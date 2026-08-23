import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { dayOfYear } from '@/services/calendar';

/**
 * Mensagem do dia.
 *
 * Determinística: o dia do ano é a chave, então todo mundo lê a mesma coisa no
 * mesmo dia. Isso é de propósito — mensagem sorteada individualmente não vira
 * conversa entre duas pessoas que treinam.
 */

export type MensagemDoDia = {
  reference: string;
  verse: string;
  theme: string;
  message: string;
};

export async function mensagemDoDia(hoje: string): Promise<MensagemDoDia | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('daily_messages')
    .select('reference, verse, theme, message')
    .eq('day_of_year', dayOfYear(hoje))
    .maybeSingle();

  return data ?? null;
}
