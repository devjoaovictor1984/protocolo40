import { expect, test, type BrowserContext } from '@playwright/test';

/**
 * Cadastro até o primeiro dia.
 *
 * Este teste existe por causa de um bug real: `idleState` era exportado de um
 * arquivo `'use server'`, o que o Next recusa em tempo de execução. Passou pelo
 * build, pelo `tsc` e pelo smoke de rotas — porque nenhum deles chegava a
 * *enviar* um formulário. Só um navegador de verdade pega isso.
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

/** Monta o cookie de sessão no formato que o @supabase/ssr lê. */
async function signIn(context: BrowserContext, baseURL: string) {
  const email = `e2e-${crypto.randomUUID()}@protocolo40.test`;
  const password = `Teste-${crypto.randomUUID()}`;

  const created = await admin('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const { id } = await created.json();

  const tokenResponse = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await tokenResponse.json();

  const encoded = `base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;
  const name = `sb-${REF}-auth-token`;
  const LIMIT = 3180;
  const { hostname } = new URL(baseURL);

  const cookies =
    encoded.length <= LIMIT
      ? [{ name, value: encoded, domain: hostname, path: '/' }]
      : Array.from({ length: Math.ceil(encoded.length / LIMIT) }, (_, index) => ({
          name: `${name}.${index}`,
          value: encoded.slice(index * LIMIT, (index + 1) * LIMIT),
          domain: hostname,
          path: '/',
        }));

  await context.addCookies(cookies);
  return id as string;
}

test.describe('onboarding', () => {
  test.skip(!configured, 'precisa das credenciais do Supabase');

  let userId = '';

  test.afterEach(async () => {
    if (userId) {
      await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
      userId = '';
    }
  });

  test('preencher os três passos leva ao Dia 1 e salva o perfil', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);

    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('/onboarding');
    await expect(page.getByRole('heading', { name: 'Como podemos te chamar?' })).toBeVisible();

    await page.getByLabel('Nome', { exact: true }).fill('João Victor');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByRole('button', { name: 'Melhorar o shape' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByLabel('Altura (cm)').fill('178');
    await page.getByLabel('Peso (kg)').fill('86.4');
    await page.getByRole('button', { name: 'Começar meu protocolo' }).click();

    // o formulário conclui e o app leva para o dia de hoje
    await page.waitForURL('**/app', { timeout: 15_000 });

    // o cartão do treino de hoje é o CTA principal; há outros links com o mesmo
    // texto na tela, então o alvo é o de dentro da seção
    const hoje = page.getByLabel('Treino de hoje');
    await expect(hoje.getByRole('link', { name: 'COMEÇAR TREINO' })).toBeVisible({ timeout: 20_000 });
    await expect(hoje.getByText('DIA 1')).toBeVisible();

    expect(errors, `erros no console: ${errors.join(' | ')}`).toEqual([]);

    const profile = await (
      await admin(`/rest/v1/profiles?id=eq.${userId}&select=full_name,goal,height_cm,onboarding_completed_at`)
    ).json();

    expect(profile[0].full_name).toBe('João Victor');
    expect(profile[0].goal).toBe('melhorar_shape');
    expect(profile[0].height_cm).toBe(178);
    expect(profile[0].onboarding_completed_at).not.toBeNull();

    // o peso informado vira a primeira medida do protocolo
    const measurements = await (
      await admin(`/rest/v1/body_measurements?user_id=eq.${userId}&select=weight_kg`)
    ).json();
    expect(Number(measurements[0]?.weight_kg)).toBeCloseTo(86.4);
  });

  test('um segundo toque acidental não pula os passos', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);

    // O botão "Continuar" e o "Começar meu protocolo" ocupam o mesmo lugar. Sem
    // chaves distintas, o React reaproveitava o nó do DOM: o clique avançava o
    // passo, o botão virava submit no meio do evento, e a ação padrão do
    // navegador enviava o formulário — pulando o passo de altura e peso.
    await page.goto('/onboarding');
    await page.getByLabel('Nome', { exact: true }).fill('João');

    const continuar = page.getByRole('button', { name: 'Continuar' });
    const box = await continuar.boundingBox();
    await continuar.click();
    // o segundo toque cai no mesmo ponto da tela; onde ele acerta depende da
    // largura, mas em nenhum caso pode enviar o formulário
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.waitForTimeout(2000);

    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByText(/Passo \d de 3/)).toBeVisible();

    const [profile] = await (
      await admin(`/rest/v1/profiles?id=eq.${userId}&select=onboarding_completed_at`)
    ).json();
    expect(profile.onboarding_completed_at, 'o formulário não pode enviar sozinho').toBeNull();
  });

  test('pular o onboarding também leva ao app', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);

    await page.goto('/onboarding');
    await page.getByRole('button', { name: 'Pular' }).click();

    await page.waitForURL('**/app', { timeout: 15_000 });
    await expect(
      page.getByLabel('Treino de hoje').getByRole('link', { name: 'COMEÇAR TREINO' }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test('o login recusa e-mail inválido sem quebrar a tela', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill('nao-e-um-email');
    await page.getByLabel('Senha').fill('12345678');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText('E-mail inválido')).toBeVisible();
    await expect(page.getByText('Algo deu errado')).toHaveCount(0);
  });
});
