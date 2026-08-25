'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';

import { env } from '@/lib/env';

/**
 * Permissão e inscrição de notificação.
 *
 * Três verdades sobre push que moldam tudo aqui:
 *
 * 1. **A permissão só pode ser pedida dentro de um gesto.** Um `requestPermission`
 *    no carregamento da página é bloqueado pelo navegador e, pior, queima a
 *    única chance: negado uma vez, o navegador não pergunta de novo.
 * 2. **No iPhone só funciona com o app instalado.** Safari não expõe
 *    `PushManager` fora do modo standalone, e é por isso que a tela precisa
 *    saber a diferença entre "não dá" e "ainda não pedi".
 * 3. **Negar é definitivo pelo app.** Depois de negado, só nas configurações do
 *    navegador — e a tela precisa dizer isso em vez de oferecer o botão de novo.
 */

export type EstadoDoPush =
  /** O navegador não tem push, ou é iPhone sem o app instalado. */
  | 'indisponivel'
  /** Dá para pedir. */
  | 'pode-pedir'
  /** Autorizado e inscrito. */
  | 'ativo'
  /** Autorizado no navegador mas sem inscrição neste aparelho. */
  | 'autorizado-sem-inscricao'
  /** Negado. Só volta pelas configurações do navegador. */
  | 'negado';

function suportado(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function lerPermissao(): NotificationPermission | 'indisponivel' {
  if (!suportado()) return 'indisponivel';
  return Notification.permission;
}

/**
 * A permissão muda fora do React — pelo cadeado da barra de endereço, por
 * exemplo. `permissions.query` avisa quando isso acontece nos navegadores que
 * o implementam; nos outros o valor é lido a cada montagem, que já resolve.
 */
function assinarPermissao(avisar: () => void): () => void {
  if (!suportado() || !navigator.permissions?.query) return () => {};

  let status: PermissionStatus | null = null;

  /*
   * O `try` em volta cobre o navegador que **lança de forma síncrona** em vez de
   * devolver uma promessa recusada quando o nome da permissão não é suportado —
   * e nesse caso o `.catch()` abaixo não pega nada. Como isto roda dentro do
   * `useSyncExternalStore`, um erro aqui quebraria a árvore inteira na hora de
   * assinar, e o sintoma apareceria longe daqui.
   */
  try {
    navigator.permissions
      .query({ name: 'notifications' as PermissionName })
      .then((resultado) => {
        status = resultado;
        resultado.addEventListener('change', avisar);
      })
      .catch(() => {
        // sem assinatura, tudo bem: a leitura na montagem cobre o caso comum
      });
  } catch {
    // idem
  }

  return () => status?.removeEventListener('change', avisar);
}

const permissaoNoServidor = () => 'indisponivel' as const;

/**
 * A chave pública vem em base64url e o navegador quer bytes.
 *
 * O `ArrayBuffer` explícito é por causa da tipagem: `Uint8Array` genérico não
 * satisfaz `BufferSource` desde que o TypeScript passou a parametrizar o buffer.
 */
function chaveEmBytes(base64: string): ArrayBuffer {
  const preenchido = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const normal = preenchido.replace(/-/g, '+').replace(/_/g, '/');
  const bruto = window.atob(normal);

  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i += 1) bytes[i] = bruto.charCodeAt(i);

  return bytes.buffer;
}

export function usePush() {
  const permissao = useSyncExternalStore(assinarPermissao, lerPermissao, permissaoNoServidor);
  const [inscrito, setInscrito] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const estado: EstadoDoPush =
    permissao === 'indisponivel' || !env.vapidKey
      ? 'indisponivel'
      : permissao === 'denied'
        ? 'negado'
        : permissao === 'default'
          ? 'pode-pedir'
          : inscrito === false
            ? 'autorizado-sem-inscricao'
            : 'ativo';

  /** Pede a permissão e inscreve o aparelho. Precisa vir de um clique. */
  const ativar = useCallback(async (): Promise<EstadoDoPush> => {
    if (!suportado() || !env.vapidKey) return 'indisponivel';

    setOcupado(true);

    try {
      const permissaoNova = await Notification.requestPermission();
      if (permissaoNova !== 'granted') return permissaoNova === 'denied' ? 'negado' : 'pode-pedir';

      const registro = await navigator.serviceWorker.ready;

      // reaproveitar a inscrição existente evita criar uma segunda linha para o
      // mesmo aparelho quando a pessoa clica duas vezes
      const inscricao =
        (await registro.pushManager.getSubscription()) ??
        (await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: chaveEmBytes(env.vapidKey),
        }));

      const resposta = await fetch('/api/push/inscrever', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inscricao.toJSON()),
      });

      if (!resposta.ok) throw new Error('não deu para registrar no servidor');

      setInscrito(true);
      return 'ativo';
    } catch {
      setInscrito(false);
      return 'autorizado-sem-inscricao';
    } finally {
      setOcupado(false);
    }
  }, []);

  /** Desliga no servidor e no navegador. */
  const desativar = useCallback(async (): Promise<void> => {
    setOcupado(true);

    try {
      const registro = await navigator.serviceWorker.ready;
      const inscricao = await registro.pushManager.getSubscription();

      if (inscricao) {
        await fetch('/api/push/inscrever', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: inscricao.endpoint }),
        }).catch(() => {
          // sem rede: a inscrição morre sozinha no próximo envio com 410
        });

        await inscricao.unsubscribe();
      }

      setInscrito(false);
    } finally {
      setOcupado(false);
    }
  }, []);

  return { estado, ocupado, ativar, desativar };
}
