import { expect, test } from '@playwright/test';

import {
  COOKIE,
  admin,
  apagarUsuario,
  criarSessao,
  gravarSessao,
  lerSessao,
  temCredenciais,
  vencida,
} from './sessao-fixtures';

/**
 * Persistência da sessão.
 *
 * Um usuário relatou ter que entrar de novo o tempo todo. O token de acesso do
 * Supabase dura uma hora; o de renovação, semanas. Se a renovação funcionar,
 * entrar uma vez basta — e é isso que estes testes verificam, sem esperar uma
 * hora: a sessão é forjada com o acesso já vencido e a renovação intacta, que é
 * exatamente o estado em que o app encontra alguém que voltou no dia seguinte.
 */
test.describe('sessão', () => {
  test.skip(!temCredenciais, 'precisa das credenciais do Supabase');
  test.describe.configure({ timeout: 120_000 });

  let userId = '';

  test.afterEach(async () => {
    if (userId) {
      await apagarUsuario(userId);
      userId = '';
    }
  });

  test('token de acesso vencido é renovado sem mandar ninguém para o login', async ({
    context,
    page,
    baseURL,
  }) => {
    const { id, session } = await criarSessao();
    userId = id;

    await gravarSessao(context, baseURL!, vencida(session));
    await page.goto('/hoje');

    await expect(page).toHaveURL(/\/hoje/, { timeout: 30_000 });
    await expect(page.getByText(/Bom dia|Boa tarde|Boa noite/)).toBeVisible({ timeout: 30_000 });
  });

  test('a sessão renovada é gravada de volta no navegador', async ({ context, page, baseURL }) => {
    const { id, session } = await criarSessao();
    userId = id;

    await gravarSessao(context, baseURL!, vencida(session));
    await page.goto('/hoje');
    await expect(page.getByText(/Bom dia|Boa tarde|Boa noite/)).toBeVisible({ timeout: 30_000 });

    // se ficar o token antigo, a próxima visita renova de novo — e uma hora
    // depois, quando a renovação falhar, alguém cai no login
    const salva = await lerSessao(context, baseURL!);

    expect(salva, 'o cookie de sessão sumiu').not.toBeNull();
    expect(salva!.expires_at * 1000, 'a sessão gravada continua vencida').toBeGreaterThan(
      Date.now(),
    );
    expect(salva!.access_token, 'o token não foi trocado').not.toBe(session.access_token);
  });

  test('o desvio do proxy carrega a sessão renovada', async ({ context, page, baseURL }) => {
    const { id, session } = await criarSessao();
    userId = id;

    await gravarSessao(context, baseURL!, vencida(session));

    // Um atalho antigo na tela inicial abre /login com a pessoa já logada, e o
    // proxy desvia para /hoje. Como o token venceu, ele renova antes de desviar
    // — e a rotação do Supabase mata o par antigo nesse instante. Se o desvio
    // não levar os cookies novos, o navegador fica com um par já morto.
    //
    // Pedimos sem seguir o desvio de propósito: seguindo, a requisição seguinte
    // renova outra vez e esconde o problema, porque dentro dos 10s de tolerância
    // de reuso o Supabase devolve o mesmo par. O que precisa ser verdade é que a
    // própria resposta do desvio traga a sessão.
    const resposta = await page.request.get(`${baseURL}/login`, { maxRedirects: 0 });

    expect(resposta.status(), 'era para o proxy desviar quem já está logado').toBe(307);

    const enviados = resposta
      .headersArray()
      .filter((h) => h.name.toLowerCase() === 'set-cookie')
      .map((h) => h.value);

    expect(
      enviados.some((c) => c.startsWith(COOKIE())),
      'o desvio saiu sem os cookies renovados: o navegador fica com o par que o servidor acabou de invalidar',
    ).toBe(true);

    await page.goto('/perfil');
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  });

  test('navegar por várias telas não derruba a sessão', async ({ context, page, baseURL }) => {
    const { id, session } = await criarSessao();
    userId = id;

    await gravarSessao(context, baseURL!, vencida(session));

    // a rotação do token de renovação é o ponto frágil: cada renovação invalida
    // a anterior, e navegar rápido dispara várias em sequência
    for (const rota of ['/hoje', '/calendario', '/evolucao', '/comunidade', '/perfil', '/hoje']) {
      await page.goto(rota);
      await expect(page, `caiu no login ao abrir ${rota}`).not.toHaveURL(/\/login/, {
        timeout: 20_000,
      });
    }
  });

  /**
   * Um usuário clicou na marca, foi parar na landing, viu o botão "Entrar" e
   * achou que tinha sido deslogado. A sessão estava intacta — o app é que
   * mostrava uma tela de visitante para quem já está dentro.
   */
  test('quem está logado nunca vê tela de visitante', async ({ context, page, baseURL }) => {
    const { id, session } = await criarSessao();
    userId = id;

    await gravarSessao(context, baseURL!, session);

    // a landing leva direto ao painel
    await page.goto('/');
    await expect(page).toHaveURL(/\/hoje/, { timeout: 30_000 });

    // e a marca, numa página pública de dentro do app, volta para o painel
    await page.goto(`/u/${crypto.randomUUID().slice(0, 8)}-ninguem`);
    await page.goto('/comunidade');
    await expect(page.getByRole('heading', { name: 'Comunidade' })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('a marca no perfil público leva ao painel, não à landing', async ({
    context,
    page,
    baseURL,
  }) => {
    const dono = await criarSessao();
    const visitante = await criarSessao();

    try {
      // o dono precisa de um @usuário para ter perfil público
      const username = `p${dono.id.replace(/-/g, '').slice(0, 12)}`;
      await admin(`/rest/v1/profiles?id=eq.${dono.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ username }),
      });

      await gravarSessao(context, baseURL!, visitante.session);
      await page.goto(`/u/${username}`);

      const marca = page.getByRole('link').first();
      await expect(marca).toHaveAttribute('href', '/hoje', { timeout: 30_000 });

      // e não convida a criar uma conta quem já tem uma
      await expect(page.getByRole('link', { name: /Começar meu protocolo/i })).toHaveCount(0);
    } finally {
      await apagarUsuario(dono.id);
      await apagarUsuario(visitante.id);
    }
  });

  test('só sai quem manda sair', async ({ context, page, baseURL }) => {
    const { id, session } = await criarSessao();
    userId = id;

    await gravarSessao(context, baseURL!, session);

    await page.goto('/configuracoes');

    // sair é um botão de componente cliente: clicar antes da hidratação não
    // dispara nada, e o clique se perde em silêncio
    const sair = page.getByRole('button', { name: 'Sair da conta' });
    await expect(sair).toBeEnabled({ timeout: 30_000 });
    await page.waitForLoadState('networkidle');

    await sair.click();
    await page.waitForURL(/\/(login|$)/, { timeout: 30_000 });

    // e aí sim a rota privada exige entrar de novo
    await page.goto('/hoje');
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
