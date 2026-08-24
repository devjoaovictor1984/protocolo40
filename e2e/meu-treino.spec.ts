import { expect, test, type BrowserContext } from '@playwright/test';

/**
 * Montar um treino próprio e reusá-lo.
 *
 * A promessa é não precisar preencher tudo de novo: o circuito fica salvo e
 * ganha USAR HOJE, recorde e última marca, igual aos treinos da biblioteca.
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
  const email = `meu-${crypto.randomUUID()}@p20x.test`;
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

test.describe('biblioteca de treinos', () => {
  test.skip(!configured, 'precisa das credenciais do Supabase');

  let userId = '';

  test.afterEach(async () => {
    if (userId) {
      await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
      userId = '';
    }
  });

  test('a biblioteca P20X aparece com a ficha completa', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);

    await page.goto('/treinos');
    await expect(page.getByRole('heading', { name: 'Escolher um treino' })).toBeVisible();

    // um treino conhecido, com a ficha que o produto promete
    const cartao = page.locator('article').filter({ hasText: 'P20X 5•10•15' }).first();
    await expect(cartao).toBeVisible({ timeout: 20_000 });

    await expect(cartao.getByText('AMRAP')).toBeVisible();
    await expect(cartao.getByText('Moderado')).toBeVisible();
    await expect(cartao.getByText('20 min')).toBeVisible();
    await expect(cartao.getByText('barra-fixa')).toBeVisible();
    await expect(cartao.getByText('Barra fixa')).toBeVisible();
    await expect(cartao.getByText('Agachamento')).toBeVisible();
    await expect(cartao.getByRole('link', { name: /INICIAR/ })).toBeVisible();

    // filtrar por nível esconde os que não são daquele nível
    await page.getByRole('button', { name: 'Iniciante', exact: true }).click();
    await expect(page.locator('article').filter({ hasText: 'P20X Start' })).toHaveCount(1);
    await expect(page.locator('article').filter({ hasText: 'P20X Challenge' })).toHaveCount(0);
  });

  test('montar um treino próprio, usá-lo e ver o recorde', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);
    page.on('dialog', (dialog) => void dialog.accept());

    await page.goto('/treinos/novo');

    // digitar antes da hidratação faz o React descartar o texto; conferir que
    // o valor ficou é o que separa um teste honesto de um que passa por sorte
    const nome = page.getByLabel('Nome');
    await nome.click();
    await nome.fill('Meu circuito');
    await expect(nome).toHaveValue('Meu circuito');

    // dois exercícios no round
    for (const exercicio of ['Agachamento', 'Flexão']) {
      await page.getByRole('button', { name: 'Adicionar exercício' }).click();
      await page.getByRole('button', { name: exercicio, exact: true }).first().click();
    }

    await page.getByRole('button', { name: 'SALVAR E COMEÇAR AGORA' }).click();

    // salvou e abriu a tela de preparo com ele — sem começar sozinho
    await page.waitForURL(/\/treinar/, { timeout: 25_000 });
    await expect(page.getByText('Meu circuito')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Sua meta de hoje')).toBeVisible({ timeout: 20_000 });

    // os exercícios que acabei de escolher aparecem antes de começar
    await expect(page.getByText('Agachamento')).toBeVisible();
    await expect(page.getByText('Flexão')).toBeVisible();

    await page.getByRole('button', { name: /INICIAR MEUS 20 MINUTOS/ }).click();

    // dois rounds e finaliza
    await page.getByRole('button', { name: 'Adicionar um round' }).click();
    await page.getByRole('button', { name: 'Adicionar um round' }).click();
    await page.getByRole('button', { name: 'Finalizar' }).click();
    await expect(page.getByText('TREINO CONCLUÍDO')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'CONCLUIR' }).click();
    await page.waitForURL('**/hoje', { timeout: 20_000 });

    // o treino próprio ficou salvo, com o recorde na ficha
    await page.goto('/treinos/favoritos');
    const cartao = page.locator('article').filter({ hasText: 'Meu circuito' }).first();
    await expect(cartao).toBeVisible({ timeout: 20_000 });
    await expect(cartao.getByText('2 rounds').first()).toBeVisible({ timeout: 20_000 });

    // e existe de verdade no servidor
    const templates = await (
      await admin(`/rest/v1/workout_templates?owner_id=eq.${userId}&select=title,method,is_favorite`)
    ).json();
    expect(templates).toHaveLength(1);
    expect(templates[0].title).toBe('Meu circuito');
    expect(templates[0].method).toBe('amrap');
  });
});
