#!/usr/bin/env node
/**
 * Monta a demonstração animada de um exercício a partir dos quadros em PNG.
 *
 *   node scripts/demo-exercicio.mjs <slug> <quadro.png> <quadro.png> ... [--ms 500,250,450,250]
 *
 * Os quadros entram na ordem em que devem tocar, e o laço volta ao primeiro.
 * Para "alto → meio → baixo → meio → alto", passe o quadro do meio duas vezes:
 *
 *   node scripts/demo-exercicio.mjs flexao alto.png meio.png baixo.png meio.png
 *
 * `--ms` é quanto cada quadro fica na tela; sem ele, as pontas do movimento
 * (primeiro quadro e o do meio da lista) seguram um pouco mais que a passagem.
 *
 * Sai em `public/exercises/<slug>/`:
 *
 *   thumb.webp  animado, pequeno — é o que a lista de exercícios baixa
 *   demo.webp   animado, grande  — só baixa quando alguém abre a demonstração
 *   still.webp  o primeiro quadro parado, para quem pediu menos movimento
 *
 * Por que alinhar: a arte vem de geração de imagem, e cada quadro põe o mascote
 * num lugar e num tamanho um pouco diferentes. Tocados em sequência, ele "pula"
 * e as mãos escorregam. Aqui cada quadro é ancorado no que toca o chão — a
 * faixa de baixo do desenho, onde ficam pés e mãos — e reescalado (no máximo
 * 10%) para que esses apoios caiam sempre no mesmo lugar. O que se mexe passa a
 * ser só o movimento.
 *
 * Depois de gerar, registre o slug em `features/exercises/demos.ts` com a
 * largura e a altura que este script imprime.
 */

import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * A miniatura aparece com até 112px de largura; 224 cobre tela de densidade 2x.
 * O alfa é o que mais pesa num WebP com transparência, e na miniatura dá para
 * apertar: a borda do desenho é pequena demais para o serrilhado aparecer.
 */
const THUMB = { width: 224, height: 150, quality: 70, alphaQuality: 60 };
/** A demonstração abre com até ~500px; 720 cobre o celular em 2x sem pesar demais. */
const DEMO = { width: 720, height: 720, quality: 76, alphaQuality: 75 };
/** Respiro em volta do mascote, em fração do tamanho do conteúdo. */
const MARGEM = 0.04;
/** Pixel com alfa abaixo disto é fundo (halo de antisserrilhado não conta como corpo). */
const ALFA_MINIMO = 24;
/** Altura da faixa de baixo, em fração do maior lado do desenho, onde se procuram os apoios. */
const FAIXA_DE_APOIO = 0.12;

const args = process.argv.slice(2);
const iMs = args.indexOf('--ms');
const ms = iMs >= 0 ? args.splice(iMs, 2)[1].split(',').map(Number) : null;
const [slug, ...quadros] = args;

if (!slug || !/^[a-z0-9-]+$/.test(slug) || quadros.length < 2) {
  console.error('Uso: node scripts/demo-exercicio.mjs <slug> <quadro.png> <quadro.png> ... [--ms 500,250]');
  console.error('O slug é o mesmo do exercício no seed (ex.: flexao) e são pelo menos dois quadros.');
  process.exit(1);
}
if (ms && ms.length !== quadros.length) {
  console.error(`--ms tem ${ms.length} valores e há ${quadros.length} quadros: precisa de um para cada.`);
  process.exit(1);
}

