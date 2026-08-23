'use client';

import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Recarregar de verdade depois de gravar.
 *
 * `invalidateQueries` não serve sozinho aqui. Se uma busca já está em curso —
 * e está, sempre que a pessoa grava logo depois de abrir a tela — ele apenas
 * espera aquela busca terminar. Só que ela começou antes do dado existir, e o
 * resultado que volta é o antigo: a foto recém-tirada não aparecia na galeria
 * até a próxima ação qualquer.
 *
 * `refetchQueries` com `cancelRefetch` derruba a busca velha e começa outra,
 * que enxerga o que acabou de ser gravado.
 */
export async function recarregar(client: QueryClient, ...chaves: QueryKey[]): Promise<void> {
  await Promise.all(
    chaves.map((queryKey) =>
      client.refetchQueries({ queryKey, type: 'active' }, { cancelRefetch: true }),
    ),
  );

  // as inativas ficam marcadas para buscar quando alguém voltar a olhar
  await Promise.all(chaves.map((queryKey) => client.invalidateQueries({ queryKey })));
}
