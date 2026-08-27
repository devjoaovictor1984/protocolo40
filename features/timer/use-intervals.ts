'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { audioLiberado, encerrar, liberar, tocar, vibrar, type Preferencias } from '@/lib/audio/apito';
import { momentoEm, sinalEm, type ConfiguracaoDeIntervalo } from '@/services/intervals';

/**
 * O sino do treino.
 *
 * A regra de *o que* toca é pura e vive em `services/intervals`. Aqui mora só o
 * *quando*: transformar os segundos decorridos do cronômetro em som.
 *
 * **Dispara na virada do segundo, e nunca duas vezes no mesmo.** O cronômetro
 * atualiza quatro vezes por segundo; sem a trava do último segundo tocado, cada
 * sinal soaria quatro vezes.
 *
 * **Não recupera o que passou.** Se o telefone ficou dez minutos no bolso com a
 * tela apagada e o app suspenso, ao voltar não se toca uma sequência de bipes
 * atrasados — eles não significam mais nada. O som só vale no instante certo.
 */

/** Mantém a tela acesa enquanto os intervalos estão ligados. */
function useTelaAcesa(ativo: boolean) {
  const travaRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!ativo || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let vivo = true;

    const pedir = async () => {
      try {
        travaRef.current = await navigator.wakeLock.request('screen');
      } catch {
        // negado ou sem suporte: o treino segue, só com a tela apagando
      }
    };

    void pedir();

    // o sistema solta a trava sozinho quando o app vai para segundo plano;
    // voltando, ela precisa ser pedida de novo
    const aoVoltar = () => {
      if (vivo && document.visibilityState === 'visible') void pedir();
    };

    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      vivo = false;
      document.removeEventListener('visibilitychange', aoVoltar);
      void travaRef.current?.release().catch(() => {});
      travaRef.current = null;
    };
  }, [ativo]);
}

export function useIntervals({
  config,
  elapsed,
  rodando,
  preferencias,
}: {
  config: ConfiguracaoDeIntervalo | null;
  /** Segundos decorridos, vindos do cronômetro. */
  elapsed: number;
  /** Falso quando pausado: pausa não deve tocar nada. */
  rodando: boolean;
  /** Volume, timbre e vibração escolhidos. */
  preferencias: Preferencias;
}) {
  const [comSom, setComSom] = useState(false);
  const ultimoSegundo = useRef(-1);

  const ativo = Boolean(config) && rodando;
  useTelaAcesa(ativo);

  /** Chamado de dentro do toque que começa o treino. */
  const ligarSom = useCallback(async () => {
    const ok = await liberar();
    setComSom(ok);
    return ok;
  }, []);

  useEffect(() => () => encerrar(), []);

  useEffect(() => {
    if (!config || !rodando) {
      ultimoSegundo.current = -1;
      return;
    }

    const segundo = Math.floor(elapsed);
    if (segundo === ultimoSegundo.current) return;

    // saltou vários segundos de uma vez (app voltou do segundo plano): assume o
    // novo ponto sem tocar o que ficou para trás
    const saltou = ultimoSegundo.current >= 0 && segundo - ultimoSegundo.current > 1;
    ultimoSegundo.current = segundo;
    if (saltou) return;

    const sinal = sinalEm(config, segundo);
    if (!sinal) return;

    tocar(sinal, preferencias);
    vibrar(sinal, preferencias.vibrar);
  }, [config, elapsed, rodando, preferencias]);

  return {
    /** O áudio foi liberado por um gesto e está pronto. */
    comSom: comSom && audioLiberado(),
    ligarSom,
    momento: config ? momentoEm(config, Math.floor(elapsed)) : null,
  };
}
