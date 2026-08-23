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
  const email = `msg-${crypto.randomUUID()}@p20x.test`;
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

test.describe('mensagem do dia e rotas', () => {
  test.skip(!configured, 'precisa das credenciais do Supabase');

  let userId = '';

  test.afterEach(async () => {
    if (userId) {
      await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
      userId = '';
    }
  });

  test('a mensagem do dia aparece e o versículo abre a um toque', async ({
    context,
    page,
    baseURL,
  }) => {
    userId = await signIn(context, baseURL!);

    // a mensagem de hoje, calculada do mesmo jeito que o app calcula
    const agora = new Date();
    const diaDoAno =
      Math.round(
        (Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()) -
          Date.UTC(agora.getFullYear(), 0, 1)) /
          86_400_000,
      ) + 1;

    const [esperada] = await (
      await admin(`/rest/v1/daily_messages?day_of_year=eq.${diaDoAno}&select=message,reference,verse`)
    ).json();

    expect(esperada).toBeTruthy();

    await page.goto('/hoje');
    await expect(page.getByText(esperada.message)).toBeVisible({ timeout: 20_000 });

    // o versículo fica recolhido até alguém pedir
    await expect(page.getByText(esperada.verse)).toHaveCount(0);
    await page.getByRole('button', { name: new RegExp(esperada.reference.split(' ')[0]) }).click();
    await expect(page.getByText(esperada.verse)).toBeVisible();
    await expect(page.getByText(/João Ferreira de Almeida/)).toBeVisible();
  });

  test('existe uma mensagem para cada um dos 366 dias', async () => {
    const linhas = await (
      await admin('/rest/v1/daily_messages?select=day_of_year&order=day_of_year')
    ).json();

    const dias = (linhas as { day_of_year: number }[]).map((l) => l.day_of_year);
    expect(dias).toHaveLength(366);
    expect(dias[0]).toBe(1);
    expect(dias[365]).toBe(366);

    // nenhum buraco no meio
    for (let i = 0; i < dias.length; i += 1) expect(dias[i]).toBe(i + 1);
  });

  test('nenhuma mensagem ficou sem versículo ou sem texto', async () => {
    const linhas = await (
      await admin('/rest/v1/daily_messages?select=day_of_year,reference,verse,message')
    ).json();

    for (const linha of linhas as { day_of_year: number; reference: string; verse: string; message: string }[]) {
      expect(linha.reference.length, `dia ${linha.day_of_year}`).toBeGreaterThan(3);
      expect(linha.verse.length, `dia ${linha.day_of_year}`).toBeGreaterThan(10);
      expect(linha.message.length, `dia ${linha.day_of_year}`).toBeGreaterThan(10);
    }
  });

  test('os endereços antigos continuam levando ao lugar certo', async ({
    context,
    page,
    baseURL,
  }) => {
    userId = await signIn(context, baseURL!);

    // quem instalou o PWA tem o atalho apontando para /app
    await page.goto('/app');
    await page.waitForURL('**/hoje', { timeout: 20_000 });

    await page.goto('/treino/hoje');
    await page.waitForURL('**/treinar', { timeout: 20_000 });

    // atalhos digitáveis
    await page.goto('/suporte');
    await page.waitForURL('**/ajuda', { timeout: 20_000 });

    await page.goto('/insignias');
    await page.waitForURL('**/conquistas', { timeout: 20_000 });

    await page.goto('/agua');
    await page.waitForURL('**/saude', { timeout: 20_000 });
  });
});
