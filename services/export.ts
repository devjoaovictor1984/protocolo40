/**
 * Exportação dos dados.
 *
 * Levar os próprios dados embora não é funcionalidade extra: é o que a LGPD
 * chama de portabilidade (art. 18, V), e é o que permite chegar num médico, num
 * nutricionista ou num personal com o histórico na mão em vez de com memória.
 *
 * Duas formas, porque servem a duas pessoas diferentes:
 *
 * - **CSV** para quem vai abrir numa planilha. Separador `;`, decimal com
 *   vírgula e BOM no começo — é o que faz o Excel em português abrir o arquivo
 *   com as colunas separadas em vez de despejar tudo na coluna A. Com `,` como
 *   separador, o mesmo Excel quebraria cada número decimal em duas colunas.
 * - **JSON** para quem vai levar os dados para outro sistema. Números crus, com
 *   ponto decimal, sem formatação de idioma nenhuma.
 *
 * Tudo aqui é função pura sobre listas já carregadas: nenhuma consulta, nenhuma
 * data de hoje escondida. Quem lê o banco é a rota em `app/api/exportar`.
 */

/** O Excel só reconhece UTF-8 num arquivo `.csv` se ele começar com isto. */
export const BOM = '﻿';

const SEPARADOR = ';';
/** CRLF: é o que a especificação do CSV (RFC 4180) manda, e o que o Excel espera. */
const QUEBRA = '\r\n';

export type Coluna<T> = {
  titulo: string;
  valor: (linha: T) => string | number | null | undefined;
};

/**
 * Um campo de CSV.
 *
 * Aspas só entram quando precisam — separador, aspas ou quebra de linha dentro
 * do valor. Uma observação de treino com ponto e vírgula desalinharia o arquivo
 * inteiro a partir dali, e o erro só apareceria na planilha de quem baixou.
 */
