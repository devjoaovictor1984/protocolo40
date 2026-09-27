import 'server-only';

import { getUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { Sessao } from '@/services/tracks';
import type { TrackRow } from '@/types/database';

/**
 * Trilhas.
 *
 * Como nos desafios, este módulo só pergunta — quem decide o que pode ser lido
 * é a RLS. E, como nos desafios, nenhuma contagem de progresso é lida de
 * coluna: os dias saem de `workouts`, pela função `meus_dias_na_trilha`. Uma
 * trilha nunca fica com número errado porque não existe número guardado.
 *
 * A conta de "em que sessão eu estou" não acontece aqui: ela é regra pura e
 * mora em `services/tracks`, que é onde ela pode ser testada sem banco.
 */

/** Uma sessão pronta para a tela: a da trilha, mais a ficha do circuito. */
export type SessaoDaTela = Sessao & {
  templateTitle: string;
  templateSubtitle: string | null;
  estimatedSeconds: number;
};

export type Matricula = {
  startedOn: string;
  completedAt: string | null;
};

export type TrilhaCompleta = {
  trilha: TrackRow;
  sessoes: SessaoDaTela[];
  /** Nula quando a pessoa ainda não entrou. */
  matricula: Matricula | null;
  /** Dias com treino desde a matrícula. Vazio quando não há matrícula. */
  meusDias: string[];
};

type LinhaDeSessao = {
  position: number;
  week: number;
  title: string;
  focus: Sessao['focus'];
  note: string;
  template_id: string | null;
  workout_templates: { title: string; subtitle: string | null; estimated_seconds: number } | null;
};

function paraTela(linhas: LinhaDeSessao[]): SessaoDaTela[] {
  return linhas
    .map((linha) => ({
      position: linha.position,
      week: linha.week,
      title: linha.title,
      focus: linha.focus,
      note: linha.note,
      templateId: linha.template_id,
      templateTitle: linha.workout_templates?.title ?? linha.title,
      templateSubtitle: linha.workout_templates?.subtitle ?? null,
      // descanso não tem circuito, e portanto não tem tempo
      estimatedSeconds: linha.workout_templates?.estimated_seconds ?? (linha.template_id ? 1200 : 0),
    }))
    .sort((a, b) => a.position - b.position);
}

const CAMPOS_DA_SESSAO =
  'position, week, title, focus, note, template_id, workout_templates(title, subtitle, estimated_seconds)';

/**
 * Uma trilha pelo endereço, com as sessões, a minha matrícula e os meus dias.
 *
 * As quatro consultas vão juntas porque nenhuma depende do resultado da outra —
 * e a tela não desenha nada sem as quatro.
 */
export async function trilhaPorSlug(slug: string): Promise<TrilhaCompleta | null> {
  const supabase = await createClient();
  const user = await getUser();

  const { data: trilha } = await supabase
    .from('tracks')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (!trilha) return null;

  const [{ data: sessoes }, { data: matriculas }, { data: dias }] = await Promise.all([
    supabase.from('track_sessions').select(CAMPOS_DA_SESSAO).eq('track_id', trilha.id).order('position'),
    /*
     * O `eq('user_id')` acompanha a RLS em vez de confiar só nela — a policy de
     * `track_enrollments` já limita ao dono, mas repetir o filtro é o que
     * mantém a consulta correta se um dia a política mudar de forma (foi
     * exatamente por não ter isso que a lista de desafios achou, por um tempo,
     * que todo mundo estava inscrito em tudo).
     */
    user
      ? supabase
          .from('track_enrollments')
          .select('started_on, completed_at')
          .eq('track_id', trilha.id)
          .eq('user_id', user.id)
      : Promise.resolve({ data: [] as { started_on: string; completed_at: string | null }[] }),
    user
      ? supabase.rpc('meus_dias_na_trilha', { p_slug: slug })
      : Promise.resolve({ data: [] as unknown as string[] }),
  ]);

  const matricula = matriculas?.[0] ?? null;

  return {
    trilha,
    sessoes: paraTela((sessoes ?? []) as unknown as LinhaDeSessao[]),
    matricula: matricula
      ? { startedOn: matricula.started_on, completedAt: matricula.completed_at }
      : null,
    meusDias: matricula ? ((dias ?? []) as unknown as string[]) : [],
  };
}

/**
 * A trilha em que eu estou, se houver.
 *
 * É o que a tela de Hoje precisa saber para trocar "começar treino" por "sessão
 * 5 de 28". Uma matrícula por vez na prática — a tabela permite mais de uma,
 * mas só existe uma trilha; quando houver duas, a mais recente é a que vale,
 * porque foi a última escolha deliberada da pessoa.
 */
export async function minhaTrilha(): Promise<TrilhaCompleta | null> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  const { data: matricula } = await supabase
    .from('track_enrollments')
    .select('track_id, started_on, completed_at, tracks(*)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const trilha = (matricula?.tracks ?? null) as TrackRow | null;
  if (!matricula || !trilha || !trilha.is_active) return null;

  const [{ data: sessoes }, { data: dias }] = await Promise.all([
    supabase.from('track_sessions').select(CAMPOS_DA_SESSAO).eq('track_id', trilha.id).order('position'),
    supabase.rpc('meus_dias_na_trilha', { p_slug: trilha.slug }),
  ]);

  return {
    trilha,
    sessoes: paraTela((sessoes ?? []) as unknown as LinhaDeSessao[]),
    matricula: { startedOn: matricula.started_on, completedAt: matricula.completed_at },
    meusDias: (dias ?? []) as unknown as string[],
  };
}

/**
 * A trilha que o app oferece a quem ainda não está em nenhuma.
 *
 * Uma só, e a primeira da ordem: um convite com três opções não é convite, é
 * mais uma escolha para quem já não sabia o que escolher.
 */
export async function trilhaEmDestaque(): Promise<TrackRow | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('tracks')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .limit(1)
    .maybeSingle();

  return data ?? null;
}
