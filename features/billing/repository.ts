import 'server-only';

import { cache } from 'react';

import { cobrancaAtiva } from '@/lib/billing/config';
import { createClient } from '@/lib/supabase/server';
import type { PlanRow, Recurso, SubscriptionRow } from '@/types/database';

/**
 * Planos e assinatura.
 *
 * `temAcesso` chama a função do banco em vez de decidir aqui: se a regra
 * morasse no TypeScript, a mesma pergunta teria duas respostas possíveis — a
 * do servidor e a da RLS — e um dia elas divergiriam. `cache()` do React evita
 * repetir a chamada quando layout e página perguntam a mesma coisa.
 */

export const temAcesso = cache(async (recurso: Recurso): Promise<boolean> => {
  // enquanto o produto é inteiro de graça, não há o que consultar
  if (!cobrancaAtiva) return true;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('tem_acesso', { p_recurso: recurso });

  // na dúvida, não libera
  return error ? false : Boolean(data);
});

export type AssinaturaAtual = SubscriptionRow & { plano: PlanRow | null };

export const assinaturaAtual = cache(async (userId: string): Promise<AssinaturaAtual | null> => {
  const supabase = await createClient();

  const { data } = await supabase
    .from('subscriptions')
    .select('*, plans(*)')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return null;

  const { plans, ...assinatura } = data as unknown as SubscriptionRow & { plans: PlanRow | null };
  return { ...assinatura, plano: plans ?? null };
});

export async function planosAtivos(): Promise<PlanRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  return (data ?? []) as PlanRow[];
}

export async function planoPorSlug(slug: string): Promise<PlanRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('plans').select('*').eq('slug', slug).maybeSingle();
  return (data as PlanRow | null) ?? null;
}

/** Preço formatado em reais, sem depender do locale do servidor. */
export function precoEmReais(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}
