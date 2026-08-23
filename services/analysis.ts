/**
 * Consultoria.
 *
 * Lê o que a pessoa realmente fez — exercícios, volume, frequência e o esforço
 * que ela declarou — e devolve o que mudar, com o motivo. Funções puras: entram
 * treinos, saem diagnósticos. Nenhuma consulta, nenhum relógio escondido.
 *
 * As faixas usadas aqui vêm do consenso de treinamento de força e hipertrofia:
 *
 * - **Volume.** Cerca de 10 séries semanais por grupo muscular é o patamar onde
 *   o ganho aparece de forma consistente; acima de ~20 o retorno cai e o custo
 *   de recuperação sobe. (Schoenfeld, Ogborn & Krieger, 2017 — revisão de dose‑
 *   resposta de volume.)
 * - **Frequência.** Dividir o mesmo volume em duas sessões semanais rende mais
 *   que concentrar tudo em uma. (Schoenfeld, Ogborn & Krieger, 2016.)
 * - **Esforço.** Séries levadas a 1–3 repetições da falha (RPE 7–9) dão o
 *   estímulo; ir à falha em toda série aumenta a fadiga sem aumentar o ganho.
 *   (Grgic et al., 2021 — treino até a falha.)
 * - **Recuperação.** O mesmo padrão de movimento em alta intensidade pede 48h;
 *   dor e queda de desempenho no dia seguinte são sinal de dívida, não de
 *   mérito. (Bishop, Jones & Woods, 2008.)
 * - **Sobrecarga progressiva.** Sem aumentar repetições, séries, carga ou
 *   dificuldade do movimento, o corpo não tem por que mudar.
 *
 * Nada aqui é conselho médico, e o texto na tela diz isso.
 */

import { addDays, daysBetween, startOfWeek } from '@/services/calendar';

export type ExercicioFeito = {
  exercise_id: string;
  exercise_name: string;
  /** grupo muscular, quando conhecido */
  category: string | null;
  sets: number | null;
  repetitions: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  weight_kg: number | null;
};

export type TreinoFeito = {
  workout_date: string;
  duration_seconds: number;
  rounds: number | null;
  /** 1 a 10, quando a pessoa respondeu */
  effort: number | null;
  exercises: ExercicioFeito[];
};

export type Severidade = 'atencao' | 'ajuste' | 'elogio';

export type Recomendacao = {
  id: string;
  severidade: Severidade;
  titulo: string;
  /** o que fazer, em uma frase executável */
  acao: string;
  /** por que isso funciona */
  porque: string;
};

export type AnaliseExercicio = {
  exerciseId: string;
  nome: string;
  categoria: string | null;
  /** sessões nas últimas 4 semanas */
  sessoes: number;
  vezesPorSemana: number;
  /** repetições (ou segundos) somados nas últimas 4 semanas */
  volume: number;
  volumeAnterior: number;
  /** séries semanais estimadas: é a unidade das recomendações de volume */
  seriesPorSemana: number;
  unidade: 'repetições' | 'segundos' | 'metros';
  /** média do esforço declarado nos dias em que este exercício apareceu */
  esforcoMedio: number | null;
  ultimaVez: string | null;
  recomendacoes: Recomendacao[];
};

export type Analise = {
  /** quantos treinos entraram na conta */
  treinos: number;
  /** quantos deles têm esforço declarado */
  comEsforco: number;
  esforcoMedio: number | null;
  exercicios: AnaliseExercicio[];
  gerais: Recomendacao[];
};

const JANELA_SEMANAS = 4;

/** Esforço a partir do qual a série está perto da falha. */
const ESFORCO_ALTO = 8;
/** Abaixo disso o estímulo provavelmente não chega. */
const ESFORCO_BAIXO = 5;

/** Séries semanais: abaixo do primeiro number falta, acima do segundo sobra. */
const SERIES_MINIMAS = 10;
const SERIES_MAXIMAS = 20;

function volumeDe(item: ExercicioFeito, rounds: number | null): number {
  const vezes = item.sets ?? rounds ?? 1;

  if (item.repetitions !== null) return vezes * item.repetitions;
  if (item.duration_seconds !== null) return vezes * item.duration_seconds;
  if (item.distance_meters !== null) return vezes * item.distance_meters;
  return 0;
}

function unidadeDe(item: ExercicioFeito): AnaliseExercicio['unidade'] {
  if (item.repetitions !== null) return 'repetições';
  if (item.duration_seconds !== null) return 'segundos';
  return 'metros';
}

function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((soma, valor) => soma + valor, 0) / valores.length;
}

