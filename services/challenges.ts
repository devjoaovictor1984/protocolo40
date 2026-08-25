import { addDays, daysBetween, isValidDay, type DayKey } from '@/services/calendar';

/**
 * Regras dos desafios.
 *
 * Função pura, como a sequência: recebe os dias em que houve treino e devolve
 * os números. O "hoje" é sempre argumento — um desafio que termina hoje à
 * meia-noite não pode depender do relógio da máquina que renderizou a tela.
 *
 * Todas as datas são `yyyy-MM-dd` no fuso do usuário, pela mesma razão de
 * sempre: quem treina 23h50 treinou hoje.
 */

export type Desafio = {
  slug: string;
  title: string;
  tagline: string | null;
  description: string;
  starts_on: DayKey;
  ends_on: DayKey;
  goal: number;
  badge_slug: string | null;
};

/** Onde o desafio está na linha do tempo. */
export type Fase = 'antes' | 'durante' | 'depois';

export type Progresso = {
  fase: Fase;
  /** Dias do desafio que já tiveram treino. */
  cumpridos: number;
  /** Quantos faltam para a meta. Zero quando já bateu. */
  faltam: number;
  /** Dias da janela que já passaram, incluindo hoje quando está em curso. */
  decorridos: number;
  /** Tamanho da janela, em dias. */
  total: number;
  /** Fração de 0 a 1 para a barra. */
  fracao: number;
  /** Bateu a meta. */
  concluido: boolean;
  /** Já treinou hoje — só faz sentido durante o desafio. */
  hoje: boolean;
  /**
   * Quantos dias ainda podem ser perdidos sem inviabilizar a meta.
   *
   * É o número que decide o tom da tela: com folga, ela é leve; sem folga, ela
   * avisa; abaixo de zero, ela para de cobrar uma meta que não existe mais.
   */
  folga: number;
  /** A meta ainda é alcançável no tempo que resta. */
  alcancavel: boolean;
};

/** Dias da janela do desafio, em ordem. */
export function diasDoDesafio(desafio: Pick<Desafio, 'starts_on' | 'ends_on'>): DayKey[] {
  if (!isValidDay(desafio.starts_on) || !isValidDay(desafio.ends_on)) return [];

  const total = daysBetween(desafio.starts_on, desafio.ends_on) + 1;
  if (total <= 0) return [];

  return Array.from({ length: total }, (_, i) => addDays(desafio.starts_on, i));
}

export function faseDo(desafio: Pick<Desafio, 'starts_on' | 'ends_on'>, hoje: DayKey): Fase {
  if (daysBetween(hoje, desafio.starts_on) > 0) return 'antes';
  if (daysBetween(desafio.ends_on, hoje) > 0) return 'depois';
  return 'durante';
}

/**
 * @param desafio A janela e a meta.
 * @param dias    Dias com treino, em qualquer ordem, com repetições permitidas.
 *                Dias fora da janela são ignorados — quem já treinava antes não
 *                entra no desafio com vantagem.
 * @param hoje    Dia de referência, no fuso do usuário.
 */
export function progressoNoDesafio(
  desafio: Pick<Desafio, 'starts_on' | 'ends_on' | 'goal'>,
  dias: readonly string[],
  hoje: DayKey,
): Progresso {
  const janela = diasDoDesafio(desafio);
  const total = janela.length;
  const dentro = new Set(janela);

  const cumpridosSet = new Set(dias.filter((dia) => isValidDay(dia) && dentro.has(dia)));
  const cumpridos = cumpridosSet.size;

  const fase = faseDo(desafio, hoje);
  const decorridos =
    fase === 'antes' ? 0 : fase === 'depois' ? total : daysBetween(desafio.starts_on, hoje) + 1;

  const meta = Math.min(desafio.goal, total);
  const faltam = Math.max(0, meta - cumpridos);
  const restantes = Math.max(0, total - decorridos);

  return {
    fase,
    cumpridos,
    faltam,
    decorridos,
    total,
    fracao: meta === 0 ? 0 : Math.min(1, cumpridos / meta),
    concluido: cumpridos >= meta,
    hoje: cumpridosSet.has(hoje),
    // dias que ainda podem ser perdidos: os que sobram menos os que faltam
    folga: restantes - faltam,
    alcancavel: faltam <= restantes,
  };
}

