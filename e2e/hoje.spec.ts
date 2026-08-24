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
  const email = `hoje-${crypto.randomUUID()}@p20x.test`;
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

test.describe('a tela de hoje', () => {
  test.skip(!configured, 'precisa das credenciais do Supabase');

  let userId = '';

  test.afterEach(async () => {
    if (userId) {
      await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
      userId = '';
    }
  });

  test('peso e água ficam lado a lado, e os dois registram dali mesmo', async ({
    context,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    userId = await signIn(context, baseURL!);

    await admin(`/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ height_cm: 178 }),
    });

    await page.goto('/hoje');

    const dia = page.getByRole('region', { name: 'Seu dia' });
    await expect(dia).toBeVisible({ timeout: 20_000 });

    // o peso registra sem sair da tela
    await dia.getByLabel('Peso de hoje em quilos').fill('82,5');
    await dia.getByLabel('Registrar peso de hoje').click();
    await expect(dia.getByText('82,5')).toBeVisible({ timeout: 30_000 });

    // e a água soma por toque
    await expect(dia.getByText('0,0')).toBeVisible();
    // agora são quatro medidas; o rótulo curto é o do botão
    await dia.getByRole('button', { name: 'Somar 200 ml' }).click();
    await expect(dia.getByText('0,2')).toBeVisible({ timeout: 30_000 });

    // e as outras medidas existem
    await dia.getByRole('button', { name: 'Somar 1000 ml' }).click();
    await expect(dia.getByText('1,2')).toBeVisible({ timeout: 30_000 });

    await dia.getByRole('button', { name: 'Tirar 200 ml' }).click();
    await expect(dia.getByText('1,0')).toBeVisible({ timeout: 30_000 });

    // os dois chegaram ao servidor
    await expect
      .poll(
        async () => {
          const linhas = await (
            await admin(`/rest/v1/body_measurements?user_id=eq.${userId}&select=weight_kg`)
          ).json();
          return (linhas as { weight_kg: number }[])[0]?.weight_kg ?? null;
        },
        { timeout: 60_000, message: 'o peso não chegou ao servidor' },
      )
      .toBe(82.5);

    const agua = await (
      await admin(`/rest/v1/water_logs?user_id=eq.${userId}&select=ml`)
    ).json();
    expect((agua as { ml: number }[])[0].ml).toBe(1000);
  });

  test('cada dia da semana leva a algum lugar', async ({ context, page, baseURL }) => {
    test.setTimeout(120_000);
    userId = await signIn(context, baseURL!);

    await page.goto('/hoje');

    const semana = page.getByRole('region', { name: 'Sua semana' });
    await expect(semana).toBeVisible({ timeout: 20_000 });

    // hoje sem treino abre o cronômetro
    const hoje = semana.getByRole('link', { name: /começar o treino/ });
    await expect(hoje).toBeVisible();
    await hoje.click();
    await page.waitForURL('**/treinar', { timeout: 20_000 });

    // um dia passado sem treino abre o registro daquele dia
    await page.goto('/hoje');
    const passado = semana.getByRole('link', { name: /registrar este dia/ }).first();

    if ((await passado.count()) > 0) {
      await passado.click();
      await page.waitForURL(/\/treino\/novo\?data=\d{4}-\d{2}-\d{2}/, { timeout: 20_000 });
    }
  });

  test('o cronômetro não começa sozinho: mostra o treino e espera o toque', async ({
    context,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    userId = await signIn(context, baseURL!);

    // um treino da biblioteca, para a tela ter o que mostrar
    await page.goto('/treinos');
    const cartao = page.locator('article').filter({ hasText: 'P20X 5•10•15' }).first();
    await expect(cartao).toBeVisible({ timeout: 20_000 });
    await cartao.getByRole('link', { name: /INICIAR/ }).click();

    await page.waitForURL(/\/treinar/, { timeout: 20_000 });

    // parado, com a meta e os exercícios à vista
    await expect(page.getByText('Sua meta de hoje')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Restantes')).toHaveCount(0);
    await expect(page.getByText('Barra fixa')).toBeVisible();
    await expect(page.getByText('Agachamento')).toBeVisible();

    // só começa quando alguém manda
    await page.getByRole('button', { name: /INICIAR MEUS 20 MINUTOS/ }).click();
    await expect(page.getByText('Restantes')).toBeVisible({ timeout: 20_000 });
  });
});
