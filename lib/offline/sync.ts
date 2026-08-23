import type { SupabaseClient } from '@supabase/supabase-js';

import {
  deleteWorkout as deleteWorkoutLocal,
  getDb,
  getPhoto,
  getWorkout,
  putPhoto,
  putWorkout,
} from '@/lib/offline/db';
import { failOperation, listReady, removeOperation } from '@/lib/offline/queue';
import type { Database } from '@/types/database';
import type { LocalMeasurement, LocalPhoto, LocalWorkout, PendingOperation } from '@/types/offline';

/**
 * Sincronização.
 *
 * Reprocessar a fila inteira duas vezes tem que produzir exatamente o mesmo
 * estado. Isso é garantido por `unique (user_id, client_id)` no banco, e por
 * `upsert` em todas as escritas daqui.
 */

type Client = SupabaseClient<Database>;

export type SyncResult = {
  processed: number;
  failed: number;
};

/** Erro do Postgres que indica violação de unicidade. */
const UNIQUE_VIOLATION = '23505';

function storagePrefix(userId: string, takenOn: string): string {
  const [year, month] = takenOn.split('-');
  return `${userId}/${year}/${month}`;
}

// ---------------------------------------------------------------------------
// Treinos
// ---------------------------------------------------------------------------

async function pushWorkout(supabase: Client, workout: LocalWorkout): Promise<string> {
  const { data, error } = await supabase
    .from('workouts')
    .upsert(
      {
        user_id: workout.user_id,
        client_id: workout.client_id,
        template_id: workout.template_id,
        title: workout.title,
        started_at: workout.started_at,
        finished_at: workout.finished_at,
        duration_seconds: workout.duration_seconds,
        workout_date: workout.workout_date,
        rounds: workout.rounds,
        effort: workout.effort,
        location: workout.location,
        notes: workout.notes,
      },
      { onConflict: 'user_id,client_id' },
    )
    .select('id')
    .single();

  if (error) throw error;

  const workoutId = data.id;

  // Os exercícios são substituídos por completo: é a única forma de o reenvio
  // convergir para o mesmo estado sem duplicar linha.
  const { error: clearError } = await supabase
    .from('workout_exercises')
    .delete()
    .eq('workout_id', workoutId);

  if (clearError) throw clearError;

  if (workout.exercises.length > 0) {
    const { error: insertError } = await supabase.from('workout_exercises').insert(
      workout.exercises.map((exercise) => ({
        workout_id: workoutId,
        exercise_id: exercise.exercise_id,
        sets: exercise.sets,
        repetitions: exercise.repetitions,
        duration_seconds: exercise.duration_seconds,
        distance_meters: exercise.distance_meters,
        weight_kg: exercise.weight_kg,
        order_index: exercise.order_index,
        notes: exercise.notes,
      })),
    );

    if (insertError) throw insertError;
  }

  return workoutId;
}