/** Recorta o quadro no que não é transparente. */
async function recortar(arquivo) {
  const { data, info } = await sharp(arquivo)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] >= ALFA_MINIMO) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error(`${arquivo} é todo transparente.`);

  const width = x1 - x0 + 1;
  const height = y1 - y0 + 1;

  // os apoios: o que há de opaco na faixa de baixo do desenho
  const faixa = Math.round(Math.max(width, height) * FAIXA_DE_APOIO);
  let a0 = width, a1 = -1;
  for (let y = y1 - faixa; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (data[(y * info.width + x) * 4 + 3] >= ALFA_MINIMO) {
        if (x - x0 < a0) a0 = x - x0;
        if (x - x0 > a1) a1 = x - x0;
      }
    }
  }

  const buffer = await sharp(arquivo)
    .ensureAlpha()
    .extract({ left: x0, top: y0, width, height })
    .png()
    .toBuffer();
  return { buffer, width, height, apoioInicio: a0, apoioLargura: a1 - a0 + 1 };
}

const recortes = await Promise.all(quadros.map(recortar));

// o primeiro quadro é a régua: os outros são levados à mesma distância entre apoios
const regua = recortes[0];
const ajustados = await Promise.all(
  recortes.map(async (r) => {
    const escala = Math.min(1.1, Math.max(0.9, regua.apoioLargura / r.apoioLargura));
    const width = Math.round(r.width * escala);
    const height = Math.round(r.height * escala);
    return {
      buffer: await sharp(r.buffer).resize(width, height).png().toBuffer(),
      width,
      height,
      apoioInicio: Math.round(r.apoioInicio * escala),
    };
  }),
);

// uma tela só para todos, com o chão e o primeiro apoio de cada quadro no mesmo lugar
const antes = Math.max(...ajustados.map((r) => r.apoioInicio));
const depois = Math.max(...ajustados.map((r) => r.width - r.apoioInicio));
const conteudoA = Math.max(...ajustados.map((r) => r.height));
const margem = Math.round(Math.max(antes + depois, conteudoA) * MARGEM);
const telaL = antes + depois + margem * 2;
const telaA = conteudoA + margem * 2;

const alinhados = await Promise.all(
  ajustados.map((r) =>
    sharp({
      create: { width: telaL, height: telaA, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        {
          input: r.buffer,
          left: margem + antes - r.apoioInicio,
          top: telaA - margem - r.height,
        },
      ])
      .png()
      .toBuffer(),
  ),
);

const meio = Math.floor(quadros.length / 2);
const tempos = ms ?? quadros.map((_, i) => (i === 0 || i === meio ? 450 : 220));

async function animado({ width, height, quality, alphaQuality }, destino) {
  // redimensiona cada quadro antes de juntar: o `join` exige quadros do mesmo tamanho
  const menores = await Promise.all(
    alinhados.map((b) => sharp(b).resize({ width, height, fit: 'inside' }).png().toBuffer()),
  );
  const info = await sharp(menores, { join: { animated: true } })
    .webp({ quality, alphaQuality, effort: 6, loop: 0, delay: tempos })
    .toFile(destino);
  return info;
}

const pasta = join('public', 'exercises', slug);
mkdirSync(pasta, { recursive: true });

const thumb = await animado(THUMB, join(pasta, 'thumb.webp'));
const demo = await animado(DEMO, join(pasta, 'demo.webp'));
await sharp(alinhados[0])
  .resize({ width: DEMO.width, height: DEMO.height, fit: 'inside' })
  .webp({ quality: DEMO.quality, alphaQuality: DEMO.alphaQuality, effort: 6 })
  .toFile(join(pasta, 'still.webp'));

const kb = (arquivo) => `${(statSync(join(pasta, arquivo)).size / 1024).toFixed(1)} KB`;
const altura = Math.round(demo.height / quadros.length);

console.log(`\n${pasta}`);
console.log(`  thumb.webp  ${thumb.width}px  ${kb('thumb.webp')}`);
console.log(`  demo.webp   ${demo.width}×${altura}  ${kb('demo.webp')}`);
console.log(`  still.webp  ${kb('still.webp')}`);
console.log(`  quadros: ${quadros.length} · laço de ${tempos.reduce((a, b) => a + b, 0)} ms\n`);
console.log('Registre em features/exercises/demos.ts:');
console.log(`  '${slug}': { width: ${demo.width}, height: ${altura} },\n`);
