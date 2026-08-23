import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { BadgeRow, UserBadgeRow } from '@/types/database';

/**
 * Conquistas.
 *
 * Quem concede é o banco, por gatilho — a mesma regra do recorde. Aqui só se lê,
 * e o catálogo inteiro vem junto de propósito: ver a próxima insígnia bloqueada
 * é metade do motivo de a conquista existir.
 */

export type Conquista = BadgeRow & {
  earned: boolean;
  earnedOn: string | null;
  value: number | null;
};

export type Conquistas = {
  todas: Conquista[];
  conquistadas: Conquista[];
  proxima: Conquista | null;
};

export async function conquistasDoUsuario(userId: string): Promise<Conquistas> {
  const supabase = await createClient();

  const [{ data: catalogo }, { data: minhas }] = await Promise.all([
    supabase.from('badges').select('*').order('sort_order'),
    supabase.from('user_badges').select('*').eq('user_id', userId),
  ]);

  const ganhas = new Map(
    ((minhas ?? []) as UserBadgeRow[]).map((linha) => [linha.badge_slug, linha]),
  );

  const todas: Conquista[] = ((catalogo ?? []) as BadgeRow[]).map((badge) => {
    const ganha = ganhas.get(badge.slug);
    return {
      ...badge,
      earned: Boolean(ganha),
      earnedOn: ganha?.earned_on ?? null,
      value: ganha?.value ?? null,
    };
  });

  const conquistadas = todas
    .filter((badge) => badge.earned)
    .sort(
      (a, b) => (b.earnedOn ?? '').localeCompare(a.earnedOn ?? '') || b.sort_order - a.sort_order,
    );

  // a próxima é a de menor exigência entre as que faltam na mesma escada
  const proxima =
    todas.find((badge) => !badge.earned && badge.metric === 'dias') ??
    todas.find((badge) => !badge.earned && badge.metric !== 'fundador') ??
    null;

  return { todas, conquistadas, proxima };
}

/** Quanto falta para a próxima, para a barra de progresso. */
export async function progressoAtual(userId: string): Promise<Record<string, number>> {
  const supabase = await createClient();

  const { data: dias } = await supabase
    .from('workouts')
    .select('workout_date')
    .eq('user_id', userId)
    .is('deleted_at', null);

  return {
    dias: new Set((dias ?? []).map((linha) => linha.workout_date)).size,
  };
}