async function deleteWorkoutRemote(supabase: Client, workout: LocalWorkout): Promise<void> {
  const { error } = await supabase
    .from('workouts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', workout.user_id)
    .eq('client_id', workout.client_id);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Medidas
// ---------------------------------------------------------------------------

async function pushMeasurement(supabase: Client, measurement: LocalMeasurement): Promise<string> {
  const payload = {
    user_id: measurement.user_id,
    client_id: measurement.client_id,
    measured_on: measurement.measured_on,
    weight_kg: measurement.weight_kg,
    waist_cm: measurement.waist_cm,
    chest_cm: measurement.chest_cm,
    arm_cm: measurement.arm_cm,
    hip_cm: measurement.hip_cm,
    thigh_cm: measurement.thigh_cm,
    body_fat_pct: measurement.body_fat_pct,
    notes: measurement.notes,
  };

  const { data, error } = await supabase
    .from('body_measurements')
    .upsert(payload, { onConflict: 'user_id,client_id' })
    .select('id')
    .single();

  if (!error) return data.id;

  // Outro aparelho já registrou a medida deste dia: atualiza aquela linha em
  // vez de insistir numa segunda, que o índice do dia recusaria de qualquer jeito.
  if (error.code === UNIQUE_VIOLATION) {
    const { data: updated, error: updateError } = await supabase
      .from('body_measurements')
      .update(payload)
      .eq('user_id', measurement.user_id)
      .eq('measured_on', measurement.measured_on)
      .select('id')
      .single();

    if (updateError) throw updateError;
    return updated.id;
  }

  throw error;
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

async function pushPhoto(supabase: Client, photo: LocalPhoto): Promise<string> {
  const prefix = storagePrefix(photo.user_id, photo.taken_on);
  const storagePath = `${prefix}/${photo.client_id}.webp`;
  const thumbnailPath = `${prefix}/${photo.client_id}_thumb.webp`;

  const bucket = supabase.storage.from('progress-photos');

  // upsert: reenviar a mesma foto sobrescreve, nunca duplica
  const [{ error: fullError }, { error: thumbError }] = await Promise.all([
    bucket.upload(storagePath, photo.blob, { contentType: 'image/webp', upsert: true }),
    bucket.upload(thumbnailPath, photo.thumbnail, { contentType: 'image/webp', upsert: true }),
  ]);

  if (fullError) throw fullError;
  if (thumbError) throw thumbError;

  // O treino pode ter sido sincronizado depois que a foto entrou na fila.
  let workoutId: string | null = null;
  if (photo.workout_client_id) {
    const localWorkout = await getWorkout(photo.workout_client_id);
    workoutId = localWorkout?.remote_id ?? null;
  }

  const { data, error } = await supabase
    .from('progress_photos')
    .upsert(
      {
        user_id: photo.user_id,
        client_id: photo.client_id,
        workout_id: workoutId,
        storage_path: storagePath,
        thumbnail_path: thumbnailPath,
        pose: photo.pose,
        taken_at: photo.taken_at,
        taken_on: photo.taken_on,
        weight_kg: photo.weight_kg,
        width: photo.width,
        height: photo.height,
        byte_size: photo.blob.size,
        notes: photo.notes,
        // a foto nasce privada; a policy de INSERT recusaria qualquer outra coisa
        visibility: 'private' as const,
      },
      { onConflict: 'user_id,client_id' },
    )
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

// ---------------------------------------------------------------------------
// Motor
// ---------------------------------------------------------------------------

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Falha desconhecida';
}

/**
 * Traduz a recusa do banco para uma frase que diz o que fazer.
 *
 * "violates check constraint workouts_duration_range" não ajuda ninguém a
 * consertar o próprio treino.
 */
function describeRejection(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('workouts_duration_range')) {
    return 'A duração precisa ser de pelo menos 1 segundo e no máximo 24 horas.';
  }
  if (message.includes('workouts_finish_after')) {
    return 'O fim do treino ficou antes do começo.';
  }
  if (message.includes('workouts_rounds_range')) {
    return 'A quantidade de rounds está fora do intervalo aceito.';
  }
  if (message.includes('workouts_effort_range')) {
    return 'O esforço precisa ficar entre 1 e 10.';
  }
  if (message.includes('bm_weight_range')) {
    return 'O peso precisa ficar entre 20 e 400 kg.';
  }
  if (message.includes('we_has_metric')) {
    return 'Um dos exercícios ficou sem nenhuma medida preenchida.';
  }

  return message;
}

/** Erros que não adianta repetir: o dado está inválido, não a conexão. */
function isPermanent(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = 'code' in error ? String((error as { code: unknown }).code) : '';
  // 22xxx: dado inválido · 23xxx: violação de constraint · 42xxx: permissão
  return /^(22|23|42)/.test(code) && code !== UNIQUE_VIOLATION;
}

async function runOperation(
  supabase: Client,
  operation: PendingOperation,
): Promise<void> {
  switch (operation.type) {
    case 'CREATE_WORKOUT':
    case 'UPDATE_WORKOUT': {
      const workout = await getWorkout(operation.client_id);
      if (!workout) return;

      await putWorkout({ ...workout, sync_state: 'syncing' });
      const remoteId = await pushWorkout(supabase, workout);

      // Reler antes de gravar: o registro pode ter mudado enquanto subia — é o
      // que acontece quando a pessoa marca o esforço logo depois de terminar o
      // treino, com o primeiro envio ainda em curso. Escrever de volta o
      // retrato antigo apagaria a edição que ela acabou de fazer.
      const atual = await getWorkout(operation.client_id);
      if (!atual) return;

      const mudouNoMeio = atual.updated_at !== workout.updated_at;

      await putWorkout({
        ...atual,
        remote_id: remoteId,
        // ainda pendente de propósito: a operação nova já está na fila
        sync_state: mudouNoMeio ? 'pending' : 'synced',
        sync_error: null,
      });
      return;
    }

    case 'DELETE_WORKOUT': {
      const workout = await getWorkout(operation.client_id);
      if (!workout) return;

      await deleteWorkoutRemote(supabase, workout);
      // o servidor já sabe: a cópia local não serve mais para nada
      await deleteWorkoutLocal(operation.client_id);
      return;
    }

    case 'CREATE_MEASUREMENT': {
      const db = await getDb();
      const measurement = await db.get('measurements', operation.client_id);
      if (!measurement) return;

      const remoteId = await pushMeasurement(supabase, measurement);

      const atual = await db.get('measurements', operation.client_id);
      if (!atual) return;

      await db.put('measurements', {
        ...atual,
        remote_id: remoteId,
        sync_state: atual.updated_at !== measurement.updated_at ? 'pending' : 'synced',
        sync_error: null,
      });
      return;
    }

    case 'UPLOAD_PHOTO': {
      const photo = await getPhoto(operation.client_id);
      if (!photo) return;

      await putPhoto({ ...photo, sync_state: 'syncing' });
      const remoteId = await pushPhoto(supabase, photo);

      const atual = await getPhoto(operation.client_id);
      if (!atual) return;

      await putPhoto({
        ...atual,
        remote_id: remoteId,
        sync_state: atual.updated_at !== photo.updated_at ? 'pending' : 'synced',
        sync_error: null,
      });
      return;
    }
  }
}

let running = false;
let pedidoPendente = false;

/** Quantas rodadas seguidas antes de devolver o controle. */
const MAX_RODADAS = 20;

/**
 * Processa a fila.
 *
 * Uma execução por vez, mas pedidos que chegam durante uma rodada não são
 * descartados: ficam anotados e a rodada seguinte os atende. Isso importa
 * porque gravar vários registros de uma vez — 14 dias anteriores, por exemplo —
 * dispara 14 pedidos quase simultâneos, e engolir 13 deixaria a fila parada
 * até o próximo tick do relógio.
 */
export async function flushQueue(supabase: Client): Promise<SyncResult> {
  if (running) {
    pedidoPendente = true;
    return { processed: 0, failed: 0 };
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { processed: 0, failed: 0 };
  }

  running = true;
  let processed = 0;
  let failed = 0;

  try {
    for (let rodada = 0; rodada < MAX_RODADAS; rodada += 1) {
      pedidoPendente = false;

      const prontas = await listReady();
      if (prontas.length === 0) break;

      for (const operation of prontas) {
        try {
          await runOperation(supabase, operation);
          if (operation.id !== undefined) {
            await removeOperation(operation.id);
          }
          processed += 1;
        } catch (error) {
          failed += 1;
          const message = describe(error);
          const permanente = isPermanent(error);

          if (permanente) {
            // Não adianta repetir: marca como falha visível e para de tentar.
            await failOperation({ ...operation, attempts: 99 }, message);
          } else {
            await failOperation(operation, message);
          }

          await markEntityFailed(
            operation,
            permanente ? describeRejection(error) : message,
            permanente,
          );
        }
      }

      // nada novo chegou e nada mais está pronto: encerra
      if (!pedidoPendente && (await listReady()).length === 0) break;
    }
  } finally {
    running = false;
  }

  /*
   * Um pedido que chegou entre o fim do laço e a liberação da trava ficaria
   * anotado sem ninguém para lê-lo, e só sairia no próximo tick do relógio.
   * A janela é estreita, mas apagar um treino cai bem nela: a exclusão entra
   * na fila enquanto a tela ainda está sincronizando o que veio antes.
   */
  if (pedidoPendente) {
    pedidoPendente = false;
    const extra = await flushQueue(supabase);
    processed += extra.processed;
    failed += extra.failed;
  }

  return { processed, failed };
}

async function markEntityFailed(
  operation: PendingOperation,
  message: string,
  permanente: boolean,
): Promise<void> {
  if (operation.type === 'UPLOAD_PHOTO') {
    const photo = await getPhoto(operation.client_id);
    if (photo) await putPhoto({ ...photo, sync_state: 'failed', sync_error: message });
    return;
  }

  const workout = await getWorkout(operation.client_id);
  if (workout) {
    await putWorkout({
      ...workout,
      sync_state: 'failed',
      sync_error: message,
      sync_permanent: permanente,
    });
  }
}
