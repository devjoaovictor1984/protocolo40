import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { MetaDePeso } from '@/services/goals';
import type { WeightGoalRow } from '@/types/database';

/**
 * A meta de peso, do lado do servidor.
 *
 * A meta é dado de perfil, não de treino: muda uma vez por trimestre, cabe numa
 * linha e não precisa de fila offline. Por isso ela é lida no servidor e
 * desce como prop, enquanto o peso continua vindo do IndexedDB — que é onde as
 * pesagens são gravadas mesmo sem rede.
 */

/** A meta em andamento, se houver. Uma por pessoa, garantido por índice parcial. */
export async function metaAtiva(userId: string): Promise<WeightGoalRow | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('weight_goals')
    .select('*')
    .eq('user_id', userId)
    .is('achieved_on', null)
    .is('deleted_at', null)
    .maybeSingle();

  return data ?? null;
}

/**
 * A meta ativa já na forma que `services/goals.ts` espera.
 *
 * O `Number()` não é decoração: `numeric` do Postgres chega como string no
 * cliente JS, e uma comparação de string com número decidiria a direção da
 * meta errado ("9" > "72").
 */
export async function metaParaTela(userId: string): Promise<MetaDePeso | null> {
  const linha = await metaAtiva(userId);
  if (!linha) return null;

  return {
    alvoKg: Number(linha.target_kg),
    inicioKg: Number(linha.start_kg),
    inicioEm: linha.started_on,
    alcancadaEm: linha.achieved_on,
  };
}

/** Metas já concluídas, da mais recente para a mais antiga. */
export async function metasConcluidas(userId: string, limite = 5): Promise<WeightGoalRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('weight_goals')
    .select('*')
    .eq('user_id', userId)
    .not('achieved_on', 'is', null)
    .is('deleted_at', null)
    .order('achieved_on', { ascending: false })
    .limit(limite);

  return data ?? [];
}

/**
 * O peso mais recente registrado.
 *
 * Vira o `start_kg` da meta nova. Uma única pesagem, e não a tendência: no
 * momento em que a meta nasce pode não haver série nenhuma para suavizar, e um
 * ponto de partida que existe vale mais que um que ainda não dá para calcular.
 */
export async function pesoMaisRecente(
  userId: string,
): Promise<{ kg: number; em: string } | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('body_measurements')
    .select('weight_kg, measured_on')
    .eq('user_id', userId)
    .not('weight_kg', 'is', null)
    .is('deleted_at', null)
    .order('measured_on', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.weight_kg) return null;
  return { kg: Number(data.weight_kg), em: data.measured_on };
}
