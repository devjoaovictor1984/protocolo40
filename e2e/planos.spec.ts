import { expect, test, type BrowserContext } from '@playwright/test';

/**
 * Planos, acesso e cobrança.
 *
 * O que importa aqui não é a tela bonita: é que ninguém consiga se dar um
 * plano, que uma assinatura vencida não valha e que o webhook recuse evento
 * sem assinatura criptográfica.
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
  const email = `plan-${crypto.randomUUID()}@p20x.test`;
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

  return { id: id as string, accessToken: session.access_token as string };
}

test.describe('planos e acesso', () => {
  test.skip(!configured, 'precisa das credenciais do Supabase');

  let userId = '';
  let outroId = '';
  let marca = '';

  test.afterEach(async () => {
    for (const id of [userId, outroId]) {
      if (id) await admin(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });
    }

    // o log de auditoria é dado real do produto: o que o teste escreveu sai
    if (marca) {
      await admin(`/rest/v1/admin_audit_log?detail->>motivo=eq.${encodeURIComponent(marca)}`, {
        method: 'DELETE',
      });
    }

    userId = '';
    outroId = '';
    marca = '';
  });

  test('com a cobrança desligada, o app inteiro é livre', async ({ context, page, baseURL }) => {
    ({ id: userId } = await signIn(context, baseURL!));

    // nenhum paywall em lugar nenhum
    await page.goto('/analise');
    await expect(page.getByRole('heading', { name: 'Análise', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('link', { name: 'VER OS PLANOS' })).toHaveCount(0);

    await page.goto('/saude');
    await expect(page.getByRole('heading', { name: 'Saúde', exact: true })).toBeVisible();

    for (const rota of ['/hoje', '/calendario', '/evolucao', '/conquistas', '/medidas']) {
      const resposta = await page.goto(rota);
      expect(resposta?.status(), rota).toBeLessThan(400);
    }
  });

  test('a tela de planos sai do ar e o link some das configurações', async ({
    context,
    page,
    baseURL,
  }) => {
    ({ id: userId } = await signIn(context, baseURL!));

    await page.goto('/configuracoes');
    await expect(page.getByRole('link', { name: 'Plano e cobrança' })).toHaveCount(0);

    await page.goto('/planos');
    await page.waitForURL('**/hoje', { timeout: 20_000 });
  });

  /**
   * A regra de liberação continua valendo no banco.
   *
   * Com a cobrança desligada o app não pergunta, mas `tem_acesso()` é quem vai
   * decidir no dia em que ela for ligada — e é aqui que se garante que vencida
   * e cancelada não passam.
   */
  test('a função do banco recusa assinatura vencida e cancelada', async ({ context, baseURL }) => {
    ({ id: userId } = await signIn(context, baseURL!));

    const perguntar = async (): Promise<boolean> => {
      const resposta = await admin('/rest/v1/rpc/tem_acesso', {
        method: 'POST',
        body: JSON.stringify({ p_recurso: 'analise', p_user: userId }),
      });
      return (await resposta.json()) as boolean;
    };

    expect(await perguntar(), 'sem assinatura não tem acesso').toBe(false);

    await admin('/rest/v1/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        plan_slug: 'mensal',
        status: 'active',
        current_period_end: new Date(Date.now() - 86_400_000).toISOString(),
      }),
    });
    expect(await perguntar(), 'vencida não pode passar').toBe(false);

    await admin(`/rest/v1/subscriptions?user_id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'canceled', current_period_end: null }),
    });
    expect(await perguntar(), 'cancelada não pode passar').toBe(false);

    await admin(`/rest/v1/subscriptions?user_id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active' }),
    });
    expect(await perguntar(), 'ativa sem prazo tem acesso').toBe(true);
  });

  test('ninguém consegue se dar um plano com o próprio token', async ({ context, baseURL }) => {
    const { id, accessToken } = await signIn(context, baseURL!);
    userId = id;

    // exatamente o que o navegador da pessoa tem em mãos
    const resposta = await fetch(`${SUPABASE}/rest/v1/subscriptions`, {
      method: 'POST',
      headers: {
        apikey: ANON!,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId, plan_slug: 'mensal', status: 'active' }),
    });

    expect(resposta.status).toBeGreaterThanOrEqual(400);

    const linhas = await (
      await admin(`/rest/v1/subscriptions?user_id=eq.${userId}&select=user_id`)
    ).json();
    expect(linhas).toHaveLength(0);
  });

  test('nem alterar uma assinatura que já existe', async ({ context, baseURL }) => {
    const { id, accessToken } = await signIn(context, baseURL!);
    userId = id;

    await admin('/rest/v1/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, plan_slug: 'mensal', status: 'canceled' }),
    });

    const resposta = await fetch(`${SUPABASE}/rest/v1/subscriptions?user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        apikey: ANON!,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'active' }),
    });

    // a policy de UPDATE não existe: nada muda
    const [linha] = await (
      await admin(`/rest/v1/subscriptions?user_id=eq.${userId}&select=status`)
    ).json();
    expect(linha.status).toBe('canceled');
    expect(resposta.status).toBeLessThan(500);
  });

  test('o webhook recusa evento sem assinatura válida', async ({ baseURL }) => {
    const resposta = await fetch(`${baseURL}/api/billing/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'customer.subscription.updated', data: { object: {} } }),
    });

    // 400 sem assinatura, 503 quando a cobrança nem está ligada — nunca 200
    expect([400, 503]).toContain(resposta.status);
  });

  test('a concessão do admin fica registrada na auditoria', async ({ context, page, baseURL }) => {
    test.setTimeout(120_000);
    ({ id: userId } = await signIn(context, baseURL!));

    await admin(`/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_admin: true }),
    });

    const outro = await (
      await admin('/auth/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: `alvo-${crypto.randomUUID()}@p20x.test`,
          password: `T-${crypto.randomUUID()}`,
          email_confirm: true,
        }),
      })
    ).json();
    outroId = outro.id;

    await page.goto(`/admin/usuarios/${outroId}`);
    await expect(page.getByText('Sem plano pago. Está no Livre.')).toBeVisible({ timeout: 20_000 });

    // motivo único: o log é compartilhado e acumula entre execuções
    marca = `teste ${crypto.randomUUID()}`;

    await page.getByRole('button', { name: 'P20X Completo', exact: true }).click();
    await page.getByLabel('Motivo').fill(marca);
    await page.getByRole('button', { name: 'Conceder' }).click();
    await expect(page.getByText('Plano concedido.')).toBeVisible({ timeout: 30_000 });

    await page.goto('/admin/auditoria');
    await expect(page.getByText(marca)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Plano concedido').first()).toBeVisible();
  });

  test('o motivo é obrigatório ao conceder', async ({ context, page, baseURL }) => {
    test.setTimeout(120_000);
    ({ id: userId } = await signIn(context, baseURL!));

    await admin(`/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_admin: true }),
    });

    const outro = await (
      await admin('/auth/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: `alvo-${crypto.randomUUID()}@p20x.test`,
          password: `T-${crypto.randomUUID()}`,
          email_confirm: true,
        }),
      })
    ).json();
    outroId = outro.id;

    await page.goto(`/admin/usuarios/${outroId}`);
    await page.getByRole('button', { name: 'Conceder' }).click();
    await expect(page.getByText('O motivo fica no registro de auditoria.')).toBeVisible({
      timeout: 30_000,
    });

    const linhas = await (
      await admin(`/rest/v1/subscriptions?user_id=eq.${outroId}&select=user_id`)
    ).json();
    expect(linhas).toHaveLength(0);
  });
});
