import type { ProfileRow } from '@/types/database';

/**
 * Endereço da foto de perfil.
 *
 * Duas origens possíveis: o arquivo que a pessoa enviou, no bucket `avatars`, e
 * a foto que veio do Google no primeiro login. O arquivo próprio vence — foi
 * uma escolha deliberada, a do Google só veio junto.
 *
 * O bucket é público de propósito: um avatar é para ser visto. Foto de corpo é
 * outra história e vive em bucket privado, com URL assinada.
 */

/** O `?v=` força o navegador a buscar de novo depois de uma troca de foto. */
export function avatarUrl(
  profile: Pick<ProfileRow, 'avatar_path' | 'avatar_url' | 'updated_at'>,
  supabaseUrl: string,
): string | null {
  if (profile.avatar_path) {
    const version = Date.parse(profile.updated_at) || 0;
    return `${supabaseUrl}/storage/v1/object/public/avatars/${profile.avatar_path}?v=${version}`;
  }

  return profile.avatar_url;
}

/** Caminho do arquivo dentro do bucket. Um por usuário, sempre sobrescrito. */
export function avatarPath(userId: string): string {
  return `${userId}/avatar.webp`;
}

/** Iniciais para quando não há foto nenhuma. */
export function initialsOf(name: string | null, username: string): string {
  const source = (name ?? username).trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}
