import { expect, test } from '@playwright/test';

import { apagarUsuario, criarSessao, gravarSessao, temCredenciais } from './sessao-fixtures';

/**
 * A demonstração do exercício no cartão do treino.
 *
 * O que importa aqui é o que a pessoa não vê: a animação grande não pode ser
 * baixada antes de alguém pedir, a janela precisa fechar pelos três caminhos
 * (X, fora, ESC) e quem pediu menos movimento não recebe animação nenhuma.
 */
test.describe('demonstração do exercício', () => {
  test.skip(!temCredenciais, 'precisa das credenciais do Supabase');

  let userId = '';

  test.beforeEach(async ({ context, baseURL }) => {
    const { id, session } = await criarSessao();
    userId = id;
    await gravarSessao(context, baseURL!, session);
  });

  test.afterEach(async () => {
    if (userId) await apagarUsuario(userId);
    userId = '';
  });

  test('miniatura no cartão, janela grande só ao tocar', async ({ page }, testInfo) => {
    const pedidos: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/exercises/')) pedidos.push(new URL(req.url()).pathname);
    });

    await page.goto('/treinos');

    const cartao = page.locator('article').filter({ has: page.getByRole('heading', { name: 'P20X Base' }) });
    const miniatura = cartao.getByRole('button', { name: 'Ver execução: Flexão' });
    await miniatura.scrollIntoViewIfNeeded();
    await expect(miniatura).toBeVisible();
    // exercício ainda sem arte fica sem botão, mas o cartão continua listando
    await expect(cartao.getByText('Agachamento', { exact: true })).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Ver execução: Agachamento' })).toHaveCount(0);

    await cartao.screenshot({ path: testInfo.outputPath('cartao.png') });
    expect(pedidos).not.toContain('/exercises/flexao/demo.webp');

    // abre e fecha no X
    await miniatura.click();
    const janela = page.getByRole('dialog', { name: 'Flexão' });
    await expect(janela).toBeVisible();
    await expect(janela.getByRole('img', { name: 'Demonstração do exercício Flexão' })).toBeVisible();
    expect(pedidos).toContain('/exercises/flexao/demo.webp');
    await page.waitForTimeout(400);
    await page.screenshot({ path: testInfo.outputPath('janela.png') });

    await janela.getByRole('button', { name: 'Fechar demonstração' }).click();
    await expect(janela).toBeHidden();
    await expect(miniatura).toBeFocused();

    // fecha no ESC
    await miniatura.click();
    await expect(janela).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(janela).toBeHidden();

    // fecha tocando fora
    await miniatura.click();
    await expect(janela).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(janela).toBeHidden();
  });

  test('com menos movimento, o mascote fica parado', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/treinos');

    const miniatura = page.getByRole('button', { name: 'Ver execução: Flexão' }).first();
    await miniatura.scrollIntoViewIfNeeded();
    const imagem = miniatura.locator('img');
    await expect.poll(() => imagem.evaluate((img: HTMLImageElement) => img.currentSrc)).toContain('/still.webp');
  });
});