export function campoCsv(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return '';

  // decimal com vírgula acompanha o separador `;`, que é o par usado em pt-BR
  const texto = typeof valor === 'number' ? String(valor).replace('.', ',') : valor;

  if (!/[";\r\n]/.test(texto)) return texto;
  return `"${texto.replace(/"/g, '""')}"`;
}

export function paraCsv<T>(colunas: readonly Coluna<T>[], linhas: readonly T[]): string {
  const cabecalho = colunas.map((coluna) => campoCsv(coluna.titulo)).join(SEPARADOR);

  const corpo = linhas.map((linha) =>
    colunas.map((coluna) => campoCsv(coluna.valor(linha))).join(SEPARADOR),
  );

  return BOM + [cabecalho, ...corpo].join(QUEBRA) + QUEBRA;
}

// -----------------------------------------------------------------------------
// As formas que chegam do banco. Declaradas aqui, e não importadas de
// `types/database`, para deixar explícito o mínimo que cada CSV precisa.
// -----------------------------------------------------------------------------

export type ExercicioExportado = {
  nome: string | null;
  sets: number | null;
  repetitions: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  weight_kg: number | null;
  notes: string | null;
};

export type TreinoExportado = {
  workout_date: string;
  title: string | null;
  duration_seconds: number;
  rounds: number | null;
  effort: number | null;
  location: string | null;
  notes: string | null;
  exercicios: ExercicioExportado[];
};

export type MedidaExportada = {
  measured_on: string;
  weight_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  hip_cm: number | null;
  thigh_cm: number | null;
  body_fat_pct: number | null;
  notes: string | null;
};

export type AguaExportada = { day: string; ml: number };

export type RecordeExportado = {
  exercicio: string | null;
  metric: string;
  value: number;
  unit: string | null;
  achieved_on: string;
};

/** Uma linha por exercício, com os dados do treino repetidos ao lado. */
export type LinhaDeTreino = {
  data: string;
  titulo: string | null;
  minutos: number;
  rodadas: number | null;
  esforco: number | null;
  local: string | null;
  exercicio: string | null;
  series: number | null;
  repeticoes: number | null;
  segundos: number | null;
  metros: number | null;
  carga: number | null;
  observacoes: string | null;
};

/**
 * Achata treinos em linhas de planilha.
 *
 * Formato longo — uma linha por exercício, repetindo as colunas do treino. É o
 * que permite somar, filtrar e cruzar numa tabela dinâmica; o formato "um
 * treino por linha, exercícios numa célula só" fica bonito e não serve para
 * conta nenhuma. Treino sem exercício registrado ainda vira uma linha: ele
 * aconteceu.
 */
export function linhasDeTreino(treinos: readonly TreinoExportado[]): LinhaDeTreino[] {
  const linhas: LinhaDeTreino[] = [];

  for (const treino of treinos) {
    const base = {
      data: treino.workout_date,
      titulo: treino.title,
      minutos: Math.round(treino.duration_seconds / 60),
      rodadas: treino.rounds,
      esforco: treino.effort,
      local: treino.location,
      observacoes: treino.notes,
    };

    if (treino.exercicios.length === 0) {
      linhas.push({
        ...base,
        exercicio: null,
        series: null,
        repeticoes: null,
        segundos: null,
        metros: null,
        carga: null,
      });
      continue;
    }

    for (const exercicio of treino.exercicios) {
      linhas.push({
        ...base,
        exercicio: exercicio.nome,
        series: exercicio.sets,
        repeticoes: exercicio.repetitions,
        segundos: exercicio.duration_seconds,
        metros: exercicio.distance_meters,
        carga: exercicio.weight_kg,
        observacoes: exercicio.notes ?? treino.notes,
      });
    }
  }

  return linhas;
}

export const COLUNAS_TREINOS: readonly Coluna<LinhaDeTreino>[] = [
  { titulo: 'Data', valor: (l) => l.data },
  { titulo: 'Treino', valor: (l) => l.titulo },
  { titulo: 'Minutos', valor: (l) => l.minutos },
  { titulo: 'Rodadas', valor: (l) => l.rodadas },
  { titulo: 'Esforço (1-10)', valor: (l) => l.esforco },
  { titulo: 'Local', valor: (l) => l.local },
  { titulo: 'Exercício', valor: (l) => l.exercicio },
  { titulo: 'Séries', valor: (l) => l.series },
  { titulo: 'Repetições', valor: (l) => l.repeticoes },
  { titulo: 'Segundos', valor: (l) => l.segundos },
  { titulo: 'Metros', valor: (l) => l.metros },
  { titulo: 'Carga (kg)', valor: (l) => l.carga },
  { titulo: 'Observações', valor: (l) => l.observacoes },
];

export const COLUNAS_MEDIDAS: readonly Coluna<MedidaExportada>[] = [
  { titulo: 'Data', valor: (m) => m.measured_on },
  { titulo: 'Peso (kg)', valor: (m) => m.weight_kg },
  { titulo: 'Cintura (cm)', valor: (m) => m.waist_cm },
  { titulo: 'Peito (cm)', valor: (m) => m.chest_cm },
  { titulo: 'Braço (cm)', valor: (m) => m.arm_cm },
  { titulo: 'Quadril (cm)', valor: (m) => m.hip_cm },
  { titulo: 'Coxa (cm)', valor: (m) => m.thigh_cm },
  { titulo: 'Gordura (%)', valor: (m) => m.body_fat_pct },
  { titulo: 'Observações', valor: (m) => m.notes },
];

export const COLUNAS_AGUA: readonly Coluna<AguaExportada>[] = [
  { titulo: 'Dia', valor: (a) => a.day },
  { titulo: 'Água (ml)', valor: (a) => a.ml },
];

const NOME_DA_METRICA: Record<string, string> = {
  reps: 'repetições',
  duration: 'duração',
  distance: 'distância',
  weight: 'carga',
  rounds: 'rodadas',
  volume: 'volume',
};

export const COLUNAS_RECORDES: readonly Coluna<RecordeExportado>[] = [
  { titulo: 'Data', valor: (r) => r.achieved_on },
  { titulo: 'Exercício', valor: (r) => r.exercicio },
  { titulo: 'Métrica', valor: (r) => NOME_DA_METRICA[r.metric] ?? r.metric },
  { titulo: 'Valor', valor: (r) => r.value },
  { titulo: 'Unidade', valor: (r) => r.unit },
];

export type TipoDeExportacao = 'treinos' | 'medidas' | 'agua' | 'recordes' | 'tudo';

export const TIPOS: readonly TipoDeExportacao[] = [
  'treinos',
  'medidas',
  'agua',
  'recordes',
  'tudo',
];

export function ehTipoValido(valor: string): valor is TipoDeExportacao {
  return (TIPOS as readonly string[]).includes(valor);
}

/**
 * Nome do arquivo baixado.
 *
 * Leva o usuário e a data porque exportações se acumulam na pasta de downloads,
 * e "export.csv" na terceira vez já não diz de quando é nem de quem.
 */
export function nomeDoArquivo(
  tipo: TipoDeExportacao,
  usuario: string,
  dia: string,
  extensao: 'csv' | 'json',
): string {
  const limpo = usuario.replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'p20x';
  return `p20x-${tipo}-${limpo}-${dia}.${extensao}`;
}
