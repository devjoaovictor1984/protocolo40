import { daysBetween, isValidDay, type DayKey } from '@/services/calendar';
import type { TrackFocus } from '@/types/database';

/**
 * Regras da trilha.
 *
 * Uma trilha é uma lista ordenada de sessões e nada mais. O que transforma essa
 * lista num programa é a conta que está aqui: **em que sessão eu estou hoje**.
 *
 * A resposta não olha o calendário — olha quantos dias a pessoa treinou desde
 * que entrou. Quem entrou na segunda e treinou segunda, quinta e sábado está na
 * sessão 4 no sábado, não na sessão 6. Um programa que anda sozinho enquanto a
 * pessoa não treina só serve para informar a ela o tamanho do atraso, e essa
 * informação nunca fez ninguém voltar.
 *
 * Função pura, como as dos desafios: entram os dias, sai o estado. O "hoje" é
 * sempre argumento, e todas as datas são `yyyy-MM-dd` no fuso do usuário —
 * quem treina 23h50 treinou hoje.
 */

export type Sessao = {
  /** 1 a N, na ordem em que as sessões acontecem. */
  position: number;
  week: number;
  title: string;
  focus: TrackFocus;
  note: string;
  templateId: string;
};

export type Trilha = {
  slug: string;
  title: string;
  tagline: string | null;
  description: string;
  weeks: number;
  weekTitles: string[];
  badgeSlug: string | null;
};

export type Progresso = {
  /** Sessões já cumpridas. Nunca passa do total. */
  feitas: number;
  total: number;
  /** A próxima sessão a fazer. Nula quando a trilha acabou. */
  atual: Sessao | null;
  /** A última cumprida, que é a que o dia de hoje fechou quando já treinou. */
  ultima: Sessao | null;
  /** Semana em que a pessoa está — a da sessão atual, ou a última, no fim. */
  semana: number;
  /** Fração de 0 a 1 para a barra. */
  fracao: number;
  concluida: boolean;
  /** Já treinou hoje: a sessão de hoje está fechada. */
  treinouHoje: boolean;
  /** Dias corridos desde a matrícula, contando hoje. Zero antes de começar. */
  diasDesdeInicio: number;
  /**
   * Dias sem treinar até hoje. Zero quando treinou hoje, `null` quando nunca
   * treinou desde que entrou.
   *
   * É o número que decide o tom: até dois dias a tela não comenta, porque
   * descanso faz parte. Acima disso ela reconhece a ausência sem cobrar —
   * fingir que não houve pausa é o que faz um app parecer que não presta
   * atenção.
   */
  diasParado: number | null;
};

export type EstadoDaSessao = 'feita' | 'atual' | 'adiante';

/** Rótulo de cada tipo de sessão, para a tela não precisar traduzir enum. */
export const FOCO_LABELS: Record<TrackFocus, string> = {
  forca: 'Força',
  cardio: 'Condicionamento',
  core: 'Core',
  mobilidade: 'Mobilidade',
  recuperacao: 'Recuperação',
  referencia: 'Referência',
};

/**
 * Os dias que contam.
 *
 * Fora da janela nada entra: treino anterior à matrícula não adianta a trilha
 * (senão quem já treinava começaria na sessão 20), e dia no futuro não existe.
 * Repetições somem — dois treinos no mesmo dia são um dia.
 */
function diasValidos(dias: readonly string[], inicio: DayKey, hoje: DayKey): Set<string> {
  return new Set(dias.filter((dia) => isValidDay(dia) && dia >= inicio && dia <= hoje));
}

/**
 * @param sessoes Sessões da trilha, em qualquer ordem — a posição é que manda.
 * @param dias    Dias com treino, com repetições permitidas.
 * @param inicio  Dia da matrícula, no fuso do usuário.
 * @param hoje    Dia de referência, no fuso do usuário.
 */
