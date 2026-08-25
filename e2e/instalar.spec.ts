import { expect, test } from '@playwright/test';

import { apagarUsuario, criarSessao, gravarSessao, temCredenciais } from './sessao-fixtures';

/**
 * O convite para instalar o app.
 *
 * O caminho do iPhone é o que mais importa e é o único sem API: o navegador
 * não oferece botão nenhum, então o app precisa ensinar o caminho manual. Se
 * essa instrução sumir, o iPhone fica sem instalação — e sem notificação, que
 * no iOS só existe com o app instalado.
 */
test.describe('instalar o app', () => {
  test.skip(!temCredenciais, 'precisa das credenciais do Supabase');
  test.describe.configure({ timeout: 120_000 });

  let userId = '';

  test.afterEach(async () => {
    if (userId) {
      await apagarUsuario(userId);
      userId = '';
    }
  });

  test('o convite aparece na tela de Hoje e explica o porquê', async ({
    context,
    page,
    baseURL,
  }) => {
    const { id, session } = await criarSessao();
    userId = id;

    await gravarSessao(context, baseURL!, session);
    await page.goto('/hoje');

    const convite = page.getByRole('region', { name: 'Instalar o app' });
    await expect(convite).toBeVisible({ timeout: 30_000 });

    // a razão é concreta, não "instale nosso app"
    await expect(convite).toContainText(/sem internet/i);
  });

  test('no iPhone, ensina o caminho manual — que é o único que existe', async ({
    context,
    page,
    baseURL,
  }) => {
    test.skip(test.info().project.name !== 'iphone', 'a instrução do iPhone só vale no WebKit');

    const { id, session } = await criarSessao();
    userId = id;

    await gravarSessao(context, baseURL!, session);
    await page.goto('/hoje');

    await page.getByRole('button', { name: 'COMO INSTALAR' }).click();

    await expect(page.getByRole('heading', { name: 'Instalar no iPhone' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Adicionar à Tela de Início')).toBeVisible();
    // o Chrome no iPhone não instala, e dizer isso evita um chamado no suporte
    await expect(page.getByText(/Safari/).first()).toBeVisible();
  });

  test('dispensar tira o convite e ele não volta ao recarregar', async ({
    context,
    page,
    baseURL,
  }) => {
    const { id, session } = await criarSessao();
    userId = id;

    await gravarSessao(context, baseURL!, session);
    await page.goto('/hoje');

    const convite = page.getByRole('region', { name: 'Instalar o app' });
    await expect(convite).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Dispensar por enquanto' }).click();
    await expect(convite).toHaveCount(0);

    await page.reload();
    await expect(page.getByText(/Bom dia|Boa tarde|Boa noite/)).toBeVisible({ timeout: 30_000 });
    await expect(convite).toHaveCount(0);
  });
});
