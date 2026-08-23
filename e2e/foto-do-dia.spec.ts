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
  const email = `foto-${crypto.randomUUID()}@p20x.test`;
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

const FOTO = pngQuadrado(64, [40, 120, 200]);

test.describe('foto de um dia anterior', () => {
  test.skip(!configured, 'precisa das credenciais do Supabase');

  let userId = '';

  test.afterEach(async () => {
    if (userId) {
      await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
      userId = '';
    }
  });

  test('registrar a foto de duas semanas atrás e virar o Dia 1', async ({
    context,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000); // upload de imagem + fila offline
    userId = await signIn(context, baseURL!);

    // o dia em que a pessoa realmente começou, bem antes do cadastro
    const inicio = new Date(Date.now() - 16 * 86_400_000).toISOString().slice(0, 10);

    await page.goto('/evolucao/fotos');

    const campo = page.getByLabel('Dia da foto');
    await expect(campo).toBeVisible({ timeout: 20_000 });
    await campo.fill(inicio);
    await expect(campo).toHaveValue(inicio);

    // depois de hidratar, o botão passa a falar da data escolhida — mas a data
    // salva tem de ser a do campo mesmo antes disso
    await expect(page.getByRole('button', { name: /Registrar foto de \d{2}\/\d{2}\// })).toBeVisible({
      timeout: 20_000,
    });

    // como um usuário faria: toca no botão e escolhe o arquivo
    const [seletor] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: /Registrar foto de / }).click(),
    ]);
    await seletor.setFiles({ name: 'dia1.png', mimeType: 'image/png', buffer: FOTO });

    await expect(page.getByText('Foto guardada.')).toBeVisible({ timeout: 30_000 });

    // chegou ao servidor com a data certa
    await expect
      .poll(
        async () => {
          const linhas = await (
            await admin(`/rest/v1/progress_photos?user_id=eq.${userId}&select=taken_on`)
          ).json();
          return linhas[0]?.taken_on ?? null;
        },
        { timeout: 40_000, message: 'a foto não chegou com a data escolhida' },
      )
      .toBe(inicio);

    // e o protocolo recuou: aquele dia virou o Dia 1
    await expect
      .poll(
        async () => {
          const linhas = await (
            await admin(`/rest/v1/profiles?id=eq.${userId}&select=protocol_started_on`)
          ).json();
          return linhas[0]?.protocol_started_on ?? null;
        },
        { timeout: 40_000, message: 'o início do protocolo não acompanhou a foto' },
      )
      .toBe(inicio);

    await page.reload();
    await expect(page.getByText('Dia 1 ·')).toBeVisible({ timeout: 20_000 });
  });

  test('o treino antigo leva direto à foto e ao peso daquele dia', async ({
    context,
    page,
    baseURL,
  }) => {
    userId = await signIn(context, baseURL!);
    const dia = new Date(Date.now() - 9 * 86_400_000).toISOString().slice(0, 10);

    await page.goto('/treino/registrar-dias');
    await page.getByRole('button', { name: 'últimos 14 dias' }).click();
    await page.getByRole('button', { name: /REGISTRAR/ }).click();
    await page.waitForURL(/\/(hoje|historico)/, { timeout: 30_000 });

    await page.goto('/historico');
    await page.getByText(dia.split('-').reverse().join('/')).first().click();
    await page.waitForURL(/\/treino\/[0-9a-f-]+$/, { timeout: 20_000 });

    // os dois atalhos que fecham o histórico do dia
    await page.getByRole('link', { name: 'Peso deste dia' }).click();
    await page.waitForURL(/\/medidas/, { timeout: 20_000 });
    await expect(page.getByLabel('Data')).toHaveValue(dia);

    await page.goBack();
    await page.getByRole('link', { name: 'Foto deste dia' }).click();
    await page.waitForURL(/\/evolucao\/fotos/, { timeout: 20_000 });
    await expect(page.getByLabel('Dia da foto')).toHaveValue(dia);
  });

  test('as miniaturas do comparar aparecem depois de passar pela galeria', async ({
    context,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    userId = await signIn(context, baseURL!);

    // duas fotos em dias diferentes, como quem está montando a comparação
    for (const [indice, dias] of [12, 0].entries()) {
      const dia = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);

      await page.goto('/evolucao/fotos');
      const campo = page.getByLabel('Dia da foto');
      await expect(campo).toBeVisible({ timeout: 20_000 });
      await campo.fill(dia);

      const [seletor] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByRole('button', { name: /Registrar foto/ }).click(),
      ]);
      await seletor.setFiles({
        name: `foto-${indice}.png`,
        mimeType: 'image/png',
        buffer: FOTO,
      });
      await expect(page.getByText('Foto guardada.')).toBeVisible({ timeout: 30_000 });
    }

    // as duas chegaram ao servidor
    await expect
      .poll(
        async () => {
          const linhas = await (
            await admin(`/rest/v1/progress_photos?user_id=eq.${userId}&select=id`)
          ).json();
          return (linhas as unknown[]).length;
        },
        { timeout: 40_000, message: 'as duas fotos não subiram' },
      )
      .toBe(2);

    // a galeria mostra as duas sem precisar recarregar
    await expect(page.locator('main img')).toHaveCount(2, { timeout: 20_000 });

    // sair da galeria revogava as object URLs guardadas no cache; a tela de
    // comparar recebia o mesmo cache e ficava com os seletores em branco
    await page.getByRole('link', { name: 'Comparar' }).click();
    await page.waitForURL('**/evolucao/comparar', { timeout: 20_000 });

    const seletorA = page.getByRole('group', { name: 'Foto A' });
    await expect(seletorA.locator('img')).toHaveCount(2, { timeout: 20_000 });

    // decodificadas de verdade, e não uma <img> com src morto
    for (const miniatura of await seletorA.locator('img').all()) {
      await expect
        .poll(async () => miniatura.evaluate((el: HTMLImageElement) => el.naturalWidth), {
          timeout: 15_000,
          message: 'a miniatura não carregou',
        })
        .toBeGreaterThan(0);
    }
  });
});
