import { addDays, daysBetween, startOfWeek } from '@/services/calendar';
import type { Severidade, TreinoFeito } from '@/services/analysis';

/**
 * O foco da semana, para o objetivo de cada um.
 *
 * A consultoria de `analysis.ts` responde "o que está errado nos meus
 * exercícios". Esta responde outra pergunta, que é a que a pessoa realmente
 * faz: **o que eu faço esta semana para chegar onde eu disse que quero.**
 *
 * A diferença entre as duas é o objetivo. Quem quer perder gordura e quem quer
 * ganhar força fizeram a mesma semana de treinos e precisam ouvir coisas
 * opostas — um precisa de frequência e o outro de descanso. Um diagnóstico que
 * ignora isso dá conselho médio, que não serve para ninguém.
 *
 * As faixas vêm do consenso da área:
 *
 * - **Frequência e gasto.** Para perda de gordura, o que decide é o gasto
 *   semanal acumulado, não a intensidade de uma sessão: mais dias curtos rendem
 *   mais que dois dias longos. (ACSM Position Stand, 2009 — estratégias de
 *   intervenção para perda de peso.)
 * - **Recuperação na força.** O mesmo padrão de movimento em alta intensidade
 *   pede 48h; treinar por cima disso acumula fadiga sem acumular ganho.
 *   (Bishop, Jones & Woods, 2008.)
 * - **Frequência na hipertrofia.** Dividir o volume em duas sessões semanais
 *   rende mais que concentrar tudo numa. (Schoenfeld, Ogborn & Krieger, 2016.)
 * - **Constância antes de tudo.** Para quem está construindo o hábito, o
 *   preditor de sucesso é a repetição em contexto estável — não a intensidade.
 *   (Lally et al., 2010 — formação de hábito.)
 *
 * Nada aqui é conselho médico, e o texto na tela diz isso.
 */

export type Objetivo =
  | 'perder_gordura'
  | 'ganhar_forca'
  | 'condicionamento'
  | 'ganhar_massa'
  | 'melhorar_shape'
  | 'criar_disciplina'
  | 'manter_saude'
  | 'outro';

/** O que o objetivo pede por semana. */
type Alvo = {
  nome: string;
  /** Dias de treino por semana: mínimo e o ponto onde o retorno estabiliza. */
  diasPorSemana: [number, number];
  /** Faixa de esforço declarado (0–10) que corresponde ao estímulo certo. */
  esforco: [number, number];
  /** Dias de descanso por semana que o objetivo pede. */
  descansoPorSemana: [number, number];
  /** A frase que resume o que decide o resultado neste objetivo. */
  oQueDecide: string;
};

const ALVOS: Record<Objetivo, Alvo> = {
  perder_gordura: {
    nome: 'perder gordura',
    diasPorSemana: [5, 6],
    esforco: [6, 8],
    descansoPorSemana: [1, 2],
    oQueDecide: 'o gasto somado da semana, não a intensidade de um dia',
  },
  ganhar_forca: {
    nome: 'ganhar força',
    diasPorSemana: [3, 4],
    esforco: [8, 9],
    descansoPorSemana: [3, 4],
    oQueDecide: 'a carga subindo aos poucos, com 48h entre os treinos pesados',
  },
  condicionamento: {
    nome: 'condicionamento',
    diasPorSemana: [4, 5],
    esforco: [6, 8],
    descansoPorSemana: [2, 3],
    oQueDecide: 'variar o ritmo: nem todo dia no talo, nem todo dia leve',
  },
  ganhar_massa: {
    nome: 'ganhar massa',
    diasPorSemana: [4, 5],
    esforco: [7, 9],
    descansoPorSemana: [2, 3],
    oQueDecide: 'repetir cada movimento duas vezes por semana, com volume que sobe',
  },
  melhorar_shape: {
    nome: 'melhorar o shape',
    diasPorSemana: [4, 5],
    esforco: [7, 8],
    descansoPorSemana: [2, 3],
    oQueDecide: 'constância por meses, e não uma semana perfeita',
  },
  criar_disciplina: {
    nome: 'criar disciplina',
    diasPorSemana: [5, 7],
    esforco: [4, 7],
    descansoPorSemana: [0, 2],
    oQueDecide: 'aparecer todo dia, mesmo que seja pouco',
  },
  manter_saude: {
    nome: 'manter a saúde',
    diasPorSemana: [3, 5],
    esforco: [4, 7],
    descansoPorSemana: [2, 4],
    oQueDecide: 'movimento regular, sem semana perdida',
  },
  outro: {
    nome: 'seu objetivo',
    diasPorSemana: [4, 5],
    esforco: [6, 8],
    descansoPorSemana: [2, 3],
    oQueDecide: 'constância antes de intensidade',
  },
};

