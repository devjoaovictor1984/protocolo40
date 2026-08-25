'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

/**
 * Entrar e sair de um desafio.
 *
 * Nenhuma checagem de permissão mora aqui: as policies de
 * `challenge_participants` já exigem que a linha seja da própria pessoa.
 * Repetir a regra no TypeScript criaria uma segunda fonte de verdade — e um
 * dia ela discordaria da primeira.
 */

export async function entrarNoDesafio(formData: FormData): Promise<void> {
  const user = await requireUser();
  const slug = String(formData.get('slug') ?? '');
  if (!slug) return;

  const supabase = await createClient();

  const { data: desafio } = await supabase
    .from('challenges')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (!desafio) return;

  // entrar duas vezes não é erro: a chave primária resolve, e a tela não
  // precisa saber se o toque anterior chegou
  await supabase
    .from('challenge_participants')
    .upsert({ challenge_id: desafio.id, user_id: user.id }, { onConflict: 'challenge_id,user_id' });

  revalidatePath('/desafios');
  revalidatePath(`/desafios/${slug}`);
  revalidatePath('/hoje');
}

export async function sairDoDesafio(formData: FormData): Promise<void> {
  const user = await requireUser();
  const slug = String(formData.get('slug') ?? '');
  if (!slug) return;

  const supabase = await createClient();

  const { data: desafio } = await supabase
    .from('challenges')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (!desafio) return;

  await supabase
    .from('challenge_participants')
    .delete()
    .eq('challenge_id', desafio.id)
    .eq('user_id', user.id);

  revalidatePath('/desafios');
  revalidatePath(`/desafios/${slug}`);
  revalidatePath('/hoje');
}

/**
 * Fecha o desafio quando a meta já foi atingida.
 *
 * Chamada ao abrir a tela, e não por um botão: a pessoa não deveria precisar
 * pedir a insígnia que já conquistou. A função do banco é quem confere os dias
 * e é idempotente — chamar de novo depois de concluído não faz nada.
 */
export async function conferirConclusao(slug: string): Promise<boolean> {
  await requireUser();

  const supabase = await createClient();
  const { data } = await supabase.rpc('concluir_desafio', { p_slug: slug });

  return data === true;
}
