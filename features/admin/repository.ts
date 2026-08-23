import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { ProfileRow, SupportTicketRow, TicketStatus } from '@/types/database';

/**
 * Leituras da área administrativa.
 *
 * A regra continua sendo a RLS: quem não é admin não passa das policies, e
 * `requireAdmin()` só evita renderizar uma tela vazia. O service role entra em
 * dois pontos onde não existe alternativa — o e-mail vive em `auth.users`, que
 * nenhuma policy alcança, e apagar uma conta é operação do Admin API.
 */

/** Quantos itens cada página da administração mostra. */
export const POR_PAGINA = 20;

export type UsuarioListado = ProfileRow & {
  email: string | null;
  total_dias: number;
  ultimo_treino: string | null;
};

export type PaginaDe<T> = {
  itens: T[];
  total: number;
  pagina: number;
  paginas: number;
};

function fatia(pagina: number): { de: number; ate: number } {
  const atual = Math.max(1, pagina);
  const de = (atual - 1) * POR_PAGINA;
  return { de, ate: de + POR_PAGINA - 1 };
}

/** E-mails por id, em uma chamada só. Sem isto a lista faria N requisições. */
async function emailsPorId(ids: string[]): Promise<Map<string, string | null>> {
  const mapa = new Map<string, string | null>();
  if (ids.length === 0) return mapa;

  const admin = createAdminClient();
  // o Admin API não filtra por id; a lista é pequena o bastante para varrer
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  for (const usuario of data?.users ?? []) {
    mapa.set(usuario.id, usuario.email ?? null);
  }

  return mapa;
}

export async function listarUsuarios(
  termo: string,
  pagina: number,
): Promise<PaginaDe<UsuarioListado>> {
  const supabase = await createClient();
  const { de, ate } = fatia(pagina);

  let consulta = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(de, ate);

  const busca = termo.trim();
  if (busca) {
    consulta = consulta.or(`username.ilike.%${busca}%,full_name.ilike.%${busca}%`);
  }

  const { data, count } = await consulta;
  const perfis = (data ?? []) as ProfileRow[];
  const emails = await emailsPorId(perfis.map((perfil) => perfil.id));

  // dias treinados de cada um, sem uma consulta por linha
  const { data: dias } = await supabase
    .from('workouts')
    .select('user_id, workout_date')
    .in(
      'user_id',
      perfis.map((perfil) => perfil.id),
    )
    .is('deleted_at', null);

  const porUsuario = new Map<string, Set<string>>();
  for (const linha of dias ?? []) {
    const conjunto = porUsuario.get(linha.user_id) ?? new Set<string>();
    conjunto.add(linha.workout_date);
    porUsuario.set(linha.user_id, conjunto);
  }

  const total = count ?? perfis.length;

  return {
    itens: perfis.map((perfil) => {
      const marcados = [...(porUsuario.get(perfil.id) ?? [])].sort();
      return {
        ...perfil,
        email: emails.get(perfil.id) ?? null,
        total_dias: marcados.length,
        ultimo_treino: marcados.at(-1) ?? null,
      };
    }),
    total,
    pagina: Math.max(1, pagina),
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
  };
}

export async function verUsuario(id: string): Promise<UsuarioListado | null> {
  const supabase = await createClient();

  const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (!data) return null;

  const perfil = data as ProfileRow;
  const emails = await emailsPorId([id]);

  const { data: dias } = await supabase
    .from('workouts')
    .select('workout_date')
    .eq('user_id', id)
    .is('deleted_at', null);

  const marcados = [...new Set((dias ?? []).map((linha) => linha.workout_date))].sort();

  return {
    ...perfil,
    email: emails.get(id) ?? null,
    total_dias: marcados.length,
    ultimo_treino: marcados.at(-1) ?? null,
  };
}

export type ChamadoListado = SupportTicketRow & {
  autor: { username: string; full_name: string | null } | null;
};

export async function listarChamados(
  status: TicketStatus | 'todos',
  pagina: number,
): Promise<PaginaDe<ChamadoListado>> {
  const supabase = await createClient();
  const { de, ate } = fatia(pagina);

  let consulta = supabase
    .from('support_tickets')
    .select('*, profiles!support_tickets_user_id_fkey(username, full_name)', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(de, ate);

  if (status !== 'todos') {
    consulta = consulta.eq('status', status);
  }

  const { data, count } = await consulta;
  const total = count ?? (data ?? []).length;

  const itens = (data ?? []).map((linha) => {
    const { profiles, ...ticket } = linha as unknown as SupportTicketRow & {
      profiles: { username: string; full_name: string | null } | null;
    };
    return { ...ticket, autor: profiles ?? null };
  });

  return {
    itens,
    total,
    pagina: Math.max(1, pagina),
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
  };
}

export async function verChamado(id: string): Promise<ChamadoListado | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('support_tickets')
    .select('*, profiles!support_tickets_user_id_fkey(username, full_name)')
    .eq('id', id)
    .maybeSingle();

  if (!data) return null;

  const { profiles, ...ticket } = data as unknown as SupportTicketRow & {
    profiles: { username: string; full_name: string | null } | null;
  };

  return { ...ticket, autor: profiles ?? null };
}

/** URL temporária do print. O bucket é privado; nada de link permanente. */
export async function assinarPrint(caminho: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage.from('support').createSignedUrl(caminho, 300);
  return data?.signedUrl ?? null;
}

export type ResumoAdmin = {
  usuarios: number;
  usuariosNovos7d: number;
  chamadosAbertos: number;
  treinos: number;
};

export async function resumo(): Promise<ResumoAdmin> {
  const supabase = await createClient();
  const seteDiasAtras = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [usuarios, novos, abertos, treinos] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', seteDiasAtras),
    supabase
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .in('status', ['aberto', 'em_analise']),
    supabase.from('workouts').select('id', { count: 'exact', head: true }).is('deleted_at', null),
  ]);

  return {
    usuarios: usuarios.count ?? 0,
    usuariosNovos7d: novos.count ?? 0,
    chamadosAbertos: abertos.count ?? 0,
    treinos: treinos.count ?? 0,
  };
}
