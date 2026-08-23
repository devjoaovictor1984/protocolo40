'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/features/session/session-context';
import { localPhotos, signPhotos } from '@/features/photos/repository';
import { createClient } from '@/lib/supabase/client';
import type { PhotoPose } from '@/types/database';

/**
 * Fotos de evolução, do aparelho e do servidor.
 *
 * A foto tirada aqui já tem o arquivo local — aparece na hora, mesmo offline.
 * As que vieram de outro aparelho chegam por URL assinada, válida por cinco
 * minutos, porque o bucket é privado.
 */

export type GalleryPhoto = {
  key: string;
  clientId: string | null;
  remoteId: string | null;
  takenOn: string;
  takenAt: string;
  pose: PhotoPose;
  weightKg: number | null;
  notes: string | null;
  pending: boolean;
  /**
   * Miniatura local, guardada como Blob e nunca como object URL.
   *
   * Uma object URL vive presa ao componente que a criou: quando a galeria sai
   * de cena e revoga as suas, quem estivesse lendo o mesmo cache do React Query
   * — a tela de comparar, por exemplo — ficava com URLs mortas e sem imagem.
   * O Blob é reutilizável; a URL é criada por quem vai exibir.
   */
  thumbBlob: Blob | null;
  /** miniatura remota, já assinada */
  thumbUrl: string | null;
  /** caminho no storage, para assinar a versão grande sob demanda */
  storagePath: string | null;
  /** blob local da versão grande, quando existe */
  fullBlob: Blob | null;
};

export function usePhotos() {
  const { userId } = useSession();

  return useQuery({
    queryKey: ['photos', userId],
    queryFn: async (): Promise<GalleryPhoto[]> => {
      const local = await localPhotos(userId);

      const localItems: GalleryPhoto[] = local.map((photo) => {
        return {
          key: photo.client_id,
          clientId: photo.client_id,
          remoteId: photo.remote_id,
          takenOn: photo.taken_on,
          takenAt: photo.taken_at,
          pose: photo.pose,
          weightKg: photo.weight_kg,
          notes: photo.notes,
          pending: photo.sync_state !== 'synced',
          thumbBlob: photo.thumbnail,
          thumbUrl: null,
          storagePath: null,
          fullBlob: photo.blob,
        };
      });

      const knownClientIds = new Set(local.map((photo) => photo.client_id));

      // as que vieram de outro aparelho: só metadados, imagem por URL assinada
      const supabase = createClient();
      const { data } = await supabase
        .from('progress_photos')
        .select('id, client_id, storage_path, thumbnail_path, pose, taken_at, taken_on, weight_kg, notes')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('taken_at', { ascending: false })
        .limit(400);

      const remoteOnly = (data ?? []).filter((row) => !knownClientIds.has(row.client_id));
      const signed = remoteOnly.length
        ? await signPhotos(remoteOnly.map((row) => row.thumbnail_path))
        : new Map<string, string>();

      const remoteItems: GalleryPhoto[] = remoteOnly.map((row) => ({
        key: row.id,
        clientId: row.client_id,
        remoteId: row.id,
        takenOn: row.taken_on,
        takenAt: row.taken_at,
        pose: row.pose,
        weightKg: row.weight_kg,
        notes: row.notes,
        pending: false,
        thumbBlob: null,
        thumbUrl: signed.get(row.thumbnail_path) ?? null,
        storagePath: row.storage_path,
        fullBlob: null,
      }));

      return [...localItems, ...remoteItems].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
    },
    staleTime: 60_000,
  });
}

/**
 * URL exibível de um Blob, criada e revogada junto com o componente.
 *
 * Cada tela cria a sua: assim ninguém revoga a URL que outra ainda usa.
 */
export function useBlobUrl(blob: Blob | null): string | null {
  // criada na renderização e devolvida na limpeza: a imagem aparece no
  // primeiro quadro, sem o piscar de um estado que só chega depois
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return url;
}

/** Miniatura de uma foto: blob local quando existe, senão a URL assinada. */
export function useThumbUrl(photo: GalleryPhoto | null): string | null {
  const local = useBlobUrl(photo?.thumbBlob ?? null);
  return local ?? photo?.thumbUrl ?? null;
}

/** Versão grande de uma foto: blob local quando existe, senão URL assinada. */
export function useFullPhoto(photo: GalleryPhoto | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    let alive = true;

    async function load() {
      if (!photo) {
        setUrl(null);
        return;
      }

      if (photo.fullBlob) {
        const objectUrl = URL.createObjectURL(photo.fullBlob);
        revoke = objectUrl;
        if (alive) setUrl(objectUrl);
        return;
      }

      if (photo.storagePath) {
        const signed = await signPhotos([photo.storagePath]);
        if (alive) setUrl(signed.get(photo.storagePath) ?? null);
      }
    }

    void load();

    return () => {
      alive = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [photo]);

  return url;
}

/** Fotos agrupadas por dia, para a grade da galeria. */
export function useGroupedPhotos() {
  const query = usePhotos();

  const groups = useMemo(() => {
    const map = new Map<string, GalleryPhoto[]>();
    for (const photo of query.data ?? []) {
      map.set(photo.takenOn, [...(map.get(photo.takenOn) ?? []), photo]);
    }
    return [...map.entries()];
  }, [query.data]);

  return { ...query, groups };
}
