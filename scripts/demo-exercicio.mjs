#!/usr/bin/env node
/**
 * Monta a demonstração animada de um exercício a partir dos quadros em PNG.
 *
 *   node scripts/demo-exercicio.mjs <slug> <quadro.png> ... [--vista lado|frente] [--ms 500,250,450,250]
 *
 * Os quadros entram na ordem em que devem tocar, e o laço volta ao primeiro.
 * Para "alto → meio → baixo → meio → alto", passe o quadro do meio duas vezes:
 *
 *   node scripts/demo-exercicio.mjs flexao alto.png meio.png baixo.png meio.png
 *
 * Ou uma folha só, com as poses lado a lado sobre fundo transparente — é o
 * formato que sai melhor da geração de imagem, porque o desenho mantém a mesma
 * escala e o mesmo chão sozinho:
 *
 *   node scripts/demo-exercicio.mjs agachamento --vista frente --folha poses.png
 *
 * As poses são separadas pelas colunas vazias entre elas e tocadas em ida e
 * volta: com três, 1 → 2 → 3 → 2 → 1. Movimento que alterna lados não é ida e
 * volta; `--ordem` escolhe a sequência (a marcha é `--ordem 1,2,1,3 --ponto cabeca`). De frente, a escala da folha fica como
 * veio — ela já sai numa só; de lado, os apoios ainda acertam o que variar.
 *
 * Exercício parado (prancha, cadeira na parede) é um quadro só: sai tudo
 * como imagem parada, e a lista mostra o mascote na posição, sem animar.
 *
 *   node scripts/demo-exercicio.mjs prancha prancha.png
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
 * num lugar e num tamanho diferentes. Tocados em sequência, ele "pula", cresce
 * e encolhe. Aqui todo quadro vai para o mesmo chão, na mesma escala, preso no
 * mesmo ponto — o que se mexe passa a ser só o movimento. Como achar a escala e
 * o ponto depende de onde a câmera está (`--vista`):
 *
 *   lado    (padrão; flexão, prancha) — a régua é a distância entre os apoios
 *           no chão, pés e mãos, e o ponto fixo é o pé. Eles não saem do lugar
 *           durante o movimento; a escala se corrige em no máximo 10%.
 *           Com `--ponto maos`, o ponto fixo são as mãos e a escala da folha
 *           fica como veio: é para quando o pé de trás se mexe de verdade
 *           (mountain climber), e medir pés–mãos inflaria o mascote.
 *
 * `--altura-da-folha` mantém a altura de cada pose como veio na folha, em vez
 * de apoiar todas no mesmo chão pela base do desenho. É para quando há um
 * aparelho que não se mexe (a barra fixa): pendurado, os pés passam da base
 * dos postes, e "apoiar no chão" faria a barra subir e descer. Implica
 * `--sem-escala`.
 *
 * `--sem-escala` deixa a escala da folha como veio em qualquer vista. É para
 * exercício deitado (abdominal): perto do chão estão pés, quadril, costas e,
 * em parte das poses, a cabeça — a "distância entre apoios" muda com o
 * movimento e não serve de régua.
 *   frente  (agachamento, polichinelo, marcha) — a régua é a largura do boné,
 *           a única parte do corpo que não muda de tamanho de frente (os pés
 *           abrem no agachamento fundo). O ponto fixo é o meio entre os pés
 *           no chão — ou, com `--ponto cabeca`, o meio da cabeça. A cabeça é
 *           para quando só um pé toca o chão (marcha): preso nele, o corpo
 *           pularia de lado a cada passo. Nos outros, os pés são mais firmes. A geração
 *           costuma encher a altura da imagem em todo quadro, então aqui a
 *           correção pode ser grande: o agachado sai do mesmo tamanho do em pé.
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
/** Altura da faixa de cima, em fração da altura do desenho, onde se mede o boné (vista de frente). */
const FAIXA_DA_CABECA = 0.05;

