'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { erroDaMarcacao } from '@/services/challenges';

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

  /*
   * Entrar duas vezes não é erro, e `ignoreDuplicates` é o que faz isso ser
   * verdade. Sem ele o upsert vira `on conflict do update`, e aí o Postgres
   * passa a exigir a policy de UPDATE da tabela — que é `conclusao admin`,
   * porque ninguém marca a própria conclusão. O segundo toque voltava
   * `42501 new row violates row-level security policy (USING expression)`, e
   * quem já estava inscrito lia "não conseguimos te inscrever".
   *
   * Com `do nothing` só a policy de INSERT é consultada, e `joined_at` e
   * `completed_at` de quem já entrou ficam intactos.
   */
  const { error } = await supabase
    .from('challenge_participants')
    .upsert(
      { challenge_id: desafio.id, user_id: user.id },
      { onConflict: 'challenge_id,user_id', ignoreDuplicates: true },
    );

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
 * Marcar (ou desmarcar) um dia num desafio de alimentação.
 *
 * Toda regra — janela, inscrição, hoje-ou-ontem no fuso da pessoa — está em
 * `marcar_dia_no_desafio`. Aqui só se traduz o código de volta em frase.
 *
 * Depois de marcar, confere a conclusão: o dia que bate a meta é o momento
 * certo da insígnia cair, e não a próxima vez que a pessoa abrir a tela.
 */
export async function marcarDia(slug: string, dia: string, feito: boolean): Promise<string | null> {
  await requireUser();
  if (!slug || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return 'Dia inválido.';

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('marcar_dia_no_desafio', {
    p_slug: slug,
    p_day: dia,
    p_feito: feito,
  });

  const mensagem = erroDaMarcacao(error ? 'erro' : (data ?? 'erro'));
  if (mensagem) return mensagem;

  if (feito) await supabase.rpc('concluir_desafio', { p_slug: slug });

  revalidatePath('/desafios');
  revalidatePath(`/desafios/${slug}`);
  revalidatePath('/hoje');

  return null;
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
