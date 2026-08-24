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
  const email = `conq-${crypto.randomUUID()}@p20x.test`;
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

test.describe('conquistas', () => {
  test.skip(!configured, 'precisa das credenciais do Supabase');

  let userId = '';

  test.afterEach(async () => {
    if (userId) {
      await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
      userId = '';
    }
  });

  test('a insígnia de fundador cai no cadastro', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);

    await page.goto('/conquistas');
    await expect(page.getByRole('heading', { name: 'Conquistas' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Fundador')).toBeVisible();

    // as bloqueadas continuam à vista, com o que falta
    await expect(page.getByText('Ainda pela frente')).toBeVisible();
    await expect(page.getByText('7 dias treinados')).toBeVisible();
    await expect(page.getByText('Próxima')).toBeVisible();
  });

  test('sete dias treinados viram Legionário', async ({ context, page, baseURL }) => {
    test.setTimeout(120_000);
    userId = await signIn(context, baseURL!);

    await page.goto('/treino/registrar-dias');
    await page.getByRole('button', { name: 'últimos 7 dias' }).click();
    await page.getByRole('button', { name: /REGISTRAR/ }).click();
    await page.waitForURL(/\/(hoje|calendario)/, { timeout: 30_000 });

    // quem concede é o gatilho no banco, não o cliente
    await expect
      .poll(
        async () => {
          const linhas = await (
            await admin(`/rest/v1/user_badges?user_id=eq.${userId}&select=badge_slug`)
          ).json();
          return (linhas as { badge_slug: string }[]).map((l) => l.badge_slug).sort();
        },
        { timeout: 60_000, message: 'as conquistas não foram concedidas' },
      )
      .toEqual(['fundador', 'legionario', 'recruta', 'sentinela']);

    await page.goto('/conquistas');
    await expect(page.getByText('Legionário')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Recruta')).toBeVisible();
    // sete dias seguidos também valem a insígnia de sequência
    await expect(page.getByText('Sentinela')).toBeVisible();

    // e aparecem no perfil
    await page.goto('/perfil');
    await expect(page.getByText('Insígnias')).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole('link', { name: 'Ver todas as conquistas', exact: true }),
    ).toBeVisible();
  });

  test('apagar o treino que sustentava a conquista a retira', async ({ context, page, baseURL }) => {
    test.setTimeout(120_000);
    userId = await signIn(context, baseURL!);
    page.on('dialog', (dialog) => void dialog.accept());

    // um dia só: garante Recruta e nada além
    await page.goto('/treino/registrar-dias');
    await page.getByRole('button', { name: 'últimos 7 dias' }).click();
    await page.getByRole('button', { name: /REGISTRAR/ }).click();
    await page.waitForURL(/\/(hoje|calendario)/, { timeout: 30_000 });

    await expect
      .poll(
        async () => {
          const linhas = await (
            await admin(`/rest/v1/user_badges?user_id=eq.${userId}&select=badge_slug`)
          ).json();
          return (linhas as { badge_slug: string }[]).length;
        },
        { timeout: 60_000 },
      )
      .toBe(4);

    // apagar um dia derruba a contagem para 6 e o Legionário sai junto
    await page.goto('/calendario');
    await page
      .locator(
        'main a[href^="/treino/"]:not([href*="?"]):not([href="/treinar"]):not([href^="/treino/novo"]):not([href^="/treino/registrar"])',
      )
      .first()
      .click();
    await page.waitForURL(/\/treino\/[0-9a-f-]+$/, { timeout: 20_000 });
    await page.getByRole('button', { name: 'Apagar treino' }).click();
    await page.waitForURL('**/calendario', { timeout: 30_000 });

    await expect
      .poll(
        async () => {
          const linhas = await (
            await admin(`/rest/v1/user_badges?user_id=eq.${userId}&select=badge_slug`)
          ).json();
          return (linhas as { badge_slug: string }[]).map((l) => l.badge_slug).sort();
        },
        { timeout: 60_000, message: 'a conquista sobreviveu ao treino apagado' },
      )
      .toEqual(['fundador', 'recruta']);
  });
});
