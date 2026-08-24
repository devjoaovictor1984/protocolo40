import { expect, test, type BrowserContext } from '@playwright/test';

/**
 * Convites.
 *
 * O que precisa estar certo: o vínculo é gravado uma vez e nunca muda,
 * ninguém convida a si mesmo, e o convite só conta quando a pessoa realmente
 * termina o cadastro. Um sistema de indicação que aceita conta descartável
 * vira um placar de quem cria mais e-mails.
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

type Conta = { id: string; username: string; email: string; senha: string };

/** Cria a conta. `pronto` decide se o onboarding já está concluído. */
async function criar(pronto = true): Promise<Conta> {
  const email = `conv-${crypto.randomUUID()}@p20x.test`;
  const senha = `Teste-${crypto.randomUUID()}`;

  const { id } = await (
    await admin('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password: senha, email_confirm: true }),
    })
  ).json();

  const username = `conv${id.replace(/-/g, '').slice(0, 12)}`;

  await admin(`/rest/v1/profiles?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      username,
      full_name: 'Pessoa Convidada',
      ...(pronto ? { onboarding_completed_at: new Date().toISOString() } : {}),
    }),
  });

  return { id, username, email, senha };
}

async function entrar(context: BrowserContext, baseURL: string, conta: Conta) {
  const session = await (
    await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: conta.email, password: conta.senha }),
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
}

/** Chama a função como se fosse o usuário logado, com o token real dele. */
async function registrarConvite(conta: Conta, username: string) {
  const session = await (
    await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: conta.email, password: conta.senha }),
    })
  ).json();

  const resposta = await fetch(`${SUPABASE}/rest/v1/rpc/registrar_convite`, {
    method: 'POST',
    headers: {
      apikey: ANON!,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_username: username }),
  });

  return resposta.json();
}

test.describe('convites', () => {
  test.skip(!configured, 'precisa das credenciais do Supabase');

  const criadas: string[] = [];

  test.afterEach(async () => {
    for (const id of criadas.splice(0)) {
      await admin(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });
    }
  });

  test('a página do convite mostra quem convidou e guarda o crédito', async ({ page, baseURL }) => {
    const padrinho = await criar();
    criadas.push(padrinho.id);

    await page.goto(`/convite/${padrinho.username}`);

    await expect(page.getByText('Pessoa Convidada')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/está te chamando para o P20X/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'CRIAR MINHA CONTA' })).toBeVisible();

    // o crédito viaja num cookie, porque o cadastro pode passar pelo Google
    const cookies = await page.context().cookies(baseURL!);
    const convite = cookies.find((c) => c.name === 'p20x_convite');
    expect(convite?.value).toBe(padrinho.username.toLowerCase());
    expect(convite?.httpOnly, 'o cookie não pode ser lido por script').toBe(true);
  });

  test('o vínculo é gravado uma vez e nunca muda', async () => {
    const padrinho = await criar();
    const outro = await criar();
    const convidado = await criar();
    criadas.push(padrinho.id, outro.id, convidado.id);

    expect(await registrarConvite(convidado, padrinho.username)).toBe('ok');

    // uma segunda tentativa não reatribui o convite
    expect(await registrarConvite(convidado, outro.username)).toBe('ja_tem');

    const [perfil] = await (
      await admin(`/rest/v1/profiles?id=eq.${convidado.id}&select=referred_by`)
    ).json();
    expect(perfil.referred_by).toBe(padrinho.id);
  });

  test('ninguém convida a si mesmo, nem usa um @usuário inexistente', async () => {
    const pessoa = await criar();
    criadas.push(pessoa.id);

    expect(await registrarConvite(pessoa, pessoa.username)).toBe('proprio');
    expect(await registrarConvite(pessoa, 'naoexisteesteusuario')).toBe('nao_achou');

    const [perfil] = await (
      await admin(`/rest/v1/profiles?id=eq.${pessoa.id}&select=referred_by`)
    ).json();
    expect(perfil.referred_by).toBeNull();
  });

  test('o convite só conta depois do onboarding, e vira insígnia', async ({
    context,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);

    const padrinho = await criar();
    const convidado = await criar(false); // ainda sem onboarding
    criadas.push(padrinho.id, convidado.id);

    expect(await registrarConvite(convidado, padrinho.username)).toBe('ok');

    const contar = async () => {
      const resposta = await admin('/rest/v1/rpc/contar_convites', {
        method: 'POST',
        body: JSON.stringify({ p_user: padrinho.id }),
      });
      return resposta.json();
    };

    expect(await contar(), 'cadastro incompleto não pode contar').toBe(0);

    // terminar o onboarding é o que faz o convite valer
    await admin(`/rest/v1/profiles?id=eq.${convidado.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ onboarding_completed_at: new Date().toISOString() }),
    });

    expect(await contar()).toBe(1);

    // e o gatilho concedeu a insígnia ao padrinho
    await expect
      .poll(
        async () => {
          const linhas = await (
            await admin(`/rest/v1/user_badges?user_id=eq.${padrinho.id}&select=badge_slug`)
          ).json();
          return (linhas as { badge_slug: string }[]).map((l) => l.badge_slug);
        },
        { timeout: 30_000, message: 'a insígnia de convite não foi concedida' },
      )
      .toContain('arauto');

    // e a tela mostra o número e o link
    await entrar(context, baseURL!, padrinho);
    await page.goto('/convidar');

    await expect(page.getByRole('heading', { name: 'Convidar' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(`/convite/${padrinho.username}`)).toBeVisible();
    await expect(page.getByText('pessoa entrou pelo seu convite')).toBeVisible();
    await expect(page.getByText('Arauto')).toBeVisible();
    await expect(page.getByText(/Faltam 4 pessoas para Recrutador/)).toBeVisible();
  });

  test('quem já tem conta não vê a tela de convite', async ({ context, page, baseURL }) => {
    const padrinho = await criar();
    const pessoa = await criar();
    criadas.push(padrinho.id, pessoa.id);

    await entrar(context, baseURL!, pessoa);

    await page.goto(`/convite/${padrinho.username}`);
    await page.waitForURL('**/hoje', { timeout: 20_000 });
  });
});
