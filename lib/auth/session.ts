import 'server-only';

import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import type { ProfileRow, UserSettingsRow } from '@/types/database';

/**
 * Identidade e sessão no servidor.
 *
 * Duas decisões de desempenho moram aqui.
 *
 * A primeira é `getClaims()` no lugar de `getUser()`. O segundo faz uma
 * chamada de rede ao Supabase para validar o token — cerca de 250ms, em toda
 * requisição. O primeiro verifica a assinatura localmente com as chaves
 * públicas do projeto, que são ES256, e leva zero. A garantia é a mesma que o
 * banco usa: a RLS confia no mesmo JWT, verificado do mesmo jeito.
 *
 * A segunda é o `cache()` do React. Layout e página pedem a sessão de forma
 * independente; sem ele, cada navegação repetiria a mesma consulta.
 */

export type SessionUser = {
  id: string;
  email: string | null;
};

/** Usuário da requisição, ou null. Nunca lança. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    return null;
  }

  return {
    id: data.claims.sub,
    email: typeof data.claims.email === 'string' ? data.claims.email : null,
  };
});

/**
 * Exige sessão. O proxy já redireciona antes de chegar aqui; este guard é a
 * segunda barreira, para Server Actions e Route Handlers.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

export type SessionContext = {
  user: SessionUser;
  profile: ProfileRow;
  settings: UserSettingsRow;
};

/**
 * Sessão completa: usuário, perfil e configurações numa consulta só.
 *
 * Se o perfil ainda não existe — janela rara entre o INSERT em auth.users e o
 * trigger — trata como sessão inválida em vez de renderizar meio quebrado.
 */
export const requireSession = cache(async (): Promise<SessionContext> => {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const supabase = await createClient();

  // um único round trip: o join traz as configurações junto com o perfil
  const { data } = await supabase
    .from('profiles')
    .select('*, user_settings(*)')
    .eq('id', user.id)
    .maybeSingle();

  const settings = data?.user_settings as UserSettingsRow | UserSettingsRow[] | null | undefined;
  const resolved = Array.isArray(settings) ? settings[0] : settings;

  if (!data || !resolved) {
    redirect('/login?erro=perfil-nao-encontrado');
  }

  // o join vem aninhado; o perfil segue com a forma da tabela
  const profile = { ...data } as Record<string, unknown>;
  delete profile.user_settings;

  return { user, profile: profile as unknown as ProfileRow, settings: resolved };
});

/**
 * Exige admin master.
 *
 * A RLS já recusaria a leitura de dados de terceiros, mas devolver uma tela
 * vazia para quem não é admin seria pior do que devolver 404: esconder que a
 * área existe é parte da proteção.
 */
export async function requireAdmin(): Promise<SessionContext> {
  const session = await requireSession();
  if (!session.profile.is_admin) {
    notFound();
  }
  return session;
}

/** Onboarding é opcional, mas o primeiro acesso passa por ele. */
export function needsOnboarding(profile: ProfileRow): boolean {
  return profile.onboarding_completed_at === null;
}
