/**
 * Meta de peso.
 *
 * A pergunta que esta camada responde é "estou indo para onde eu disse que
 * quero, e em que ritmo" — não "quanto a balança marcou hoje". A diferença
 * entre as duas é o que faz a tela ajudar em vez de assustar.
 *
 * As decisões, e o porquê de cada uma:
 *
 * - **Tendência, nunca o número do dia.** O peso corporal oscila 1 a 2 kg por
 *   água, sal, intestino e ciclo menstrual. Um progresso calculado sobre a
 *   última pesagem dá notícia falsa toda semana — ora "você ganhou 900 g", ora
 *   "você perdeu 1,2 kg" — e ensina a pessoa a não confiar no app. Tudo aqui
 *   olha a média dos últimos dias.
 * - **Ritmo antes de prazo.** A pessoa escolhe o alvo; quem calcula o prazo é o
 *   app, a partir do que é seguro. O caminho contrário — escolher a data e
 *   derivar o déficit necessário — é receitar dieta perigosa com outro nome.
 *   Referência: ~0,5% do peso corporal por semana em perda preserva massa magra
 *   (cortes maiores custam músculo); ganho de massa acompanha ~0,25% por
 *   semana, e o que passa disso é gordura. Mesmas fontes citadas em
 *   `services/health.ts`.
 * - **Marco pequeno.** 8 kg intimida; 1 kg oito vezes é factível. O degrau é
 *   ~1% do peso de partida: grande o bastante para sair do ruído da balança e
 *   pequeno o bastante para chegar em semanas.
 * - **Platô é informação.** Peso que para de andar é a fase normal em que o
 *   corpo ajusta gasto e retenção de água. O texto diz isso; nunca "você está
 *   atrasado".
 * - **Nenhum texto daqui cobra, e nenhum julga corpo.** Vale a mesma regra de
 *   `services/notifications.ts`: o que aparece na tela de alguém sobre o
 *   próprio corpo tem que ser fato e caminho, não veredito.
 *
 * Nada aqui é conselho médico, e a tela diz isso.
 */

import { addDays, daysBetween } from '@/services/calendar';

export type DirecaoDaMeta = 'perder' | 'ganhar';

export type MetaDePeso = {
  alvoKg: number;
  inicioKg: number;
  inicioEm: string;
  /** preenchido quando a meta foi batida; a partir daí ela só é histórico */
  alcancadaEm: string | null;
};

/** A forma em que o peso chega, igual no banco e no IndexedDB. */
export type PesoRegistrado = {
  measured_on: string;
  weight_kg: number | null;
};

export type Marco = {
  ordem: number;
  pesoKg: number;
  /** o último marco é o próprio alvo */
  final: boolean;
  atingido: boolean;
};

export type SituacaoDaMeta =
  | 'sem_dados'
  | 'poucos_dados'
  | 'alcancada'
  | 'no_ritmo'
  | 'devagar'
  | 'parada'
  | 'rapido_demais'
  | 'afastando';

export type Leitura = { titulo: string; texto: string };

export type ProgressoDaMeta = {
  direcao: DirecaoDaMeta;
  alvoKg: number;
  inicioKg: number;
  /** média dos registros recentes: é este número que a tela mostra em destaque */
  tendenciaKg: number | null;
  /** quantos dias a janela precisou abrir para achar registro */
  janelaDias: number | null;
  /** a última pesagem, mostrada só como referência secundária */
  ultimoKg: number | null;
  ultimoEm: string | null;
  /** 0 a 1, já limitado nas pontas */
  fracao: number;
  percorridoKg: number;
  restanteKg: number;
  /** kg por semana no sentido do alvo; negativo é afastar-se dele */
  ritmoSemanal: number | null;
  ritmoSeguroSemanal: number;
  semanasRestantes: number | null;
  previsaoEm: string | null;
  marcos: Marco[];
  proximoMarco: Marco | null;
  situacao: SituacaoDaMeta;
  leitura: Leitura;
};