/**
 * A frase que a tela mostra.
 *
 * Fica aqui, e não no componente, porque é regra: qual mensagem cabe em qual
 * estado é decisão do produto, e decisão de produto se testa. O tom segue o do
 * app — informa, não cobra, e nunca finge que está tudo bem quando não está.
 */
export function recadoDoDesafio(progresso: Progresso, meta: number): string {
  const { fase, cumpridos, faltam, folga, concluido, hoje, alcancavel } = progresso;

  if (fase === 'antes') {
    return 'Começa em breve. Entre agora para não deixar o primeiro dia passar.';
  }

  if (concluido) {
    return fase === 'depois'
      ? `Você fechou o desafio: ${cumpridos} dias.`
      : `Meta batida com ${cumpridos} dias. O que vier agora é lucro.`;
  }

  if (fase === 'depois') {
    return `O desafio terminou com ${cumpridos} de ${meta} dias. Ficou o que você treinou — isso não some.`;
  }

  if (!alcancavel) {
    return `A meta deste mês não sai mais, e tudo bem. Continue treinando: a sequência e as insígnias seguem valendo.`;
  }

  if (!hoje) {
    return folga <= 0
      ? `Hoje não pode faltar: ${faltam} ${faltam === 1 ? 'dia' : 'dias'} para a meta e nenhum de folga.`
      : `Faltam ${faltam} ${faltam === 1 ? 'dia' : 'dias'}. Hoje ainda está em aberto.`;
  }

  return folga <= 2
    ? `Dia garantido. Faltam ${faltam} e a folga está curta — ${folga} ${folga === 1 ? 'dia' : 'dias'}.`
    : `Dia garantido. Faltam ${faltam} ${faltam === 1 ? 'dia' : 'dias'}.`;
}

export type LinhaDoRanking = {
  user_id: string;
  username: string | null;
  dias: number;
};

/**
 * Posições com empate.
 *
 * Quem tem o mesmo número de dias divide a posição — em desafio de constância,
 * desempatar por horário de cadastro seria inventar uma diferença que não
 * existe. A posição seguinte pula, como em qualquer classificação.
 */
export function posicoes<T extends { dias: number }>(linhas: readonly T[]): (T & { posicao: number })[] {
  let posicao = 0;
  let anterior: number | null = null;

  return [...linhas]
    .sort((a, b) => b.dias - a.dias)
    .map((linha, indice) => {
      if (anterior === null || linha.dias !== anterior) {
        posicao = indice + 1;
        anterior = linha.dias;
      }
      return { ...linha, posicao };
    });
}

/**
 * Qual desafio aparece na tela de Hoje.
 *
 * Um só, e o mais urgente: o que está em curso ganha do que vai começar, e o
 * que já acabou não aparece. Uma tela inicial com três desafios empilhados não
 * convida ninguém a entrar em nenhum.
 *
 * Entre dois em curso, vence o de maior `sort_order` — é o controle que o admin
 * tem para decidir a vitrine. Empatado, vence o que começou por último.
 *
 * Puro de propósito: é regra de produto, e é o tipo de escolha que muda de dono
 * (do destaque de setembro para o de outubro) num dia em que ninguém está
 * olhando.
 */
export function desafioEmDestaque<T extends Pick<Desafio, 'starts_on' | 'ends_on'> & { sort_order?: number }>(
  desafios: readonly T[],
  hoje: DayKey,
): T | null {
  const ordenar = (a: T, b: T) =>
    (b.sort_order ?? 0) - (a.sort_order ?? 0) || b.starts_on.localeCompare(a.starts_on);

  const emCurso = desafios.filter((d) => d.starts_on <= hoje && d.ends_on >= hoje).sort(ordenar);
  if (emCurso.length > 0) return emCurso[0];

  // nenhum aberto: mostra o próximo a começar, que é o que ainda dá para pegar
  const porVir = desafios
    .filter((d) => d.starts_on > hoje)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on));

  return porVir[0] ?? null;
}