export type Ponto = {
  chave: string;
  titulo: string;
  detalhe: string;
  severidade: Severidade;
};

export type FocoDaSemana = {
  objetivo: Objetivo;
  /** Como o objetivo é chamado em texto corrido. */
  nome: string;
  oQueDecide: string;
  /** Dias treinados por semana, na janela. */
  diasPorSemana: number;
  alvoDeDias: [number, number];
  /** Dias sem treino nem descanso registrado, por semana. */
  descansoPorSemana: number;
  alvoDeDescanso: [number, number];
  esforcoMedio: number | null;
  alvoDeEsforco: [number, number];
  /** Maior sequência de dias treinados sem nenhuma folga, na janela. */
  maiorEmenda: number;
  /** Volume total da janela contra a janela anterior, em fração. Null sem base. */
  variacaoDeVolume: number | null;
  pontos: Ponto[];
};

const JANELA_SEMANAS = 4;

const media = (valores: readonly number[]) =>
  valores.length === 0 ? null : valores.reduce((a, b) => a + b, 0) / valores.length;

/** Maior corrida de dias consecutivos dentro de um conjunto de datas. */
function maiorEmenda(dias: readonly string[]): number {
  const unicos = [...new Set(dias)].sort();
  if (unicos.length === 0) return 0;

  let maior = 1;
  let atual = 1;

  for (let i = 1; i < unicos.length; i += 1) {
    atual = daysBetween(unicos[i - 1], unicos[i]) === 1 ? atual + 1 : 1;
    maior = Math.max(maior, atual);
  }

  return maior;
}

/** Soma bruta do que foi feito, só para comparar uma janela com a outra. */
function volumeTotal(treinos: readonly TreinoFeito[]): number {
  let total = 0;

  for (const treino of treinos) {
    for (const item of treino.exercises) {
      const vezes = item.sets ?? treino.rounds ?? 1;
      total +=
        vezes * (item.repetitions ?? item.duration_seconds ?? item.distance_meters ?? 0);
    }
  }

  return total;
}

/**
 * O foco da semana.
 *
 * @param treinos   Tudo que a pessoa registrou; a janela é recortada aqui.
 * @param descansos Dias marcados como descanso — contam como recuperação
 *                  deliberada, e não como falha.
 * @param objetivo  O que a pessoa disse que quer. Sem isso, cai no genérico.
 * @param hoje      Dia de referência, no fuso do usuário.
 */
