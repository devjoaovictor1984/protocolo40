import 'server-only';

import webpush, { type PushSubscription, WebPushError } from 'web-push';

/**
 * Envio de push.
 *
 * O trabalho de verdade aqui é lidar com o que dá errado, porque quase tudo dá
 * errado: aparelho desinstalado, permissão revogada, serviço fora do ar. Cada
 * um pede uma resposta diferente, e tratar tudo igual acumula lixo que faz a
 * próxima campanha demorar.
 */

const chavePublica = process.env.NEXT_PUBLIC_VAPID_KEY?.trim();
const chavePrivada = process.env.VAPID_PRIVATE_KEY?.trim();
const assunto = process.env.VAPID_SUBJECT?.trim() ?? 'mailto:contato@p20x.com.br';

/** O push está configurado neste ambiente? */
export const pushConfigurado = Boolean(chavePublica && chavePrivada);

if (pushConfigurado) {
  webpush.setVapidDetails(assunto, chavePublica!, chavePrivada!);
}

export type Aparelho = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type Aviso = {
  title: string;
  body: string;
  /** Caminho interno para onde a notificação leva. */
  url: string;
  /**
   * Agrupa notificações do mesmo assunto.
   *
   * Sem isto, três lembretes viram três avisos empilhados na tela de alguém que
   * ficou dois dias sem abrir o app.
   */
  tag?: string;
};

/** O que aconteceu com um envio. */
export type Resultado =
  | { estado: 'entregue'; endpoint: string }
  | { estado: 'morto'; endpoint: string }
  | { estado: 'falhou'; endpoint: string; motivo: string };

/**
 * 404 e 410 são definitivos: aquele aparelho não existe mais.
 *
 * Qualquer outro erro é passageiro — serviço fora do ar, rede, limite. A
 * diferença importa porque apagar cedo demais tira notificação de quem ainda
 * quer receber, e apagar tarde demais faz toda campanha arrastar inscrições
 * mortas.
 */
const ehDefinitivo = (status: number) => status === 404 || status === 410;

export async function enviarPara(aparelho: Aparelho, aviso: Aviso): Promise<Resultado> {
  if (!pushConfigurado) {
    return { estado: 'falhou', endpoint: aparelho.endpoint, motivo: 'push não configurado' };
  }

  const inscricao: PushSubscription = {
    endpoint: aparelho.endpoint,
    keys: { p256dh: aparelho.p256dh, auth: aparelho.auth },
  };

  try {
    await webpush.sendNotification(inscricao, JSON.stringify(aviso), {
      // o serviço guarda por até um dia; um lembrete de ontem não serve
      TTL: 60 * 60 * 12,
      urgency: 'normal',
    });

    return { estado: 'entregue', endpoint: aparelho.endpoint };
  } catch (erro) {
    if (erro instanceof WebPushError && ehDefinitivo(erro.statusCode)) {
      return { estado: 'morto', endpoint: aparelho.endpoint };
    }

    return {
      estado: 'falhou',
      endpoint: aparelho.endpoint,
      motivo: erro instanceof Error ? erro.message : 'erro desconhecido',
    };
  }
}

/**
 * Envia para muitos, em lotes.
 *
 * Sem lote, mil aparelhos viram mil conexões simultâneas e o processo morre por
 * memória ou toma limite do serviço de push. Vinte por vez é conservador e
 * atravessa uma base de milhares dentro do tempo de uma função serverless.
 */
export async function enviarEmLote(
  aparelhos: readonly Aparelho[],
  aviso: Aviso,
  tamanhoDoLote = 20,
): Promise<Resultado[]> {
  const resultados: Resultado[] = [];

  for (let i = 0; i < aparelhos.length; i += tamanhoDoLote) {
    const lote = aparelhos.slice(i, i + tamanhoDoLote);
    resultados.push(...(await Promise.all(lote.map((aparelho) => enviarPara(aparelho, aviso)))));
  }

  return resultados;
}

/** Um resumo legível do que aconteceu. */
export function resumir(resultados: readonly Resultado[]) {
  return {
    entregues: resultados.filter((r) => r.estado === 'entregue').length,
    mortos: resultados.filter((r) => r.estado === 'morto').map((r) => r.endpoint),
    falhas: resultados.filter((r) => r.estado === 'falhou').length,
  };
}
