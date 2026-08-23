import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * O caminho principal do produto: começar, treinar, finalizar.
 *
 * Existe por causa de um travamento real em produção — o dashboard entrava em
 * loop de render e a tela parava de responder ao toque, dando a impressão de
 * que "o link não abre nada". Nenhum teste de rota pega isso: a página até
 * responde 200, ela só não deixa mais ninguém clicar.
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
  const email = `treino-${crypto.randomUUID()}@protocolo40.test`;
  const password = `Teste-${crypto.randomUUID()}`;

  const { id } = await (
    await admin('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, email_confirm: true }),
    })
  ).json();

  await admin(`/rest/v1/profiles?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ onboarding_completed_at: new Date().toISOString(), full_name: 'João Victor' }),
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

/**
 * A tela responde ao toque?
 *
 * Um loop de render não quebra a página — ele ocupa a thread principal, e é aí
 * que o produto fica inutilizável sem nenhum erro no console.
 */
async function telaResponde(page: Page) {
  const inicio = Date.now();
  await page.locator('body').count();
  await page.evaluate(() => document.title);
  return Date.now() - inicio;
}

test.describe('treino', () => {
  test.skip(!configured, 'precisa das credenciais do Supabase');

  let userId = '';

  test.afterEach(async () => {
    if (userId) {
      await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
      userId = '';
    }
  });

  test('do dashboard ao treino salvo', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);

    const erros: string[] = [];
    page.on('pageerror', (error) => erros.push(error.message));
    // o treino do teste dura poucos segundos e cai na confirmação de treino curto
    page.on('dialog', (dialog) => void dialog.accept());

    await page.goto('/app');

    const cartao = page.getByLabel('Treino de hoje');
    await expect(cartao.getByText('DIA 1')).toBeVisible({ timeout: 20_000 });

    // o dashboard precisa continuar respondendo depois de assentar
    await page.waitForTimeout(3000);
    expect(await telaResponde(page), 'o dashboard travou a thread principal').toBeLessThan(3000);

    await cartao.getByRole('link', { name: 'COMEÇAR TREINO' }).click();
    await page.waitForURL('**/treino/hoje**');

    // o cronômetro está correndo, e não parado em 20:00
    await expect(page.getByText('Restantes')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2500);
    const marcador = await page.locator('.tnum').first().innerText();
    expect(marcador, 'o cronômetro não está andando').not.toBe('20:00');

    // dois rounds
    await page.getByRole('button', { name: 'Adicionar um round' }).click();
    await page.getByRole('button', { name: 'Adicionar um round' }).click();
    await expect(page.getByText('2', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Finalizar' }).click();

    await expect(page.getByText('TREINO CONCLUÍDO')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/2 rounds/)).toBeVisible();

    await page.getByRole('button', { name: 'CONCLUIR' }).click();
    await page.waitForURL('**/app', { timeout: 20_000 });

    // o dia aparece como feito
    await expect(page.getByText('Dia 1 está feito.')).toBeVisible({ timeout: 20_000 });

    // e o treino chegou ao servidor
    await expect
      .poll(
        async () => {
          const rows = await (
            await admin(`/rest/v1/workouts?user_id=eq.${userId}&select=rounds,duration_seconds,workout_date`)
          ).json();
          return rows.length;
        },
        { timeout: 30_000, message: 'o treino não sincronizou' },
      )
      .toBe(1);

    const [workout] = await (
      await admin(`/rest/v1/workouts?user_id=eq.${userId}&select=rounds,duration_seconds`)
    ).json();
    expect(workout.rounds).toBe(2);
    expect(workout.duration_seconds).toBeGreaterThan(0);

    // e virou recorde, gravado pelo trigger
    const records = await (
      await admin(`/rest/v1/personal_records?user_id=eq.${userId}&select=metric,value`)
    ).json();
    expect(records.map((r: { metric: string }) => r.metric).sort()).toEqual(['duration', 'rounds']);

    expect(erros, `erros na página: ${erros.join(' | ')}`).toEqual([]);
  });

  test('treino de poucos segundos pede confirmação e nunca grava zero', async ({
    context,
    page,
    baseURL,
  }) => {
    userId = await signIn(context, baseURL!);

    let perguntou = false;
    let mensagem = '';

    await page.goto('/treino/hoje?auto=1');
    await expect(page.getByText('Restantes')).toBeVisible({ timeout: 15_000 });

    // primeiro recusa: o treino não pode ser gravado
    page.once('dialog', (dialog) => {
      perguntou = true;
      mensagem = dialog.message();
      void dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Finalizar' }).click();
    await page.waitForTimeout(1500);

    expect(perguntou, 'deveria perguntar antes de gravar um treino de segundos').toBe(true);
    expect(mensagem).toContain('Registrar assim mesmo?');
    await expect(page).toHaveURL(/\/treino\/hoje/);

    // agora aceita: grava, e com duração de pelo menos 1 segundo
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Finalizar' }).click();
    await expect(page.getByText('TREINO CONCLUÍDO')).toBeVisible({ timeout: 20_000 });


    await expect
      .poll(
        async () => {
          const rows = await (
            await admin(`/rest/v1/workouts?user_id=eq.${userId}&select=duration_seconds`)
          ).json();
          return rows[0]?.duration_seconds ?? 0;
        },
        { timeout: 30_000, message: 'o treino não sincronizou — duração zerada seria recusada' },
      )
      .toBeGreaterThan(0);
  });

  test('o cronômetro sobrevive a sair e voltar para a tela', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);

    await page.goto('/treino/hoje?auto=1');
    await expect(page.getByText('Restantes')).toBeVisible({ timeout: 15_000 });

    // sai do cronômetro e volta: o tempo continua de onde estava
    await page.goto('/historico');
    await page.waitForTimeout(3000);
    await page.goto('/treino/hoje');

    await expect(page.getByText('Restantes')).toBeVisible({ timeout: 15_000 });
    const marcador = await page.locator('.tnum').first().innerText();
    expect(marcador, 'a sessão foi perdida ao trocar de tela').not.toBe('20:00');
  });
});