/** Duas sessões seguidas com menos de 48h entre elas. */
function diasSeguidos(datas: string[]): number {
  const ordenadas = [...new Set(datas)].sort();
  let seguidos = 0;

  for (let i = 1; i < ordenadas.length; i += 1) {
    if (daysBetween(ordenadas[i - 1], ordenadas[i]) === 1) seguidos += 1;
  }

  return seguidos;
}

/**
 * Recomendações para um exercício.
 *
 * A ordem importa: o que aparece primeiro é o que mais muda o resultado.
 */
function recomendarPara(
  analise: Omit<AnaliseExercicio, 'recomendacoes'>,
  diasColados: number,
  variacoesDoGrupo: number,
): Recomendacao[] {
  const lista: Recomendacao[] = [];
  const nome = analise.nome.toLowerCase();
  const esforco = analise.esforcoMedio;
  const cresceu = analise.volume > analise.volumeAnterior;
  const primeiraJanela = analise.volumeAnterior === 0;

  // 1. Esforço alto sem o volume crescer: é o caso que motivou esta tela
  if (esforco !== null && esforco >= ESFORCO_ALTO && !cresceu && !primeiraJanela) {
    lista.push({
      id: `${analise.exerciseId}-plato`,
      severidade: 'atencao',
      titulo: 'Muito esforço, mesmo resultado',
      acao:
        `Nas últimas quatro semanas você levou ${analise.nome} perto do limite ` +
        `(esforço ${esforco.toFixed(1)}/10) e o volume não subiu. Troque uma das séries ` +
        'semanais por uma versão mais fácil do movimento e leve-a a 2 repetições da falha, ' +
        'em vez de treinar tudo no limite.',
      porque:
        'Séries a 1–3 repetições da falha dão praticamente o mesmo estímulo que ir à falha, ' +
        'com muito menos fadiga acumulada. Treinar sempre no limite atrapalha justamente as ' +
        'séries seguintes, que são as que fariam o volume crescer.',
    });
  }

  // 2. Barra e outros movimentos de puxar travam por falta de progressão gradual
  if (
    esforco !== null &&
    esforco >= ESFORCO_ALTO &&
    (nome.includes('barra') || nome.includes('pull')) &&
    analise.volume < 40
  ) {
    lista.push({
      id: `${analise.exerciseId}-barra`,
      severidade: 'ajuste',
      titulo: 'A barra pede degraus, não força de vontade',
      acao:
        'Duas vezes por semana, faça 4 séries de negativas: suba como der, e desça em ' +
        '5 segundos controlando. Some 3 séries de barra australiana (corpo mais na horizontal) ' +
        'no outro dia. Quando chegar a 8 repetições completas, volte à barra livre.',
      porque:
        'A fase excêntrica suporta mais carga que a concêntrica, então a negativa treina o ' +
        'movimento inteiro numa intensidade que você aguenta repetir. É sobrecarga progressiva ' +
        'de verdade: o degrau existe, em vez de tentar o mesmo salto todo dia.',
    });
  }

  // 3. Volume semanal abaixo do patamar que costuma render
  if (analise.seriesPorSemana > 0 && analise.seriesPorSemana < SERIES_MINIMAS) {
    lista.push({
      id: `${analise.exerciseId}-volume`,
      severidade: 'ajuste',
      titulo: 'Falta volume semanal',
      acao:
        `Você está fazendo cerca de ${analise.seriesPorSemana.toFixed(0)} séries por semana de ` +
        `${analise.nome}. Suba uma série por semana até chegar perto de ${SERIES_MINIMAS}, ` +
        'sem mudar mais nada.',
      porque:
        'O ganho acompanha o volume até cerca de 10 a 20 séries semanais por grupo muscular. ' +
        'Abaixo disso o corpo tem pouco motivo para mudar, por mais intenso que seja cada dia.',
    });
  }

  // 4. Volume alto demais junto com esforço alto: dívida de recuperação
  if (analise.seriesPorSemana > SERIES_MAXIMAS && esforco !== null && esforco >= ESFORCO_ALTO) {
    lista.push({
      id: `${analise.exerciseId}-excesso`,
      severidade: 'atencao',
      titulo: 'Volume e intensidade altos ao mesmo tempo',
      acao:
        `São ${analise.seriesPorSemana.toFixed(0)} séries semanais em esforço ${esforco.toFixed(1)}/10. ` +
        'Corte para dois terços disso por duas semanas e mantenha a intensidade. Depois volte a subir.',
      porque:
        'Acima de ~20 séries semanais o retorno cai e o custo de recuperação sobe. Duas semanas ' +
        'mais leves costumam devolver desempenho em vez de tirar — a adaptação acontece no descanso.',
    });
  }

  // 5. Esforço baixo demais: o estímulo não chega
  if (esforco !== null && esforco <= ESFORCO_BAIXO && analise.sessoes >= 3) {
    lista.push({
      id: `${analise.exerciseId}-leve`,
      severidade: 'ajuste',
      titulo: 'Está confortável demais',
      acao:
        `${analise.nome} tem saído em esforço ${esforco.toFixed(1)}/10. Escolha uma variação mais ` +
        'difícil, some repetições até a série ficar puxada nas últimas três, ou diminua o descanso.',
      porque:
        'A série só conta como estímulo quando chega perto da falha. Repetições fáceis somam ' +
        'cansaço e tempo, mas não dão ao corpo o motivo para se adaptar.',
    });
  }

  // 6. Mesmo padrão em dias colados
  if (diasColados >= 2 && esforco !== null && esforco >= ESFORCO_ALTO) {
    lista.push({
      id: `${analise.exerciseId}-descanso`,
      severidade: 'ajuste',
      titulo: 'Dias colados no mesmo movimento',
      acao:
        `Você repetiu ${analise.nome} em dias seguidos ${diasColados} vezes, em alta intensidade. ` +
        'Deixe pelo menos um dia entre eles e use o dia do meio para outro padrão de movimento.',
      porque:
        'O músculo trabalhado forte precisa de cerca de 48 horas para voltar ao desempenho. ' +
        'Repetir antes disso treina o movimento cansado, o que rende menos e machuca mais.',
    });
  }

  // 7. Um único exercício para o grupo inteiro
  if (variacoesDoGrupo === 1 && analise.sessoes >= 4) {
    lista.push({
      id: `${analise.exerciseId}-variacao`,
      severidade: 'ajuste',
      titulo: 'Um exercício só para esse grupo',
      acao:
        `Tudo o que você treina de ${analise.categoria ?? 'desse grupo'} é ${analise.nome}. ` +
        'Acrescente uma variação com ângulo ou amplitude diferente uma vez por semana.',
      porque:
        'Ângulos diferentes recrutam porções diferentes do mesmo músculo. Variar também dá ' +
        'ao tendão um descanso do padrão exato que vem sendo repetido.',
    });
  }

  // 8. O que está funcionando merece ser dito
  if (cresceu && !primeiraJanela && esforco !== null && esforco >= 6 && esforco < ESFORCO_ALTO) {
    lista.push({
      id: `${analise.exerciseId}-bom`,
      severidade: 'elogio',
      titulo: 'Este está no ponto',
      acao:
        `Volume subiu de ${Math.round(analise.volumeAnterior)} para ${Math.round(analise.volume)} ` +
        `${analise.unidade} com esforço ${esforco.toFixed(1)}/10. Não mude nada ainda — ` +
        'continue somando uma repetição por série a cada semana.',
      porque:
        'Progressão pequena e constante, com esforço sustentável, é exatamente o que a ' +
        'sobrecarga progressiva pede. Mudar um programa que está rendendo é o erro mais comum.',
    });
  }

  return lista;
}

