'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { PREFERENCIAS_PADRAO, type Preferencias } from '@/lib/audio/apito';
import type { ConfiguracaoDeIntervalo } from '@/services/intervals';

/**
 * As preferências do sino, lembradas entre treinos.
 *
 * Ficam no aparelho e não no servidor de propósito: **é preferência, não dado.**
 * Quem treina de fone no celular e sem fone no tablet quer volumes diferentes
 * nos dois, e sincronizar isso seria imitar uma consistência que ninguém pediu.
 *
 * Retomar o último intervalo usado é o que faz a diferença no uso diário: quem
 * sempre faz 40/20 não quer redigitar antes de cada treino. Mas o intervalo
 * volta **desligado** — retomar o som sozinho seria o app fazendo barulho sem
 * ninguém ter pedido naquele momento.
 */

export type PreferenciasDoSino = Preferencias & {
  /** O último intervalo escolhido, para oferecer de novo. Nunca liga sozinho. */
  ultimo: ConfiguracaoDeIntervalo | null;
};

const PADRAO: PreferenciasDoSino = { ...PREFERENCIAS_PADRAO, ultimo: null };
const CHAVE = 'p20x_sino';

const ouvintes = new Set<() => void>();
let cache: PreferenciasDoSino | null = null;

function ler(): PreferenciasDoSino {
  if (cache) return cache;

  try {
    const bruto = window.localStorage.getItem(CHAVE);
    const salvo = bruto ? (JSON.parse(bruto) as Partial<PreferenciasDoSino>) : {};

    // mistura com o padrão: uma versão antiga do app pode ter gravado menos
    // campos, e faltar um não pode deixar o objeto pela metade
    cache = {
      volume: salvo.volume ?? PADRAO.volume,
      timbre: salvo.timbre ?? PADRAO.timbre,
      vibrar: salvo.vibrar ?? PADRAO.vibrar,
      ultimo: salvo.ultimo ?? null,
    };
  } catch {
    // navegador com armazenamento bloqueado: o padrão serve
    cache = PADRAO;
  }

  return cache;
}

const assinar = (avisar: () => void) => {
  ouvintes.add(avisar);
  return () => {
    ouvintes.delete(avisar);
  };
};

/** No servidor não há armazenamento; o padrão é o mesmo dos dois lados. */
const noServidor = () => PADRAO;

export function useIntervalPrefs() {
  const preferencias = useSyncExternalStore(assinar, ler, noServidor);

  const salvar = useCallback((mudanca: Partial<PreferenciasDoSino>) => {
    const novo = { ...ler(), ...mudanca };
    cache = novo;

    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(novo));
    } catch {
      // sem armazenamento a escolha vale só nesta sessão, e tudo bem
    }

    for (const avisar of ouvintes) avisar();
  }, []);

  return { preferencias, salvar };
}
