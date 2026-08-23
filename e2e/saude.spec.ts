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
  const email = `saude-${crypto.randomUUID()}@p20x.test`;
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

test.describe('saúde', () => {
  test.skip(!configured, 'precisa das credenciais do Supabase');

  let userId = '';
  // o segundo usuário do teste de isolamento; sai mesmo se o teste falhar antes
  let outroId = '';

  test.afterEach(async () => {
    for (const id of [userId, outroId]) {
      if (id) await admin(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });
    }
    userId = '';
    outroId = '';
  });

  test('sem peso nem altura, pede os dois em vez de inventar números', async ({
    context,
    page,
    baseURL,
  }) => {
    userId = await signIn(context, baseURL!);

    await page.goto('/saude');
    await expect(page.getByText('Faltam dois números para começar.')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('main').getByRole('link', { name: 'REGISTRAR PESO' })).toBeVisible();
  });

  test('com peso, altura, nascimento e sexo, calcula tudo', async ({ context, page, baseURL }) => {
    test.setTimeout(120_000);
    userId = await signIn(context, baseURL!);

    await admin(`/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        height_cm: 178,
        birth_date: '1984-08-24',
        biological_sex: 'masculino',
        goal: 'perder_gordura',
      }),
    });

    await admin('/rest/v1/body_measurements', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        client_id: crypto.randomUUID(),
        measured_on: new Date().toISOString().slice(0, 10),
        weight_kg: 90,
      }),
    });

    await page.goto('/saude');
    await expect(page.getByRole('heading', { name: 'Saúde' })).toBeVisible({ timeout: 20_000 });

    // IMC de 90 kg com 1,78 m é 28,4 — acima da faixa
    await expect(page.getByText(/IMC é 28,4/)).toBeVisible();
    await expect(page.getByText('acima da faixa adequada')).toBeVisible();

    // faixa de referência, e não um peso "ideal" único
    await expect(page.getByText(/58,6 kg/)).toBeVisible();
    await expect(page.getByText(/78,9 kg/)).toBeVisible();
    await expect(page.getByText(/11,1 kg/)).toBeVisible();

    // proteína a 2,0 g/kg porque o objetivo é perder gordura
    await expect(page.getByText('180 g')).toBeVisible();
    await expect(page.getByText(/2,0 g por quilo/)).toBeVisible();

    // calorias com déficit
    await expect(page.getByText(/kcal/).first()).toBeVisible();
    await expect(page.getByText(/−\d+ kcal/)).toBeVisible();

    // e o aviso de que isto não é prescrição
    await expect(page.getByText(/não de prescrição/)).toBeVisible();
  });

  test('a água do dia soma, desfaz e sobrevive a recarregar', async ({
    context,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    userId = await signIn(context, baseURL!);

    await admin(`/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ height_cm: 178, birth_date: '1990-01-01' }),
    });
    await admin('/rest/v1/body_measurements', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        client_id: crypto.randomUUID(),
        measured_on: new Date().toISOString().slice(0, 10),
        weight_kg: 80,
      }),
    });

    await page.goto('/saude');

    // 80 kg sem treino hoje: 2,8 L
    await expect(page.getByText('de 2,8 L')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: '500 ml Garrafa' }).click();
    await expect(page.getByText('0,5 L de 2,8 L')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: '200 ml Copo' }).click();
    await expect(page.getByText('0,7 L de 2,8 L')).toBeVisible({ timeout: 20_000 });

    // o número aparece na hora, mas só está guardado quando o indicador some
    await expect(page.getByLabel('Salvando')).toHaveCount(0, { timeout: 20_000 });

    // recarregar não perde o que foi bebido
    await page.reload();
    await expect(page.getByText('0,7 L de 2,8 L')).toBeVisible({ timeout: 20_000 });

    // e dá para corrigir para menos
    await page.getByRole('button', { name: 'Tirar 200 ml' }).click();
    await expect(page.getByText('0,5 L de 2,8 L')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel('Salvando')).toHaveCount(0, { timeout: 20_000 });

    const linhas = await (
      await admin(`/rest/v1/water_logs?user_id=eq.${userId}&select=ml`)
    ).json();
    expect((linhas as { ml: number }[])[0].ml).toBe(500);
  });

  test('a água de outra pessoa não é somada na minha', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);

    // um segundo usuário com água registrada hoje
    const outro = await (
      await admin('/auth/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: `outro-${crypto.randomUUID()}@p20x.test`,
          password: `T-${crypto.randomUUID()}`,
          email_confirm: true,
        }),
      })
    ).json();
    outroId = outro.id;

    await admin('/rest/v1/water_logs', {
      method: 'POST',
      body: JSON.stringify({
        user_id: outro.id,
        day: new Date().toISOString().slice(0, 10),
        ml: 3000,
      }),
    });

    await admin(`/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ height_cm: 170 }),
    });
    await admin('/rest/v1/body_measurements', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        client_id: crypto.randomUUID(),
        measured_on: new Date().toISOString().slice(0, 10),
        weight_kg: 70,
      }),
    });

    await page.goto('/saude');
    await expect(page.getByText(/0,0 L de/)).toBeVisible({ timeout: 20_000 });

  });
});
