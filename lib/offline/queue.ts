import { getDb } from '@/lib/offline/db';
import type { PendingOperation, PendingOperationType } from '@/types/offline';

/**
 * Fila de operações pendentes.
 *
 * Uma operação nunca some sozinha: ou ela chega ao servidor, ou fica visível
 * como falha para o usuário tentar de novo.
 */

const MAX_ATTEMPTS = 6;

/** Backoff exponencial: 2s, 4s, 8s… até 5 minutos. */
export function backoffMs(attempts: number): number {
  return Math.min(300_000, 2_000 * 2 ** attempts);
}

export async function enqueue(
  type: PendingOperationType,
  clientId: string,
  dependsOn: string | null = null,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('pending_operations', 'readwrite');
  const store = tx.objectStore('pending_operations');

  // Uma entidade tem no máximo uma operação pendente por tipo: a mais recente
  // já carrega o estado final, então enfileirar duas vezes só geraria trabalho.
  const existing = await store.index('by_client').getAll(clientId);
  for (const operation of existing) {
    if (operation.type === type && operation.id !== undefined) {
      await store.delete(operation.id);
    }
  }

  await store.add({
    type,
    client_id: clientId,
    depends_on: dependsOn,
    attempts: 0,
    next_attempt_at: Date.now(),
    last_error: null,
    created_at: Date.now(),
  });

  await tx.done;
}

export async function listOperations(): Promise<PendingOperation[]> {
  const db = await getDb();
  const all = await db.getAll('pending_operations');
  return all.sort((a, b) => a.created_at - b.created_at);
}

/**
 * O que pode ir agora: já passou do backoff e não depende de nada que ainda
 * esteja na fila.
 */
export async function listReady(now = Date.now()): Promise<PendingOperation[]> {
  const all = await listOperations();
  const pendingClientIds = new Set(all.map((operation) => operation.client_id));

  return all.filter(
    (operation) =>
      operation.next_attempt_at <= now &&
      operation.attempts < MAX_ATTEMPTS &&
      (operation.depends_on === null || !pendingClientIds.has(operation.depends_on)),
  );
}

export async function removeOperation(id: number): Promise<void> {
  const db = await getDb();
  await db.delete('pending_operations', id);
}

/** Marca a falha e agenda a próxima tentativa. */
export async function failOperation(operation: PendingOperation, message: string): Promise<void> {
  if (operation.id === undefined) return;

  const db = await getDb();
  const attempts = operation.attempts + 1;

  await db.put('pending_operations', {
    ...operation,
    attempts,
    last_error: message,
    next_attempt_at: Date.now() + backoffMs(attempts),
  });
}

/** Reagenda tudo para agora — o botão "tentar novamente" do usuário. */
export async function retryAll(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('pending_operations', 'readwrite');

  for (const operation of await tx.store.getAll()) {
    if (operation.id === undefined) continue;
    await tx.store.put({ ...operation, attempts: 0, next_attempt_at: Date.now() });
  }

  await tx.done;
}

export type QueueSummary = {
  pending: number;
  failed: number;
};

export async function summarize(): Promise<QueueSummary> {
  const all = await listOperations();
  return {
    pending: all.filter((operation) => operation.attempts < MAX_ATTEMPTS).length,
    failed: all.filter((operation) => operation.attempts >= MAX_ATTEMPTS).length,
  };
}

export { MAX_ATTEMPTS };
