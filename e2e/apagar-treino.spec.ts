import { expect, test, type BrowserContext } from '@playwright/test';

/**
 * Apagar um treino.
 *
 * Existe por causa de um bug real: o treino sumia do servidor mas a cópia local
 * ficava para sempre, então ele continuava na tela. Quem apagou tem que parar
 * de ver o registro — na hora, mesmo antes de a exclusão subir.
 */

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REF = process.env.SUPABASE_PROJECT_REF;

const configured = Boolean(SUPABASE && ANON && SECRET && REF) && !SUPABASE!.includes('placeholder');

/**
 * Só as linhas de treino do histórico.
 *
 * `a[href^="/treino/"]` sozinho pegaria também "Começar treino" e "Registrar
 * dias", que são atalhos e não registros.
 */
const LINHAS =
  'main a[href^="/treino/"]:not([href*="?"]):not([href="/treino/hoje"]):not([href^="/treino/novo"]):not([href^="/treino/registrar"])';

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
  const email = `apagar-${crypto.randomUUID()}@p20x.test`;
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

test.describe('apagar treino', () => {
  test.skip(!configured, 'precisa das credenciais do Supabase');

  let userId = '';

  test.afterEach(async () => {
    if (userId) {
      await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
      userId = '';
    }
  });

  test('some da tela, do histórico e do servidor', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);
    page.on('dialog', (dialog) => void dialog.accept());

    // um treino já sincronizado é o caso que estava quebrado
    await page.goto('/treino/registrar-dias');
    await page.getByRole('button', { name: 'últimos 7 dias' }).click();
    await page.getByRole('button', { name: /REGISTRAR 7 DIAS/ }).click();
    await page.waitForURL('**/app', { timeout: 25_000 });

    await expect
      .poll(
        async () => {
          const rows = await (
            await admin(`/rest/v1/workouts?user_id=eq.${userId}&select=id&deleted_at=is.null`)
          ).json();
          return rows.length;
        },
        { timeout: 40_000 },
      )
      .toBe(7);

    await page.goto('/historico');
    const primeiro = page.locator(LINHAS).first();
    await expect(primeiro).toBeVisible({ timeout: 20_000 });
    await primeiro.click();

    await page.waitForURL(/\/treino\/[0-9a-f-]+$/);
    await page.getByRole('button', { name: 'Apagar treino' }).click();

    // volta ao histórico já sem ele
    await page.waitForURL('**/historico', { timeout: 20_000 });
    await expect
      .poll(async () => page.locator(LINHAS).count(), { timeout: 20_000 })
      .toBe(6);

    // e o servidor também não o conta mais
    await expect
      .poll(
        async () => {
          const rows = await (
            await admin(`/rest/v1/workouts?user_id=eq.${userId}&select=id&deleted_at=is.null`)
          ).json();
          return rows.length;
        },
        { timeout: 40_000, message: 'a exclusão não chegou ao servidor' },
      )
      .toBe(6);

    // recarregar não pode ressuscitá-lo
    await page.reload();
    await page.waitForTimeout(3000);
    expect(await page.locator(LINHAS).count()).toBe(6);
  });

  test('o recorde conquistado no treino apagado some junto', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);
    page.on('dialog', (dialog) => void dialog.accept());

    // um treino de verdade, com rounds: gera recorde de duração e de rounds
    await page.goto('/treino/hoje?auto=1');
    await expect(page.getByText('Restantes')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Adicionar um round' }).click();
    await page.getByRole('button', { name: 'Finalizar' }).click();
    await expect(page.getByText('TREINO CONCLUÍDO')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'CONCLUIR' }).click();
    await page.waitForURL('**/app', { timeout: 20_000 });

    // o trigger gravou os recordes
    await expect
      .poll(
        async () => {
          const rows = await (
            await admin(`/rest/v1/personal_records?user_id=eq.${userId}&select=metric`)
          ).json();
          return rows.length;
        },
        { timeout: 40_000, message: 'o trigger não registrou os recordes' },
      )
      .toBeGreaterThan(0);

    await expect(page.getByText(/1 recorde|2 recordes/)).toBeHidden().catch(() => {});

    // apaga o treino
    await page.goto('/historico');
    await page.locator(LINHAS).first().click();
    await page.waitForURL(/\/treino\/[0-9a-f-]+$/);
    await page.getByRole('button', { name: 'Apagar treino' }).click();
    await page.waitForURL('**/historico', { timeout: 20_000 });

    // o recorde não pode sobreviver ao treino que o criou
    await expect
      .poll(
        async () => {
          const rows = await (
            await admin(`/rest/v1/personal_records?user_id=eq.${userId}&select=metric`)
          ).json();
          return rows.length;
        },
        { timeout: 40_000, message: 'sobrou recorde de um treino apagado' },
      )
      .toBe(0);

    // e a tela de recordes fica vazia
    await page.goto('/recordes');
    await expect(page.getByText('Seu primeiro treino já vira recorde.')).toBeVisible({
      timeout: 20_000,
    });
  });

  test('a sequência encolhe quando o dia é apagado', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);
    page.on('dialog', (dialog) => void dialog.accept());

    await page.goto('/treino/registrar-dias');
    await page.getByRole('button', { name: 'últimos 7 dias' }).click();
    await page.getByRole('button', { name: /REGISTRAR 7 DIAS/ }).click();
    await page.waitForURL('**/app', { timeout: 25_000 });

    await expect(page.getByText(/7 dias seguidos/)).toBeVisible({ timeout: 25_000 });

    // apaga o de hoje: a sequência passa a contar a partir de ontem
    await page.goto('/historico');
    await page.locator(LINHAS).first().click();
    await page.waitForURL(/\/treino\/[0-9a-f-]+$/);
    await page.getByRole('button', { name: 'Apagar treino' }).click();
    await page.waitForURL('**/historico', { timeout: 20_000 });

    await page.goto('/app');
    await expect(page.getByText(/6 dias seguidos/)).toBeVisible({ timeout: 25_000 });
  });
});
