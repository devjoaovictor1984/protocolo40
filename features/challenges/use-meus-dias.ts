'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/features/session/session-context';
import { localWorkoutDays } from '@/features/workouts/repository';
import { isBrowser } from '@/lib/offline/db';
import { diasComOAparelho } from '@/services/challenges';

/**
 * Os meus dias num desafio, com o que ainda não subiu.
 *
 * A contagem do desafio nasce no servidor, e é assim que tem que ser: ela sai
 * dos treinos gravados, e não de um número guardado que pode ficar errado. Só
 * que entre terminar o treino e a fila subir existe um intervalo — e sem rede
 * ele dura o tempo que durar. Nesse intervalo o painel dizia "treino de hoje
 * feito" e o cartão do desafio dizia "hoje ainda está em aberto", na mesma tela.
 *
 * Aqui o servidor continua sendo a base e o IndexedDB entra como correção. A
 * regra de mesclagem é pura e mora em `services/challenges`.
 *
 * O primeiro render devolve exatamente o que veio do servidor — a consulta
 * local ainda não respondeu. É de propósito: é o que o HTML do servidor tem, e
 * é o que a hidratação espera encontrar.
 */
export function useMeusDias(doServidor: readonly string[]): string[] {
  const { userId } = useSession();

  // a chave começa com 'workouts' para pegar carona nas invalidações que a
  // sincronização e as telas de treino já disparam
  const { data } = useQuery({
    queryKey: ['workouts', 'dias-locais', userId],
    queryFn: () => localWorkoutDays(userId),
    enabled: isBrowser(),
    staleTime: 5_000,
  });

  return useMemo(
    () => (data ? diasComOAparelho(doServidor, data) : [...doServidor]),
    [data, doServidor],
  );
}
