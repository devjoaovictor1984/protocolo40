import type { BrowserContext } from '@playwright/test';

/**
 * Ferramentas para testar sessão.
 *
 * Montar o cookie na mão é o único jeito de testar o que acontece com um token
 * vencido sem esperar uma hora por teste.
 */

export const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const REF = process.env.SUPABASE_PROJECT_REF;

export const temCredenciais =
  Boolean(SUPABASE && ANON && SECRET && REF) && !SUPABASE!.includes('placeholder');

export const admin = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE}${path}`, {
    ...init,
    headers: {
      apikey: SECRET!,
      Authorization: `Bearer ${SECRET!}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

export const COOKIE = () => `sb-${REF}-auth-token`;

/** O @supabase/ssr parte o cookie em .0, .1… quando passa deste tamanho. */
const LIMITE = 3180;

/** Grava a sessão nos cookies como o `@supabase/ssr` faria. */
export async function gravarSessao(
  context: BrowserContext,
  baseURL: string,
  session: unknown,
): Promise<void> {
  const codificada = `base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;
  const { hostname } = new URL(baseURL);

  await context.clearCookies();
  await context.addCookies(
    codificada.length <= LIMITE
      ? [{ name: COOKIE(), value: codificada, domain: hostname, path: '/' }]
      : Array.from({ length: Math.ceil(codificada.length / LIMITE) }, (_, i) => ({
          name: `${COOKIE()}.${i}`,
          value: codificada.slice(i * LIMITE, (i + 1) * LIMITE),
          domain: hostname,
          path: '/',
        })),
  );
}

/** Lê de volta a sessão que está no navegador, remontando os pedaços. */
export async function lerSessao(
  context: BrowserContext,
  baseURL: string,
): Promise<{ access_token: string; refresh_token: string; expires_at: number } | null> {
  const cookies = await context.cookies(baseURL);
  const bruto = cookies
    .filter((c) => c.name.startsWith(COOKIE()))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => c.value)
    .join('');

  if (!bruto) return null;
  return JSON.parse(Buffer.from(bruto.replace(/^base64-/, ''), 'base64').toString('utf8'));
}

/** Cria um usuário pronto para usar o app e devolve uma sessão de verdade. */
export async function criarSessao(): Promise<{
  id: string;
  session: { access_token: string; refresh_token: string; expires_at: number };
}> {
  const email = `sess-${crypto.randomUUID()}@p20x.test`;
  const password = `Teste-${crypto.randomUUID()}`;

  const { id } = await (
    await admin('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, email_confirm: true }),
    })
  ).json();

  await admin(`/rest/v1/profiles?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ onboarding_completed_at: new Date().toISOString(), full_name: 'João' }),
  });

  const session = await (
    await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  ).json();

  return { id, session };
}

/** Uma sessão em que o token de acesso já venceu — quem volta no dia seguinte. */
export const vencida = <T extends object>(session: T) => ({
  ...session,
  expires_at: Math.floor(Date.now() / 1000) - 60,
  expires_in: 0,
});

/** Apaga a conta criada para o teste. */
export const apagarUsuario = (id: string) =>
  admin(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });
