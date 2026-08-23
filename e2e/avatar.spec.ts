import { deflateSync } from 'node:zlib';

import { expect, test, type BrowserContext } from '@playwright/test';

/**
 * Foto de perfil.
 *
 * Cobre o caminho inteiro: escolher o arquivo, recortar no aparelho, subir para
 * o bucket `avatars`, gravar o caminho no perfil e a imagem voltar acessível.
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
  const email = `avatar-${crypto.randomUUID()}@p20x.test`;
  const password = `Teste-${crypto.randomUUID()}`;

  const { id } = await (
    await admin('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, email_confirm: true }),
    })
  ).json();

  // o onboarding já concluído: o teste é sobre a foto, não sobre o cadastro
  await admin(`/rest/v1/profiles?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ onboarding_completed_at: new Date().toISOString(), full_name: 'João Victor' }),
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

const FOTO = pngQuadrado(64, [200, 70, 40]);

test.describe('foto de perfil', () => {
  test.skip(!configured, 'precisa das credenciais do Supabase');

  let userId = '';

  test.afterEach(async () => {
    if (userId) {
      await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
      userId = '';
    }
  });

  test('enviar, ver e remover a foto', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);

    await page.goto('/configuracoes/conta');
    await expect(page.getByRole('button', { name: 'Adicionar foto', exact: true })).toBeVisible();

    // como um usuário faria: toca no botão e escolhe o arquivo
    const [seletor] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Adicionar foto', exact: true }).click(),
    ]);
    await seletor.setFiles({ name: 'foto.png', mimeType: 'image/png', buffer: FOTO });

    await expect(page.getByText('Foto atualizada.')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Trocar foto', exact: true })).toBeVisible();

    // o caminho ficou gravado no perfil
    const [profile] = await (
      await admin(`/rest/v1/profiles?id=eq.${userId}&select=avatar_path`)
    ).json();
    expect(profile.avatar_path).toBe(`${userId}/avatar.webp`);

    // e o arquivo responde no bucket público
    const stored = await fetch(`${SUPABASE}/storage/v1/object/public/avatars/${profile.avatar_path}`);
    expect(stored.status).toBe(200);
    expect(stored.headers.get('content-type')).toContain('image');

    // a foto aparece no perfil
    await page.goto('/perfil');
    await expect(page.locator('img').first()).toBeVisible();

    // e dá para remover
    await page.goto('/configuracoes/conta');
    await page.getByRole('button', { name: 'Remover' }).click();
    await expect(page.getByText('Foto removida.')).toBeVisible({ timeout: 20_000 });

    const [depois] = await (
      await admin(`/rest/v1/profiles?id=eq.${userId}&select=avatar_path`)
    ).json();
    expect(depois.avatar_path).toBeNull();
  });

  test('ninguém escreve na pasta de outro usuário', async ({ context, page, baseURL }) => {
    userId = await signIn(context, baseURL!);

    await page.goto('/configuracoes/conta');

    // a policy do bucket amarra o primeiro nível da pasta ao auth.uid()
    const status = await page.evaluate(async ({ url, key }) => {
      const response = await fetch(`${url}/storage/v1/object/avatars/outro-usuario/avatar.webp`, {
        method: 'POST',
        headers: { apikey: key },
        body: new Blob(['x'], { type: 'image/webp' }),
      });
      return response.status;
    }, { url: SUPABASE!, key: ANON! });

    expect(status).toBeGreaterThanOrEqual(400);
  });
});
