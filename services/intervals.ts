/**
 * Intervalos de trabalho e descanso.
 *
 * O pedido que originou isto foi "um sino a cada minuto". Mas o exemplo dado
 * junto — *corrida estacionária um minuto, descanso um minuto, apita para
 * começar e apita para parar* — não é um sino a cada minuto: é **treino
 * intervalado**, que é outra coisa e vale muito mais.
 *
 * A diferença: um sino periódico avisa que o tempo passou. O intervalado
 * **conduz** — diz quando acelerar e quando parar, e é isso que permite treinar
 * sem olhar para a tela, que é o ponto todo de ter som.
 *
 * O sino simples continua existindo: é o caso em que o descanso vale zero.
 *
 * Como o cronômetro do app, isto é calculado e não contado. Recebe o segundo
 * decorrido e devolve em que fase ele cai — nada de `setInterval` acumulando
 * erro, e o resultado é o mesmo depois de o telefone ficar dez minutos no bolso.
 */

export type ConfiguracaoDeIntervalo = {
  /** Segundos de esforço. */
  trabalho: number;
  /** Segundos de pausa entre um esforço e o próximo. Zero vira sino simples. */
  descanso: number;
};

export type Fase = 'trabalho' | 'descanso';

export type Momento = {
  fase: Fase;
  /** Quantos segundos faltam para a fase virar. */
  restante: number;
  /** Qual repetição está em curso, começando em 1. */
  ciclo: number;
};

/**
 * O que deve soar exatamente neste segundo.
 *
 * - `comecar`: a fase de esforço começou agora.
 * - `parar`: o esforço acabou e o descanso começou.
 * - `contagem`: falta pouco para virar — o toque curto de aviso.
 * - `null`: silêncio.
 */
export type Sinal = 'comecar' | 'parar' | 'contagem' | null;

/** Quantos segundos de aviso antes de cada virada. */
export const AVISO_ANTES = 3;

/** Presets prontos, para não obrigar ninguém a configurar antes de usar. */
export const PRESETS: { nome: string; descricao: string; config: ConfiguracaoDeIntervalo }[] = [
  {
    nome: '30 / 30',
    descricao: 'Meio a meio. Bom para começar e para movimento contínuo.',
    config: { trabalho: 30, descanso: 30 },
  },
  {
    nome: '40 / 20',
    descricao: 'Mais esforço que pausa. O formato mais comum de circuito.',
    config: { trabalho: 40, descanso: 20 },
  },
  {
    nome: '60 / 60',
    descricao: 'Um minuto de cada. Foi o pedido que originou este recurso.',
    config: { trabalho: 60, descanso: 60 },
  },
  {
    nome: '20 / 10',
    descricao: 'Tabata. Curto, intenso, e cansa mais do que o número sugere.',
    config: { trabalho: 20, descanso: 10 },
  },
  {
    nome: 'Sino a cada minuto',
    descricao: 'Sem pausa marcada: um toque por minuto, só para não perder a conta.',
    config: { trabalho: 60, descanso: 0 },
  },
];

const valida = (config: ConfiguracaoDeIntervalo) =>
  Number.isFinite(config.trabalho) &&
  Number.isFinite(config.descanso) &&
  config.trabalho >= 1 &&
  config.descanso >= 0;

/** Duração de uma volta completa. */
export const duracaoDoCiclo = (config: ConfiguracaoDeIntervalo) =>
  Math.max(1, Math.round(config.trabalho) + Math.max(0, Math.round(config.descanso)));

/**
 * Em que ponto do intervalo cai um segundo qualquer do treino.
 *
 * @param segundo Segundos decorridos desde o início, começando em zero.
 */
export function momentoEm(config: ConfiguracaoDeIntervalo, segundo: number): Momento {
  if (!valida(config) || segundo < 0) {
    return { fase: 'trabalho', restante: 0, ciclo: 1 };
  }

  const trabalho = Math.round(config.trabalho);
  const descanso = Math.max(0, Math.round(config.descanso));
  const ciclo = duracaoDoCiclo(config);

  const dentro = Math.floor(segundo) % ciclo;
  const volta = Math.floor(Math.floor(segundo) / ciclo) + 1;

  if (descanso === 0 || dentro < trabalho) {
    return { fase: 'trabalho', restante: trabalho - dentro, ciclo: volta };
  }

  return { fase: 'descanso', restante: ciclo - dentro, ciclo: volta };
}

/**
 * O sinal deste segundo.
 *
 * Chamado uma vez por segundo cheio. Devolver `null` é o normal — só as viradas
 * e os três segundos antes delas fazem barulho, porque um som que toca o tempo
 * todo deixa de ser aviso e vira ruído que a pessoa desliga.
 */
export function sinalEm(config: ConfiguracaoDeIntervalo, segundo: number): Sinal {
  if (!valida(config) || segundo < 0) return null;

  const trabalho = Math.round(config.trabalho);
  const descanso = Math.max(0, Math.round(config.descanso));
  const ciclo = duracaoDoCiclo(config);
  const dentro = Math.floor(segundo) % ciclo;

  // início de cada volta de esforço, incluindo o primeiro segundo do treino
  if (dentro === 0) return 'comecar';

  // fim do esforço: só existe quando há descanso marcado
  if (descanso > 0 && dentro === trabalho) return 'parar';

  const faltaParaVirar = descanso > 0 && dentro < trabalho ? trabalho - dentro : ciclo - dentro;

  // o aviso não cabe em fase mais curta que ele: avisar três segundos antes
  // numa pausa de dois seria barulho contínuo
  const fase = descanso > 0 && dentro < trabalho ? trabalho : descanso || trabalho;
  if (fase > AVISO_ANTES && faltaParaVirar > 0 && faltaParaVirar <= AVISO_ANTES) {
    return 'contagem';
  }

  return null;
}

/**
 * Todos os sinais de um trecho, para conferir sem esperar o relógio.
 *
 * É o que a demonstração do painel usa: em vez de gravar um vídeo esperando
 * cinco minutos em tempo real, ela desenha a linha inteira de uma vez.
 */
export function linhaDoTempo(
  config: ConfiguracaoDeIntervalo,
  ateSegundo: number,
): { segundo: number; sinal: Exclude<Sinal, null> }[] {
  const saida: { segundo: number; sinal: Exclude<Sinal, null> }[] = [];
  // pedir a linha até antes do começo devolve vazio, e não o primeiro sinal
  if (!Number.isFinite(ateSegundo) || ateSegundo < 0) return saida;

  for (let s = 0; s <= Math.floor(ateSegundo); s += 1) {
    const sinal = sinalEm(config, s);
    if (sinal) saida.push({ segundo: s, sinal });
  }

  return saida;
}
