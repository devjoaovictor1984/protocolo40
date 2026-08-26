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

export type EstadoDaInscricao = { erro: string | null };

/**
 * Só tipo e função saem daqui.
 *
 * Um arquivo `'use server'` exporta exclusivamente funções assíncronas — cada
 * export vira um endpoint. Uma constante aqui derruba o build inteiro com
 * "can only export async functions, found object", e o estado inicial mora
 * no componente que o usa.
 */
const semErro: EstadoDaInscricao = { erro: null };

/**
 * Entrar no desafio.
 *
 * Devolve estado, e não `void`: a versão anterior falhava em silêncio absoluto
 * — a página revalidava, o botão continuava dizendo "ENTRAR NO DESAFIO" e a
 * pessoa não tinha como saber se o toque valeu. Quem clica num botão precisa
 * saber o que aconteceu, inclusive quando não aconteceu nada.
 */
export async function entrarNoDesafio(
  _anterior: EstadoDaInscricao,
  formData: FormData,
): Promise<EstadoDaInscricao> {
  const user = await requireUser();
  const slug = String(formData.get('slug') ?? '');
  if (!slug) return { erro: 'Desafio não identificado.' };

  const supabase = await createClient();

  const { data: desafio } = await supabase
    .from('challenges')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (!desafio) return { erro: 'Este desafio não está mais aberto.' };

  // entrar duas vezes não é erro: a chave primária resolve, e a tela não
  // precisa saber se o toque anterior chegou
  const { error } = await supabase
    .from('challenge_participants')
    .upsert({ challenge_id: desafio.id, user_id: user.id }, { onConflict: 'challenge_id,user_id' });

  if (error) {
    return { erro: 'Não conseguimos te inscrever agora. Tente de novo em instantes.' };
  }

  revalidatePath('/desafios');
  revalidatePath(`/desafios/${slug}`);
  revalidatePath('/hoje');

  return semErro;
}

export async function sairDoDesafio(
  _anterior: EstadoDaInscricao,
  formData: FormData,
): Promise<EstadoDaInscricao> {
  const user = await requireUser();
  const slug = String(formData.get('slug') ?? '');
  if (!slug) return { erro: 'Desafio não identificado.' };

  const supabase = await createClient();

  const { data: desafio } = await supabase
    .from('challenges')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (!desafio) return { erro: 'Desafio não encontrado.' };

  const { error } = await supabase
    .from('challenge_participants')
    .delete()
    .eq('challenge_id', desafio.id)
    .eq('user_id', user.id);

  if (error) return { erro: 'Não conseguimos sair agora. Tente de novo.' };

  revalidatePath('/desafios');
  revalidatePath(`/desafios/${slug}`);
  revalidatePath('/hoje');

  return semErro;
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
