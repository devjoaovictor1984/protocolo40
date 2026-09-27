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

/**
 * De onde sai o dia cumprido.
 *
 * `treino` conta os treinos terminados; `alimentacao` conta os dias que a
 * própria pessoa marcou como vencidos. Janela, meta e folga são as mesmas.
 */
export type TipoDeDesafio = 'treino' | 'alimentacao';

export type Desafio = {
  slug: string;
  title: string;
  tagline: string | null;
  description: string;
  starts_on: DayKey;
  ends_on: DayKey;
  goal: number;
  badge_slug: string | null;
  kind: TipoDeDesafio;
  /**
   * Nulo: janela única, a mesma para todo mundo. Preenchido: cada pessoa
   * escolhe quando começa, e `starts_on`/`ends_on` passam a dizer quando dá
   * para começar — não quando o desafio acontece.
   */
  duration_days: number | null;
};

type Janela = { starts_on: DayKey; ends_on: DayKey };

/** Quanto à frente dá para marcar o início. Igual ao trigger do banco. */
export const INICIO_MAXIMO_DIAS = 30;

/**
 * A janela que vale para mim.
 *
 * Janela única: a do desafio. Data pessoal: do meu início até o fim dos meus
 * `duration_days`. Nula quando é pessoal e eu ainda não escolhi — não existe
 * janela de quem não começou.
 */
export function janelaDoDesafio(
  desafio: Pick<Desafio, 'starts_on' | 'ends_on' | 'duration_days'>,
  meuInicio: DayKey | null,
): Janela | null {
  if (!desafio.duration_days) return { starts_on: desafio.starts_on, ends_on: desafio.ends_on };
  if (!meuInicio || !isValidDay(meuInicio)) return null;
  return { starts_on: meuInicio, ends_on: addDays(meuInicio, desafio.duration_days - 1) };
}

/**
 * Entre que dias a pessoa pode escolher começar: de hoje até 30 dias à frente,
 * sem sair do período em que o desafio aceita começos. Nulo quando não cabe
 * nenhum dia — o desafio fechou para novos começos.
 */
export function datasParaComecar(
  desafio: Pick<Desafio, 'starts_on' | 'ends_on'>,
  hoje: DayKey,
): { min: DayKey; max: DayKey } | null {
  const limite = addDays(hoje, INICIO_MAXIMO_DIAS);
  const min = desafio.starts_on > hoje ? desafio.starts_on : hoje;
  const max = desafio.ends_on < limite ? desafio.ends_on : limite;
  return min <= max ? { min, max } : null;
}

/** O nome do tipo, para o rótulo das telas. */
export function rotuloDoTipo(kind: TipoDeDesafio): string {
  return kind === 'alimentacao' ? 'Desafio de alimentação' : 'Desafio de treino';
}

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
export function recadoDoDesafio(
  progresso: Progresso,
  meta: number,
  kind: TipoDeDesafio = 'treino',
): string {
  const { fase, cumpridos, faltam, folga, concluido, hoje, alcancavel } = progresso;
  const alimentacao = kind === 'alimentacao';

  // o recado só aparece para quem já está dentro: "entre agora" dizia a quem
  // tinha acabado de entrar que ainda faltava entrar
  if (fase === 'antes') {
    return 'Começa em breve. Você já está dentro — o primeiro dia conta.';
  }

  if (concluido) {
    return fase === 'depois'
      ? `Você fechou o desafio: ${cumpridos} dias.`
      : `Meta batida com ${cumpridos} dias. O que vier agora é lucro.`;
  }

  if (fase === 'depois') {
    return alimentacao
      ? `O desafio terminou com ${cumpridos} de ${meta} dias vencidos. Cada um deles aconteceu — isso não some.`
      : `O desafio terminou com ${cumpridos} de ${meta} dias. Ficou o que você treinou — isso não some.`;
  }

  if (!alcancavel) {
    // em comida, "não sai mais" não pode soar como "desista": cada dia vencido
    // continua sendo um dia bom, com ou sem insígnia
    return alimentacao
      ? 'A meta não sai mais, e tudo bem. Cada dia que você vencer daqui para a frente continua valendo.'
      : `A meta deste mês não sai mais, e tudo bem. Continue treinando: a sequência e as insígnias seguem valendo.`;
  }

  if (!hoje) {
    if (alimentacao) {
      // nunca "hoje não pode faltar": pressão sobre comida é o caminho para a
      // culpa, e culpa derruba desafio mais rápido do que doce
      return folga <= 0
        ? `Faltam ${faltam} ${faltam === 1 ? 'dia' : 'dias'} para a medalha e a folga acabou. Hoje ainda está em aberto.`
        : `Faltam ${faltam} ${faltam === 1 ? 'dia' : 'dias'} para a medalha. Hoje ainda está em aberto.`;
    }

    return folga <= 0
      ? `Hoje não pode faltar: ${faltam} ${faltam === 1 ? 'dia' : 'dias'} para a meta e nenhum de folga.`
      : `Faltam ${faltam} ${faltam === 1 ? 'dia' : 'dias'}. Hoje ainda está em aberto.`;
  }

  const garantido = alimentacao ? 'Dia vencido.' : 'Dia garantido.';
  const destino = alimentacao ? ' para a medalha' : '';

  return folga <= 2
    ? `${garantido} Faltam ${faltam}${destino} e a folga está curta — ${folga} ${folga === 1 ? 'dia' : 'dias'}.`
    : `${garantido} Faltam ${faltam} ${faltam === 1 ? 'dia' : 'dias'}${destino}.`;
}