export function progressoNaTrilha(
  sessoes: readonly Sessao[],
  dias: readonly string[],
  inicio: DayKey,
  hoje: DayKey,
): Progresso {
  const ordenadas = [...sessoes].sort((a, b) => a.position - b.position);
  const total = ordenadas.length;

  const cumpridos = isValidDay(inicio) && isValidDay(hoje) ? diasValidos(dias, inicio, hoje) : new Set<string>();
  const feitas = Math.min(total, cumpridos.size);

  const atual = ordenadas[feitas] ?? null;
  const ultima = feitas > 0 ? (ordenadas[feitas - 1] ?? null) : null;

  const distancia = isValidDay(inicio) && isValidDay(hoje) ? daysBetween(inicio, hoje) : -1;
  const diasDesdeInicio = distancia < 0 ? 0 : distancia + 1;

  const ultimoTreino = [...cumpridos].sort().at(-1) ?? null;

  return {
    feitas,
    total,
    atual,
    ultima,
    semana: atual?.week ?? ultima?.week ?? 1,
    fracao: total === 0 ? 0 : feitas / total,
    concluida: total > 0 && feitas >= total,
    treinouHoje: cumpridos.has(hoje),
    diasDesdeInicio,
    diasParado: ultimoTreino === null ? null : daysBetween(ultimoTreino, hoje),
  };
}

/** Onde uma sessão está em relação ao ponto em que a pessoa se encontra. */
export function estadoDaSessao(sessao: Sessao, progresso: Progresso): EstadoDaSessao {
  if (sessao.position <= progresso.feitas) return 'feita';
  if (sessao.position === progresso.feitas + 1) return 'atual';
  return 'adiante';
}

/**
 * As sessões agrupadas por semana, com o nome de cada uma.
 *
 * O nome vem da trilha (`week_titles`), não daqui: é conteúdo, e conteúdo mora
 * no banco. Quando a trilha não nomeia as semanas, sobra o número — que é o
 * suficiente para a tela funcionar.
 */
export function semanasDaTrilha<T extends Sessao>(
  sessoes: readonly T[],
  weekTitles: readonly string[] = [],
): { numero: number; titulo: string | null; sessoes: T[] }[] {
  const porSemana = new Map<number, T[]>();

  for (const sessao of [...sessoes].sort((a, b) => a.position - b.position)) {
    const atual = porSemana.get(sessao.week) ?? [];
    atual.push(sessao);
    porSemana.set(sessao.week, atual);
  }

  return [...porSemana.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([numero, lista]) => ({
      numero,
      titulo: weekTitles[numero - 1] ?? null,
      sessoes: lista,
    }));
}

/**
 * A frase que a tela mostra.
 *
 * Mora aqui, e não no componente, porque é regra de produto: qual mensagem cabe
 * em qual estado se decide uma vez e se testa. O tom é o do app — informa, não
 * cobra, e não finge que uma semana parada não aconteceu.
 */
export function recadoDaTrilha(progresso: Progresso): string {
  const { feitas, total, atual, concluida, treinouHoje, diasParado } = progresso;

  if (concluida) {
    return `Trilha completa: ${total} sessões. Você não é mais iniciante — a biblioteca inteira é sua.`;
  }

  if (feitas === 0) {
    return diasParado === null && progresso.diasDesdeInicio > 1
      ? 'A trilha está esperando a primeira sessão. Ela começa quando você começar.'
      : `Sessão 1 de ${total}. Vinte minutos, e o resto se resolve depois.`;
  }

  const faltam = total - feitas;

  if (treinouHoje) {
    return atual
      ? `Sessão ${feitas} está feita. A próxima é a ${atual.position}: ${atual.title}.`
      : `Sessão ${feitas} está feita.`;
  }

  if (diasParado !== null && diasParado >= 3) {
    return `${diasParado} dias sem treinar, e a trilha não andou sem você: ela continua na sessão ${feitas + 1}.`;
  }

  return `Sessão ${feitas + 1} de ${total}. ${
    faltam === 1 ? 'É a última.' : `Faltam ${faltam} depois desta.`
  }`;
}