const args = process.argv.slice(2);
const iMs = args.indexOf('--ms');
const ms = iMs >= 0 ? args.splice(iMs, 2)[1].split(',').map(Number) : null;
const iVista = args.indexOf('--vista');
const vista = iVista >= 0 ? args.splice(iVista, 2)[1] : 'lado';
const iFolha = args.indexOf('--folha');
const folha = iFolha >= 0 ? args.splice(iFolha, 2)[1] : null;
const iPonto = args.indexOf('--ponto');
const ponto = iPonto >= 0 ? args.splice(iPonto, 2)[1] : 'pes';
const iSemEscala = args.indexOf('--sem-escala');
const semEscala = iSemEscala >= 0 && Boolean(args.splice(iSemEscala, 1));
const iAlturaDaFolha = args.indexOf('--altura-da-folha');
const alturaDaFolha = iAlturaDaFolha >= 0 && Boolean(args.splice(iAlturaDaFolha, 1));
const iOrdem = args.indexOf('--ordem');
const ordem = iOrdem >= 0 ? args.splice(iOrdem, 2)[1].split(',').map(Number) : null;
const [slug, ...soltos] = args;

/** Colunas vazias seguidas, em fração da largura da folha, que separam uma pose da outra. */
const VAO_ENTRE_POSES = 0.01;

/** Parte a folha nas poses, pelas colunas sem nada entre elas. */
async function separarFolha(arquivo) {
  const { data, info } = await sharp(arquivo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cheia = (x) => {
    for (let y = 0; y < info.height; y++) if (data[(y * info.width + x) * 4 + 3] >= ALFA_MINIMO) return true;
    return false;
  };

  const vaoMinimo = Math.round(info.width * VAO_ENTRE_POSES);
  const trechos = [];
  let inicio = -1, vazias = 0;
  for (let x = 0; x < info.width; x++) {
    if (cheia(x)) {
      if (inicio < 0) inicio = x;
      vazias = 0;
    } else if (inicio >= 0 && ++vazias >= vaoMinimo) {
      trechos.push([inicio, x - vazias]);
      inicio = -1;
    }
  }
  if (inicio >= 0) trechos.push([inicio, info.width - 1]);

  // a altura inteira da folha em cada pose: é ela que guarda o chão comum
  return Promise.all(
    trechos.map(([a, b]) =>
      sharp(arquivo).extract({ left: a, top: 0, width: b - a + 1, height: info.height }).png().toBuffer(),
    ),
  );
}

let quadros = soltos;
if (folha) {
  const poses = await separarFolha(folha);
  if (poses.length < 2) {
    console.error(`Achei ${poses.length} pose na folha: as poses precisam de espaço vazio entre elas.`);
    process.exit(1);
  }
  if (ordem) {
    const fora = ordem.filter((n) => !poses[n - 1]);
    if (fora.length) {
      console.error(`--ordem cita a pose ${fora.join(', ')}, e a folha tem ${poses.length}.`);
      process.exit(1);
    }
    quadros = ordem.map((n) => poses[n - 1]);
  } else {
    // ida e volta: 1 2 3 → 1 2 3 2
    quadros = [...poses, ...poses.slice(1, -1).reverse()];
  }
  console.log(`${poses.length} poses na folha → ${quadros.length} quadros${ordem ? '' : ' em ida e volta'}`);
}

if (!slug || !/^[a-z0-9-]+$/.test(slug) || quadros.length < 1) {
  console.error('Uso: node scripts/demo-exercicio.mjs <slug> (<quadro.png> ... | --folha poses.png) [--vista lado|frente] [--ms 500,250]');
  console.error('O slug é o mesmo do exercício no seed (ex.: flexao).');
  process.exit(1);
}
if (vista !== 'lado' && vista !== 'frente') {
  console.error(`--vista é "lado" ou "frente", não "${vista}".`);
  process.exit(1);
}
if (!['pes', 'cabeca', 'maos'].includes(ponto)) {
  console.error(`--ponto é "pes", "cabeca" ou "maos", não "${ponto}".`);
  process.exit(1);
}
if (ms && ms.length !== quadros.length) {
  console.error(`--ms tem ${ms.length} valores e há ${quadros.length} quadros: precisa de um para cada.`);
  process.exit(1);
}

/** Recorta o quadro (arquivo ou buffer) no que não é transparente. */
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
  if (x1 < 0) throw new Error('Um dos quadros é todo transparente.');

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

  // a cabeça: a largura do que há de opaco no topo do desenho, o boné
  let c0 = width, c1 = -1;
  for (let y = y0; y <= y0 + Math.round(height * FAIXA_DA_CABECA); y++) {
    for (let x = x0; x <= x1; x++) {
      if (data[(y * info.width + x) * 4 + 3] >= ALFA_MINIMO) {
        if (x - x0 < c0) c0 = x - x0;
        if (x - x0 > c1) c1 = x - x0;
      }
    }
  }

  const buffer = await sharp(arquivo)
    .ensureAlpha()
    .extract({ left: x0, top: y0, width, height })
    .png()
    .toBuffer();
  return {
    buffer,
    width,
    height,
    /** onde o desenho começa na imagem original, para `--altura-da-folha` */
    topo: y0,
    apoioInicio: a0,
    apoioLargura: a1 - a0 + 1,
    cabecaLargura: c1 - c0 + 1,
    cabecaMeio: (c0 + c1) / 2,
    apoioMeio: (a0 + a1) / 2,
    apoioFim: a1,
  };
}

