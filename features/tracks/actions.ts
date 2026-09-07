'use server';

import { revalidatePath } from 'next/cache';

import { requireSession, requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { todayIn } from '@/services/calendar';

/**
 * Entrar e sair de uma trilha.
 *
 * Nenhuma checagem de permissão mora aqui: as policies de `track_enrollments`
 * já exigem que a linha seja da própria pessoa. Repetir a regra no TypeScript
 * criaria uma segunda fonte de verdade — e um dia ela discordaria da primeira.
 *
 * Só tipo e função assíncrona saem de um arquivo `'use server'`: cada export
 * vira um endpoint, e uma constante exportada aqui derruba o build inteiro com
 * "can only export async functions".
 */

export type EstadoDaMatricula = { erro: string | null };

const semErro: EstadoDaMatricula = { erro: null };

/**
 * Entrar na trilha.
 *
 * `started_on` é o dia da pessoa, não o do servidor — é ele que separa "treino
 * que conta" de "treino que já tinha acontecido", e quem entra 23h50 em Manaus
 * entra hoje, não amanhã.
 *
 * Devolve estado em vez de `void` pela mesma razão do desafio: um botão que
 * falha em silêncio deixa a pessoa sem saber se o toque valeu.
 */
export async function entrarNaTrilha(
  _anterior: EstadoDaMatricula,
  formData: FormData,
): Promise<EstadoDaMatricula> {
  const { user, profile } = await requireSession();
  const slug = String(formData.get('slug') ?? '');
  if (!slug) return { erro: 'Trilha não identificada.' };

  const supabase = await createClient();

  const { data: trilha } = await supabase
    .from('tracks')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (!trilha) return { erro: 'Esta trilha não está mais disponível.' };

  /*
   * `ignoreDuplicates` pelo mesmo motivo do desafio: sem ele o upsert vira
   * `on conflict do update` e o Postgres passa a exigir a policy de UPDATE, que
   * aqui é `conclusao admin` — o segundo toque voltaria erro de RLS para quem
   * já estava dentro. Com `do nothing`, entrar duas vezes não é erro e
   * `started_on` de quem já entrou fica intacto: reentrar não zera a trilha.
   */
  const { error } = await supabase
    .from('track_enrollments')
    .upsert(
      { track_id: trilha.id, user_id: user.id, started_on: todayIn(profile.timezone) },
      { onConflict: 'track_id,user_id', ignoreDuplicates: true },
    );

  if (error) {
    return { erro: 'Não conseguimos abrir a trilha agora. Tente de novo em instantes.' };
  }

  revalidatePath('/trilha');
  revalidatePath(`/trilha/${slug}`);
  revalidatePath('/hoje');

  return semErro;
}

/**
 * Sair da trilha.
 *
 * Apaga a matrícula, e com ela o `started_on`. Quem voltar depois recomeça da
 * sessão 1 — que é o certo: a trilha conta dias desde a entrada, e uma entrada
 * antiga guardada faria alguém voltar direto para a sessão 20 sem ter feito as
 * dezenove. Os treinos, esses, continuam todos no histórico.
 */
export async function sairDaTrilha(
  _anterior: EstadoDaMatricula,
  formData: FormData,
): Promise<EstadoDaMatricula> {
  const user = await requireUser();
  const slug = String(formData.get('slug') ?? '');
  if (!slug) return { erro: 'Trilha não identificada.' };

  const supabase = await createClient();

  const { data: trilha } = await supabase.from('tracks').select('id').eq('slug', slug).maybeSingle();
  if (!trilha) return { erro: 'Trilha não encontrada.' };

  const { error } = await supabase
    .from('track_enrollments')
    .delete()
    .eq('track_id', trilha.id)
    .eq('user_id', user.id);

  if (error) return { erro: 'Não conseguimos sair agora. Tente de novo.' };

  revalidatePath('/trilha');
  revalidatePath(`/trilha/${slug}`);
  revalidatePath('/hoje');

  return semErro;
}

/**
 * Fecha a trilha quando as sessões acabaram.
 *
 * Chamada ao abrir a tela, e não por um botão: ninguém deveria precisar pedir a
 * insígnia que já conquistou. A função do banco confere os dias e é idempotente
 * — chamar de novo depois de concluída não faz nada.
 */
export async function conferirConclusaoDaTrilha(slug: string): Promise<boolean> {
  await requireUser();

  const supabase = await createClient();
  const { data } = await supabase.rpc('concluir_trilha', { p_slug: slug });

  return data === true;
}
