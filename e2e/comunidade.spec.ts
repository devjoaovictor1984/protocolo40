import { expect, test, type BrowserContext } from '@playwright/test';

/**
 * Comunidade.
 *
 * O que importa aqui não é seguir funcionar: é o que NÃO vaza. Perfil privado
 * não aparece na busca, foto que ninguém expôs continua invisível mesmo para
 * quem segue, e ninguém consegue seguir quem não aceita seguidores.
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

type Conta = { id: string; username: string; accessToken: string };

/** Cria uma conta. `publico` decide se ela aparece para os outros. */
async function criarConta(publico: boolean): Promise<Conta> {
  const email = `com-${crypto.randomUUID()}@p20x.test`;
  const password = `Teste-${crypto.randomUUID()}`;

  const { id } = await (
    await admin('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, email_confirm: true }),
    })
  ).json();

  const username = `com${id.replace(/-/g, '').slice(0, 12)}`;

  await admin(`/rest/v1/profiles?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      onboarding_completed_at: new Date().toISOString(),
      full_name: 'Pessoa de Teste',
      username,
    }),
  });

  await admin(`/rest/v1/user_settings?user_id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      profile_visibility: publico ? 'public' : 'private',
      allow_followers: publico,
      streak_visibility: publico ? 'public' : 'private',
    }),
  });

  const session = await (
    await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  ).json();

  return { id, username, accessToken: session.access_token as string };
}

async function entrarComo(context: BrowserContext, baseURL: string, email: string, senha: string) {
  const session = await (
    await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senha }),
    })
  ).json();

  await gravarCookie(context, baseURL, session);
}

async function gravarCookie(context: BrowserContext, baseURL: string, session: unknown) {
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
}

/** Entra com uma conta recém-criada, devolvendo os dados dela. */
async function entrar(context: BrowserContext, baseURL: string, publico = true): Promise<Conta> {
  const email = `com-${crypto.randomUUID()}@p20x.test`;
  const password = `Teste-${crypto.randomUUID()}`;

  const { id } = await (
    await admin('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, email_confirm: true }),
    })
  ).json();

  const username = `com${id.replace(/-/g, '').slice(0, 12)}`;

  await admin(`/rest/v1/profiles?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      onboarding_completed_at: new Date().toISOString(),
      full_name: 'João de Teste',
      username,
    }),
  });

  await admin(`/rest/v1/user_settings?user_id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      profile_visibility: publico ? 'public' : 'private',
      allow_followers: publico,
      streak_visibility: publico ? 'public' : 'private',
    }),
  });

  await entrarComo(context, baseURL, email, password);

  const session = await (
    await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  ).json();

  return { id, username, accessToken: session.access_token as string };
}

