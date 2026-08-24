import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * Área segura do aparelho.
 *
 * O app usa `viewport-fit=cover` para a barra inferior encostar na borda do
 * iPhone. O preço é que o topo passa por baixo da status bar e da ilha
 * dinâmica — foi o que aconteceu num iPhone 11 Pro Max: título colado no alto
 * e botões no canto, difíceis de alcançar.
 *
 * O navegador de teste não simula entalhe: `env(safe-area-inset-top)` volta
 * zero. Então o teste injeta o recuo do próprio iPhone e confere que o layout
 * reage — que é exatamente o que o aparelho de verdade faz.
 */

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REF = process.env.SUPABASE_PROJECT_REF;

const configured = Boolean(SUPABASE && ANON && SECRET && REF) && !SUPABASE!.includes('placeholder');

/** Recuos reais de um iPhone com ilha dinâmica, em retrato. */
const TOPO = 59;
const RODAPE = 34;

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
  const email = `safe-${crypto.randomUUID()}@p20x.test`;
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

/** Finge o entalhe: o `env()` do navegador de teste é sempre zero. */
async function simularEntalhe(page: Page) {
  await page.addStyleTag({
    content: `body { --safe-top: ${TOPO}px; --safe-bottom: ${RODAPE}px; }`,
  });
}

/** Distância do topo da tela até o primeiro elemento clicável do conteúdo. */
async function primeiroAlvo(page: Page) {
  const alvo = page.locator('main a, main button').first();
  await alvo.waitFor({ state: 'visible', timeout: 20_000 });
  const caixa = await alvo.boundingBox();
  return caixa?.y ?? 0;
}

test.describe('área segura', () => {
  test.skip(!configured, 'precisa das credenciais do Supabase');

  let userId = '';

  test.afterEach(async () => {
    if (userId) {
      await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
      userId = '';
    }
  });

  test('o conteúdo desce quando o aparelho tem entalhe', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);

    await page.goto('/hoje');
    await page.waitForTimeout(2500);
    const semEntalhe = await primeiroAlvo(page);

    await simularEntalhe(page);
    await page.waitForTimeout(400);
    const comEntalhe = await primeiroAlvo(page);

    expect(
      comEntalhe - semEntalhe,
      'o conteúdo precisa descer o mesmo tanto que o entalhe ocupa',
    ).toBeGreaterThanOrEqual(TOPO - 1);
  });

  test('nada clicável encosta na status bar', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);
    await page.goto('/hoje');
    await page.waitForTimeout(2500);
    await simularEntalhe(page);
    await page.waitForTimeout(400);

    const invasores = await page.evaluate((topo) => {
      const fora: string[] = [];
      for (const el of document.querySelectorAll('main a, main button, header a, header button')) {
        const caixa = el.getBoundingClientRect();
        if (caixa.height === 0) continue;
        if (caixa.top < topo) {
          fora.push(`${el.tagName} "${(el.textContent ?? '').trim().slice(0, 24)}" y=${Math.round(caixa.top)}`);
        }
      }
      return fora;
    }, TOPO);

    expect(invasores, `elementos por baixo da status bar: ${invasores.join(' | ')}`).toEqual([]);
  });

  test('o cronômetro também respeita o topo', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);

    await page.goto('/treinar');
    // o cronômetro não começa sozinho: a tela de preparo mostra o treino primeiro
    await page.getByRole('button', { name: /INICIAR MEUS 20 MINUTOS/ }).click();
    await expect(page.getByText('Restantes')).toBeVisible({ timeout: 15_000 });
    await simularEntalhe(page);
    await page.waitForTimeout(400);

    const sair = await page.getByRole('button', { name: 'Sair sem salvar' }).boundingBox();
    expect(sair?.y ?? 0, 'o botão de sair estava por baixo da ilha dinâmica').toBeGreaterThanOrEqual(
      TOPO,
    );
  });

  test('a barra de baixo fica acima da faixa do gesto', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);
    await page.goto('/hoje');
    await page.waitForTimeout(2000);
    await simularEntalhe(page);
    await page.waitForTimeout(400);

    const alturaTela = page.viewportSize()?.height ?? 0;
    const registrar = await page
      .getByRole('button', { name: /Começar treino, registrar/ })
      .boundingBox();

    expect(
      alturaTela - (registrar!.y + registrar!.height),
      'o botão central ficou dentro da faixa do gesto de voltar',
    ).toBeGreaterThanOrEqual(RODAPE - 1);
  });
});