/** Fração do peso corporal por semana que a literatura trata como sustentável. */
const RITMO_SEGURO = { perder: 0.005, ganhar: 0.0025 } as const;

/** Janelas tentadas, em dias, até achar registro de peso. */
const JANELAS = [7, 14, 21] as const;

/** Distâncias, em dias, para medir o ritmo comparando duas tendências. */
const COMPARACOES = [28, 21, 14] as const;

/** Abaixo disto a variação é ruído de balança, não movimento. */
const RUIDO_SEMANAL = 0.05;

/** Teto de marcos: 30 kg divididos em degraus de 1% viram uma lista inútil. */
const MAX_MARCOS = 12;

/** IMC mínimo que um alvo pode ter. O gatilho em `weight_goals` repete a regra. */
export const IMC_PISO = 17;
/** Abaixo deste IMC o alvo é aceito, mas com aviso. */
export const IMC_AVISO = 18.5;

const arredondar = (valor: number, casas = 1) => {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
};

/** Formata para leitura em pt-BR: 72,5 kg. */
export function formatarKg(valor: number): string {
  return `${arredondar(valor, 1).toFixed(1).replace('.', ',')} kg`;
}

function formatarRitmo(kgPorSemana: number): string {
  return `${Math.abs(arredondar(kgPorSemana, 2)).toFixed(2).replace('.', ',')} kg por semana`;
}

/** Menor peso que o app aceita como alvo para esta altura. */
export function pisoDoAlvo(alturaCm: number): number {
  const metros = alturaCm / 100;
  return arredondar(IMC_PISO * metros * metros, 1);
}

export type AvaliacaoDoAlvo =
  | { nivel: 'ok' }
  | { nivel: 'aviso'; mensagem: string }
  | { nivel: 'recusado'; mensagem: string };

/**
 * O alvo é aceitável?
 *
 * Três respostas, e não duas. Recusar tudo abaixo da faixa "adequada" seria o
 * app dando palpite sobre o corpo de quem já está dentro dela; aceitar qualquer
 * número seria o app ajudando alguém a chegar em desnutrição. O aviso existe
 * justamente para a faixa entre os dois.
 */
export function avaliarAlvo(alvoKg: number, alturaCm: number | null): AvaliacaoDoAlvo {
  if (alturaCm === null) return { nivel: 'ok' };

  const metros = alturaCm / 100;
  const imc = alvoKg / (metros * metros);

  if (imc < IMC_PISO) {
    return {
      nivel: 'recusado',
      mensagem:
        `Para ${alturaCm} cm, ${formatarKg(alvoKg)} fica abaixo do limite que dá para ` +
        `acompanhar aqui com segurança — o mínimo é ${formatarKg(pisoDoAlvo(alturaCm))}. ` +
        'Um objetivo nessa faixa pede acompanhamento de profissional de saúde.',
    };
  }

  if (imc < IMC_AVISO) {
    return {
      nivel: 'aviso',
      mensagem:
        `${formatarKg(alvoKg)} fica um pouco abaixo da faixa de referência para ${alturaCm} cm. ` +
        'Dá para registrar, e o app acompanha — só vale saber que a faixa começa mais acima.',
    };
  }

  return { nivel: 'ok' };
}

/** Kg por semana que a literatura trata como sustentável para este peso. */
export function ritmoSeguroSemanal(pesoKg: number, direcao: DirecaoDaMeta): number {
  return arredondar(pesoKg * RITMO_SEGURO[direcao], 2);
}

/** Média do peso registrado nos `dias` que terminam em `fim`. */
export function mediaNaJanela(
  pesos: readonly PesoRegistrado[],
  fim: string,
  dias: number,
): number | null {
  const inicio = addDays(fim, -(dias - 1));

  const valores = pesos
    .filter(
      (item): item is PesoRegistrado & { weight_kg: number } =>
        item.weight_kg !== null && item.measured_on >= inicio && item.measured_on <= fim,
    )
    .map((item) => item.weight_kg);

  if (valores.length === 0) return null;
  return valores.reduce((soma, valor) => soma + valor, 0) / valores.length;
}