test.describe('comunidade', () => {
  test.skip(!configured, 'precisa das credenciais do Supabase');

  const criadas: string[] = [];

  test.afterEach(async () => {
    for (const id of criadas.splice(0)) {
      await admin(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });
    }
  });

  test('encontrar alguém pelo @usuário e seguir', async ({ context, page, baseURL }) => {
    test.setTimeout(120_000);

    const eu = await entrar(context, baseURL!);
    const outro = await criarConta(true);
    criadas.push(eu.id, outro.id);

    await page.goto('/comunidade');
    await expect(page.getByRole('heading', { name: 'Comunidade' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Você ainda não segue ninguém.')).toBeVisible();

    await page.getByLabel('Buscar pessoas').fill(outro.username);
    await page.getByLabel('Buscar pessoas').press('Enter');
    await page.waitForURL(/q=/, { timeout: 20_000 });

    await expect(page.getByText(`@${outro.username}`)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Seguir' }).first().click();

    // primeiro o que importa: o servidor registrou
    await expect
      .poll(
        async () => {
          const linhas = await (
            await admin(`/rest/v1/followers?follower_id=eq.${eu.id}&select=following_id,status`)
          ).json();
          return (linhas as { following_id: string }[]).map((l) => l.following_id);
        },
        { timeout: 30_000, message: 'a relação não chegou ao servidor' },
      )
      .toEqual([outro.id]);

    // e a tela reflete
    await expect(page.getByRole('button', { name: 'Seguindo' }).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('perfil privado não aparece na busca', async ({ context, page, baseURL }) => {
    test.setTimeout(120_000);

    const eu = await entrar(context, baseURL!);
    const escondido = await criarConta(false);
    criadas.push(eu.id, escondido.id);

    await page.goto(`/comunidade?q=${escondido.username}`);
    await expect(page.getByText('Ninguém com esse nome por aqui.')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(`@${escondido.username}`)).toHaveCount(0);
  });

  test('não dá para seguir quem não aceita seguidores', async ({ context, baseURL }) => {
    const eu = await entrar(context, baseURL!);
    const escondido = await criarConta(false);
    criadas.push(eu.id, escondido.id);

    // a tentativa direta na API, com o token real de quem está logado
    const resposta = await fetch(`${SUPABASE}/rest/v1/followers`, {
      method: 'POST',
      headers: {
        apikey: ANON!,
        Authorization: `Bearer ${eu.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        follower_id: eu.id,
        following_id: escondido.id,
        status: 'accepted',
      }),
    });

    expect(resposta.status).toBeGreaterThanOrEqual(400);

    const linhas = await (
      await admin(`/rest/v1/followers?follower_id=eq.${eu.id}&select=following_id`)
    ).json();
    expect(linhas).toHaveLength(0);
  });

  test('ninguém segue em nome de outra pessoa', async ({ context, baseURL }) => {
    const eu = await entrar(context, baseURL!);
    const vitima = await criarConta(true);
    const alvo = await criarConta(true);
    criadas.push(eu.id, vitima.id, alvo.id);

    // tentar criar uma relação em que o seguidor é outra pessoa
    const resposta = await fetch(`${SUPABASE}/rest/v1/followers`, {
      method: 'POST',
      headers: {
        apikey: ANON!,
        Authorization: `Bearer ${eu.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        follower_id: vitima.id,
        following_id: alvo.id,
        status: 'accepted',
      }),
    });

    expect(resposta.status).toBeGreaterThanOrEqual(400);
  });

  test('o perfil público mostra insígnias e contagem de seguidores', async ({
    context,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);

    const eu = await entrar(context, baseURL!);
    const outro = await criarConta(true);
    criadas.push(eu.id, outro.id);

    // um treino garante a insígnia de Recruta para o outro
    await admin('/rest/v1/workouts', {
      method: 'POST',
      body: JSON.stringify({
        user_id: outro.id,
        client_id: crypto.randomUUID(),
        started_at: new Date().toISOString(),
        duration_seconds: 1200,
        workout_date: new Date().toISOString().slice(0, 10),
      }),
    });

    await admin('/rest/v1/followers', {
      method: 'POST',
      body: JSON.stringify({ follower_id: eu.id, following_id: outro.id, status: 'accepted' }),
    });

    await page.goto(`/u/${outro.username}`);
    await expect(page.getByRole('heading', { name: 'Pessoa de Teste' })).toBeVisible({
      timeout: 20_000,
    });

    await expect(page.getByText('1 seguidor')).toBeVisible();
    await expect(page.getByText('Insígnias')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Recruta')).toBeVisible();

    // e o botão já reflete que estou seguindo
    await expect(page.getByRole('button', { name: 'Seguindo' })).toBeVisible();
  });

  test('sem vitrine escolhida, o perfil não mostra antes e depois', async ({
    context,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);

    const eu = await entrar(context, baseURL!);
    const outro = await criarConta(true);
    criadas.push(eu.id, outro.id);

    await page.goto(`/u/${outro.username}`);
    await expect(page.getByRole('heading', { name: 'Pessoa de Teste' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Antes e depois')).toHaveCount(0);
  });

  test('foto privada continua invisível para quem segue', async ({ context, baseURL }) => {
    const eu = await entrar(context, baseURL!);
    const outro = await criarConta(true);
    criadas.push(eu.id, outro.id);

    await admin('/rest/v1/followers', {
      method: 'POST',
      body: JSON.stringify({ follower_id: eu.id, following_id: outro.id, status: 'accepted' }),
    });

    // uma foto do outro, privada como toda foto nasce
    await admin('/rest/v1/progress_photos', {
      method: 'POST',
      body: JSON.stringify({
        user_id: outro.id,
        client_id: crypto.randomUUID(),
        storage_path: `${outro.id}/x.webp`,
        thumbnail_path: `${outro.id}/x_thumb.webp`,
        taken_on: new Date().toISOString().slice(0, 10),
        visibility: 'private',
      }),
    });

    // com o meu token, a foto dele não existe
    const resposta = await fetch(
      `${SUPABASE}/rest/v1/progress_photos?user_id=eq.${outro.id}&select=id`,
      {
        headers: { apikey: ANON!, Authorization: `Bearer ${eu.accessToken}` },
      },
    );

    expect(await resposta.json()).toHaveLength(0);
  });
});
