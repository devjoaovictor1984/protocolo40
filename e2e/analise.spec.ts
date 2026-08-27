import { expect, test, type BrowserContext } from '@playwright/test';

/**
 * Trazer o histórico junto.
 *
 * Quem já treinava antes de instalar precisa registrar os dias de trás — senão
 * a sequência começa do zero, que é justamente o que o produto promete não
 * fazer com você.
 */

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REF = process.env.SUPABASE_PROJECT_REF;

const configured = Boolean(SUPABASE && ANON && SECRET && REF) && !SUPABASE!.includes('placeholder');

const admin = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE}${path}`, {
    ...init,
    headers: {
      apikey: SECRET!,
      Authorization: `Bearer ${SECRET!}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

async function signIn(context: BrowserContext, baseURL: string) {
  const email = `anal-${crypto.randomUUID()}@p20x.test`;
  const password = `Teste-${crypto.randomUUID()}`;

  const { id } = await (
    await admin('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, email_confirm: true }),
    })
  ).json();

  await admin(`/rest/v1/profiles?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ onboarding_completed_at: new Date().toISOString(), full_name: 'João' }),
  });

  const session = await (
    await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  ).json();

  const encoded = `base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;
  const name = `sb-${REF}-auth-token`;
  const LIMIT = 3180;
  const { hostname } = new URL(baseURL);

  await context.addCookies(
    encoded.length <= LIMIT
      ? [{ name, value: encoded, domain: hostname, path: '/' }]
      : Array.from({ length: Math.ceil(encoded.length / LIMIT) }, (_, index) => ({
          name: `${name}.${index}`,
          value: encoded.slice(index * LIMIT, (index + 1) * LIMIT),
          domain: hostname,
          path: '/',
        })),
  );

  return id as string;
}

/** Cria treinos direto no banco: o que importa aqui é o diagnóstico. */
async function semear(
  userId: string,
  treinos: { diasAtras: number; effort: number; reps: number; sets: number }[],
) {
  const exercicios = await (
    await admin('/rest/v1/exercises?slug=eq.barra-fixa&select=id')
  ).json();
  const exerciseId = exercicios[0].id;

  for (const t of treinos) {
    const data = new Date(Date.now() - t.diasAtras * 86_400_000);
    const dia = data.toISOString().slice(0, 10);

    const [workout] = await (
      await admin('/rest/v1/workouts', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          user_id: userId,
          client_id: crypto.randomUUID(),
          started_at: data.toISOString(),
          duration_seconds: 1200,
          workout_date: dia,
          effort: t.effort,
          title: 'Treino de barra',
        }),
      })
    ).json();

    await admin('/rest/v1/workout_exercises', {
      method: 'POST',
      body: JSON.stringify({
        workout_id: workout.id,
        exercise_id: exerciseId,
        sets: t.sets,
        repetitions: t.reps,
        order_index: 0,
      }),
    });
  }
}

test.describe('análise', () => {
  test.skip(!configured, 'precisa das credenciais do Supabase');

  let userId = '';

  test.afterEach(async () => {
    if (userId) {
      await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
      userId = '';
    }
  });

  test('sem treino, a tela convida a começar em vez de inventar diagnóstico', async ({
    context,
    page,
    baseURL,
  }) => {
    userId = await signIn(context, baseURL!);

    await page.goto('/analise');
    await expect(page.getByText('Ainda não há o que analisar.')).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('main').getByRole('link', { name: 'COMEÇAR TREINO' }),
    ).toBeVisible();
  });

  test('esforço alto com volume caindo vira alerta de platô e plano de negativas', async ({
    context,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    userId = await signIn(context, baseURL!);

    await semear(userId, [
      // quatro semanas anteriores: volume maior
      { diasAtras: 33, effort: 8, reps: 8, sets: 3 },
      { diasAtras: 36, effort: 8, reps: 8, sets: 3 },
      { diasAtras: 40, effort: 8, reps: 8, sets: 3 },
      // janela atual: mesmo limite, menos volume
      { diasAtras: 2, effort: 9, reps: 3, sets: 2 },
      { diasAtras: 5, effort: 9, reps: 3, sets: 2 },
      { diasAtras: 9, effort: 10, reps: 3, sets: 2 },
    ]);

    await page.goto('/analise');
    await expect(page.getByRole('heading', { name: 'Análise' })).toBeVisible({ timeout: 20_000 });

    // o exercício analisado, com o esforço e a queda de volume
    await expect(page.getByRole('heading', { name: 'Barra fixa' })).toBeVisible();
    await expect(page.getByText(/esforço 9[.,]3\/10/).first()).toBeVisible();

    // o diagnóstico que motivou a tela
    await expect(page.getByText('Muito esforço, mesmo resultado')).toBeVisible();
    await expect(page.getByText('A barra pede degraus, não força de vontade')).toBeVisible();
    await expect(page.getByText(/negativas/).first()).toBeVisible();

    // e a base do porquê fica a um toque, sem poluir a leitura
    const porque = page.getByText('Por que isso funciona').first();
    await expect(porque).toBeVisible();
    await porque.click();
    await expect(page.getByText(/repetições da falha/).first()).toBeVisible();

    // o aviso de que isto não é avaliação médica está sempre visível
    await expect(page.getByText(/Não é avaliação médica/)).toBeVisible();
  });

  test('esforço declarado no fim do treino chega à análise', async ({ context, page, baseURL }) => {
    test.setTimeout(120_000);
    userId = await signIn(context, baseURL!);
    // treino de poucos segundos pede confirmação
    page.on('dialog', (dialog) => void dialog.accept());

    await page.goto('/treinar');
    // o cronômetro não começa sozinho: a tela de preparo mostra o treino primeiro
    await page.getByRole('button', { name: /INICIAR MEUS 20 MINUTOS/ }).click();
    await expect(page.getByText('Restantes')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Adicionar um round' }).click();
    await page.getByRole('button', { name: 'Finalizar' }).click();
    await expect(page.getByRole('heading', { name: /TREINO CONCLUÍDO/ })).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Esforço 9 de 10' }).click();
    await expect(page.getByText('9/10')).toBeVisible();

    await page.getByRole('button', { name: 'CONCLUIR' }).click();
    await page.waitForURL('**/hoje', { timeout: 20_000 });

    await expect
      .poll(
        async () => {
          const linhas = await (
            await admin(`/rest/v1/workouts?user_id=eq.${userId}&select=effort`)
          ).json();
          return (linhas as { effort: number | null }[])[0]?.effort ?? null;
        },
        // a fila sobe CREATE e depois UPDATE; com três workers no mesmo
        // servidor de desenvolvimento isso pode levar um bom tempo
        { timeout: 90_000, message: 'o esforço não chegou ao servidor' },
      )
      .toBe(9);

    // o treino livre não tem exercícios: o esforço aparece no resumo da janela
    await page.goto('/analise');
    await expect(page.getByText(/esforço médio 9[.,]0\/10/)).toBeVisible({ timeout: 20_000 });
  });
});
