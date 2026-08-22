'use client';

import { deletePhoto as removeLocalPhoto, getPhoto, listPhotos, putPhoto } from '@/lib/offline/db';
import { enqueue } from '@/lib/offline/queue';
import { processPhoto } from '@/lib/storage/image-pipeline';
import { createClient } from '@/lib/supabase/client';
import type { PhotoPose } from '@/types/database';
import type { LocalPhoto } from '@/types/offline';

/**
 * Fotos de evolução.
 *
 * Treino e foto são processos independentes: a foto entra na própria fila e,
 * se o upload falhar, o treino continua salvo. Nenhuma foto sai daqui pública —
 * a policy de INSERT do banco recusaria.
 */

export type SavePhotoInput = {
  userId: string;
  file: File | Blob;
  takenOn: string;
  pose?: PhotoPose;
  weightKg?: number | null;
  notes?: string | null;
  workoutClientId?: string | null;
};

export async function savePhoto(input: SavePhotoInput): Promise<LocalPhoto> {
  const processed = await processPhoto(input.file);

  const photo: LocalPhoto = {
    client_id: crypto.randomUUID(),
    user_id: input.userId,
    remote_id: null,
    workout_client_id: input.workoutClientId ?? null,
    pose: input.pose ?? 'frente',
    taken_at: new Date().toISOString(),
    taken_on: input.takenOn,
    weight_kg: input.weightKg ?? null,
    notes: input.notes ?? null,
    width: processed.width,
    height: processed.height,
    blob: processed.blob,
    thumbnail: processed.thumbnail,
    sync_state: 'pending',
    sync_error: null,
    updated_at: Date.now(),
  };

  await putPhoto(photo);
  await enqueue('UPLOAD_PHOTO', photo.client_id, input.workoutClientId ?? null);

  return photo;
}

export async function localPhotos(userId: string): Promise<LocalPhoto[]> {
  return listPhotos(userId);
}

export async function removePhoto(clientId: string): Promise<void> {
  const photo = await getPhoto(clientId);
  if (!photo) return;

  if (photo.remote_id) {
    const supabase = createClient();
    await supabase
      .from('progress_photos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', photo.remote_id);
  }

  await removeLocalPhoto(clientId);
}

/** Muda a visibilidade de uma foto já sincronizada. Só o dono consegue. */
export async function setPhotoVisibility(
  remoteId: string,
  visibility: 'private' | 'followers' | 'public',
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('progress_photos')
    .update({ visibility })
    .eq('id', remoteId);

  if (error) throw error;
}

export type SignedPhoto = {
  id: string;
  takenOn: string;
  weightKg: number | null;
  pose: PhotoPose;
  url: string;
  thumbnailUrl: string;
};

/**
 * URLs assinadas para exibir fotos já sincronizadas.
 *
 * Duram 5 minutos e são geradas sob demanda: o bucket é privado e nunca expõe
 * URL pública permanente.
 */
export async function signPhotos(paths: string[], expiresIn = 300) {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from('progress-photos')
    .createSignedUrls(paths, expiresIn);

  if (error || !data) return new Map<string, string>();

  return new Map(
    data
      .filter((item) => item.signedUrl && item.path)
      .map((item) => [item.path as string, item.signedUrl]),
  );
}
