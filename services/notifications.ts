/**
 * O que a notificação diz.
 *
 * Função pura, e mora aqui pelo mesmo motivo que a frase do desafio: qual texto
 * cabe em qual estado é decisão de produto, e decisão de produto se testa.
 *
 * Uma notificação é a única coisa deste app que aparece sem ser chamada. As
 * regras do tom saem disso:
 *
 * - **Nunca cobrança.** "Você não treinou" é acusação; "seus 20 minutos estão
 *   esperando" é convite. A pessoa já sabe que não treinou.
 * - **Nunca corpo.** Peso e medida não entram no texto. A notificação aparece
 *   na tela bloqueada, à vista de quem estiver por perto.
 * - **Nunca a mesma frase.** Cinco dias com o mesmo texto e vira papel de
 *   parede — deixa de ser lida antes de deixar de ser enviada.
 */

export type ContextoDoLembrete = {
  primeiroNome: string | null;
  /** Dias seguidos até ontem. Zero quando a sequência quebrou ou nunca começou. */
  sequencia: number;
  /** Água registrada hoje, em ml. */
  aguaMl: number;
  /** Dia local, usado só para variar o texto sem sortear. */
  dia: string;
};

export type TextoDaNotificacao = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

/** Variação estável: o mesmo dia gera o mesmo texto, e dias seguidos variam. */
function indiceDoDia(dia: string, total: number): number {
  let soma = 0;
  for (let i = 0; i < dia.length; i += 1) soma = (soma + dia.charCodeAt(i) * (i + 1)) % 9973;
  return soma % total;
}

const trate = (nome: string | null) => (nome ? `${nome}, ` : '');

/**
 * Sequência em risco — o assunto mais forte que existe aqui.
 *
 * Quem tem dias acumulados tem o que perder, e dizer o número é lembrar do que
 * já foi construído. Abaixo de três dias isso não funciona: ninguém protege uma
 * sequência de dois.
 */
function sequenciaEmRisco(ctx: ContextoDoLembrete): TextoDaNotificacao[] {
  const { sequencia } = ctx;

  return [
    {
      title: `${sequencia} dias seguidos`,
      body: `${trate(ctx.primeiroNome)}faltam 20 minutos para o dia ${sequencia + 1}.`,
      url: '/treinar',
      tag: 'lembrete',
    },
    {
      title: 'Sua sequência está de pé',
      body: `São ${sequencia} dias. Hoje ainda dá tempo de manter.`,
      url: '/treinar',
      tag: 'lembrete',
    },
    {
      title: `Dia ${sequencia + 1}`,
      body: 'Vinte minutos. Menos também conta — o que não pode é o dia passar em branco.',
      url: '/treinar',
      tag: 'lembrete',
    },
  ];
}

/** Sem sequência: o assunto é começar, não recomeçar. */
function comecar(ctx: ContextoDoLembrete): TextoDaNotificacao[] {
  return [
    {
      title: 'Seus 20 minutos',
      body: `${trate(ctx.primeiroNome)}dá para fazer agora, na sala, sem equipamento.`,
      url: '/treinar',
      tag: 'lembrete',
    },
    {
      title: 'Vinte minutos hoje?',
      body: 'Sem preparação e sem roupa de treino. Só começar.',
      url: '/treinar',
      tag: 'lembrete',
    },
    {
      title: 'O dia ainda tem 20 minutos',
      body: 'Um treino curto vale mais que um treino perfeito que não aconteceu.',
      url: '/treinar',
      tag: 'lembrete',
    },
  ];
}

/**
 * Água.
 *
 * Só aparece quando nada foi registrado — lembrar de beber água alguém que já
 * bebeu dois litros é o tipo de mensagem que ensina a ignorar as próximas. E
 * mesmo assim entra em um dia de cada três: o treino é o assunto principal.
 */
function agua(ctx: ContextoDoLembrete): TextoDaNotificacao[] {
  return [
    {
      title: 'Água de hoje',
      body: `${trate(ctx.primeiroNome)}nada registrado ainda. Um copo já conta.`,
      url: '/saude',
      tag: 'lembrete',
    },
  ];
}

/**
 * O texto do lembrete diário.
 *
 * A escolha do assunto é por estado, não por sorteio; a escolha da frase dentro
 * do assunto é pelo dia, para não repetir e ainda assim ser previsível no teste.
 */
export function lembreteDoDia(ctx: ContextoDoLembrete): TextoDaNotificacao {
  const semAgua = ctx.aguaMl <= 0;
  // água entra em um dia de cada três, e só quando não há nada registrado
  const vezDaAgua = semAgua && indiceDoDia(ctx.dia, 3) === 0;

  const opcoes = vezDaAgua ? agua(ctx) : ctx.sequencia >= 3 ? sequenciaEmRisco(ctx) : comecar(ctx);

  return opcoes[indiceDoDia(ctx.dia, opcoes.length)];
}

/**
 * Uma campanha escrita à mão pelo admin.
 *
 * Passa por aqui em vez de ir direto para o envio por dois motivos: o corte no
 * tamanho fica num lugar só, e o destino é validado — uma URL externa numa
 * notificação do app é exatamente o que um phishing precisaria.
 */
export function textoDaCampanha(entrada: {
  title: string;
  body: string;
  url?: string | null;
}): TextoDaNotificacao {
  const url = entrada.url?.trim();

  return {
    title: entrada.title.trim().slice(0, 60),
    // Android corta perto de 180; iOS mostra menos ainda
    body: entrada.body.trim().slice(0, 180),
    // só caminho interno: `//outro.site` é URL absoluta disfarçada
    url: url && url.startsWith('/') && !url.startsWith('//') ? url : '/hoje',
    tag: 'campanha',
  };
}
