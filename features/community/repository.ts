import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { FollowStatus } from '@/types/database';

/**
 * Comunidade.
 *
 * A regra de quem vê o quê não mora aqui: mora nas policies e nas funções do
 * banco. Este módulo só pergunta. É por isso que a busca de pessoas passa por
 * `buscar_pessoas()` em vez de um select em `profiles` — a RLS de perfil
 * privado faria a consulta voltar vazia sem explicar por quê, e a função deixa
 * a regra visível: só aparece quem é público e aceita seguidores.
 */

export type Pessoa = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_path: string | null;
  avatar_url: string | null;
  /**
   * Só para quebrar o cache do avatar quando a foto muda.
   *
   * As funções do banco não devolvem, e nem precisam: numa lista de pessoas o
   * avatar antigo por alguns minutos não engana ninguém.
   */
  updated_at?: string;
};

export type PessoaEncontrada = Pessoa & { seguidores: number };

export type PessoaDaRede = Pessoa & {
  dias_treinados: number | null;
  sequencia: number | null;
  desde: string;
};

export async function buscarPessoas(termo: string): Promise<PessoaEncontrada[]> {
  const busca = termo.trim();
  if (busca.length < 2) return [];

  const supabase = await createClient();
  const { data } = await supabase.rpc('buscar_pessoas', { p_termo: busca, p_limite: 20 });

  return (data ?? []) as PessoaEncontrada[];
}

/**
 * Quem está por aqui, sem precisar procurar.
 *
 * Uma caixa de busca vazia não é descoberta: só encontra quem já sabe o nome
 * de alguém. Numa comunidade nova ninguém sabe — então a lista aparece
 * pronta, e a busca serve para filtrar.
 */
export async function pessoasNoApp(): Promise<PessoaEncontrada[]> {
  const supabase = await createClient();
  // vinte é o que cabe num relance; passar disso vira rolagem, e para achar
  // alguém específico existe a busca
  const { data } = await supabase.rpc('buscar_pessoas', { p_termo: '', p_limite: 20 });

  return (data ?? []) as PessoaEncontrada[];
}

export async function minhaRede(tipo: 'seguindo' | 'seguidores'): Promise<PessoaDaRede[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('minha_rede', { p_tipo: tipo });
  return (data ?? []) as PessoaDaRede[];
}

export async function contagens(userId: string): Promise<{ seguidores: number; seguindo: number }> {
  const supabase = await createClient();

  const [seguidores, seguindo] = await Promise.all([
    supabase.rpc('contar_seguidores', { p_user: userId }),
    supabase.rpc('contar_seguindo', { p_user: userId }),
  ]);

  return { seguidores: seguidores.data ?? 0, seguindo: seguindo.data ?? 0 };
}

export type Relacao = { segue: boolean; status: FollowStatus | null; meSegue: boolean };

/** Como estou em relação a alguém: sigo, estou pendente, ou nada. */
export async function relacaoCom(outroId: string): Promise<Relacao> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('followers')
    .select('follower_id, following_id, status')
    .or(`follower_id.eq.${outroId},following_id.eq.${outroId}`);

  const linhas = data ?? [];
  const eu = linhas.find((linha) => linha.following_id === outroId);
  const dele = linhas.find((linha) => linha.follower_id === outroId);

  return {
    segue: eu?.status === 'accepted',
    status: (eu?.status as FollowStatus | undefined) ?? null,
    meSegue: dele?.status === 'accepted',
  };
}

/**
 * O antes e depois que a pessoa escolheu expor.
 *
 * A checagem de permissão é a própria consulta: `progress_photos` tem policy de
 * SELECT que só devolve foto pública ou de quem o visitante pode ver. Se a
 * consulta voltar vazia, não há o que assinar. O cliente com service role entra
 * só depois disso, para emitir a URL temporária — o bucket é privado e não
 * existe link permanente para foto de ninguém.
 */
export async function vitrineDe(
  perfil: { id: string; showcase_before_id: string | null; showcase_after_id: string | null },
): Promise<{
  antes: string;
  depois: string;
  antesEm: string;
  depoisEm: string;
  /** Peso das duas pontas, só quando o dono deixa o peso visível. */
  pesoAntes: number | null;
  pesoDepois: number | null;
} | null> {
  const { showcase_before_id: antesId, showcase_after_id: depoisId } = perfil;
  if (!antesId || !depoisId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('progress_photos')
    .select('id, storage_path, taken_on')
    .in('id', [antesId, depoisId]);

  const antes = (data ?? []).find((foto) => foto.id === antesId);
  const depois = (data ?? []).find((foto) => foto.id === depoisId);

  // uma das duas não é visível para quem está olhando: não mostra nenhuma
  if (!antes || !depois) return null;

  const admin = createAdminClient();
  const [urlAntes, urlDepois] = await Promise.all([
    admin.storage.from('progress-photos').createSignedUrl(antes.storage_path, 300),
    admin.storage.from('progress-photos').createSignedUrl(depois.storage_path, 300),
  ]);

  if (!urlAntes.data?.signedUrl || !urlDepois.data?.signedUrl) return null;

  /**
   * O peso vem de uma função dedicada, e não de um select em
   * `body_measurements`: a RLS daquela tabela obedece a configuração de
   * *medidas*, e o peso tem a própria. Só os dois dias da vitrine saem de lá.
   */
  const { data: pesos } = await supabase.rpc('peso_da_vitrine', {
    p_owner: perfil.id,
    p_antes: antes.taken_on,
    p_depois: depois.taken_on,
  });

  const porDia = new Map((pesos ?? []).map((linha) => [linha.dia, Number(linha.peso)]));

  return {
    pesoAntes: porDia.get(antes.taken_on) ?? null,
    pesoDepois: porDia.get(depois.taken_on) ?? null,
    antes: urlAntes.data.signedUrl,
    depois: urlDepois.data.signedUrl,
    antesEm: antes.taken_on,
    depoisEm: depois.taken_on,
  };
}
