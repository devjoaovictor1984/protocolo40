import { expect, test } from '@playwright/test';

import { admin, apagarUsuario, criarSessao, gravarSessao, temCredenciais } from './sessao-fixtures';

/**
 * A Trilha do Iniciante e o treino guiado.
 *
 * O que precisa ser verdade: o treino guiado conduz sozinho — exercício,
 * descanso que acaba e chama o próximo, prancha que conta sozinha — e grava o
 * dia no fim; o novato recebe o convite e pode recusar de verdade; e o dia de
 * descanso da trilha se cumpre registrando o descanso.
 */
test.describe('trilha do novato', () => {
  test.skip(!temCredenciais, 'precisa das credenciais do Supabase');
  test.describe.configure({ timeout: 180_000 });

  const criados: string[] = [];
  const novoUsuario = async () => {
    const sessao = await criarSessao();
    criados.push(sessao.id);
    return sessao;
  };

  test.afterEach(async () => {
    for (const id of criados.splice(0)) await apagarUsuario(id);
  });

  const exercicio = async (slug: string) =>
    (await (await admin(`/rest/v1/exercises?slug=eq.${slug}&owner_id=is.null&select=id`)).json())[0].id as string;

  test('o treino guiado conduz passo a passo até salvar', async ({ context, page, baseURL }) => {
    const { session } = await novoUsuario();
    const id = crypto.randomUUID();

    // um guiado curtinho: 2 voltas de 3 polichinelos e 3 s de prancha, 2 s de descanso
    await admin('/rest/v1/workout_templates', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id,
        owner_id: null,
        title: `Guiado de teste ${id.slice(0, 6)}`,
        method: 'guiado',
        level: 'iniciante',
        place: 'casa',
        estimated_seconds: 120,
        program_only: true,
        rounds: 2,
        rest_seconds: 2,
        round_rest_seconds: 2,
      }),
    });
    await admin('/rest/v1/workout_template_exercises', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([
        // as duas linhas com as mesmas chaves: o PostgREST recusa lote com
        // objetos diferentes, e a recusa passava em silêncio
        { template_id: id, exercise_id: await exercicio('polichinelo'), sets: 1, repetitions: 3, duration_seconds: null, order_index: 1 },
        { template_id: id, exercise_id: await exercicio('prancha'), sets: 1, repetitions: null, duration_seconds: 3, order_index: 2 },
      ]),
    });

    try {
      await gravarSessao(context, baseURL!, session);
      await page.goto(`/treinar?template=${id}`);

      // a tela de preparo diz o que vem, sem o sino de intervalo
      await expect(page.getByRole('button', { name: 'COMEÇAR TREINO GUIADO' })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('2 voltas · descanso de 2 s entre exercícios')).toBeVisible();
      await page.getByRole('button', { name: 'COMEÇAR TREINO GUIADO' }).click();

      const guia = page.getByRole('region', { name: 'Treino guiado' });

      for (const volta of [1, 2]) {
        await expect(guia.getByText(`Volta ${volta} de 2 · 1 de 2`)).toBeVisible({ timeout: 15_000 });
        await expect(guia.getByRole('heading', { name: 'Polichinelo' })).toBeVisible();
        await guia.getByRole('button', { name: 'FEITO' }).click();

        // o descanso mostra o próximo e acaba sozinho
        await expect(guia.getByText('Descanse')).toBeVisible();
        await expect(guia.getByText('A seguir')).toBeVisible();
        await expect(guia.getByRole('heading', { name: 'Prancha' })).toBeVisible({ timeout: 10_000 });

        // a prancha conta sozinha depois do toque
        await guia.getByRole('button', { name: 'COMEÇAR 3 S' }).click();
        if (volta === 1) {
          // entre as voltas, pular o descanso também funciona
          await expect(guia.getByText('Fim da volta · Descanse')).toBeVisible({ timeout: 10_000 });
          await guia.getByRole('button', { name: 'PULAR DESCANSO' }).click();
        }
      }

      const fim = page.getByRole('region', { name: 'Treino concluído' });
      await expect(fim.getByText('Treino completo')).toBeVisible({ timeout: 15_000 });
      await fim.getByRole('button', { name: 'FINALIZAR E SALVAR' }).click();

      await page.waitForURL('**/treino/*/finalizar', { timeout: 30_000 });
    } finally {
      await admin(`/rest/v1/workout_templates?id=eq.${id}`, { method: 'DELETE' });
    }
  });

  test('o novato recebe o convite, e "agora não" vale', async ({ context, page, baseURL }) => {
    const { id, session } = await novoUsuario();
    await gravarSessao(context, baseURL!, session);

    await page.goto('/hoje');
    const convite = page.getByRole('region', { name: 'Trilha do Iniciante' });
    await expect(convite).toBeVisible({ timeout: 30_000 });
    await expect(convite).toContainText('quer que a gente te guie nos primeiros 30 dias?');

    await convite.getByRole('button', { name: /Agora não/ }).click();
    await expect(convite).toHaveCount(0, { timeout: 15_000 });

    // gravado no perfil, e não só escondido nesta tela
    await page.reload();
    await expect(page.getByRole('region', { name: 'Trilha do Iniciante' })).toHaveCount(0);
    const [perfil] = await (await admin(`/rest/v1/profiles?id=eq.${id}&select=track_offer_declined_at`)).json();
    expect(perfil.track_offer_declined_at).not.toBeNull();
  });

  test('aceitar o convite abre a trilha no dia 1', async ({ context, page, baseURL }) => {
    const { session } = await novoUsuario();
    await gravarSessao(context, baseURL!, session);

    await page.goto('/hoje');
    const convite = page.getByRole('region', { name: 'Trilha do Iniciante' });
    await convite.getByRole('button', { name: 'COMEÇAR A TRILHA' }).click();

    await expect(page.getByText(/Dia 1 de \d+/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('region', { name: 'Trilha do Iniciante' })).toHaveCount(0);
  });

  /**
   * Só roda com o programa de 30 dias no banco: é ele que tem o dia 7 de
   * descanso. Antes da migration do programa, o teste se declara pulado em vez
   * de passar por acaso.
   */
  test('depois de seis dias, o sétimo é descanso — e registrar faz a trilha andar', async ({
    context,
    page,
    baseURL,
  }) => {
    const [descanso] = await (
      await admin(
        '/rest/v1/track_sessions?focus=eq.descanso&position=eq.7&select=track_id,tracks(slug)',
      )
    ).json();
    test.skip(!descanso, 'o programa de 30 dias ainda não está no banco');

    const { id, session } = await novoUsuario();

    // entrou há seis dias e treinou os seis
    const dia = (atras: number) => {
      const d = new Date(Date.now() - atras * 86_400_000);
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
    };
    await admin('/rest/v1/track_enrollments', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ track_id: descanso.track_id, user_id: id, started_on: dia(6) }),
    });
    await admin('/rest/v1/workouts', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(
        [6, 5, 4, 3, 2, 1].map((atras) => ({
          user_id: id,
          client_id: crypto.randomUUID(),
          title: 'Treino de teste',
          started_at: `${dia(atras)}T12:00:00Z`,
          finished_at: `${dia(atras)}T12:15:00Z`,
          duration_seconds: 900,
          workout_date: dia(atras),
        })),
      ),
    });

    await gravarSessao(context, baseURL!, session);
    await page.goto('/hoje');

    const hoje = page.getByRole('region', { name: 'Seu dia de hoje na trilha' });
    await expect(hoje.getByRole('heading', { name: 'Hoje é descanso' })).toBeVisible({ timeout: 30_000 });
    await expect(hoje).toContainText('Dia 7 de 30');

    await hoje.getByRole('button', { name: 'REGISTRAR MEU DESCANSO' }).click();

    // o dia 7 contou: a trilha já aponta o 8
    await expect(page.getByText(/A seguir na trilha: dia 8/)).toBeVisible({ timeout: 30_000 });
  });
});
