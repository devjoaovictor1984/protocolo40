import { expect, test, type BrowserContext } from '@playwright/test';

/**
 * Trazer o histórico junto.
 *
 * Quem já treinava antes de instalar precisa registrar os dias de trás — senão
 * a sequência começa do zero, que é justamente o que o produto promete não
 * fazer com você.
 */

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REF = process.env.SUPABASE_PROJECT_REF;

const configured = Boolean(SUPABASE && ANON && SECRET && REF) && !SUPABASE!.includes('placeholder');

const admin = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE}${path}`, {
    ...init,
    headers: {
      apikey: SECRET!,
      Authorization: `Bearer ${SECRET!}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

async function signIn(context: BrowserContext, baseURL: string) {
  const email = `dias-${crypto.randomUUID()}@p20x.test`;
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

  const encoded = `base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;
  const name = `sb-${REF}-auth-token`;
  const LIMIT = 3180;
  const { hostname } = new URL(baseURL);

  await context.addCookies(
    encoded.length <= LIMIT
      ? [{ name, value: encoded, domain: hostname, path: '/' }]
      : Array.from({ length: Math.ceil(encoded.length / LIMIT) }, (_, index) => ({
          name: `${name}.${index}`,
          value: encoded.slice(index * LIMIT, (index + 1) * LIMIT),
          domain: hostname,
          path: '/',
        })),
  );

  return id as string;
}

test.describe('registrar dias anteriores', () => {
  test.skip(!configured, 'precisa das credenciais do Supabase');

  let userId = '';

  test.afterEach(async () => {
    if (userId) {
      await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
      userId = '';
    }
  });

  test('marcar 14 dias de uma vez cria a sequência', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);

    await page.goto('/treino/registrar-dias');
    await expect(page.getByRole('heading', { name: 'Registrar dias anteriores' })).toBeVisible();

    await page.getByRole('button', { name: 'últimos 14 dias' }).click();
    await expect(page.getByRole('button', { name: /REGISTRAR 14 DIAS/ })).toBeVisible();

    await page.getByRole('button', { name: /REGISTRAR 14 DIAS/ }).click();
    await page.waitForURL('**/app', { timeout: 25_000 });

    // os 14 dias chegaram ao servidor
    await expect
      .poll(
        async () => {
          const rows = await (
            await admin(`/rest/v1/workouts?user_id=eq.${userId}&select=workout_date`)
          ).json();
          return rows.length;
        },
        { timeout: 40_000, message: 'os dias não sincronizaram' },
      )
      .toBe(14);

    // e viraram sequência de verdade
    const stats = await (
      await admin(`/rest/v1/rpc/get_user_stats`, {
        method: 'POST',
        body: JSON.stringify({ p_user: userId }),
      })
    ).json();

    expect(stats[0].total_days).toBe(14);
    expect(stats[0].current_streak).toBe(14);

    await expect(page.getByText(/14 dias seguidos/)).toBeVisible({ timeout: 20_000 });
  });

  test('dias já registrados não podem ser marcados de novo', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);

    await page.goto('/treino/registrar-dias');
    await page.getByRole('button', { name: 'últimos 7 dias' }).click();
    await page.getByRole('button', { name: /REGISTRAR 7 DIAS/ }).click();
    await page.waitForURL('**/app', { timeout: 25_000 });

    // espera a fila esvaziar antes de conferir
    await expect
      .poll(
        async () => {
          const rows = await (await admin(`/rest/v1/workouts?user_id=eq.${userId}&select=id`)).json();
          return rows.length;
        },
        { timeout: 40_000 },
      )
      .toBe(7);

    // volta à tela: os mesmos dias agora aparecem como já registrados
    await page.goto('/treino/registrar-dias');
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: 'últimos 7 dias' }).click();

    await expect(page.getByRole('button', { name: /Toque nos dias/ })).toBeVisible();

    const total = await (
      await admin(`/rest/v1/workouts?user_id=eq.${userId}&select=id`)
    ).json();
    expect(total.length, 'não pode duplicar dia já registrado').toBe(7);
  });
});
