import { NextResponse, type NextRequest } from 'next/server';

import { getUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { todayIn } from '@/services/calendar';
import {
  COLUNAS_AGUA,
  COLUNAS_MEDIDAS,
  COLUNAS_RECORDES,
  COLUNAS_TREINOS,
  ehTipoValido,
  linhasDeTreino,
  nomeDoArquivo,
  paraCsv,
  type AguaExportada,
  type MedidaExportada,
  type RecordeExportado,
  type TipoDeExportacao,
  type TreinoExportado,
} from '@/services/export';

/**
 * Baixar os próprios dados.
 *
 * Síncrono de propósito: os volumes aqui são de uma pessoa treinando por anos,
 * não de um data warehouse — alguns milhares de linhas. Uma fila com worker,
 * e-mail e link temporário seria mais infraestrutura do que o problema pede, e
 * transformaria "quero meus dados" em "espere um e-mail".
 *
 * Quem autoriza é a RLS: todas as consultas usam o cliente da sessão e filtram
 * por `user_id`. O filtro é conveniência de consulta; a garantia é a policy.
 *
 * `/api` já está fora do que o service worker guarda (ver
 * `lib/offline/cache-policy.ts`), e o `no-store` repete a instrução para
 * qualquer proxy no caminho: isto é o histórico de corpo de alguém.
 */

export const dynamic = 'force-dynamic';

type LinhaDeExercicio = {
  sets: number | null;
  repetitions: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  weight_kg: number | null;
  notes: string | null;
  order_index: number;
  exercises: { name: string } | null;
};

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ erro: 'sem sessão' }, { status: 401 });

  const tipoBruto = request.nextUrl.searchParams.get('tipo') ?? 'tudo';
  const formato = request.nextUrl.searchParams.get('formato') === 'json' ? 'json' : 'csv';

  if (!ehTipoValido(tipoBruto)) {
    return NextResponse.json({ erro: 'tipo de exportação desconhecido' }, { status: 400 });
  }

  const tipo: TipoDeExportacao = tipoBruto;

  // "tudo" só faz sentido em JSON: quatro assuntos diferentes não cabem numa
  // planilha só sem inventar colunas vazias para três deles.
  if (tipo === 'tudo' && formato === 'csv') {
    return NextResponse.json(
      { erro: 'o pacote completo sai em JSON; escolha um assunto para baixar em CSV' },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const { data: perfil } = await supabase
    .from('profiles')
    .select('username, full_name, timezone, height_cm, birth_date, protocol_started_on')
    .eq('id', user.id)
    .maybeSingle();

  const hoje = todayIn(perfil?.timezone ?? 'America/Sao_Paulo');

  async function lerTreinos(): Promise<TreinoExportado[]> {
    const { data } = await supabase
      .from('workouts')
      // string literal inteira, sem concatenar: o tipo do select é inferido do
      // texto, e um `+` no meio faz o cliente perder a forma da linha
      .select(
        'workout_date, title, duration_seconds, rounds, effort, location, notes, workout_exercises(sets, repetitions, duration_seconds, distance_meters, weight_kg, notes, order_index, exercises(name))',
      )
      .eq('user_id', user!.id)
      .is('deleted_at', null)
      .order('workout_date', { ascending: true });

    return (data ?? []).map((linha) => {
      const exercicios = (linha.workout_exercises ?? []) as unknown as LinhaDeExercicio[];

      return {
        workout_date: linha.workout_date,
        title: linha.title,
        duration_seconds: linha.duration_seconds,
        rounds: linha.rounds,
        effort: linha.effort,
        location: linha.location,
        notes: linha.notes,
        exercicios: [...exercicios]
          .sort((a, b) => a.order_index - b.order_index)
          .map((item) => ({
            nome: item.exercises?.name ?? null,
            sets: item.sets,
            repetitions: item.repetitions,
            duration_seconds: item.duration_seconds,
            distance_meters: item.distance_meters,
            weight_kg: item.weight_kg,
            notes: item.notes,
          })),
      };
    });
  }

  async function lerMedidas(): Promise<MedidaExportada[]> {
    const { data } = await supabase
      .from('body_measurements')
      .select(
        'measured_on, weight_kg, waist_cm, chest_cm, arm_cm, hip_cm, thigh_cm, body_fat_pct, notes',
      )
      .eq('user_id', user!.id)
      .is('deleted_at', null)
      .order('measured_on', { ascending: true });

    return (data ?? []) as MedidaExportada[];
  }

  async function lerAgua(): Promise<AguaExportada[]> {
    const { data } = await supabase
      .from('water_logs')
      .select('day, ml')
      .eq('user_id', user!.id)
      .order('day', { ascending: true });

    return (data ?? []) as AguaExportada[];
  }

  async function lerRecordes(): Promise<RecordeExportado[]> {
    const { data } = await supabase
      .from('personal_records')
      .select('metric, value, unit, achieved_on, exercises(name)')
      .eq('user_id', user!.id)
      .order('achieved_on', { ascending: true });

    return (data ?? []).map((linha) => {
      const exercicio = linha.exercises as unknown as { name: string } | null;
      return {
        exercicio: exercicio?.name ?? null,
        metric: linha.metric,
        value: Number(linha.value),
        unit: linha.unit,
        achieved_on: linha.achieved_on,
      };
    });
  }

  const nome = nomeDoArquivo(tipo, perfil?.username ?? 'p20x', hoje, formato);

  if (formato === 'json') {
    const conteudo =
      tipo === 'tudo'
        ? await pacoteCompleto()
        : { gerado_em: new Date().toISOString(), [tipo]: await porTipo(tipo) };

    return arquivo(JSON.stringify(conteudo, null, 2), 'application/json; charset=utf-8', nome);
  }

  const csv = await csvDe(tipo);
  return arquivo(csv, 'text/csv; charset=utf-8', nome);

  async function porTipo(qual: Exclude<TipoDeExportacao, 'tudo'>) {
    if (qual === 'treinos') return lerTreinos();
    if (qual === 'medidas') return lerMedidas();
    if (qual === 'agua') return lerAgua();
    return lerRecordes();
  }

  async function csvDe(qual: TipoDeExportacao): Promise<string> {
    if (qual === 'treinos') return paraCsv(COLUNAS_TREINOS, linhasDeTreino(await lerTreinos()));
    if (qual === 'medidas') return paraCsv(COLUNAS_MEDIDAS, await lerMedidas());
    if (qual === 'agua') return paraCsv(COLUNAS_AGUA, await lerAgua());
    return paraCsv(COLUNAS_RECORDES, await lerRecordes());
  }

  /**
   * O pacote de portabilidade.
   *
   * Leva também descansos e metas — o que não aparece em nenhum CSV — porque a
   * promessa aqui é "todos os seus dados", e não "os dados que couberam numa
   * planilha".
   */
  async function pacoteCompleto() {
    const [treinos, medidas, agua, recordes, descansos, metas] = await Promise.all([
      lerTreinos(),
      lerMedidas(),
      lerAgua(),
      lerRecordes(),
      supabase
        .from('rest_days')
        .select('day, note')
        .eq('user_id', user!.id)
        .order('day', { ascending: true }),
      supabase
        .from('weight_goals')
        .select('target_kg, start_kg, started_on, achieved_on')
        .eq('user_id', user!.id)
        .is('deleted_at', null)
        .order('started_on', { ascending: true }),
    ]);

    return {
      gerado_em: new Date().toISOString(),
      aplicativo: 'P20X',
      perfil: perfil ?? null,
      treinos,
      medidas,
      agua,
      recordes,
      descansos: descansos.data ?? [],
      metas_de_peso: metas.data ?? [],
    };
  }
}

function arquivo(conteudo: string, tipo: string, nome: string): NextResponse {
  return new NextResponse(conteudo, {
    headers: {
      'Content-Type': tipo,
      // `filename*` em UTF-8 para nome de usuário com acento não virar mojibake
      'Content-Disposition': `attachment; filename="${nome}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      'Cache-Control': 'no-store, private',
    },
  });
}
