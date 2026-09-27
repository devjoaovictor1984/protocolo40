'use client';

import { useEffect } from 'react';

import { precisaAtualizar, VERSAO } from '@/lib/versao';

/** De quanto em quanto tempo conferir, com o app aberto na tela. */
const INTERVALO_MS = 10 * 60 * 1000;

/**
 * Recarrega o app quando sai um deploy novo.
 *
 * O momento certo é a volta: a pessoa abre o PWA que estava em segundo plano,
 * e é aí que ele confere. Recarregar enquanto ela digita ou lê seria pior que
 * o problema. Sem rede, não faz nada — a checagem só existe para quem consegue
 * falar com o servidor, que é justamente quem vai tocar num botão.
 */
export function AtualizarVersao() {
  useEffect(() => {
    if (VERSAO === 'dev') return;

    let conferindo = false;

    const conferir = async () => {
      if (conferindo || document.visibilityState !== 'visible') return;
      conferindo = true;
      try {
        const resposta = await fetch('/api/versao', { cache: 'no-store' });
        if (!resposta.ok) return;
        const { versao } = (await resposta.json()) as { versao?: string };
        if (precisaAtualizar(VERSAO, versao ?? null, window.location.pathname)) {
          window.location.reload();
        }
      } catch {
        // sem rede: fica para a próxima
      } finally {
        conferindo = false;
      }
    };

    document.addEventListener('visibilitychange', conferir);
    const intervalo = window.setInterval(conferir, INTERVALO_MS);

    return () => {
      document.removeEventListener('visibilitychange', conferir);
      window.clearInterval(intervalo);
    };
  }, []);

  return null;
}
