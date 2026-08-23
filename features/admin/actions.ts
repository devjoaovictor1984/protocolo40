'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Ações da administração.
 *
 * Todas passam por `requireAdmin()`: a policy do banco já recusaria, mas uma
 * ação que falha em silêncio é pior de diagnosticar do que uma que nem começa.
 */

export async function alternarAdmin(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const virar = formData.get('valor') === '1';

  // tirar o próprio acesso deixaria a área sem dono
  if (!id || id === user.id) return;

  const supabase = await createClient();
  await supabase.from('profiles').update({ is_admin: virar }).eq('id', id);

  revalidatePath('/admin/usuarios');
  revalidatePath(`/admin/usuarios/${id}`);
}

/**
 * Exclusão de conta.
 *
 * Apagar em `auth.users` derruba o perfil e tudo que pende dele por cascade —
 * é irreversível e por isso passa pelo Admin API, nunca por uma policy.
 */
export async function apagarUsuario(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();

  const id = String(formData.get('id') ?? '');
  if (!id || id === user.id) return;

  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(id);

  revalidatePath('/admin/usuarios');
}