/**
 * A tendência num dia.
 *
 * Sete dias é a janela padrão porque cobre o ciclo semanal de comportamento —
 * fim de semana pesa diferente de terça. Quando não há registro nela, a janela
 * abre até 21 dias em vez de devolver nada: uma tendência de três semanas atrás
 * ainda diz mais do que um traço na tela.
 */
export function tendenciaEm(
  pesos: readonly PesoRegistrado[],
  dia: string,
): { kg: number; janelaDias: number } | null {
  for (const janela of JANELAS) {
    const kg = mediaNaJanela(pesos, dia, janela);
    if (kg !== null) return { kg: arredondar(kg, 2), janelaDias: janela };
  }

  return null;
}

/**
 * Degraus entre o peso de partida e o alvo.
 *
 * O último marco é sempre o alvo, mesmo que o degrau não feche redondo.
 */
export function marcosDe(inicioKg: number, alvoKg: number): Omit<Marco, 'atingido'>[] {
  const total = Math.abs(alvoKg - inicioKg);
  if (total < 0.5) return [];

  const sentido = alvoKg < inicioKg ? -1 : 1;
  const bruto = Math.max(inicioKg * 0.01, total / MAX_MARCOS);
  // meio quilo é o menor degrau que sai do ruído da balança
  const passo = Math.max(0.5, Math.round(bruto * 2) / 2);

  const marcos: Omit<Marco, 'atingido'>[] = [];

  for (let n = 1; n <= MAX_MARCOS; n += 1) {
    const peso = arredondar(inicioKg + sentido * passo * n, 1);
    // o que passar do alvo não vira marco: o alvo entra sozinho, logo abaixo
    if (sentido < 0 ? peso <= alvoKg : peso >= alvoKg) break;
    marcos.push({ ordem: n, pesoKg: peso, final: false });
  }

  marcos.push({ ordem: marcos.length + 1, pesoKg: arredondar(alvoKg, 1), final: true });

  return marcos;
}

/**
 * Ritmo semanal no sentido do alvo.
 *
 * Compara a tendência de hoje com a de algumas semanas atrás. Tenta a distância
 * maior primeiro: quanto mais longe, menos a oscilação de curto prazo pesa.
 */
function ritmoNoSentido(
  pesos: readonly PesoRegistrado[],
  hoje: string,
  direcao: DirecaoDaMeta,
  tendenciaHoje: number,
  inicioEm: string,
): number | null {
  const idadeDaMeta = daysBetween(inicioEm, hoje);

  for (const distancia of COMPARACOES) {
    // comparar com antes da meta existir mediria outro período da vida da pessoa
    if (distancia > idadeDaMeta) continue;

    const antes = tendenciaEm(pesos, addDays(hoje, -distancia));
    if (antes === null) continue;

    const variacao = tendenciaHoje - antes.kg;
    const avanco = direcao === 'perder' ? -variacao : variacao;

    return arredondar(avanco / (distancia / 7), 2);
  }

  return null;
}

function decidirSituacao(dados: {
  alcancou: boolean;
  tendenciaKg: number | null;
  ritmoSemanal: number | null;
  ritmoSeguro: number;
  semanasDeMeta: number;
}): SituacaoDaMeta {
  const { alcancou, tendenciaKg, ritmoSemanal, ritmoSeguro, semanasDeMeta } = dados;

  if (tendenciaKg === null) return 'sem_dados';
  if (alcancou) return 'alcancada';
  if (ritmoSemanal === null) return 'poucos_dados';

  if (ritmoSemanal < -RUIDO_SEMANAL) return 'afastando';

  // "parado" só faz sentido depois de tempo suficiente para haver o que parar
  if (Math.abs(ritmoSemanal) <= RUIDO_SEMANAL) {
    return semanasDeMeta >= 3 ? 'parada' : 'poucos_dados';
  }

  if (ritmoSemanal > ritmoSeguro * 1.5) return 'rapido_demais';
  if (ritmoSemanal < ritmoSeguro * 0.5) return 'devagar';

  return 'no_ritmo';
}

