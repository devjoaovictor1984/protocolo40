import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { addDays } from '@/services/calendar';
import {
  calcularMetas,
  idadeEm,
  objetivoCalorico,
  type Metas,
  type Sexo,
} from '@/services/health';
import type { ProfileRow } from '@/types/database';

/**
 * Dados da tela de saúde.
 *
 * O que o app já sabe entra sozinho: peso do último registro, altura e
 * nascimento do perfil, frequência de treino do histórico e os minutos
 * treinados hoje. A pessoa não deveria ter que responder de novo o que já
 * respondeu — nem estimar "quanto você se exercita por semana" quando o
 * aplicativo tem o número exato.
 */

export type PainelSaude = {
  metas: Metas;
  pesoKg: number | null;
  pesoEm: string | null;
  alturaCm: number | null;
  diasDeTreinoPorSemana: number;
  minutosDeTreinoHoje: number;
  aguaMl: number;
  /** o que falta preencher para os números existirem */
  faltando: ('peso' | 'altura' | 'nascimento' | 'sexo')[];
};

const JANELA_SEMANAS = 4;

export async function painelDeSaude(
  profile: ProfileRow,
  hoje: string,
): Promise<PainelSaude> {
  const supabase = await createClient();
  const desde = addDays(hoje, -JANELA_SEMANAS * 7);

  const [{ data: pesos }, { data: treinos }, { data: agua }] = await Promise.all([
    supabase
      .from('body_measurements')
      .select('weight_kg, measured_on')
      .eq('user_id', profile.id)
      .not('weight_kg', 'is', null)
      .is('deleted_at', null)
      .order('measured_on', { ascending: false })
      .limit(1),
    supabase
      .from('workouts')
      .select('workout_date, duration_seconds')
      .eq('user_id', profile.id)
      .is('deleted_at', null)
      .gte('workout_date', desde),
    supabase
      .from('water_logs')
      .select('ml')
      .eq('user_id', profile.id)
      .eq('day', hoje)
      .maybeSingle(),
  ]);

  const ultimoPeso = pesos?.[0] ?? null;

  const diasDistintos = new Set((treinos ?? []).map((linha) => linha.workout_date));
  const diasDeTreinoPorSemana = diasDistintos.size / JANELA_SEMANAS;

  const minutosDeTreinoHoje = Math.round(
    (treinos ?? [])
      .filter((linha) => linha.workout_date === hoje)
      .reduce((soma, linha) => soma + linha.duration_seconds, 0) / 60,
  );

  const idade = profile.birth_date ? idadeEm(profile.birth_date, hoje) : null;

  const metas = calcularMetas({
    pesoKg: ultimoPeso?.weight_kg ?? null,
    alturaCm: profile.height_cm,
    idade,
    sexo: profile.biological_sex as Sexo,
    objetivo: objetivoCalorico(profile.goal),
    diasDeTreinoPorSemana,
    minutosDeTreinoHoje,
  });

  const faltando: PainelSaude['faltando'] = [];
  if (ultimoPeso?.weight_kg == null) faltando.push('peso');
  if (profile.height_cm === null) faltando.push('altura');
  if (idade === null) faltando.push('nascimento');
  if (profile.biological_sex === 'nao_informado') faltando.push('sexo');

  return {
    metas,
    pesoKg: ultimoPeso?.weight_kg ?? null,
    pesoEm: ultimoPeso?.measured_on ?? null,
    alturaCm: profile.height_cm,
    diasDeTreinoPorSemana,
    minutosDeTreinoHoje,
    aguaMl: agua?.ml ?? 0,
    faltando,
  };
}