/** Recomendações que olham o conjunto, e não um exercício isolado. */
function recomendacoesGerais(
  treinos: TreinoFeito[],
  comEsforco: number,
  esforcoMedio: number | null,
  exercicios: AnaliseExercicio[],
): Recomendacao[] {
  const lista: Recomendacao[] = [];

  if (treinos.length >= 3 && comEsforco === 0) {
    lista.push({
      id: 'geral-sem-esforco',
      severidade: 'ajuste',
      titulo: 'Diga como foi o esforço',
      acao:
        'Ao terminar o treino, toque no número de 1 a 10. Leva um segundo e é o que permite ' +
        'separar "treinei pouco" de "treinei no limite".',
      porque:
        'Volume sem intensidade não diz nada: 30 repetições fáceis e 30 difíceis produzem ' +
        'resultados diferentes. O esforço declarado é o que transforma o histórico em análise.',
    });
  }

  if (esforcoMedio !== null && esforcoMedio >= 9 && treinos.length >= 6) {
    lista.push({
      id: 'geral-sempre-no-limite',
      severidade: 'atencao',
      titulo: 'Todo dia no limite',
      acao:
        `Seu esforço médio é ${esforcoMedio.toFixed(1)}/10. Programe um dia leve por semana — ` +
        'mesma duração, metade da intensidade.',
      porque:
        'Intensidade máxima todos os dias impede a recuperação de acompanhar, e o desempenho ' +
        'cai justamente nas semanas em que você mais se esforça. O dia leve é parte do treino.',
    });
  }

  const grupos = new Set(exercicios.map((item) => item.categoria).filter(Boolean));
  if (exercicios.length >= 3 && grupos.size === 1) {
    lista.push({
      id: 'geral-um-grupo',
      severidade: 'ajuste',
      titulo: 'Só um grupo muscular aparece',
      acao:
        'Inclua um movimento de puxar e um de perna na semana, mesmo que curto: barra ' +
        'australiana e agachamento livre já resolvem.',
      porque:
        'Treinar sempre o mesmo grupo cria desequilíbrio de força entre a frente e as costas, ' +
        'que aparece primeiro como dor de ombro. Corpo inteiro é o que sustenta o resto.',
    });
  }

  return lista;
}

