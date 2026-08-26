/**
 * Quanto dá para notificar sem cansar quem recebe.
 *
 * Não existe limite imposto por navegador ou por serviço de push que valha a
 * pena mostrar: as cotas do Firebase e da Apple são altíssimas e ninguém as
 * alcança mandando campanha à mão. O limite que importa é outro, e é humano —
 * **cada notificação a mais aumenta a chance de a pessoa desligar todas.** E
 * desligar é definitivo: o navegador não pergunta duas vezes.
 *
 * Por isso o número mostrado no painel é um orçamento escolhido por nós, não
 * uma cota de terceiro. Uma por dia é o teto de conforto; oito no mês deixa
 * espaço para um mês de campanha sem virar rotina.
 *
 * Funções puras: entram as datas das campanhas já enviadas, sai o que resta.
 */

/** Uma por dia é o teto: duas no mesmo dia já é uma a mais do que se aceita. */
export const LIMITE_DIARIO = 1;

/** Oito por mês dá ritmo de duas por semana sem virar ruído de fundo. */
export const LIMITE_MENSAL = 8;

export type Orcamento = {
  hoje: number;
  restanteHoje: number;
  mes: number;
  restanteMes: number;
  /** Dá para enviar agora sem estourar nenhum dos dois. */
  podeEnviar: boolean;
  /** Por que não dá, quando não dá. */
  motivo: string | null;
};

/**
 * @param enviadas Datas de envio, em ISO. Rascunhos e não enviadas ficam de fora.
 * @param hoje     Dia de referência `yyyy-MM-dd`, no fuso de quem administra.
 */
export function orcamentoDeCampanhas(
  enviadas: readonly (string | null)[],
  hoje: string,
): Orcamento {
  const dias = enviadas.filter((data): data is string => Boolean(data)).map((data) => data.slice(0, 10));

  const mesAtual = hoje.slice(0, 7);
  const noDia = dias.filter((dia) => dia === hoje).length;
  const noMes = dias.filter((dia) => dia.startsWith(mesAtual)).length;

  const restanteHoje = Math.max(0, LIMITE_DIARIO - noDia);
  const restanteMes = Math.max(0, LIMITE_MENSAL - noMes);

  return {
    hoje: noDia,
    restanteHoje,
    mes: noMes,
    restanteMes,
    podeEnviar: restanteHoje > 0 && restanteMes > 0,
    motivo:
      restanteHoje === 0
        ? 'Já saiu uma campanha hoje. Duas no mesmo dia é o caminho mais curto para as pessoas desligarem os avisos.'
        : restanteMes === 0
          ? `Já são ${noMes} campanhas neste mês, que é o teto combinado. O mês que vem recomeça a contagem.`
          : null,
  };
}