function lerSituacao(
  situacao: SituacaoDaMeta,
  dados: {
    direcao: DirecaoDaMeta;
    restanteKg: number;
    ritmoSemanal: number | null;
    ritmoSeguro: number;
    proximoMarco: Marco | null;
  },
): Leitura {
  const { direcao, restanteKg, ritmoSemanal, ritmoSeguro, proximoMarco } = dados;
  const verbo = direcao === 'perder' ? 'perder' : 'ganhar';

  const ateOMarco =
    proximoMarco && !proximoMarco.final
      ? ` O próximo degrau é ${formatarKg(proximoMarco.pesoKg)}.`
      : '';

  switch (situacao) {
    case 'sem_dados':
      return {
        titulo: 'Registre um peso para começar',
        texto:
          'A meta acompanha a tendência das suas pesagens, e não há nenhuma nas últimas três ' +
          'semanas. Uma por semana já basta — não precisa ser todo dia.',
      };

    case 'poucos_dados':
      return {
        titulo: 'Ainda cedo para falar de ritmo',
        texto:
          'Com algumas semanas de registro dá para separar tendência de oscilação do dia. Por ' +
          `enquanto, faltam ${formatarKg(restanteKg)} até o alvo.${ateOMarco}`,
      };

    case 'alcancada':
      return {
        titulo: 'Você chegou',
        texto:
          'A tendência das últimas pesagens alcançou o alvo. Daqui, manter é um objetivo por si ' +
          'só — e costuma ser o mais difícil dos dois.',
      };

    case 'afastando':
      return {
        titulo: 'A tendência mudou de sentido',
        texto:
          `O peso vem andando ao contrário do alvo, ${formatarRitmo(ritmoSemanal ?? 0)}. Semanas ` +
          'assim acontecem, e uma delas não desfaz o que já foi feito. Vale olhar o que mudou na ' +
          'rotina antes de mudar o treino.',
      };

    case 'parada':
      return {
        titulo: 'O peso está estável',
        texto:
          'A tendência não anda há algumas semanas. Platô é fase normal: o corpo ajusta gasto e ' +
          'retenção de água antes de voltar a se mover. O que costuma destravar é olhar a semana ' +
          'inteira — sono, constância e o que já está registrado aqui — e não apertar mais um dia.',
      };

    case 'rapido_demais':
      return {
        titulo: 'Mais rápido que o ritmo de referência',
        texto:
          `Você está a ${formatarRitmo(ritmoSemanal ?? 0)}, contra ${formatarRitmo(ritmoSeguro)} ` +
          `de referência para ${verbo}. Chegar antes tem um custo: em perda, parte do que sai é ` +
          'massa magra; em ganho, parte do que entra é gordura. A previsão abaixo usa o ritmo de ' +
          'referência, e não o seu, de propósito.',
      };

    case 'devagar':
      return {
        titulo: 'Devagar, e andando',
        texto:
          `${formatarRitmo(ritmoSemanal ?? 0)} fica abaixo da referência de ` +
          `${formatarRitmo(ritmoSeguro)}, e isso não é problema: devagar chega, e chega com mais ` +
          `massa magra preservada.${ateOMarco}`,
      };

    case 'no_ritmo':
    default:
      return {
        titulo: 'No ritmo',
        texto:
          `${formatarRitmo(ritmoSemanal ?? 0)} está dentro da faixa que se sustenta. Faltam ` +
          `${formatarKg(restanteKg)} até o alvo.${ateOMarco}`,
      };
  }
}

