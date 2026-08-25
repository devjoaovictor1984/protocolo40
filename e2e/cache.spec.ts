import { expect, test } from '@playwright/test';

import { apagarUsuario, criarSessao, gravarSessao, temCredenciais } from './sessao-fixtures';

/**
 * O que o service worker guarda no aparelho.
 *
 * Só roda contra um build de produção — em desenvolvimento o worker fica
 * desligado de propósito (veja `components/providers.tsx`), e foi exatamente por
 * isso que o bug de "ficar logando toda hora" passou por todo o resto da suíte:
 * o worker que causava o problema nunca existia durante os testes.
 *
 *   npm run build && npm start
 *   P20X_SW=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test e2e/cache.spec.ts
 */
test.describe('service worker', () => {
  test.skip(!process.env.P20X_SW, 'precisa de um build de produção — veja o topo do arquivo');
  test.skip(!temCredenciais, 'precisa das credenciais do Supabase');
  test.describe.configure({ timeout: 180_000 });

  let userId = '';

  test.afterEach(async () => {
    if (userId) {
      await apagarUsuario(userId);
      userId = '';
    }
  });

  /** Espera o worker assumir o controle da página. */
  const esperarWorker = (page: import('@playwright/test').Page) =>
    page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, {
      timeout: 60_000,
    });

  const chaves = (page: import('@playwright/test').Page, cache: string) =>
    page.evaluate(async (nome) => {
      if (!(await caches.has(nome))) return null;
      const c = await caches.open(nome);
      return (await c.keys()).map((r) => new URL(r.url).pathname);
    }, cache);

  test('a tela de treino fica guardada, e só ela', async ({ context, page, baseURL }) => {
    const { id, session } = await criarSessao();
    userId = id;

    await gravarSessao(context, baseURL!, session);

    await page.goto('/hoje');
    await esperarWorker(page);

    // segunda visita: agora com o worker no controle, ela passa por ele
    await page.goto('/perfil');
    await page.goto('/comunidade');
    await page.goto('/hoje');
    await page.waitForTimeout(1500);

    const guardadas = await chaves(page, 'p20x-treino');
    expect(guardadas, 'a tela de treino precisa abrir sem rede').toContain('/hoje');

    // e nada de tela de outra pessoa no disco deste aparelho
    for (const rota of ['/perfil', '/comunidade']) {
      expect(guardadas, `${rota} não pode ficar guardada`).not.toContain(rota);
    }

    const nomes = await page.evaluate(() => caches.keys());
    for (const proibido of ['pages', 'pages-rsc', 'pages-rsc-prefetch', 'others', 'p40-treino']) {
      expect(nomes, `o cache ${proibido} guardava página autenticada`).not.toContain(proibido);
    }
  });

  test('o desvio para o login nunca vira o conteúdo de /hoje', async ({
    context,
    page,
    baseURL,
  }) => {
    const { id, session } = await criarSessao();
    userId = id;

    await gravarSessao(context, baseURL!, session);
    await page.goto('/perfil');
    await esperarWorker(page);

    // Apaga a sessão sem avisar o app: é o que acontece quando a renovação
    // falha no meio de uma rede ruim. A navegação seguinte leva ao login.
    //
    // Precisa ser navegação do roteador, e não `page.goto`: numa navegação dura
    // o desvio chega como resposta opaca e o cache recusa sozinho. É o payload
    // RSC — o que o app busca ao trocar de tela sem recarregar — que o worker
    // antigo guardava sem olhar, desvio e tudo, sob a chave da tela pedida.
    await context.clearCookies();
    await page.getByRole('link', { name: 'Hoje', exact: true }).first().click();
    await page.waitForURL(/\/login/, { timeout: 30_000 });
    await page.waitForTimeout(2000);

    // Se o desvio tivesse sido guardado, a partir daqui /hoje seria o login para
    // sempre — e a pessoa entraria de novo todo dia sem entender por quê.
    const suspeitos = await page.evaluate(async () => {
      const achados: { cache: string; trecho: string }[] = [];

      for (const nome of await caches.keys()) {
        const cache = await caches.open(nome);

        for (const req of await cache.keys()) {
          if (new URL(req.url).pathname !== '/hoje') continue;

          const corpo = await (await cache.match(req))!.text();
          if (/name=\?"password\?"|Esqueci a senha|Entrar com o Google/.test(corpo)) {
            achados.push({ cache: nome, trecho: corpo.slice(0, 120) });
          }
        }
      }

      return achados;
    });

    expect(
      suspeitos,
      'a tela de login ficou guardada sob a chave de /hoje — é isso que faz a pessoa entrar de novo todo dia',
    ).toEqual([]);
  });

  /**
   * A landing ficava no precache, e o precache é servido antes de a requisição
   * sair do aparelho. O proxy nunca chegava a mandar para o painel quem já
   * está logado — no app instalado, a marca levava sempre à tela de visitante.
   */
  test('a landing não vem do cache, então o desvio para o painel funciona', async ({
    context,
    page,
    baseURL,
  }) => {
    const { id, session } = await criarSessao();
    userId = id;

    await gravarSessao(context, baseURL!, session);
    await page.goto('/hoje');
    await esperarWorker(page);

    const precacheada = await page.evaluate(async () => {
      for (const nome of await caches.keys()) {
        if (!nome.includes('precache')) continue;
        const cache = await caches.open(nome);
        for (const req of await cache.keys()) {
          if (new URL(req.url).pathname === '/') return true;
        }
      }
      return false;
    });

    expect(precacheada, 'a landing precacheada engole o desvio para o painel').toBe(false);

    await page.goto('/');
    await expect(page).toHaveURL(/\/hoje/, { timeout: 30_000 });
  });

  test('sair da conta limpa a tela guardada', async ({ context, page, baseURL }) => {
    const { id, session } = await criarSessao();
    userId = id;

    await gravarSessao(context, baseURL!, session);
    await page.goto('/hoje');
    await esperarWorker(page);
    await page.goto('/hoje');
    await page.waitForTimeout(1500);

    expect(await chaves(page, 'p20x-treino')).toContain('/hoje');

    await page.goto('/configuracoes');

    // o botão é de componente cliente: clicar antes da hidratação não faz nada
    const sair = page.getByRole('button', { name: 'Sair da conta' });
    await expect(sair).toBeEnabled({ timeout: 30_000 });
    await page.waitForLoadState('networkidle');
    await sair.click();
    await page.waitForURL(/\/(login|$)/, { timeout: 30_000 });
    await page.waitForTimeout(1500);

    // o próximo dono do aparelho não vê o nome nem a sequência de quem saiu
    const sobrou = await chaves(page, 'p20x-treino');
    expect(sobrou === null || sobrou.length === 0, `sobrou ${JSON.stringify(sobrou)}`).toBe(true);
  });
});
