import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type {
  ActiveSession,
  LocalMeasurement,
  LocalPhoto,
  LocalWorkout,
  PendingOperation,
} from '@/types/offline';

/**
 * Banco local do P20X.
 *
 * É aqui que o treino nasce. A rede é um detalhe que acontece depois: nada no
 * fluxo de treinar depende de estar online.
 */

/**
 * O nome do banco local não acompanha o nome do produto de propósito.
 *
 * Renomear criaria um banco vazio e deixaria órfão tudo que ainda não subiu —
 * inclusive treinos pendentes de quem estava offline na hora da troca.
 */
const DB_NAME = 'p40';
const DB_VERSION = 1;

export type CacheEntry = {
  key: string;
  value: unknown;
  updatedAt: number;
};

interface P40Schema extends DBSchema {
  active_session: {
    key: string;
    value: ActiveSession;
  };
  workouts: {
    key: string;
    value: LocalWorkout;
    indexes: { by_date: string; by_sync: string };
  };
  measurements: {
    key: string;
    value: LocalMeasurement;
    indexes: { by_date: string; by_sync: string };
  };
  photos: {
    key: string;
    value: LocalPhoto;
    indexes: { by_date: string; by_sync: string; by_workout: string };
  };
  pending_operations: {
    key: number;
    value: PendingOperation;
    indexes: { by_client: string };
  };
  cache: {
    key: string;
    value: CacheEntry;
  };
}

let dbPromise: Promise<IDBPDatabase<P40Schema>> | null = null;

export function isBrowser(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function getDb(): Promise<IDBPDatabase<P40Schema>> {
  if (!isBrowser()) {
    return Promise.reject(new Error('IndexedDB não está disponível neste ambiente.'));
  }

  dbPromise ??= openDB<P40Schema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('active_session', { keyPath: 'id' });

      const workouts = db.createObjectStore('workouts', { keyPath: 'client_id' });
      workouts.createIndex('by_date', 'workout_date');
      workouts.createIndex('by_sync', 'sync_state');

      const measurements = db.createObjectStore('measurements', { keyPath: 'client_id' });
      measurements.createIndex('by_date', 'measured_on');
      measurements.createIndex('by_sync', 'sync_state');

      const photos = db.createObjectStore('photos', { keyPath: 'client_id' });
      photos.createIndex('by_date', 'taken_on');
      photos.createIndex('by_sync', 'sync_state');
      photos.createIndex('by_workout', 'workout_client_id');

      const queue = db.createObjectStore('pending_operations', {
        keyPath: 'id',
        autoIncrement: true,
      });
      queue.createIndex('by_client', 'client_id');

      db.createObjectStore('cache', { keyPath: 'key' });
    },
    blocked() {
      console.warn('[p40] outra aba está com uma versão antiga do banco local aberta.');
    },
  });

  return dbPromise;
}

// ---------------------------------------------------------------------------
// Sessão do cronômetro
// ---------------------------------------------------------------------------

export async function readSession(): Promise<ActiveSession | null> {
  const db = await getDb();
  return (await db.get('active_session', 'atual')) ?? null;
}

export async function writeSession(session: ActiveSession): Promise<void> {
  const db = await getDb();
  await db.put('active_session', session);
}

export async function clearSession(): Promise<void> {
  const db = await getDb();
  await db.delete('active_session', 'atual');
}

// ---------------------------------------------------------------------------
// Treinos
// ---------------------------------------------------------------------------

export async function putWorkout(workout: LocalWorkout): Promise<void> {
  const db = await getDb();
  await db.put('workouts', workout);
}

export async function getWorkout(clientId: string): Promise<LocalWorkout | null> {
  const db = await getDb();
  return (await db.get('workouts', clientId)) ?? null;
}

export async function deleteWorkout(clientId: string): Promise<void> {
  const db = await getDb();
  await db.delete('workouts', clientId);
}

/**
 * Treinos locais visíveis, do mais recente para o mais antigo.
 *
 * O que foi apagado some daqui na hora, mesmo enquanto a exclusão ainda não
 * subiu — quem apagou não deveria continuar vendo o registro na tela.
 */
export async function listWorkouts(userId: string): Promise<LocalWorkout[]> {
  const db = await getDb();
  const all = await db.getAll('workouts');
  return all
    .filter((workout) => workout.user_id === userId && !workout.deleted_at)
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
}

/** Treinos que ainda não chegaram ao servidor. */
export async function listUnsyncedWorkouts(userId: string): Promise<LocalWorkout[]> {
  const workouts = await listWorkouts(userId);
  return workouts.filter((workout) => workout.sync_state !== 'synced');
}

// ---------------------------------------------------------------------------
// Medidas
// ---------------------------------------------------------------------------

export async function putMeasurement(measurement: LocalMeasurement): Promise<void> {
  const db = await getDb();
  await db.put('measurements', measurement);
}

export async function listMeasurements(userId: string): Promise<LocalMeasurement[]> {
  const db = await getDb();
  const all = await db.getAll('measurements');
  return all
    .filter((item) => item.user_id === userId)
    .sort((a, b) => b.measured_on.localeCompare(a.measured_on));
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

export async function putPhoto(photo: LocalPhoto): Promise<void> {
  const db = await getDb();
  await db.put('photos', photo);
}

export async function getPhoto(clientId: string): Promise<LocalPhoto | null> {
  const db = await getDb();
  return (await db.get('photos', clientId)) ?? null;
}

export async function deletePhoto(clientId: string): Promise<void> {
  const db = await getDb();
  await db.delete('photos', clientId);
}

export async function listPhotos(userId: string): Promise<LocalPhoto[]> {
  const db = await getDb();
  const all = await db.getAll('photos');
  return all
    .filter((photo) => photo.user_id === userId)
    .sort((a, b) => b.taken_at.localeCompare(a.taken_at));
}

// ---------------------------------------------------------------------------
// Cache de leitura (exercícios, templates, estatísticas)
// ---------------------------------------------------------------------------

export async function readCache<T>(key: string, maxAgeMs = Infinity): Promise<T | null> {
  try {
    const db = await getDb();
    const entry = await db.get('cache', key);
    if (!entry) return null;
    if (Date.now() - entry.updatedAt > maxAgeMs) return null;
    return entry.value as T;
  } catch {
    return null;
  }
}

export async function writeCache(key: string, value: unknown): Promise<void> {
  try {
    const db = await getDb();
    await db.put('cache', { key, value, updatedAt: Date.now() });
  } catch {
    // cache é conveniência: falhar aqui não pode quebrar a tela
  }
}

/** Limpa tudo do aparelho. Usado no logout e na exclusão de conta. */
export async function wipeLocalData(): Promise<void> {
  if (!isBrowser()) return;
  const db = await getDb();
  await Promise.all([
    db.clear('active_session'),
    db.clear('workouts'),
    db.clear('measurements'),
    db.clear('photos'),
    db.clear('pending_operations'),
    db.clear('cache'),
  ]);
}
