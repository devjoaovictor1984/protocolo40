import type { PhotoPose, WorkoutPlace } from '@/types/database';

/**
 * Formas locais, guardadas no IndexedDB.
 *
 * Diferem das linhas do banco em dois pontos deliberados:
 * - a chave é o `client_id`, gerado no aparelho antes de existir rede;
 * - os exercícios ficam embutidos no treino, porque um treino é criado e
 *   sincronizado como uma unidade só.
 */

export type SyncState = 'local' | 'pending' | 'syncing' | 'synced' | 'failed';

export type LocalWorkoutExercise = {
  exercise_id: string;
  /** desnormalizado para a lista funcionar offline, sem consultar exercises */
  exercise_name: string;
  sets: number | null;
  repetitions: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  weight_kg: number | null;
  order_index: number;
  notes: string | null;
};

export type LocalWorkout = {
  client_id: string;
  user_id: string;
  remote_id: string | null;
  template_id: string | null;
  template_title: string | null;
  title: string | null;
  notes: string | null;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number;
  workout_date: string;
  rounds: number | null;
  effort: number | null;
  location: WorkoutPlace | null;
  exercises: LocalWorkoutExercise[];
  sync_state: SyncState;
  sync_error: string | null;
  updated_at: number;
};

export type LocalMeasurement = {
  client_id: string;
  user_id: string;
  remote_id: string | null;
  measured_on: string;
  weight_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  hip_cm: number | null;
  thigh_cm: number | null;
  body_fat_pct: number | null;
  notes: string | null;
  sync_state: SyncState;
  sync_error: string | null;
  updated_at: number;
};

export type LocalPhoto = {
  client_id: string;
  user_id: string;
  remote_id: string | null;
  /** client_id do treino, quando a foto nasceu no fim de um treino */
  workout_client_id: string | null;
  pose: PhotoPose;
  taken_at: string;
  taken_on: string;
  weight_kg: number | null;
  notes: string | null;
  width: number;
  height: number;
  /** imagem já processada: WebP redimensionado, pronta para subir */
  blob: Blob;
  thumbnail: Blob;
  sync_state: SyncState;
  sync_error: string | null;
  updated_at: number;
};

export type PendingOperationType =
  | 'CREATE_WORKOUT'
  | 'UPDATE_WORKOUT'
  | 'DELETE_WORKOUT'
  | 'UPLOAD_PHOTO'
  | 'CREATE_MEASUREMENT';

export type PendingOperation = {
  id?: number;
  type: PendingOperationType;
  /** identifica a entidade; garante idempotência no servidor */
  client_id: string;
  /** client_id de uma operação que precisa ir antes desta */
  depends_on: string | null;
  attempts: number;
  next_attempt_at: number;
  last_error: string | null;
  created_at: number;
};

/** Sessão de cronômetro em andamento. Existe no máximo uma. */
export type ActiveSession = {
  id: 'atual';
  client_id: string;
  user_id: string;
  startedAt: number;
  pauses: { at: number; until: number | null }[];
  targetSeconds: number;
  mode: 'regressivo' | 'progressivo';
  templateId: string | null;
  templateTitle: string | null;
  title: string | null;
  rounds: number;
  checked: string[];
  updatedAt: number;
};
