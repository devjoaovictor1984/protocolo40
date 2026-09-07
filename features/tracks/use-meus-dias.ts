'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/features/session/session-context';
import { localWorkoutDays } from '@/features/workouts/repository';
import { isBrowser } from '@/lib/offline/db';
// A regra de mesclagem é a mesma do desafio e mora lá. Copiá-la para cá criaria
// uma segunda fonte de verdade para "o que o aparelho corrige", e um dia as
// duas discordariam na mesma tela — que é justamente o defeito que ela conserta.
import { diasComOAparelho } from '@/services/challenges';

/**
 * Os meus dias na trilha, com o que ainda não subiu.
 *
 * A contagem nasce no servidor, e é assim que tem que ser: ela sai dos treinos
 * gravados, não de um número guardado. Só que entre terminar o treino e a fila
 * subir existe um intervalo — sem rede, o que durar. Nesse intervalo o painel
 * diria "treino de hoje feito" e a trilha diria "sessão 5 em aberto", na mesma
 * tela e sobre o mesmo dia.
 *
 * O primeiro render devolve exatamente o que veio do servidor: a consulta local
 * ainda não respondeu, e é isso que a hidratação espera encontrar.
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