// -----------------------------------------------------------------------------
// Desafio de marcação (alimentação)
// -----------------------------------------------------------------------------

/**
 * Os dias que ainda dá para marcar: hoje e ontem, dentro da janela.
 *
 * É a mesma regra de `marcar_dia_no_desafio`, no banco. Aqui ela decide quais
 * botões aparecem; lá ela decide o que é gravado. Se as duas discordarem, a
 * tela oferece um toque que o banco recusa — e a mensagem de erro explica.
 */
export function diasMarcaveis(desafio: Pick<Desafio, 'starts_on' | 'ends_on'>, hoje: DayKey): DayKey[] {
  if (!isValidDay(hoje)) return [];

  return [hoje, addDays(hoje, -1)].filter(
    (dia) => dia >= desafio.starts_on && dia <= desafio.ends_on,
  );
}

export type EstadoDoDia = 'vencido' | 'em_aberto' | 'passou' | 'futuro';

export type PontoDaLinha = {
  dia: DayKey;
  /** "Dia 1", "Dia 2"… — a contagem do desafio, não a do calendário. */
  numero: number;
  estado: EstadoDoDia;
  /** Ainda dá para marcar ou desmarcar este dia. */
  marcavel: boolean;
  hoje: boolean;
};

/**
 * A linha do tempo do desafio: um ponto por dia, com o estado de cada um.
 *
 * `passou` é o dia que ficou para trás sem marca. Não se chama "falhou" de
 * propósito: o app não sabe se a pessoa escorregou ou só esqueceu de marcar,
 * e não vai tratar como fracasso o que ele não sabe.
 */
export function linhaDoTempo(
  desafio: Pick<Desafio, 'starts_on' | 'ends_on'>,
  dias: readonly string[],
  hoje: DayKey,
): PontoDaLinha[] {
  const vencidos = new Set(dias);
  const marcaveis = new Set(diasMarcaveis(desafio, hoje));

  return diasDoDesafio(desafio).map((dia, i) => {
    const marcavel = marcaveis.has(dia);
    const estado: EstadoDoDia = vencidos.has(dia)
      ? 'vencido'
      : dia > hoje
        ? 'futuro'
        : marcavel
          ? 'em_aberto'
          : 'passou';

    return { dia, numero: i + 1, estado, marcavel, hoje: dia === hoje };
  });
}

/**
 * O placar: "X de N dias".
 *
 * No desafio de duração própria, N é a duração — quem entra nos "21 dias sem
 * açúcar" espera ler "0 de 21", e "0 de 18" parecia um desafio de outro
 * tamanho. A meta da medalha continua valendo, mas é dita à parte ("faltam X
 * para a medalha"). Nos de janela única, N segue sendo a meta, como sempre foi.
 */
export function placarDoDesafio(
  desafio: Pick<Desafio, 'goal'> & { duration_days?: number | null },
  cumpridos: number,
): { de: number; fracao: number; medalhaAParte: boolean } {
  const de = desafio.duration_days || desafio.goal;
  return {
    de,
    fracao: de > 0 ? Math.min(1, cumpridos / de) : 0,
    medalhaAParte: de !== desafio.goal,
  };
}

/** Linha do tempo em semanas de sete, para desenhar uma fileira por semana. */
export function emSemanas<T>(pontos: readonly T[]): T[][] {
  const semanas: T[][] = [];
  for (let i = 0; i < pontos.length; i += 7) semanas.push(pontos.slice(i, i + 7));
  return semanas;
}

/**
 * A frase que volta depois de marcar, a partir do código do banco.
 *
 * Mora aqui porque cada código é um caso de produto: "fora do prazo" precisa
 * explicar a regra de hoje-ou-ontem, e não só dizer que não deu.
 */
