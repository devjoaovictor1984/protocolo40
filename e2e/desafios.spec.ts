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
  async function criarDesafio(
    goal = 3,
    kind: 'treino' | 'alimentacao' = 'treino',
    duration_days: number | null = null,
  ) {
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
        kind,
        duration_days,
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
      await expect(page.getByText(/mostra seu @usuário e seus dias na lista/i)).toBeVisible();

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

  /**
   * O bug que os testes de um usuário só não pegavam.
   *
   * A policy de `challenge_participants` é `using (true)`, porque é dela que
   * sai o ranking. A consulta do app lia todas as inscrições sem filtrar por
   * usuário — então bastou **uma** pessoa entrar para o app achar que todo
   * mundo tinha entrado: o botão nascia dizendo "Sair do desafio", e sair não
   * fazia nada, porque o delete é corretamente limitado ao próprio usuário.
   *
   * Com um participante só na base de teste, nada disso aparecia.
   */
  test('a inscrição de um não inscreve os outros', async ({ context, page, baseURL }) => {
    const primeiro = await novoUsuario();
    const segundo = await novoUsuario();
    const { slug, title } = await criarDesafio(3);

    try {
      // o primeiro entra de verdade
      await gravarSessao(context, baseURL!, primeiro.session);
      await page.goto(`/desafios/${slug}`);
      await page.getByRole('button', { name: 'ENTRAR NO DESAFIO' }).click();
      await expect(page.getByRole('button', { name: 'Sair do desafio' })).toBeVisible({
        timeout: 30_000,
      });

      // o segundo abre a mesma tela e precisa ver o convite, não a saída
      await gravarSessao(context, baseURL!, segundo.session);
      await page.goto(`/desafios/${slug}`);

      await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByRole('button', { name: 'ENTRAR NO DESAFIO' }),
        'quem não entrou não pode ver o botão de sair',
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sair do desafio' })).toHaveCount(0);

      // e na lista de desafios, o mesmo
      await page.goto('/desafios');
      const cartao = page.getByRole('article', { name: title }).first();
      await expect(cartao).toBeVisible({ timeout: 30_000 });
      await expect(cartao, 'o cartão convida quem ainda não entrou').toContainText(/Ver o desafio/);
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
      await expect(page.getByRole('region', { name: /Ranking|Já entraram/ })).toBeVisible();

      await page.getByRole('button', { name: 'Sair do desafio' }).click();
      await expect(page.getByRole('button', { name: 'ENTRAR NO DESAFIO' })).toBeVisible({
        timeout: 30_000,
      });

      // e o ranking voltou a estar vazio
      await expect(page.getByText('Ninguém entrou ainda. Seja o primeiro.').first()).toBeVisible();
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

      const ranking = page.getByRole('region', { name: /Ranking|Já entraram/ });
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
   * A verificação é na lista, e não na tela de Hoje: lá cabem só os do dia, e
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
      const cartao = page.getByRole('article', { name: title }).first();
      await expect(cartao).toBeVisible({ timeout: 30_000 });
      await expect(cartao).toContainText(/3\s*de 5 dias/);
    } finally {
      await apagarDesafio(slug);
    }
  });

  /**
   * Entrar de novo não pode dizer que falhou.
   *
   * O `upsert` do PostgREST é `on conflict do update`, e no caminho do conflito
   * o Postgres passa a exigir a policy de UPDATE — que aqui é só de admin, de
   * propósito, porque ninguém marca a própria conclusão. O segundo toque voltava
   * `42501` e a tela dizia "não conseguimos te inscrever" para quem já estava
   * inscrito. Duas abas abertas é o jeito mais simples de reproduzir o que
   * acontece com toque duplo, aba velha e inscrição feita em outro aparelho.
   */
  test('entrar de novo não acusa erro para quem já está inscrito', async ({
    context,
    page,
    baseURL,
  }) => {
    const { session } = await novoUsuario();
    const { slug } = await criarDesafio(3);

    try {
      await gravarSessao(context, baseURL!, session);

      // a segunda aba carrega antes da inscrição: ela ainda mostra "ENTRAR"
      const aba = await context.newPage();
      await aba.goto(`/desafios/${slug}`);
      await expect(aba.getByRole('button', { name: 'ENTRAR NO DESAFIO' })).toBeVisible({
        timeout: 30_000,
      });

      await page.goto(`/desafios/${slug}`);
      await page.getByRole('button', { name: 'ENTRAR NO DESAFIO' }).click();
      await expect(page.getByRole('button', { name: 'Sair do desafio' })).toBeVisible({
        timeout: 30_000,
      });

      // e agora o toque da aba velha, que é o que quebrava
      await aba.getByRole('button', { name: 'ENTRAR NO DESAFIO' }).click();
      await expect(aba.getByRole('button', { name: 'Sair do desafio' })).toBeVisible({
        timeout: 30_000,
      });
      // e nenhuma mensagem de falha: o texto exato que a tela mostrava antes
      await expect(aba.getByText(/não conseguimos te inscrever/i)).toHaveCount(0);

      await aba.close();
    } finally {
      await apagarDesafio(slug);
    }
  });

  /**
   * O treino que ainda não subiu já conta no desafio.
   *
   * A contagem nasce no servidor, e é assim que tem que ser — ela sai dos
   * treinos gravados. Só que entre terminar o treino e a fila subir existe um
   * intervalo, e sem rede ele dura o que durar. Nesse intervalo a tela de Hoje
   * dizia "Dia 1 está feito" e o cartão do desafio dizia "hoje ainda está em
   * aberto", uma embaixo da outra.
   *
   * O teste corta a escrita de treinos no navegador: o treino fica no
   * IndexedDB, a fila não consegue subir, e o desafio tem que contar assim
   * mesmo.
   */
  test('o treino que a fila não subiu já conta no desafio', async ({
    context,
    page,
    baseURL,
  }) => {
    const { id, session } = await novoUsuario();
    const { slug, title } = await criarDesafio(3);

    // treino curto cai na confirmação de "tem certeza"
    page.on('dialog', (dialog) => void dialog.accept());

    try {
      await gravarSessao(context, baseURL!, session);

      await page.goto(`/desafios/${slug}`);
      await page.getByRole('button', { name: 'ENTRAR NO DESAFIO' }).click();
      await expect(page.getByRole('button', { name: 'Sair do desafio' })).toBeVisible({
        timeout: 30_000,
      });

      // a partir daqui nenhum treino chega ao servidor
      await page.route('**/rest/v1/workouts**', (route) => route.abort());

      await page.goto('/hoje');
      const cartao = page.getByLabel('Treino de hoje');
      await cartao.getByRole('link', { name: 'COMEÇAR TREINO' }).click();
      await page.waitForURL('**/treinar**');

      await page.getByRole('button', { name: /INICIAR MEUS 20 MINUTOS/ }).click();
      await expect(page.getByText('Restantes')).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(2000);

      await page.getByRole('button', { name: 'Finalizar' }).click();
      await expect(page.getByRole('heading', { name: /TREINO CONCLUÍDO/ })).toBeVisible({
        timeout: 20_000,
      });
      await page.getByRole('button', { name: 'CONCLUIR' }).click();
      await page.waitForURL('**/hoje', { timeout: 20_000 });

      // o treino realmente não subiu
      const linhas = await (await admin(`/rest/v1/workouts?user_id=eq.${id}&select=id`)).json();
      expect(linhas, 'o treino subiu e o teste deixou de valer').toHaveLength(0);

      // e mesmo assim o desafio já conta o dia
      await page.goto('/desafios');
      const doDesafio = page.getByRole('article', { name: title }).first();
      await expect(doDesafio).toBeVisible({ timeout: 30_000 });
      await expect(doDesafio).toContainText(/1\s*de 3 dias/);
      await expect(doDesafio).toContainText('Hoje está feito');

      // inclusive na tela do desafio, com a grade do mês
      await page.goto(`/desafios/${slug}`);
      const progresso = page.getByRole('region', { name: 'Seu progresso' });
      await expect(progresso).toContainText(/1\s*de 3 dias/, { timeout: 30_000 });
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
  /**
   * O desafio de alimentação não tem treino para contar: quem diz que venceu o
   * dia é a pessoa. O toque precisa aparecer na hora, ficar gravado e poder ser
   * desfeito — um dia marcado por engano não pode virar dia vencido.
   */
  test('no desafio de alimentação, a pessoa marca o dia vencido', async ({
    context,
    page,
    baseURL,
  }) => {
    const { session } = await novoUsuario();
    const { slug, title } = await criarDesafio(3, 'alimentacao');

    try {
      await gravarSessao(context, baseURL!, session);
      await page.goto(`/desafios/${slug}`);
      await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/Desafio de alimentação/)).toBeVisible();

      await page.getByRole('button', { name: 'ENTRAR NO DESAFIO' }).click();
      const progresso = page.getByRole('region', { name: 'Seu progresso' });
      await expect(progresso).toContainText(/0\s*de 3 dias/, { timeout: 30_000 });

      await progresso.getByRole('button', { name: 'VENCI HOJE' }).click();
      await expect(progresso.getByText('Hoje vencido')).toBeVisible();
      // a tela muda na hora; o botão só volta a responder quando o banco
      // confirmou — recarregar antes disso cortava a gravação no meio
      await expect(progresso.getByRole('button', { name: 'Desfazer' })).toBeEnabled();

      // gravado de verdade, não só na tela
      await page.reload();
      await expect(progresso).toContainText(/1\s*de 3 dias/, { timeout: 30_000 });
      await expect(progresso.getByText('Hoje vencido')).toBeVisible();

      // ontem ainda dá para marcar, e conta
      await progresso.getByRole('button', { name: /Venci ontem também/ }).click();
      await expect(progresso).toContainText(/2\s*de 3 dias/);
      await expect(progresso.getByRole('button', { name: 'Desfazer' })).toBeEnabled();

      // desfazer tira o dia
      await progresso.getByRole('button', { name: 'Desfazer' }).click();
      await expect(progresso.getByRole('button', { name: 'VENCI HOJE' })).toBeEnabled();
      await page.reload();
      await expect(progresso).toContainText(/1\s*de 3 dias/, { timeout: 30_000 });

      // a linha do tempo diz o estado de cada dia sem depender de cor
      await expect(
        page.getByRole('region', { name: 'Linha do tempo do desafio' }).getByText(/: vencido/),
      ).toHaveCount(1);
    } finally {
      await apagarDesafio(slug);
    }
  });
  /**
   * Com data pessoal, cada um começa os seus dias quando quiser: o desafio não
   * tem "Dia 7 de 21" para todo mundo, tem o dia de cada pessoa.
   */
  test('no desafio de data pessoal, a pessoa escolhe quando começa', async ({
    context,
    page,
    baseURL,
  }) => {
    const { session } = await novoUsuario();
    const { slug, title } = await criarDesafio(18, 'alimentacao', 21);

    try {
      await gravarSessao(context, baseURL!, session);
      await page.goto(`/desafios/${slug}`);
      await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/21 dias, você escolhe quando/)).toBeVisible();

      // a data já vem em hoje; é só confirmar
      await expect(page.getByLabel('Quando você começa?')).toBeVisible();
      await page.getByRole('button', { name: 'COMEÇAR MEUS 21 DIAS' }).click();

      const progresso = page.getByRole('region', { name: 'Seu progresso' });
      await expect(progresso).toContainText(/0\s*de 18 dias/, { timeout: 30_000 });
      await expect(page.getByText(/Dia 1 de 21/)).toBeVisible();

      // o primeiro dia é o de hoje: ontem é antes do começo e não se marca
      await expect(progresso.getByRole('button', { name: /Venci ontem/ })).toHaveCount(0);
      await progresso.getByRole('button', { name: 'VENCI HOJE' }).click();
      await expect(progresso.getByRole('button', { name: 'Desfazer' })).toBeEnabled();
      await expect(progresso).toContainText(/1\s*de 18 dias/);
    } finally {
      await apagarDesafio(slug);
    }
  });
});
