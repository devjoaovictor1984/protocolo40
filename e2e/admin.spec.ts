import { deflateSync } from 'node:zlib';

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
  const email = `adm-${crypto.randomUUID()}@p20x.test`;
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

/** Gera um PNG válido de verdade: escrever o base64 à mão não decodifica. */
function pngQuadrado(lado: number, cor: [number, number, number]): Buffer {
  const bruto = Buffer.alloc(lado * (lado * 3 + 1));
  let cursor = 0;
  for (let y = 0; y < lado; y += 1) {
    bruto[cursor++] = 0; // filtro "none" no início de cada linha
    for (let x = 0; x < lado; x += 1) {
      bruto[cursor++] = cor[0];
      bruto[cursor++] = cor[1];
      bruto[cursor++] = cor[2];
    }
  }

  const bloco = (tipo: string, dados: Buffer) => {
    const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
    const tamanho = Buffer.alloc(4);
    tamanho.writeUInt32BE(dados.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(corpo) >>> 0);
    return Buffer.concat([tamanho, corpo, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(bruto)),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const PRINT = pngQuadrado(48, [220, 60, 60]);

/** Promove alguém a admin master pelo service role — é o que o dono faria. */
async function tornarAdmin(id: string) {
  await admin(`/rest/v1/profiles?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_admin: true }),
  });
}

test.describe('ajuda e administração', () => {
  test.skip(!configured, 'precisa das credenciais do Supabase');

  let userId = '';

  test.afterEach(async () => {
    if (userId) {
      await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
      userId = '';
    }
  });

  test('quem não é admin não enxerga a área nem o link', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);

    await page.goto('/configuracoes');
    await expect(page.getByRole('link', { name: 'Ajuda e sugestões' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Administração' })).toHaveCount(0);

    // e a rota direta não existe para ele
    const resposta = await page.goto('/admin');
    expect(resposta?.status()).toBe(404);
  });

  test('mandar um chamado com print, o admin responder e a resposta voltar', async ({
    context,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    userId = await signIn(context, baseURL!);

    await page.goto('/ajuda');
    await page.getByRole('button', { name: 'Algo deu errado' }).click();
    await page.getByLabel('Título').fill('O cronômetro parou sozinho');
    await page
      .getByLabel('O que aconteceu?')
      .fill('Coloquei o telefone no bolso e quando voltei o tempo estava congelado.');

    const [seletor] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Anexar um print' }).click(),
    ]);
    await seletor.setFiles({ name: 'print.png', mimeType: 'image/png', buffer: PRINT });
    await expect(page.getByAltText('Print escolhido')).toBeVisible();

    await page.getByRole('button', { name: 'ENVIAR' }).click();
    await expect(page.getByText('Recebemos seu contato. Obrigado.')).toBeVisible({
      timeout: 30_000,
    });

    // chegou ao banco, com o print anexado
    const [ticket] = await (
      await admin(
        `/rest/v1/support_tickets?user_id=eq.${userId}&select=id,title,kind,status,screenshot_path`,
      )
    ).json();
    expect(ticket.title).toBe('O cronômetro parou sozinho');
    expect(ticket.kind).toBe('erro');
    expect(ticket.status).toBe('aberto');
    expect(ticket.screenshot_path).toContain(userId);

    // e aparece na própria tela de ajuda
    await page.reload();
    await expect(page.getByText('O cronômetro parou sozinho')).toBeVisible({ timeout: 20_000 });

    // agora como admin
    await tornarAdmin(userId);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Administração' })).toBeVisible();

    await page.getByRole('link', { name: /^Chamados/ }).click();
    await page.waitForURL('**/admin/chamados', { timeout: 20_000 });
    await page.getByText('O cronômetro parou sozinho').click();
    await page.waitForURL(/\/admin\/chamados\/[0-9a-f-]+/, { timeout: 20_000 });

    // o print privado é exibido por URL assinada
    await expect(page.getByAltText('Print enviado pelo usuário')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Resolvido' }).click();
    await page.getByLabel('Resposta para quem escreveu').fill('Corrigido: agora o tempo vem do relógio.');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Resposta registrada.')).toBeVisible({ timeout: 30_000 });

    // quem abriu vê a resposta
    await page.goto('/ajuda');
    await expect(page.getByText('Corrigido: agora o tempo vem do relógio.')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Resolvido').first()).toBeVisible();
  });

  test('o admin lista usuários, pagina e abre um deles', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);
    await tornarAdmin(userId);

    await page.goto('/admin/usuarios');
    await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible({ timeout: 20_000 });

    // buscar pelo próprio @usuário devolve exatamente uma linha
    const [perfil] = await (
      await admin(`/rest/v1/profiles?id=eq.${userId}&select=username`)
    ).json();
    await page.getByLabel('Buscar usuário').fill(perfil.username);
    await page.getByLabel('Buscar usuário').press('Enter');
    await page.waitForURL(/q=/, { timeout: 20_000 });

    await page.getByText(`@${perfil.username}`).first().click();
    await page.waitForURL(/\/admin\/usuarios\/[0-9a-f-]+/, { timeout: 20_000 });
    await expect(page.getByText('Ações administrativas')).toBeVisible();

    // é a própria conta: as ações perigosas ficam desligadas
    await expect(page.getByText('Esta é a sua própria conta.')).toBeVisible();
  });
});
