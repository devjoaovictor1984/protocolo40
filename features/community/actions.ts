'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

/**
 * Seguir e deixar de seguir.
 *
 * Nenhuma checagem de permissão acontece aqui: a policy de INSERT de
 * `followers` já exige que quem segue seja quem está logado e que a outra
 * pessoa aceite seguidores. Repetir a regra no TypeScript criaria uma segunda
 * fonte de verdade — e um dia ela discordaria da primeira.
 */

export async function seguir(formData: FormData): Promise<void> {
  const user = await requireUser();

  const alvo = String(formData.get('user_id') ?? '');
  const username = String(formData.get('username') ?? '');

  if (!alvo || alvo === user.id) return;

  const supabase = await createClient();
  await supabase.from('followers').insert({
    follower_id: user.id,
    following_id: alvo,
    // sem aprovação por enquanto: quem aceita seguidores aceita na hora
    status: 'accepted',
  });

  if (username) revalidatePath(`/u/${username}`);
  revalidatePath('/comunidade');
}

export async function deixarDeSeguir(formData: FormData): Promise<void> {
  const user = await requireUser();

  const alvo = String(formData.get('user_id') ?? '');
  const username = String(formData.get('username') ?? '');

  if (!alvo) return;

  const supabase = await createClient();
  await supabase
    .from('followers')
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', alvo);

  if (username) revalidatePath(`/u/${username}`);
  revalidatePath('/comunidade');
}

/**
 * Escolhe o par de fotos exposto no perfil.
 *
 * Duas coisas acontecem juntas, e a ordem importa: primeiro as fotos mudam de
 * visibilidade, depois o perfil aponta para elas. Se o processo parar no meio,
 * o pior caso é uma foto pública que ninguém encontra — e não um link no perfil
 * para uma foto que a policy recusa.
 */
export async function definirVitrine(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();

  const antes = String(formData.get('antes') ?? '');
  const depois = String(formData.get('depois') ?? '');

  // limpar: as fotos voltam a ser privadas e o perfil deixa de apontar
  if (!antes || !depois) {
    const { data: perfil } = await supabase
      .from('profiles')
      .select('showcase_before_id, showcase_after_id')
      .eq('id', user.id)
      .maybeSingle();

    const antigas = [perfil?.showcase_before_id, perfil?.showcase_after_id].filter(
      (id): id is string => Boolean(id),
    );

    if (antigas.length > 0) {
      await supabase
        .from('progress_photos')
        .update({ visibility: 'private' })
        .eq('user_id', user.id)
        .in('id', antigas);
    }

    await supabase
      .from('profiles')
      .update({ showcase_before_id: null, showcase_after_id: null })
      .eq('id', user.id);

    revalidatePath('/evolucao/fotos');
    return;
  }

  if (antes === depois) return;

  // o que estava exposto antes volta a ser privado
  const { data: perfil } = await supabase
    .from('profiles')
    .select('showcase_before_id, showcase_after_id, username')
    .eq('id', user.id)
    .maybeSingle();

  const antigas = [perfil?.showcase_before_id, perfil?.showcase_after_id].filter(
    (id): id is string => Boolean(id) && id !== antes && id !== depois,
  );

  if (antigas.length > 0) {
    await supabase
      .from('progress_photos')
      .update({ visibility: 'private' })
      .eq('user_id', user.id)
      .in('id', antigas);
  }

  const { error } = await supabase
    .from('progress_photos')
    .update({ visibility: 'public' })
    .eq('user_id', user.id)
    .in('id', [antes, depois]);

  if (error) return;

  await supabase
    .from('profiles')
    .update({ showcase_before_id: antes, showcase_after_id: depois })
    .eq('id', user.id);

  revalidatePath('/evolucao/fotos');
  if (perfil?.username) revalidatePath(`/u/${perfil.username}`);
}
