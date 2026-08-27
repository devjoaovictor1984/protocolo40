'use client';

import { useCallback } from 'react';

import { liberar } from '@/lib/audio/apito';
import { momentoEm, type ConfiguracaoDeIntervalo } from '@/services/intervals';

/**
 * A parte do sino que a tela do cronômetro precisa.
 *
 * **Não toca nada.** Quem toca é o `IntervalBell`, montado no layout — ver o
 * comentário lá. Tocar daqui foi a primeira versão e tinha um defeito difícil
 * de enxergar: sair da tela do cronômetro desmontava o hook, o som parava, e
 * voltando para a tela ele ressuscitava. O treino nunca parou; só o aviso.
 *
 * Sobraram duas coisas, e as duas dependem de estar na tela:
 *
 * - **liberar o áudio**, que só vale dentro de um gesto — e o gesto é o toque
 *   em Iniciar, que acontece aqui;
 * - **calcular a fase** para mostrar esforço/descanso e o anel.
 */
export function useIntervals({
  config,
  elapsed,
}: {
  config: ConfiguracaoDeIntervalo | null;
  /** Segundos decorridos, vindos do cronômetro. */
  elapsed: number;
}) {
  /** Chamado de dentro do toque que começa o treino. */
  const ligarSom = useCallback(async () => liberar(), []);

  return {
    ligarSom,
    momento: config ? momentoEm(config, Math.floor(elapsed)) : null,
  };
}