export function erroDaMarcacao(codigo: string): string | null {
  switch (codigo) {
    case 'ok':
      return null;
    case 'sem_sessao':
      return 'Sua sessão expirou. Entre de novo para marcar o dia.';
    case 'nao_participa':
      return 'Você ainda não está neste desafio. Entre nele para marcar os dias.';
    case 'fora_da_janela':
      return 'Esse dia está fora do período do desafio.';
    case 'fora_do_prazo':
      return 'Dá para marcar só hoje e ontem. Os dias anteriores ficam como estão.';
    case 'nao_encontrado':
      return 'Este desafio não está mais aberto.';
    case 'nao_e_de_marcar':
      return 'Neste desafio os dias contam sozinhos, pelos treinos.';
    default:
      return 'Não conseguimos marcar agora. Confira a conexão e tente de novo.';
  }
}

/**
 * Os dias do desafio corrigidos pelo que o aparelho sabe.
 *
 * O cartão do desafio é renderizado no servidor, e a contagem sai dos treinos
 * que já subiram. Quem termina um treino sem rede via "hoje ainda está em
 * aberto" no mesmo instante em que o painel dizia que tinha treinado — duas
 * respostas para a mesma pergunta, na mesma tela, e a errada era a do desafio.
 *
 * A regra é: o servidor é a base, o aparelho é a correção.
 *
 * - o que existe aqui e ainda não subiu **entra**;
 * - o que foi apagado aqui e a exclusão ainda não subiu **sai** — mas só se
 *   nenhum outro treino sustentar aquele dia, porque dois treinos no mesmo dia
 *   contam como um só.
 *
 * A ordem importa: soma antes, subtrai depois. Invertida, um dia apagado que
 * foi treinado de novo sumiria da tela.
 */
