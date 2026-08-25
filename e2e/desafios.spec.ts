import { expect, test } from '@playwright/test';

import { admin, apagarUsuario, criarSessao, gravarSessao, temCredenciais } from './sessao-fixtures';

/**
 * Desafios.
 *
 * O que precisa ser verdade: o progresso sai dos treinos e não de uma coluna,
 * entrar é deliberado, e o ranking mostra constância sem nunca vazar peso,
 * medida ou foto — que é a promessa que a tela faz antes do clique.
 */
test.describe('desafios', () => {
  test.skip(!temCredenciais, 'precisa das credenciais do Supabase');
  test.describe.configure({ timeout: 180_000 });

  const criados: string[] = [];

  const novoUsuario = async () => {
    const sessao = await criarSessao();
    criados.push(sessao.id);
    return sessao;
  };

  /** Um desafio de teste, com janela em volta de hoje. */
  async function criarDesafio(goal = 3) {
    const marca = crypto.randomUUID().slice(0, 8);
    const slug = `teste-${marca}`;
    // título único: os testes rodam em paralelo e o desafio de um worker
    // aparecia na tela do outro
    const title = `Desafio ${marca}`;
    const hoje = new Date();
    const inicio = new Date(hoje.getTime() - 5 * 86_400_000).toISOString().slice(0, 10);
    const fim = new Date(hoje.getTime() + 5 * 86_400_000).toISOString().slice(0, 10);

    await admin('/rest/v1/challenges', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        slug,
        title,
        tagline: '20 minutos. Todos os dias.',
        description: 'Um desafio criado por teste automatizado.\n\nSegundo parágrafo.',
        starts_on: inicio,
        ends_on: fim,
        goal,
        is_active: true,
      }),
    });

    return { slug, title, inicio, fim };
  }

  const apagarDesafio = (slug: string) =>
    admin(`/rest/v1/challenges?slug=eq.${slug}`, { method: 'DELETE' });

  /** Grava treinos concluídos direto, para não depender do cronômetro. */
  async function registrarTreinos(userId: string, dias: string[]) {
    await admin('/rest/v1/workouts', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(
        dias.map((dia) => ({
          user_id: userId,
          client_id: crypto.randomUUID(),
          title: 'Treino de teste',
          started_at: `${dia}T10:00:00Z`,
          finished_at: `${dia}T10:20:00Z`,
          duration_seconds: 1200,
          workout_date: dia,
        })),
      ),
    });
  }

  test.afterEach(async () => {
    for (const id of criados.splice(0)) await apagarUsuario(id);
  });

  test('entrar é deliberado, e o progresso vem dos treinos', async ({ context, page, baseURL }) => {
    const { id, session } = await novoUsuario();
    const { slug, title, inicio } = await criarDesafio(3);

    try {
      // dois treinos dentro da janela, gravados antes de entrar no desafio:
      // o progresso é contado, não acumulado a partir da inscrição
      const d1 = inicio;
      const d2 = new Date(new Date(inicio).getTime() + 86_400_000).toISOString().slice(0, 10);
      await registrarTreinos(id, [d1, d2]);

      await gravarSessao(context, baseURL!, session);
      await page.goto(`/desafios/${slug}`);

      // antes de entrar não há barra nenhuma, só o convite
      await expect(page.getByRole('heading', { name: title })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByRole('button', { name: 'ENTRAR NO DESAFIO' })).toBeVisible();

      // e o app avisa o que entrar significa, antes do clique
      await expect(page.getByText(/mostra seu @usuário e seus dias no ranking/i)).toBeVisible();

      await page.getByRole('button', { name: 'ENTRAR NO DESAFIO' }).click();

      // agora os dois treinos que já existiam contam
      const progresso = page.getByRole('region', { name: 'Seu progresso' });
      await expect(progresso).toBeVisible({ timeout: 30_000 });
      await expect(progresso).toContainText(/2\s*de 3 dias/);
      await expect(page.getByRole('button', { name: 'Sair do desafio' })).toBeVisible();
    } finally {
      await apagarDesafio(slug);
    }
  });

  test('sair tira do ranking na hora', async ({ context, page, baseURL }) => {
    const { id, session } = await novoUsuario();
    const { slug, inicio } = await criarDesafio(3);

    try {
      await registrarTreinos(id, [inicio]);
      await gravarSessao(context, baseURL!, session);

      await page.goto(`/desafios/${slug}`);
      await page.getByRole('button', { name: 'ENTRAR NO DESAFIO' }).click();
      await expect(page.getByRole('button', { name: 'Sair do desafio' })).toBeVisible({
        timeout: 30_000,
      });

      // apareceu no ranking
      await expect(page.getByRole('region', { name: 'Ranking' })).toBeVisible();

      await page.getByRole('button', { name: 'Sair do desafio' }).click();
      await expect(page.getByRole('button', { name: 'ENTRAR NO DESAFIO' })).toBeVisible({
        timeout: 30_000,
      });

      // e o ranking voltou a estar vazio
      await expect(page.getByText('O ranking aparece quando alguém entrar.')).toBeVisible();
    } finally {
      await apagarDesafio(slug);
    }
  });

  /**
   * A regra que não pode quebrar: entrar num desafio expõe constância, e só.
   * O ranking passa por uma função SECURITY DEFINER, que é exatamente o tipo de
   * lugar onde uma coluna a mais no `select` vaza corpo sem ninguém notar.
   */
  test('o ranking mostra dias, nunca peso nem medida', async ({ context, page, baseURL }) => {
    const outro = await novoUsuario();
    const eu = await novoUsuario();
    const { slug, inicio } = await criarDesafio(3);

    try {
      await registrarTreinos(outro.id, [inicio]);

      // a outra pessoa tem peso e medida registrados
      await admin('/rest/v1/body_measurements', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: outro.id,
          client_id: crypto.randomUUID(),
          measured_on: inicio,
          weight_kg: 87.3,
          waist_cm: 94.5,
        }),
      });

      // e um @usuário previsível, para achar no ranking
      const username = `d${outro.id.replace(/-/g, '').slice(0, 12)}`;
      await admin(`/rest/v1/profiles?id=eq.${outro.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ username }),
      });

      // ela entra no desafio
      const { data: desafio } = await (
        await admin(`/rest/v1/challenges?slug=eq.${slug}&select=id`)
      ).json().then((linhas: { id: string }[]) => ({ data: linhas[0] }));

      await admin('/rest/v1/challenge_participants', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ challenge_id: desafio.id, user_id: outro.id }),
      });

      await gravarSessao(context, baseURL!, eu.session);
      await page.goto(`/desafios/${slug}`);

      const ranking = page.getByRole('region', { name: 'Ranking' });
      await expect(ranking).toBeVisible({ timeout: 30_000 });

      // a constância aparece
      await expect(ranking.getByText('1', { exact: true })).toBeVisible();

      // o corpo não
      const conteudo = await page.content();
      expect(conteudo, 'o peso vazou para o ranking').not.toContain('87.3');
      expect(conteudo, 'o peso vazou para o ranking').not.toContain('87,3');
      expect(conteudo, 'a medida vazou para o ranking').not.toContain('94.5');
      expect(conteudo, 'a medida vazou para o ranking').not.toContain('94,5');
    } finally {
      await apagarDesafio(slug);
    }
  });

  test('o desafio aparece na tela de Hoje e na barra de baixo', async ({
    context,
    page,
    baseURL,
  }) => {
    const { session } = await novoUsuario();
    const { slug, title } = await criarDesafio(3);

    try {
      await gravarSessao(context, baseURL!, session);
      await page.goto('/hoje');

      // um desafio qualquer aparece: qual deles é escolha do destaque, e com os
      // testes em paralelo o vencedor pode ser o de outro worker
      await expect(page.getByRole('link', { name: /Desafio /i }).first()).toBeVisible({
        timeout: 30_000,
      });

      // e o caminho pela navegação existe
      await page.goto('/desafios');
      await expect(page.getByRole('heading', { name: 'Desafios', exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText(title).first()).toBeVisible();
    } finally {
      await apagarDesafio(slug);
    }
  });

  /**
   * O cartão pedia os dias com o slug escrito à mão. Funcionava enquanto
   * existisse um desafio só — e no dia em que outro entrasse em destaque, a
   * barra mostraria os dias do desafio errado para todo mundo ao mesmo tempo.
   *
   * A verificação é na lista, e não na tela de Hoje: lá cabe um desafio só, e
   * com os testes rodando em paralelo o destaque pode ser o de outro worker.
   * Qual desafio vira destaque é regra pura, testada em `tests/challenges`.
   */
  test('a barra mostra os dias de cada desafio, não de um slug fixo', async ({
    context,
    page,
    baseURL,
  }) => {
    const { id, session } = await novoUsuario();
    const { slug, title, inicio } = await criarDesafio(5);

    try {
      const d2 = new Date(new Date(inicio).getTime() + 86_400_000).toISOString().slice(0, 10);
      const d3 = new Date(new Date(inicio).getTime() + 2 * 86_400_000).toISOString().slice(0, 10);
      await registrarTreinos(id, [inicio, d2, d3]);

      await gravarSessao(context, baseURL!, session);

      await page.goto(`/desafios/${slug}`);
      await page.getByRole('button', { name: 'ENTRAR NO DESAFIO' }).click();
      await expect(page.getByRole('button', { name: 'Sair do desafio' })).toBeVisible({
        timeout: 30_000,
      });

      // a lista mostra o progresso deste desafio, e não uma barra zerada
      await page.goto('/desafios');
      const cartao = page.getByRole('link', { name: new RegExp(title) }).first();
      await expect(cartao).toBeVisible({ timeout: 30_000 });
      await expect(cartao).toContainText(/3\s*de 5 dias/);
    } finally {
      await apagarDesafio(slug);
    }
  });

  test('desafio desligado some das telas', async ({ context, page, baseURL }) => {
    const { session } = await novoUsuario();
    const { slug, title } = await criarDesafio(3);

    try {
      await admin(`/rest/v1/challenges?slug=eq.${slug}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false }),
      });

      await gravarSessao(context, baseURL!, session);
      await page.goto('/desafios');
      await expect(page.getByRole('heading', { name: 'Desafios', exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText(title)).toHaveCount(0);
    } finally {
      await apagarDesafio(slug);
    }
  });
});
