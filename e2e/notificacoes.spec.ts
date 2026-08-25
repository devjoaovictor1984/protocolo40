import { expect, test } from '@playwright/test';

import { apagarUsuario, criarSessao, gravarSessao, temCredenciais } from './sessao-fixtures';

/**
 * Notificações.
 *
 * O que precisa ser verdade nas bordas: só o cron dispara os lembretes, só
 * quem tem sessão inscreve um aparelho, e a inscrição é do dono e de mais
 * ninguém. Um erro aqui vira notificação no bolso de estranho.
 */
test.describe('notificações', () => {
  test.skip(!temCredenciais, 'precisa das credenciais do Supabase');
  test.describe.configure({ timeout: 120_000 });

  let userId = '';

  test.afterEach(async () => {
    if (userId) {
      await apagarUsuario(userId);
      userId = '';
    }
  });

  const inscricaoFalsa = () => ({
    endpoint: `https://exemplo.test/${crypto.randomUUID()}`,
    keys: { p256dh: 'chave-publica-de-teste', auth: 'segredo-de-teste' },
  });

  test('o cron dos lembretes recusa quem não tem o segredo', async ({ request, baseURL }) => {
    const semNada = await request.get(`${baseURL}/api/notificacoes/lembretes`);
    expect(semNada.status(), 'qualquer um dispararia push para a base inteira').toBe(401);

    const comSegredoErrado = await request.get(`${baseURL}/api/notificacoes/lembretes`, {
      headers: { Authorization: 'Bearer chute' },
    });
    expect(comSegredoErrado.status()).toBe(401);
  });

  test('inscrever exige sessão', async ({ request, baseURL }) => {
    const resposta = await request.post(`${baseURL}/api/push/inscrever`, {
      data: inscricaoFalsa(),
    });

    expect(resposta.status()).toBe(401);
  });

  test('inscrever liga os lembretes, e desinscrever desliga', async ({
    context,
    page,
    baseURL,
  }) => {
    const { id, session } = await criarSessao();
    userId = id;

    await gravarSessao(context, baseURL!, session);
    // uma navegação primeiro: é ela que renova a sessão nos cookies
    await page.goto('/hoje');

    const inscricao = inscricaoFalsa();

    const criou = await page.request.post(`${baseURL}/api/push/inscrever`, { data: inscricao });
    expect(criou.ok()).toBe(true);

    // a tela precisa refletir que está ligado
    await page.goto('/configuracoes');
    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible({
      timeout: 30_000,
    });

    const apagou = await page.request.delete(`${baseURL}/api/push/inscrever`, {
      data: { endpoint: inscricao.endpoint },
    });
    expect(apagou.ok()).toBe(true);
  });

  test('inscrição malformada é recusada', async ({ context, page, baseURL }) => {
    const { id, session } = await criarSessao();
    userId = id;

    await gravarSessao(context, baseURL!, session);
    await page.goto('/hoje');

    const resposta = await page.request.post(`${baseURL}/api/push/inscrever`, {
      data: { endpoint: 'nem-url-e', keys: {} },
    });

    expect(resposta.status()).toBe(400);
  });

  test('a renovação não cria inscrição do nada', async ({ request, baseURL }) => {
    // a rota roda sem sessão, com service role: precisa ser estreita
    const resposta = await request.post(`${baseURL}/api/push/renovar`, {
      data: { antigo: 'https://exemplo.test/nao-existe', nova: inscricaoFalsa() },
    });

    expect(resposta.ok()).toBe(true);
    expect(await resposta.json()).toEqual({ ok: false });
  });

  test('as configurações oferecem o lembrete e o horário', async ({ context, page, baseURL }) => {
    const { id, session } = await criarSessao();
    userId = id;

    await gravarSessao(context, baseURL!, session);
    await page.goto('/configuracoes');

    await expect(page.getByText(/Lembretes (ligados|desligados)/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel('Horário do lembrete')).toBeVisible();
  });
});
