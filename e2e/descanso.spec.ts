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
  const email = `desc-${crypto.randomUUID()}@p20x.test`;
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

test.describe('descanso e navegação', () => {
  test.skip(!configured, 'precisa das credenciais do Supabase');

  let userId = '';

  test.afterEach(async () => {
    if (userId) {
      await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
      userId = '';
    }
  });

  test('o descanso sustenta a sequência sem contar como dia treinado', async ({
    context,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    userId = await signIn(context, baseURL!);

    // três dias seguidos terminando ontem: a sequência morreria hoje
    for (const atras of [1, 2, 3]) {
      const dia = new Date(Date.now() - atras * 86_400_000);
      await admin('/rest/v1/workouts', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          client_id: crypto.randomUUID(),
          started_at: dia.toISOString(),
          duration_seconds: 1200,
          workout_date: dia.toISOString().slice(0, 10),
        }),
      });
    }

    const stats = async () => {
      const linhas = await (
        await admin('/rest/v1/rpc/get_user_stats', {
          method: 'POST',
          body: JSON.stringify({ p_user: userId }),
        })
      ).json();
      return linhas[0] as { current_streak: number; total_days: number };
    };

    const antes = await stats();
    expect(antes.total_days).toBe(3);

    await page.goto('/hoje');
    await page.getByRole('button', { name: 'Hoje é dia de descanso' }).click();
    await expect(page.getByText('Descanso registrado.').first()).toBeVisible({ timeout: 30_000 });

    const depois = await stats();

    // a sequência cresceu; os dias treinados, não
    expect(depois.current_streak, 'o descanso deve sustentar a sequência').toBe(4);
    expect(depois.total_days, 'descanso não é dia treinado').toBe(3);
  });

  test('um descanso por semana, e nunca num dia já treinado', async ({
    context,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    userId = await signIn(context, baseURL!);

    const chamar = async (dia: string) => {
      const resposta = await admin('/rest/v1/rpc/registrar_descanso', {
        method: 'POST',
        body: JSON.stringify({ p_day: dia }),
      });
      return resposta.json();
    };

    const hoje = new Date().toISOString().slice(0, 10);

    // pelo service role a função não tem auth.uid(): a regra é verificada na tela
    await page.goto('/hoje');
    await page.getByRole('button', { name: 'Hoje é dia de descanso' }).click();
    await expect(page.getByText('Descanso registrado.').first()).toBeVisible({ timeout: 30_000 });

    // o segundo, no mesmo dia, é recusado com o motivo certo
    await page.reload();
    await expect(page.getByText('Descanso registrado. Sua sequência continua de pé.')).toBeVisible({
      timeout: 20_000,
    });

    // e não existe botão para repetir
    await expect(page.getByRole('button', { name: 'Hoje é dia de descanso' })).toHaveCount(0);

    const linhas = await (
      await admin(`/rest/v1/rest_days?user_id=eq.${userId}&select=day`)
    ).json();
    expect(linhas).toHaveLength(1);
    expect((linhas as { day: string }[])[0].day).toBe(hoje);

    expect(await chamar(hoje)).toBe('sem_sessao');
  });

  test('o descanso aparece no calendário com marca própria', async ({
    context,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    userId = await signIn(context, baseURL!);

    await page.goto('/hoje');
    await page.getByRole('button', { name: 'Hoje é dia de descanso' }).click();
    await expect(page.getByText('Descanso registrado.').first()).toBeVisible({ timeout: 30_000 });

    await page.goto('/calendario');
    await expect(page.getByRole('heading', { name: 'Calendário' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel(/— descanso/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('descanso', { exact: true })).toBeVisible();
  });

  test('a linha do tempo aparece e não estoura a largura', async ({ context, page, baseURL }) => {
    test.setTimeout(120_000);
    userId = await signIn(context, baseURL!);

    await page.goto('/treino/registrar-dias');
    await page.getByRole('button', { name: 'últimos 30 dias' }).click();
    await page.getByRole('button', { name: /REGISTRAR/ }).click();
    await page.waitForURL(/\/(hoje|calendario)/, { timeout: 30_000 });

    await page.goto('/calendario');

    const linha = page.getByRole('img', { name: /dias treinados em .* dias de protocolo/ });
    await expect(linha).toBeVisible({ timeout: 20_000 });

    await expect(page.getByText(/Dia 1 ·/).first()).toBeVisible();
    await expect(page.getByText(/· hoje/).first()).toBeVisible();

    // não pode empurrar a página para o lado
    const largura = await page.evaluate(() => ({
      corpo: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(largura.corpo, 'a linha do tempo estourou a tela').toBeLessThanOrEqual(largura.janela + 1);
  });

  test('as telas internas têm caminho de volta', async ({ context, page, baseURL }) => {
    test.setTimeout(120_000);
    userId = await signIn(context, baseURL!);

    const caminhos: [string, string][] = [
      ['/recordes', 'Perfil'],
      ['/conquistas', 'Perfil'],
      ['/comunidade', 'Perfil'],
      ['/analise', 'Evolução'],
      ['/saude', 'Evolução'],
      ['/medidas', 'Evolução'],
      ['/evolucao/fotos', 'Evolução'],
      ['/evolucao/comparar', 'Fotos'],
    ];

    for (const [rota, origem] of caminhos) {
      await page.goto(rota);
      await expect(
        page.getByRole('link', { name: origem, exact: true }).first(),
        `${rota} sem caminho de volta`,
      ).toBeVisible({ timeout: 20_000 });
    }
  });
});
