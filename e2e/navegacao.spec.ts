import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * Toda tela precisa ser alcançável a dedo, no celular.
 *
 * Existe porque `/treinos` — as sugestões de treino, o coração do método —
 * não tinha nenhum ponto de entrada no telefone. Só aparecia na sidebar do
 * desktop. Um teste de rota não pega isso: a página respondia 200, ninguém
 * conseguia chegar nela.
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
  const email = `nav-${crypto.randomUUID()}@p20x.test`;
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

/** Todos os destinos alcançáveis clicando, a partir da tela de hoje. */
async function destinosAlcancaveis(page: Page): Promise<Set<string>> {
  const encontrados = new Set<string>();

  const coletar = async () => {
    for (const href of await page.locator('a:visible').evaluateAll((links) =>
      links.map((link) => (link as HTMLAnchorElement).getAttribute('href') ?? ''),
    )) {
      if (href.startsWith('/')) encontrados.add(href.split('?')[0]);
    }
  };

  await page.goto('/hoje');
  await page.waitForTimeout(2500);
  await coletar();

  // a folha do botão central faz parte da navegação: no celular ela é a barra,
  // no desktop o mesmo conteúdo aparece na sidebar
  const mais = page.getByRole('button', { name: /Começar treino, registrar/ });
  if (await mais.isVisible().catch(() => false)) {
    await mais.click();
    // espera o conteúdo montar, em vez de torcer por um tempo fixo
    await page.getByText('O que você quer fazer?').waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByText('Treino passado').waitFor({ state: 'visible', timeout: 10_000 });
    await coletar();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  }

  // e o que cada destino abre a partir dele, dois níveis adentro
  for (const partida of [
    '/calendario',
    '/evolucao',
    '/evolucao/fotos',
    '/perfil',
    '/treinos',
    '/medidas',
  ]) {
    await page.goto(partida);
    await page.waitForTimeout(1800);
    await coletar();
  }

  return encontrados;
}

test.describe('navegação', () => {
  test.skip(!configured, 'precisa das credenciais do Supabase');

  let userId = '';

  test.afterEach(async () => {
    if (userId) {
      await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
      userId = '';
    }
  });

  test('todas as telas são alcançáveis a dedo no celular', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);

    const alcancaveis = await destinosAlcancaveis(page);

    const obrigatorias = [
      '/hoje',
      '/treinos',
      '/treinos/novo',
      '/calendario',
      '/evolucao',
      '/evolucao/fotos',
      '/evolucao/comparar',
      '/medidas',
      '/recordes',
      '/perfil',
      '/configuracoes',
      '/treinar',
      '/treino/novo',
    ];

    const inalcancaveis = obrigatorias.filter((rota) => !alcancaveis.has(rota));

    expect(
      inalcancaveis,
      `sem caminho no celular: ${inalcancaveis.join(', ')}. Alcançáveis: ${[...alcancaveis].sort().join(', ')}`,
    ).toEqual([]);
  });

  test('o calendário é a segunda aba e traz o histórico junto', async ({
    context,
    page,
    baseURL,
  }) => {
    await signIn(context, baseURL!);

    await page.goto('/hoje');

    const barra = page.getByRole('navigation', { name: 'Navegação principal' });
    await expect(barra.getByRole('link', { name: 'Calendário' })).toBeVisible({ timeout: 20_000 });
    await expect(barra.getByRole('link', { name: 'Histórico' })).toHaveCount(0);

    await barra.getByRole('link', { name: 'Calendário' }).click();
    await page.waitForURL('**/calendario', { timeout: 20_000 });

    // o mês vem primeiro, a lista logo abaixo, na mesma tela
    await expect(page.getByRole('heading', { name: 'Calendário' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Histórico' })).toBeVisible();
    await expect(page.getByLabel('Buscar treino ou exercício')).toBeVisible();

    // o endereço antigo continua funcionando: leva ao mesmo lugar
    await page.goto('/historico');
    await page.waitForURL('**/calendario', { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Histórico' })).toBeVisible();
  });
});
