import 'server-only';

import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import type { ProfileRow, UserSettingsRow } from '@/types/database';

/** Usuário da sessão, ou null. Nunca lança. */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Exige sessão. O middleware já redireciona antes de chegar aqui; este guard é
 * a segunda barreira, para Server Actions e Route Handlers.
 */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

export type SessionContext = {
  user: User;
  profile: ProfileRow;
  settings: UserSettingsRow;
};

/**
 * Sessão completa: usuário, perfil e configurações.
 *
 * Se o perfil ainda não existe — janela rara entre o INSERT em auth.users e o
 * trigger — trata como sessão inválida em vez de renderizar meio quebrado.
 */
export async function requireSession(): Promise<SessionContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
  ]);

  if (!profile || !settings) {
    redirect('/login?erro=perfil-nao-encontrado');
  }

  return { user, profile, settings };
}

/** Onboarding é opcional, mas o primeiro acesso passa por ele. */
export function needsOnboarding(profile: ProfileRow): boolean {
  return profile.onboarding_completed_at === null;
}