/**
 * O estado da meta hoje.
 *
 * Função pura: entram a meta e os pesos registrados, sai tudo o que a tela
 * mostra. Nenhuma consulta e nenhum relógio escondido — `hoje` é parâmetro.
 */
export function analisarMeta(
  meta: MetaDePeso,
  pesos: readonly PesoRegistrado[],
  hoje: string,
): ProgressoDaMeta {
  const direcao: DirecaoDaMeta = meta.alvoKg < meta.inicioKg ? 'perder' : 'ganhar';
  const total = Math.abs(meta.alvoKg - meta.inicioKg);

  const tendencia = tendenciaEm(pesos, hoje);
  const tendenciaKg = tendencia?.kg ?? null;

  const ultimo =
    [...pesos]
      .filter((item) => item.weight_kg !== null)
      .sort((a, b) => a.measured_on.localeCompare(b.measured_on))
      .at(-1) ?? null;

  const referencia = tendenciaKg ?? meta.inicioKg;
  const avancou = direcao === 'perder' ? referencia < meta.inicioKg : referencia > meta.inicioKg;

  // andar para o lado errado não vira progresso negativo: a barra fica em zero
  const percorridoKg = arredondar(
    avancou ? Math.min(Math.abs(referencia - meta.inicioKg), total) : 0,
    1,
  );
  const restanteKg = arredondar(Math.max(total - percorridoKg, 0), 1);
  const fracao = total === 0 ? 1 : Math.min(Math.max(percorridoKg / total, 0), 1);

  const ritmoSeguro = ritmoSeguroSemanal(referencia, direcao);
  const ritmoSemanal =
    tendenciaKg === null ? null : ritmoNoSentido(pesos, hoje, direcao, tendenciaKg, meta.inicioEm);

  const marcos: Marco[] = marcosDe(meta.inicioKg, meta.alvoKg).map((marco) => ({
    ...marco,
    atingido:
      tendenciaKg !== null &&
      (direcao === 'perder' ? tendenciaKg <= marco.pesoKg : tendenciaKg >= marco.pesoKg),
  }));

  const proximoMarco = marcos.find((marco) => !marco.atingido) ?? null;

  const alcancou =
    tendenciaKg !== null &&
    (direcao === 'perder' ? tendenciaKg <= meta.alvoKg : tendenciaKg >= meta.alvoKg);

  const situacao = decidirSituacao({
    alcancou,
    tendenciaKg,
    ritmoSemanal,
    ritmoSeguro,
    semanasDeMeta: daysBetween(meta.inicioEm, hoje) / 7,
  });

  // Quando o ritmo real passa do seguro, a previsão usa o seguro: prometer a
  // data que sai de um ritmo insustentável é prometer o que não se sustenta.
  const ritmoDaPrevisao =
    ritmoSemanal !== null && ritmoSemanal > RUIDO_SEMANAL
      ? Math.min(ritmoSemanal, ritmoSeguro)
      : null;

  const semanasRestantes =
    ritmoDaPrevisao !== null && restanteKg > 0 ? Math.ceil(restanteKg / ritmoDaPrevisao) : null;

  return {
    direcao,
    alvoKg: meta.alvoKg,
    inicioKg: meta.inicioKg,
    tendenciaKg,
    janelaDias: tendencia?.janelaDias ?? null,
    ultimoKg: ultimo?.weight_kg ?? null,
    ultimoEm: ultimo?.measured_on ?? null,
    fracao,
    percorridoKg,
    restanteKg,
    ritmoSemanal,
    ritmoSeguroSemanal: ritmoSeguro,
    semanasRestantes,
    previsaoEm: semanasRestantes === null ? null : addDays(hoje, semanasRestantes * 7),
    marcos,
    proximoMarco,
    situacao,
    leitura: lerSituacao(situacao, {
      direcao,
      restanteKg,
      ritmoSemanal,
      ritmoSeguro,
      proximoMarco,
    }),
  };
}