/**
 * Analisa os treinos.
 *
 * `hoje` entra como argumento porque a janela é relativa ao dia do usuário, e
 * nenhuma função aqui pode olhar o relógio da máquina.
 */
export function analisar(treinos: readonly TreinoFeito[], hoje: string): Analise {
  const inicioJanela = addDays(startOfWeek(hoje), -(JANELA_SEMANAS - 1) * 7);
  const inicioAnterior = addDays(inicioJanela, -JANELA_SEMANAS * 7);

  const recentes = treinos.filter((treino) => treino.workout_date >= inicioJanela);
  const anteriores = treinos.filter(
    (treino) => treino.workout_date >= inicioAnterior && treino.workout_date < inicioJanela,
  );

  const esforcos = recentes.map((treino) => treino.effort).filter((valor): valor is number => valor !== null);

  type Acumulado = {
    nome: string;
    categoria: string | null;
    volume: number;
    series: number;
    datas: string[];
    esforcos: number[];
    unidade: AnaliseExercicio['unidade'];
  };

  const porExercicio = new Map<string, Acumulado>();

  for (const treino of recentes) {
    for (const item of treino.exercises) {
      const atual = porExercicio.get(item.exercise_id) ?? {
        nome: item.exercise_name,
        categoria: item.category,
        volume: 0,
        series: 0,
        datas: [],
        esforcos: [],
        unidade: unidadeDe(item),
      };

      atual.volume += volumeDe(item, treino.rounds);
      atual.series += item.sets ?? treino.rounds ?? 1;
      atual.datas.push(treino.workout_date);
      if (treino.effort !== null) atual.esforcos.push(treino.effort);

      porExercicio.set(item.exercise_id, atual);
    }
  }

  const volumeAnteriorPor = new Map<string, number>();
  for (const treino of anteriores) {
    for (const item of treino.exercises) {
      volumeAnteriorPor.set(
        item.exercise_id,
        (volumeAnteriorPor.get(item.exercise_id) ?? 0) + volumeDe(item, treino.rounds),
      );
    }
  }

  // quantos exercícios distintos existem em cada grupo muscular
  const porGrupo = new Map<string, Set<string>>();
  for (const [id, dados] of porExercicio) {
    const chave = dados.categoria ?? 'sem-grupo';
    const conjunto = porGrupo.get(chave) ?? new Set<string>();
    conjunto.add(id);
    porGrupo.set(chave, conjunto);
  }

  const exercicios: AnaliseExercicio[] = [...porExercicio.entries()]
    .map(([id, dados]) => {
      const sessoes = new Set(dados.datas).size;

      const base: Omit<AnaliseExercicio, 'recomendacoes'> = {
        exerciseId: id,
        nome: dados.nome,
        categoria: dados.categoria,
        sessoes,
        vezesPorSemana: sessoes / JANELA_SEMANAS,
        volume: dados.volume,
        volumeAnterior: volumeAnteriorPor.get(id) ?? 0,
        seriesPorSemana: dados.series / JANELA_SEMANAS,
        unidade: dados.unidade,
        esforcoMedio: media(dados.esforcos),
        ultimaVez: [...dados.datas].sort().at(-1) ?? null,
      };

      return {
        ...base,
        recomendacoes: recomendarPara(
          base,
          diasSeguidos(dados.datas),
          porGrupo.get(dados.categoria ?? 'sem-grupo')?.size ?? 1,
        ),
      };
    })
    // o que tem alerta vem primeiro; depois o que é mais frequente
    .sort((a, b) => {
      const alertaA = a.recomendacoes.some((item) => item.severidade === 'atencao') ? 1 : 0;
      const alertaB = b.recomendacoes.some((item) => item.severidade === 'atencao') ? 1 : 0;
      return alertaB - alertaA || b.sessoes - a.sessoes || a.nome.localeCompare(b.nome);
    });

  const esforcoMedio = media(esforcos);

  return {
    treinos: recentes.length,
    comEsforco: esforcos.length,
    esforcoMedio,
    exercicios,
    gerais: recomendacoesGerais(recentes, esforcos.length, esforcoMedio, exercicios),
  };
}
