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

    /**
     * Todo ícone que o manifest promete precisa existir de verdade.
     *
     * Conferir um caminho fixo deixava passar o caso que aconteceu: os ícones
     * mudaram de rota gerada para arquivo estático e o manifest foi junto — o
     * teste continuou apontando para o endereço velho. Lendo do manifest, ele
     * acompanha a mudança e ainda pega o inverso: um ícone declarado que não
     * responde, que é o que faz a instalação falhar sem explicação.
     */
    const icones = body.icons as { src: string; type: string; sizes: string; purpose?: string }[];
    expect(icones.length, 'o manifest precisa declarar ícones').toBeGreaterThan(0);

    for (const icone of icones) {
      const resposta = await request.get(icone.src);
      expect(resposta.ok(), `ícone declarado e ausente: ${icone.src}`).toBeTruthy();
      expect(resposta.headers()['content-type']).toContain('image/');
    }

    // o badge da notificação não entra no manifest, mas o service worker usa
    const badge = await request.get('/icons/badge');
    expect(badge.ok(), 'o badge da notificação sumiu').toBeTruthy();

    /**
     * O que o Android exige para instalar de verdade, e não só criar atalho:
     * ícone de 192 e de 512 com `purpose: any`, `display` autônomo e `id`
     * fixo. As capturas não são exigência, mas são elas que trocam a barra
     * mínima pela caixa de instalação rica — a diferença entre alguém instalar
     * e alguém achar que instalou.
     */
    const tamanhos = icones.filter((icone) => icone.purpose !== 'maskable');
    expect(tamanhos.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(body.display);
    expect(body.id, 'sem id, uma mudança de start_url vira um segundo app').toBeTruthy();

    for (const captura of (body.screenshots ?? []) as { src: string }[]) {
      const resposta = await request.get(captura.src);
      expect(resposta.ok(), `captura declarada e ausente: ${captura.src}`).toBeTruthy();
    }
    expect((body.screenshots ?? []).length, 'sem captura, o Android mostra a barra mínima').toBeGreaterThan(0);
  });

  test('o login recusa credenciais vazias sem quebrar', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill('nao-e-um-email');
    await page.getByLabel('Senha').fill('123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText('E-mail inválido')).toBeVisible();
  });
});