const recortes = await Promise.all(quadros.map(recortar));

// o primeiro quadro é a régua: os outros são levados à mesma medida que ele
const regua = recortes[0];
const ajustados = await Promise.all(
  recortes.map(async (r) => {
    // de frente, a folha já sai numa escala só, e medir de novo só arriscaria
    // errar (no polichinelo, o topo do desenho são as mãos, não o boné). De
    // lado a régua são os apoios, que não enganam — e corrigem o pouco que a
    // geração varia: na flexão inclinada, a distância do pé à caixa
    const escala = semEscala || alturaDaFolha || (folha && (vista === 'frente' || ponto === 'maos'))
      ? 1
      : vista === 'lado'
        ? Math.min(1.1, Math.max(0.9, regua.apoioLargura / r.apoioLargura))
        : Math.min(2, Math.max(0.5, regua.cabecaLargura / r.cabecaLargura));
    const width = Math.round(r.width * escala);
    const height = Math.round(r.height * escala);
    return {
      buffer: await sharp(r.buffer).resize(width, height).png().toBuffer(),
      width,
      height,
      topo: r.topo,
      ancora: Math.round(
        (vista === 'lado'
          ? ponto === 'maos' ? r.apoioFim : r.apoioInicio
          : ponto === 'cabeca' ? r.cabecaMeio : r.apoioMeio) * escala,
      ),
    };
  }),
);

// uma tela só para todos, com o chão e o ponto fixo de cada quadro no mesmo lugar
const antes = Math.max(...ajustados.map((r) => r.ancora));
const depois = Math.max(...ajustados.map((r) => r.width - r.ancora));
// no chão comum, o conteúdo é o quadro mais alto; na altura da folha, vai do
// topo mais alto à base mais baixa entre todos
const topoMin = Math.min(...ajustados.map((r) => r.topo));
const conteudoA = alturaDaFolha
  ? Math.max(...ajustados.map((r) => r.topo + r.height)) - topoMin
  : Math.max(...ajustados.map((r) => r.height));
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
          left: margem + antes - r.ancora,
          top: alturaDaFolha ? margem + r.topo - topoMin : telaA - margem - r.height,
        },
      ])
      .png()
      .toBuffer(),
  ),
);

const meio = Math.floor(quadros.length / 2);
const tempos = ms ?? quadros.map((_, i) => (i === 0 || i === meio ? 450 : 220));

async function animado({ width, height, quality, alphaQuality }, destino) {
  // exercício parado (prancha): uma imagem só, sem o envelope de animação
  if (alinhados.length === 1) {
    return sharp(alinhados[0])
      .resize({ width, height, fit: 'inside' })
      .webp({ quality, alphaQuality, effort: 6 })
      .toFile(destino);
  }
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
console.log(
  quadros.length === 1
    ? '  imagem parada (um quadro só)\n'
    : `  quadros: ${quadros.length} · laço de ${tempos.reduce((a, b) => a + b, 0)} ms\n`,
);
console.log('Registre em features/exercises/demos.ts:');
console.log(`  '${slug}': { width: ${demo.width}, height: ${altura} },\n`);
