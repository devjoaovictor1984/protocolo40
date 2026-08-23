import { expect, test } from '@playwright/test';

test.describe('fundação', () => {
  test('a landing apresenta a proposta e leva ao cadastro', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('20 minutos');
    await page.getByRole('link', { name: 'COMEÇAR MEU PROTOCOLO' }).first().click();

    await expect(page).toHaveURL(/\/cadastro$/);
    await expect(page.getByRole('heading', { name: 'Comece seu protocolo' })).toBeVisible();
  });

  test('rota privada sem sessão volta para o login', async ({ page }) => {
    await page.goto('/hoje');

    await expect(page).toHaveURL(/\/login\?redirect=%2Fhoje$/);
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  });

  test('o app é instalável: manifest e ícones respondem', async ({ request }) => {
    const manifest = await request.get('/manifest.webmanifest');
    expect(manifest.ok()).toBeTruthy();

    const body = await manifest.json();
    expect(body.short_name).toBe('P20X');
    expect(body.display).toBe('standalone');

    const icon = await request.get('/icons/512');
    expect(icon.ok()).toBeTruthy();
    expect(icon.headers()['content-type']).toContain('image/png');
  });

  test('o login recusa credenciais vazias sem quebrar', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill('nao-e-um-email');
    await page.getByLabel('Senha').fill('123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText('E-mail inválido')).toBeVisible();
  });
});