export function diasComOAparelho(
  doServidor: readonly string[],
  locais: { feitos: readonly string[]; apagados: readonly string[] },
): string[] {
  const dias = new Set(doServidor);
  const feitos = new Set(locais.feitos);

  for (const dia of feitos) dias.add(dia);
  for (const dia of locais.apagados) {
    if (!feitos.has(dia)) dias.delete(dia);
  }

  return [...dias].sort();
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

export type DesafioNoHoje<T> = { desafio: T; papel: 'em_curso' | 'convite' };

/**
 * Os desafios que aparecem na tela de Hoje.
 *
 * Antes era um só, e o próximo esperava o atual acabar: o Desafio de Outubro
 * ficava invisível até o dia 1º — justamente quando as pessoas já deveriam ter
 * entrado. Agora a tela mostra, por tipo:
 *
 * - o desafio em curso (se houver dois, o mesmo critério do destaque, mas o
 *   que a pessoa já está dentro ganha — é o número dela que importa);
 * - o próximo a começar, como convite, assim que for criado.
 *
 * Por tipo porque treino e alimentação não competem: quem está no desafio do
 * mês e no de açúcar precisa ver os dois. No máximo quatro cartões, e só
 * quando existe tudo isso ao mesmo tempo.
 */
export function desafiosDoHoje<
  T extends Pick<Desafio, 'starts_on' | 'ends_on' | 'kind'> & {
    duration_days?: number | null;
    meuInicio?: DayKey | null;
    sort_order?: number;
    participando?: boolean;
  },
>(desafios: readonly T[], hoje: DayKey): DesafioNoHoje<T>[] {
  /*
   * Cada desafio é lido pela janela que vale para esta pessoa. No de data
   * pessoal, quem já escolheu o início tem janela; quem não escolheu não tem,
   * e o desafio é um convite enquanto ainda aceitar começos.
   */
  const lidos = desafios.map((desafio) => ({
    desafio,
    janela: janelaDoDesafio(
      { ...desafio, duration_days: desafio.duration_days ?? null },
      desafio.participando ? (desafio.meuInicio ?? null) : null,
    ),
  }));

  type Lido = (typeof lidos)[number];

  const ordenar = (a: Lido, b: Lido) =>
    Number(Boolean(b.desafio.participando)) - Number(Boolean(a.desafio.participando)) ||
    (b.desafio.sort_order ?? 0) - (a.desafio.sort_order ?? 0) ||
    (b.janela?.starts_on ?? '').localeCompare(a.janela?.starts_on ?? '');

  const emCurso: DesafioNoHoje<T>[] = [];
  const convites: DesafioNoHoje<T>[] = [];

  for (const kind of ['treino', 'alimentacao'] as const) {
    const doTipo = lidos.filter((item) => item.desafio.kind === kind);

    const atual = doTipo
      .filter(({ janela }) => janela && janela.starts_on <= hoje && janela.ends_on >= hoje)
      .sort(ordenar)[0];
    if (atual) emCurso.push({ desafio: atual.desafio, papel: 'em_curso' });

    const proximo =
      doTipo
        .filter(({ janela }) => janela && janela.starts_on > hoje)
        .sort((a, b) => a.janela!.starts_on.localeCompare(b.janela!.starts_on))[0] ??
      // data pessoal ainda não escolhida: convida enquanto der para começar,
      // mas não para quem já está em curso num desafio do mesmo tipo
      (atual
        ? undefined
        : doTipo
            .filter(({ desafio, janela }) => !janela && datasParaComecar(desafio, hoje))
            .sort(ordenar)[0]);
    if (proximo) convites.push({ desafio: proximo.desafio, papel: 'convite' });
  }

  // o que está valendo agora vem antes do que ainda vai começar
  return [...emCurso, ...convites];
}

// -----------------------------------------------------------------------------
// Desafio mensal
//
// Quase todo desafio do app é um mês fechado, e montar um à mão significava
// acertar seis campos que dependem uns dos outros: nome, endereço, as duas
// datas, a meta e a insígnia. Errar o último dia de fevereiro ou apontar a
// insígnia de outubro num desafio de novembro é o tipo de erro que só aparece
// quando alguém já entrou.
//
// Aqui é uma escolha só — mês e ano — e o resto sai daqui. Tudo continua
// editável depois: isto preenche, não trava.
// -----------------------------------------------------------------------------

/**
 * Os doze meses.
 *
 * `slug` é o da insígnia, e é o mesmo do endereço do desafio com o ano colado.
 * Sem acento e sem cedilha porque `challenge_slug_forma` só aceita
 * `[a-z0-9-]` — "março" viraria um endereço inválido no meio do salvamento.
 */
export const MESES = [
  { numero: 1, slug: 'janeiro', nome: 'Janeiro' },
  { numero: 2, slug: 'fevereiro', nome: 'Fevereiro' },
  { numero: 3, slug: 'marco', nome: 'Março' },
  { numero: 4, slug: 'abril', nome: 'Abril' },
  { numero: 5, slug: 'maio', nome: 'Maio' },
  { numero: 6, slug: 'junho', nome: 'Junho' },
  { numero: 7, slug: 'julho', nome: 'Julho' },
  { numero: 8, slug: 'agosto', nome: 'Agosto' },
  { numero: 9, slug: 'setembro', nome: 'Setembro' },
  { numero: 10, slug: 'outubro', nome: 'Outubro' },
  { numero: 11, slug: 'novembro', nome: 'Novembro' },
  { numero: 12, slug: 'dezembro', nome: 'Dezembro' },
] as const;

/** Dias de folga que a meta de um desafio mensal deixa. */
const FOLGA_DO_MES = 5;

export type EsbocoDeDesafio = {
  slug: string;
  title: string;
  starts_on: DayKey;
  ends_on: DayKey;
  goal: number;
  badge_slug: string;
  /** quantos dias o mês tem, para a tela explicar a meta */
  diasDoMes: number;
};

/** Último dia do mês, com fevereiro bissexto resolvido pelo próprio calendário. */
export function diasNoMes(ano: number, mes: number): number {
  // dia 0 do mês seguinte é o último dia deste
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * O desafio de um mês, pronto para o formulário.
 *
 * A meta é o mês inteiro menos cinco dias — a mesma margem do Desafio de
 * Setembro, e pela mesma razão: um desafio que quebra na primeira gripe não é
 * desafio, é armadilha. Quem falha no dia 4 de um mês perfeito abandona o mês;
 * quem tem folga volta no dia 5.
 */
export function esbocoDoMes(ano: number, mes: number): EsbocoDeDesafio | null {
  const dados = MESES.find((item) => item.numero === mes);
  if (!dados || !Number.isInteger(ano) || ano < 2020 || ano > 2100) return null;

  const dias = diasNoMes(ano, mes);
  const dd = (valor: number) => String(valor).padStart(2, '0');

  return {
    slug: `${dados.slug}-${ano}`,
    title: `Desafio de ${dados.nome}`,
    starts_on: `${ano}-${dd(mes)}-01`,
    ends_on: `${ano}-${dd(mes)}-${dd(dias)}`,
    goal: dias - FOLGA_DO_MES,
    // a insígnia é do mês, não do ano: quem já tem a de Março não ganha de
    // novo por repetir Março no ano seguinte
    badge_slug: dados.slug,
    diasDoMes: dias,
  };
}