export function focoDaSemana(
  treinos: readonly TreinoFeito[],
  descansos: readonly string[],
  objetivo: Objetivo | null,
  hoje: string,
): FocoDaSemana {
  const alvo = ALVOS[objetivo ?? 'outro'];

  const inicioJanela = addDays(startOfWeek(hoje), -(JANELA_SEMANAS - 1) * 7);
  const inicioAnterior = addDays(inicioJanela, -JANELA_SEMANAS * 7);

  const recentes = treinos.filter((t) => t.workout_date >= inicioJanela);
  const anteriores = treinos.filter(
    (t) => t.workout_date >= inicioAnterior && t.workout_date < inicioJanela,
  );

  const diasTreinados = [...new Set(recentes.map((t) => t.workout_date))];
  const diasDescanso = descansos.filter((d) => d >= inicioJanela);

  const diasPorSemana = diasTreinados.length / JANELA_SEMANAS;
  const descansoPorSemana = diasDescanso.length / JANELA_SEMANAS;

  const esforcos = recentes.map((t) => t.effort).filter((v): v is number => v !== null);
  const esforcoMedio = media(esforcos);

  const volume = volumeTotal(recentes);
  const volumeAnterior = volumeTotal(anteriores);
  const variacaoDeVolume = volumeAnterior > 0 ? (volume - volumeAnterior) / volumeAnterior : null;

  const emenda = maiorEmenda(diasTreinados);

  return {
    objetivo: objetivo ?? 'outro',
    nome: alvo.nome,
    oQueDecide: alvo.oQueDecide,
    diasPorSemana,
    alvoDeDias: alvo.diasPorSemana,
    descansoPorSemana,
    alvoDeDescanso: alvo.descansoPorSemana,
    esforcoMedio,
    alvoDeEsforco: alvo.esforco,
    maiorEmenda: emenda,
    variacaoDeVolume,
    pontos: montarPontos({
      alvo,
      diasPorSemana,
      descansoPorSemana,
      esforcoMedio,
      emenda,
      variacaoDeVolume,
      treinos: recentes.length,
    }),
  };
}

