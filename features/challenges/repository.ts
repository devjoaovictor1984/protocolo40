import 'server-only';

import { getUser, requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { desafioEmDestaque as escolherDestaque } from '@/services/challenges';
import type { ChallengeRankRow, ChallengeRow } from '@/types/database';

/**
 * Desafios.
 *
 * Como na comunidade, este módulo só pergunta — quem decide o que pode ser
 * visto é a RLS, e o ranking passa por uma função do banco porque precisa
 * contar treino de outra pessoa, coisa que a policy de `workouts` esconde (e
 * deve esconder).
 *
 * Nenhuma contagem de progresso é lida de coluna: tudo sai dos treinos que já
 * estão gravados. Um desafio nunca fica com número errado porque não existe
 * número guardado para ficar errado.
 */

export type DesafioResumo = ChallengeRow & {
  participantes: number;
  participando: boolean;
};

export type DesafioCompleto = DesafioResumo & {
  meusDias: string[];
  ranking: ChallengeRankRow[];
};

/**
 * Os meus dias em cada desafio ativo, prontos para desenhar a barra.
 *
 * Uma consulta para a lista inteira. Uma por desafio seria uma ida ao banco por
 * linha da tela, e o número de idas cresceria junto com o número de desafios.
 */
export async function meusDiasPorDesafio(): Promise<Map<string, string[]>> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('meus_dias_nos_desafios');

  const porDesafio = new Map<string, string[]>();

  for (const linha of data ?? []) {
    const atual = porDesafio.get(linha.challenge_id) ?? [];
    atual.push(linha.dia);
    porDesafio.set(linha.challenge_id, atual);
  }

  return porDesafio;
}

/** Todos os desafios ativos, do mais recente para o mais antigo. */
export async function desafiosAtivos(): Promise<DesafioResumo[]> {
  const supabase = await createClient();
  const user = await getUser();

  /*
   * O `eq('user_id')` não é redundante com a RLS — é o que faz a consulta estar
   * certa. A policy de `challenge_participants` é `using (true)` de propósito,
   * porque é dela que sai o ranking; sem o filtro, a consulta devolve a
   * inscrição de todo mundo e basta uma pessoa entrar para o app achar que
   * todos entraram. Foi o que aconteceu.
   */
  const [{ data: desafios }, { data: contagens }, { data: minhas }] = await Promise.all([
    supabase
      .from('challenges')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: false })
      .order('starts_on', { ascending: false }),
    supabase.rpc('participantes_por_desafio'),
    user
      ? supabase.from('challenge_participants').select('challenge_id').eq('user_id', user.id)
      : Promise.resolve({ data: [] as { challenge_id: string }[] }),
  ]);

  const totais = new Map((contagens ?? []).map((linha) => [linha.challenge_id, linha.total]));
  const meus = new Set((minhas ?? []).map((linha) => linha.challenge_id));

  return (desafios ?? []).map((desafio) => ({
    ...desafio,
    participantes: totais.get(desafio.id) ?? 0,
    participando: meus.has(desafio.id),
  }));
}

/** O desafio em destaque na tela de Hoje. A regra mora em `services/challenges`. */
export async function desafioEmDestaque(hoje: string): Promise<DesafioResumo | null> {
  return escolherDestaque(await desafiosAtivos(), hoje);
}

/** Um desafio com o meu progresso e o ranking. */
export async function desafioPorSlug(slug: string): Promise<DesafioCompleto | null> {
  const supabase = await createClient();
  const user = await requireUser();

  const { data: desafio } = await supabase
    .from('challenges')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (!desafio) return null;

  const [{ data: dias }, { data: ranking }, { data: contagens }, { data: minhas }] =
    await Promise.all([
      supabase.rpc('meus_dias_no_desafio', { p_slug: slug }),
      supabase.rpc('ranking_do_desafio', { p_slug: slug, p_limite: 50 }),
      supabase.rpc('participantes_por_desafio'),
      // a minha inscrição, e só a minha: sem o filtro por usuário a consulta
      // devolve a de qualquer participante e o botão nasce dizendo "Sair"
      supabase
        .from('challenge_participants')
        .select('challenge_id')
        .eq('challenge_id', desafio.id)
        .eq('user_id', user.id),
    ]);

  const totais = new Map((contagens ?? []).map((linha) => [linha.challenge_id, linha.total]));

  return {
    ...desafio,
    participantes: totais.get(desafio.id) ?? 0,
    participando: (minhas ?? []).length > 0,
    meusDias: (dias ?? []) as unknown as string[],
    ranking: (ranking ?? []) as ChallengeRankRow[],
  };
}

/** Para a administração: inclui os desligados. */
export async function todosOsDesafios(): Promise<(ChallengeRow & { participantes: number })[]> {
  const supabase = await createClient();

  const [{ data: desafios }, { data: contagens }] = await Promise.all([
    supabase.from('challenges').select('*').order('starts_on', { ascending: false }),
    supabase.rpc('participantes_por_desafio'),
  ]);

  const totais = new Map((contagens ?? []).map((linha) => [linha.challenge_id, linha.total]));

  return (desafios ?? []).map((desafio) => ({
    ...desafio,
    participantes: totais.get(desafio.id) ?? 0,
  }));
}
