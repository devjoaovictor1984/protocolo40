/**
 * O treino guiado.
 *
 * "10 polichinelos, descanso, 5 agachamentos, descanso, 3 flexões." Para quem
 * nunca treinou, uma lista de exercícios não é um treino: é uma pergunta — em
 * que ordem, quantas vezes, quanto descanso? O guiado responde uma coisa por
 * vez. A tela mostra um passo só, e o passo seguinte vem sozinho.
 *
 * Regras puras. A sequência sai do template (exercícios, voltas, descansos), e
 * o tempo de cada descanso é **calculado a partir dos segundos decorridos do
 * treino**, como o cronômetro: nada de contador. Com isso a pausa congela o
 * descanso de graça, e o telefone no bolso por dois minutos volta no ponto
 * certo.
 */

export type ItemGuiado = {
  exerciseId: string;
  name: string;
  slug: string | null;
  repetitions: number | null;
  durationSeconds: number | null;
};

export type Passo =
  | {
      tipo: 'exercicio';
      /** Volta em curso, a partir de 1. */
      volta: number;
      /** Posição do exercício dentro da volta, a partir de 0. */
      indice: number;
      item: ItemGuiado;
    }
  | {
      tipo: 'descanso';
      volta: number;
      segundos: number;
      /** Descanso entre voltas, que é mais longo e merece outro nome na tela. */
      entreVoltas: boolean;
      /** O que vem depois — a tela mostra, para a pessoa já se posicionar. */
      proximo: ItemGuiado;
    };

/** Onde a pessoa está no treino guiado. Mora na sessão do cronômetro. */
export type EstadoDoGuia = {
  /** Índice do passo atual. Igual ao total de passos quando acabou. */
  passo: number;
  /** Segundos decorridos do treino quando o passo atual começou. */
  desde: number;
  /** Exercício por tempo: segundos decorridos quando a contagem começou. */
  contando: number | null;
};

export const INICIO_DO_GUIA: EstadoDoGuia = { passo: 0, desde: 0, contando: null };

/** Exercício medido por tempo (prancha, corrida parada), e não por repetições. */
export const porTempo = (item: ItemGuiado) =>
  item.repetitions === null && item.durationSeconds !== null && item.durationSeconds > 0;

/**
 * A sequência inteira do treino.
 *
 * Descanso depois de cada exercício, menos do último de todos — terminar o
 * treino e ainda ter que esperar 30 segundos seria o app falando sozinho.
 * Descanso zero não vira passo: o exercício seguinte vem direto.
 */
export function passosDoGuiado(
  itens: readonly ItemGuiado[],
  voltas: number,
  descanso: number,
  descansoEntreVoltas: number,
): Passo[] {
  const passos: Passo[] = [];
  const totalVoltas = Math.max(1, Math.floor(voltas));

  for (let volta = 1; volta <= totalVoltas; volta += 1) {
    itens.forEach((item, indice) => {
      passos.push({ tipo: 'exercicio', volta, indice, item });

      const ultimoDaVolta = indice === itens.length - 1;
      const ultimoDeTodos = ultimoDaVolta && volta === totalVoltas;
      if (ultimoDeTodos) return;

      const segundos = Math.max(0, Math.round(ultimoDaVolta ? descansoEntreVoltas : descanso));
      if (segundos === 0) return;

      passos.push({
        tipo: 'descanso',
        volta,
        segundos,
        entreVoltas: ultimoDaVolta,
        proximo: itens[ultimoDaVolta ? 0 : indice + 1],
      });
    });
  }

  return passos;
}

/** Segundos que faltam no descanso. Nunca negativo. */
export function restanteDoDescanso(segundos: number, desde: number, decorrido: number): number {
  return Math.max(0, Math.ceil(segundos - (decorrido - desde)));
}

/** Segundos que faltam num exercício por tempo que já começou a contar. */
export function restanteDoExercicio(duracao: number, contando: number, decorrido: number): number {
  return Math.max(0, Math.ceil(duracao - (decorrido - contando)));
}

/**
 * Quantas voltas estão completas quando a pessoa chega ao passo `indice`.
 *
 * É o número que vai para `rounds` do treino gravado: quem parou na terceira
 * volta de quatro fez duas, e é isso que o histórico precisa dizer.
 */
export function voltasCompletas(passos: readonly Passo[], indice: number): number {
  if (indice >= passos.length) {
    return passos.reduce((maior, passo) => Math.max(maior, passo.volta), 0);
  }
  const atual = passos[indice];
  if (!atual) return 0;
  // no descanso entre voltas, a volta que acabou de fechar já conta
  return atual.tipo === 'descanso' && atual.entreVoltas ? atual.volta : atual.volta - 1;
}

/** Quantos exercícios há numa volta — para "exercício 2 de 4". */
export function exerciciosPorVolta(passos: readonly Passo[]): number {
  return passos.filter((passo) => passo.tipo === 'exercicio' && passo.volta === 1).length;
}

/**
 * Fração do treino já feita, pelos exercícios concluídos.
 *
 * Conta exercício, não passo: descanso não é progresso, e uma barra que anda
 * enquanto a pessoa está parada mente sobre o que falta.
 */
export function fracaoDoGuiado(passos: readonly Passo[], indice: number): number {
  const total = passos.filter((passo) => passo.tipo === 'exercicio').length;
  if (total === 0) return 0;
  const feitos = passos.slice(0, Math.min(indice, passos.length)).filter((passo) => passo.tipo === 'exercicio').length;
  return feitos / total;
}

/** "10 polichinelos", "20 s de prancha": a meta do exercício em palavras. */
export function metaDoItem(item: ItemGuiado): string {
  if (porTempo(item)) return `${item.durationSeconds} s`;
  if (item.repetitions !== null) return `${item.repetitions}×`;
  return '';
}