function montarPontos(dados: {
  alvo: Alvo;
  diasPorSemana: number;
  descansoPorSemana: number;
  esforcoMedio: number | null;
  emenda: number;
  variacaoDeVolume: number | null;
  treinos: number;
}): Ponto[] {
  const { alvo, diasPorSemana, descansoPorSemana, esforcoMedio, emenda, variacaoDeVolume } = dados;
  const pontos: Ponto[] = [];

  // Sem treino suficiente não existe diagnóstico, e inventar um é pior que
  // admitir que ainda não dá.
  if (dados.treinos < 3) {
    return [
      {
        chave: 'sem-base',
        titulo: 'Ainda não dá para analisar',
        detalhe:
          'Com três treinos registrados a análise começa a fazer sentido. Antes disso, qualquer conclusão seria chute.',
        severidade: 'ajuste',
      },
    ];
  }

  const [minDias, bomDias] = alvo.diasPorSemana;

  if (diasPorSemana < minDias - 0.5) {
    pontos.push({
      chave: 'frequencia-baixa',
      titulo: `Você treina ${arredondar(diasPorSemana)}x por semana`,
      detalhe: `Para ${alvo.nome}, ${minDias} a ${bomDias} dias é a faixa onde o resultado aparece. Falta cerca de ${arredondar(minDias - diasPorSemana)} dia por semana.`,
      severidade: 'atencao',
    });
  } else if (diasPorSemana >= minDias) {
    pontos.push({
      chave: 'frequencia-ok',
      titulo: `${arredondar(diasPorSemana)} dias por semana`,
      detalhe: `É a frequência que ${alvo.nome} pede. O que decide daqui em diante é ${alvo.oQueDecide}.`,
      severidade: 'elogio',
    });
  }

  const [minDescanso] = alvo.descansoPorSemana;

  /**
   * Descanso.
   *
   * Duas leituras diferentes: não descansar o bastante para o objetivo, e
   * emendar dias demais sem nenhuma folga. A segunda pega quem descansa na
   * média mas concentra tudo — dez dias seguidos e quatro parados somam a mesma
   * média de uma semana equilibrada, e não são a mesma coisa para o corpo.
   */
  if (minDescanso > 0 && descansoPorSemana < minDescanso - 0.5) {
    pontos.push({
      chave: 'descanso-curto',
      titulo: 'Falta recuperação',
      detalhe: `Para ${alvo.nome}, ${minDescanso} ${minDescanso === 1 ? 'dia' : 'dias'} de folga por semana faz parte do treino — é quando o corpo constrói o que você pediu. Registrar o descanso mantém a sequência de pé.`,
      severidade: 'atencao',
    });
  }

  if (emenda >= 10) {
    pontos.push({
      chave: 'emenda-longa',
      titulo: `${emenda} dias seguidos sem folga`,
      detalhe:
        'Constância é o ponto forte disso, e vale reconhecer. Mas depois de dez dias emendados, um dia leve ou de descanso costuma render mais que o décimo primeiro igual aos outros.',
      severidade: 'ajuste',
    });
  }

  const [minEsforco, maxEsforco] = alvo.esforco;

  if (esforcoMedio !== null) {
    if (esforcoMedio < minEsforco - 0.5) {
      pontos.push({
        chave: 'esforco-baixo',
        titulo: `Esforço médio ${esforcoMedio.toFixed(1).replace('.', ',')}`,
        detalhe: `Para ${alvo.nome}, o estímulo mora entre ${minEsforco} e ${maxEsforco}. Subir uma marcha — mais repetições ou uma variação mais difícil — muda o resultado sem aumentar o tempo.`,
        severidade: 'ajuste',
      });
    } else if (esforcoMedio > maxEsforco + 0.5) {
      pontos.push({
        chave: 'esforco-alto',
        titulo: `Esforço médio ${esforcoMedio.toFixed(1).replace('.', ',')}`,
        detalhe: `Está acima da faixa de ${minEsforco} a ${maxEsforco} que ${alvo.nome} pede. Todo treino no limite acumula fadiga sem acumular ganho — alternar um dia mais leve costuma destravar.`,
        severidade: 'atencao',
      });
    }
  } else {
    pontos.push({
      chave: 'sem-esforco',
      titulo: 'Marque o esforço ao terminar',
      detalhe:
        'Sem essa nota, a análise enxerga quanto você fez, mas não quanto custou — e é o custo que diz se dá para subir ou se é hora de segurar.',
      severidade: 'ajuste',
    });
  }

  /**
   * Sobrecarga progressiva.
   *
   * Sem aumentar repetições, séries ou dificuldade, o corpo não tem por que
   * mudar. A queda também importa e é lida sem drama: pode ser semana ruim.
   */
  if (variacaoDeVolume !== null) {
    if (variacaoDeVolume >= 0.1) {
      pontos.push({
        chave: 'volume-subindo',
        titulo: `Volume ${Math.round(variacaoDeVolume * 100)}% acima do mês anterior`,
        detalhe: 'É isto que faz o corpo mudar. Continue subindo aos poucos, sem saltos.',
        severidade: 'elogio',
      });
    } else if (variacaoDeVolume <= -0.2) {
      pontos.push({
        chave: 'volume-caindo',
        titulo: `Volume ${Math.abs(Math.round(variacaoDeVolume * 100))}% abaixo do mês anterior`,
        detalhe:
          'Pode ser uma fase corrida, e tudo bem. Se não for, voltar ao patamar anterior antes de tentar passar dele é o caminho mais curto.',
        severidade: 'ajuste',
      });
    } else if (Math.abs(variacaoDeVolume) < 0.05) {
      pontos.push({
        chave: 'volume-parado',
        titulo: 'Volume parado há um mês',
        detalhe: `Mesma carga, mesmo estímulo, mesmo corpo. Uma repetição a mais por série já muda isso — e para ${alvo.nome} é o que falta.`,
        severidade: 'ajuste',
      });
    }
  }

  return pontos;
}

/** Um decimal, e sem o ",0" quando é inteiro. */
function arredondar(valor: number): string {
  const arredondado = Math.round(valor * 10) / 10;
  return Number.isInteger(arredondado)
    ? String(arredondado)
    : arredondado.toFixed(1).replace('.', ',');
}
