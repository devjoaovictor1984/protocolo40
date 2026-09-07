import { expect, test } from '@playwright/test';

import { admin, apagarUsuario, criarSessao, gravarSessao, temCredenciais } from './sessao-fixtures';

/**
 * Trilha do Iniciante em Casa.
 *
 * O que precisa ser verdade: entrar é deliberado, a trilha anda com dias
 * treinados e não com o calendário, o mapa aparece antes do compromisso, e a
 * tela de Hoje passa a responder "sessão N" no lugar de "começar treino".
 */
test.describe('trilha', () => {
  test.skip(!temCredenciais, 'precisa das credenciais do Supabase');
  test.describe.configure({ timeout: 180_000 });

  const criados: string[] = [];

  const novoUsuario = async () => {
    const sessao = await criarSessao();
    criados.push(sessao.id);
    return sessao;
  };

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

  const hoje = () => new Date().toISOString().slice(0, 10);

  test.afterEach(async () => {
    for (const id of criados.splice(0)) await apagarUsuario(id);
  });

  test('o mapa vem antes do compromisso, e entrar é um clique só', async ({
    context,
    page,
    baseURL,
  }) => {
    const { session } = await novoUsuario();

    await gravarSessao(context, baseURL!, session);
    await page.goto('/trilha');

    await expect(page.getByRole('heading', { name: 'Trilha do Iniciante em Casa' })).toBeVisible({
      timeout: 30_000,
    });

    // quem ainda não entrou vê as 28 sessões e a razão de cada uma: a decisão
    // de começar não pode depender de confiar no que não se viu
    await expect(page.getByRole('heading', { name: /Semana 1 · Fundação/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Semana 4 · Graduação/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Sessão 1 — Fundação A/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Sessão 28 — Referência/ })).toBeVisible();

    // e a trilha diz que é privada antes do clique, não depois
    await expect(page.getByText(/ninguém vê em que sessão você está/i)).toBeVisible();

    await page.getByRole('button', { name: 'COMEÇAR A TRILHA' }).click();

    const progresso = page.getByRole('region', { name: 'Seu progresso na trilha' });
    await expect(progresso).toBeVisible({ timeout: 30_000 });
    await expect(progresso).toContainText(/0\s*de 28 sessões/);

    const proxima = page.getByRole('region', { name: 'Sua próxima sessão' });
    await expect(proxima).toContainText('Fundação A');
    await expect(page.getByRole('button', { name: 'Sair da trilha' })).toBeVisible();
  });

  test('a trilha anda com o dia treinado, não com o calendário', async ({
    context,
    page,
    baseURL,
  }) => {
    const { id, session } = await novoUsuario();

    // treino de ontem, gravado antes de entrar: não conta, porque a trilha
    // começa no dia da matrícula
    const ontem = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await registrarTreinos(id, [ontem]);

    await gravarSessao(context, baseURL!, session);
    await page.goto('/trilha');
    await page.getByRole('button', { name: 'COMEÇAR A TRILHA' }).click();

    const progresso = page.getByRole('region', { name: 'Seu progresso na trilha' });
    await expect(progresso).toContainText(/0\s*de 28 sessões/, { timeout: 30_000 });

    // agora um treino de hoje: uma sessão fecha, e nenhuma coluna foi escrita
    await registrarTreinos(id, [hoje()]);
    await page.reload();

    await expect(progresso).toContainText(/1\s*de 28 sessões/, { timeout: 30_000 });
    await expect(page.getByRole('region', { name: 'Sua próxima sessão' })).toContainText('Ritmo 1');
  });

  test('a tela de Hoje passa a responder com a sessão da trilha', async ({
    context,
    page,
    baseURL,
  }) => {
    const { session } = await novoUsuario();

    await gravarSessao(context, baseURL!, session);

    // antes de entrar, o convite; o cartão genérico continua sendo o do dia
    await page.goto('/hoje');
    await expect(page.getByRole('link', { name: /Trilha do Iniciante em Casa/ })).toBeVisible({
      timeout: 30_000,
    });

    await page.goto('/trilha');
    await page.getByRole('button', { name: 'COMEÇAR A TRILHA' }).click();
    await expect(page.getByRole('button', { name: 'Sair da trilha' })).toBeVisible({
      timeout: 30_000,
    });

    await page.goto('/hoje');
    const hojeCard = page.getByRole('region', { name: 'Sua sessão de hoje' });
    await expect(hojeCard).toBeVisible({ timeout: 30_000 });
    await expect(hojeCard).toContainText('Fundação A');
    await expect(hojeCard).toContainText(/Sessão 1 de 28/);
    await expect(hojeCard.getByRole('link', { name: /INICIAR SESSÃO 1/ })).toBeVisible();

    // e a trilha nunca é portaria: sair dela hoje custa um toque
    await expect(hojeCard.getByRole('link', { name: 'Prefiro outro treino hoje' })).toBeVisible();
  });

  test('os circuitos da trilha não poluem a lista de treinos', async ({
    context,
    page,
    baseURL,
  }) => {
    const { session } = await novoUsuario();

    await gravarSessao(context, baseURL!, session);
    await page.goto('/treinos');

    await expect(page.getByRole('heading', { name: 'Escolher um treino' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('heading', { name: 'P20X Start' })).toBeVisible();

    // "Fundação A+" sem o "A" antes não é um treino, é um pedaço de programa
    await expect(page.getByRole('heading', { name: 'Fundação A+' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Mobilidade guiada' })).toHaveCount(0);
  });
});
