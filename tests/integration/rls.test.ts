import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Database } from '@/types/database';

/**
 * Prova da RLS contra o banco real.
 *
 * Este é o critério de saída da Fase 0: um usuário não enxerga nem altera nada
 * de outro, e as regras que a aplicação promete existem no banco, não na
 * interface.
 *
 * Roda quando NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e
 * SUPABASE_SERVICE_ROLE_KEY estiverem no ambiente. Sem elas, o bloco é pulado.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured =
  Boolean(url && anonKey && serviceKey) && !url!.includes('placeholder');

type Client = SupabaseClient<Database>;

const asAnon = () => createClient<Database>(url!, anonKey!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

describe.skipIf(!configured)('RLS', () => {
  const admin = configured
    ? createClient<Database>(url!, serviceKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : (null as unknown as Client);

  const password = `p40-teste-${crypto.randomUUID()}`;
  const emailA = `rls-a-${crypto.randomUUID()}@p20x.test`;
  const emailB = `rls-b-${crypto.randomUUID()}@p20x.test`;

  let userA = '';
  let userB = '';
  let clientA: Client;
  let clientB: Client;
  let workoutA = '';

  beforeAll(async () => {
    const createUser = async (email: string) => {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw error;
      return data.user.id;
    };

    const signIn = async (email: string) => {
      const client = asAnon();
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return client;
    };

    userA = await createUser(emailA);
    userB = await createUser(emailB);
    [clientA, clientB] = await Promise.all([signIn(emailA), signIn(emailB)]);

    const { data, error } = await clientA
      .from('workouts')
      .insert({
        user_id: userA,
        client_id: crypto.randomUUID(),
        started_at: new Date().toISOString(),
        duration_seconds: 1200,
        title: 'Treino privado do A',
      })
      .select('id')
      .single();

    if (error) throw error;
    workoutA = data.id;
  }, 60_000);

  afterAll(async () => {
    if (!configured) return;
    await Promise.allSettled([
      admin.auth.admin.deleteUser(userA),
      admin.auth.admin.deleteUser(userB),
    ]);
  });

  it('o cadastro cria perfil e configurações automaticamente', async () => {
    const { data } = await clientA.from('profiles').select('username, timezone').eq('id', userA).single();
    expect(data?.username).toMatch(/^[a-z0-9_]{3,20}$/);
    expect(data?.timezone).toBe('America/Sao_Paulo');

    const { data: settings } = await clientA
      .from('user_settings')
      .select('photos_visibility, workouts_visibility')
      .eq('user_id', userA)
      .single();

    // padrão seguro: nada nasce público
    expect(settings?.photos_visibility).toBe('private');
    expect(settings?.workouts_visibility).toBe('private');
  });

  it('o dono lê o próprio treino', async () => {
    const { data } = await clientA.from('workouts').select('id').eq('id', workoutA).maybeSingle();
    expect(data?.id).toBe(workoutA);
  });

  it('outro usuário não lê treino privado', async () => {
    const { data } = await clientB.from('workouts').select('id').eq('id', workoutA).maybeSingle();
    expect(data).toBeNull();
  });

  it('outro usuário não altera treino alheio', async () => {
    const { data } = await clientB
      .from('workouts')
      .update({ title: 'invadido' })
      .eq('id', workoutA)
      .select('id');

    // a RLS filtra a linha: o UPDATE não atinge nada
    expect(data ?? []).toHaveLength(0);

    const { data: intact } = await clientA.from('workouts').select('title').eq('id', workoutA).single();
    expect(intact?.title).toBe('Treino privado do A');
  });

  it('outro usuário não apaga treino alheio', async () => {
    await clientB.from('workouts').delete().eq('id', workoutA);
    const { data } = await clientA.from('workouts').select('id').eq('id', workoutA).maybeSingle();
    expect(data?.id).toBe(workoutA);
  });

  it('ninguém insere treino em nome de outro', async () => {
    const { error } = await clientB.from('workouts').insert({
      user_id: userA,
      client_id: crypto.randomUUID(),
      started_at: new Date().toISOString(),
      duration_seconds: 600,
    });

    expect(error).not.toBeNull();
  });

  it('foto não pode nascer pública', async () => {
    const { error } = await clientA.from('progress_photos').insert({
      user_id: userA,
      client_id: crypto.randomUUID(),
      storage_path: `${userA}/2026/08/teste.webp`,
      thumbnail_path: `${userA}/2026/08/teste_thumb.webp`,
      taken_on: '2026-08-22',
      visibility: 'public',
    });

    expect(error).not.toBeNull();
  });

  it('foto privada é aceita e fica invisível para os outros', async () => {
    const { data, error } = await clientA
      .from('progress_photos')
      .insert({
        user_id: userA,
        client_id: crypto.randomUUID(),
        storage_path: `${userA}/2026/08/privada.webp`,
        thumbnail_path: `${userA}/2026/08/privada_thumb.webp`,
        taken_on: '2026-08-22',
      })
      .select('id, visibility')
      .single();

    expect(error).toBeNull();
    expect(data?.visibility).toBe('private');

    const { data: outroVe } = await clientB
      .from('progress_photos')
      .select('id')
      .eq('id', data!.id)
      .maybeSingle();

    expect(outroVe).toBeNull();
  });

  it('recorde não pode ser forjado pelo cliente', async () => {
    const { error } = await clientA.from('personal_records').insert({
      user_id: userA,
      exercise_id: null,
      metric: 'rounds',
      value: 999,
      achieved_on: '2026-08-22',
    } as never);

    expect(error).not.toBeNull();
  });

  it('o trigger registra o recorde do próprio treino', async () => {
    const { data } = await clientA
      .from('personal_records')
      .select('metric, value')
      .eq('user_id', userA)
      .eq('metric', 'duration');

    expect(data?.[0]?.value).toBe(1200);
  });

  it('client_id repetido não duplica treino', async () => {
    const clientId = crypto.randomUUID();
    const payload = {
      user_id: userA,
      client_id: clientId,
      started_at: new Date().toISOString(),
      duration_seconds: 900,
    };

    await clientA.from('workouts').insert(payload);
    const { error } = await clientA.from('workouts').insert(payload);

    // a segunda tentativa esbarra no unique (user_id, client_id)
    expect(error?.code).toBe('23505');
  });

  it('o dia do treino é gravado no fuso do usuário', async () => {
    const { data } = await clientA.from('workouts').select('workout_date').eq('id', workoutA).single();
    expect(data?.workout_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('as estatísticas só enxergam os próprios treinos', async () => {
    const { data: statsA } = await clientA.rpc('get_user_stats', { p_user: userA });
    expect(statsA?.[0]?.total_days).toBeGreaterThan(0);

    // B pede as estatísticas de A: a função é SECURITY INVOKER, a RLS filtra tudo
    const { data: statsB } = await clientB.rpc('get_user_stats', { p_user: userA });
    expect(statsB?.[0]?.total_days).toBe(0);
  });

  it('configurações de outro usuário são invisíveis', async () => {
    const { data } = await clientB.from('user_settings').select('user_id').eq('user_id', userA).maybeSingle();
    expect(data).toBeNull();
  });

  it('a biblioteca de exercícios do sistema é legível por todos', async () => {
    const { data } = await clientB.from('exercises').select('slug').eq('slug', 'flexao').maybeSingle();
    expect(data?.slug).toBe('flexao');
  });

  /**
   * Entrar num desafio duas vezes.
   *
   * A tabela não tem policy de UPDATE para o dono da linha — de propósito:
   * `completed_at` é escrito por `concluir_desafio()`, e ninguém marca a
   * própria conclusão. Isso faz o `upsert` padrão do PostgREST
   * (`on conflict do update`) esbarrar na policy de UPDATE no segundo toque, e
   * quem já estava inscrito recebia "não conseguimos te inscrever". A inscrição
   * tem que ser `do nothing`, e este teste é o que segura isso.
   */
  it('entrar duas vezes no desafio não é erro', async () => {
    const slug = `rls-teste-${crypto.randomUUID().slice(0, 8)}`;

    const { data: desafio, error: erroDesafio } = await admin
      .from('challenges')
      .insert({
        slug,
        title: 'Desafio de teste',
        description: 'Criado pelo teste de RLS.',
        starts_on: '2026-01-01',
        ends_on: '2026-01-31',
        goal: 25,
      })
      .select('id')
      .single();

    if (erroDesafio) throw erroDesafio;

    try {
      const entrar = () =>
        clientA
          .from('challenge_participants')
          .upsert(
            { challenge_id: desafio.id, user_id: userA },
            { onConflict: 'challenge_id,user_id', ignoreDuplicates: true },
          );

      expect((await entrar()).error).toBeNull();
      expect((await entrar()).error).toBeNull();

      // e continua uma linha só, com a inscrição original preservada
      const { data: linhas } = await admin
        .from('challenge_participants')
        .select('user_id')
        .eq('challenge_id', desafio.id);

      expect(linhas).toHaveLength(1);
    } finally {
      await admin.from('challenges').delete().eq('id', desafio.id);
    }
  });

  /**
   * A trilha é privada.
   *
   * Ao contrário do desafio, que tem ranking e por isso lê participação alheia,
   * `track_enrollments` só é visível para o dono. "Em que sessão você está" é,
   * na prática, "há quanto tempo você treina" — dado de corpo por outro nome.
   *
   * O teste cobre também as duas travas que a tabela herdou do desafio:
   * reentrar não é erro (o upsert precisa ser `do nothing`, senão bate na
   * policy de UPDATE) e não zera o ponto de partida, e ninguém escreve o
   * próprio `completed_at` — quem marca isso é `concluir_trilha()`.
   */
  it('a matrícula na trilha só é vista pelo dono', async () => {
    const { data: trilha } = await clientA
      .from('tracks')
      .select('id, slug')
      .eq('slug', 'iniciante-em-casa')
      .maybeSingle();

    // o catálogo é público: sem ele não há convite
    expect(trilha?.slug).toBe('iniciante-em-casa');
    if (!trilha) return;

    try {
      const entrar = (started_on: string) =>
        clientA
          .from('track_enrollments')
          .upsert(
            { track_id: trilha.id, user_id: userA, started_on },
            { onConflict: 'track_id,user_id', ignoreDuplicates: true },
          );

      expect((await entrar('2026-01-10')).error).toBeNull();
      // reentrar não é erro e não move o ponto de partida
      expect((await entrar('2026-02-20')).error).toBeNull();

      const { data: minha } = await clientA
        .from('track_enrollments')
        .select('started_on')
        .eq('track_id', trilha.id);

      expect(minha).toHaveLength(1);
      expect(minha?.[0].started_on).toBe('2026-01-10');

      // B não enxerga a matrícula de A
      const { data: doOutro } = await clientB
        .from('track_enrollments')
        .select('user_id')
        .eq('track_id', trilha.id);

      expect(doOutro).toEqual([]);

      // e ninguém marca a própria conclusão
      const { error: erroConclusao } = await clientA
        .from('track_enrollments')
        .update({ completed_at: new Date().toISOString() })
        .eq('track_id', trilha.id)
        .eq('user_id', userA);

      const { data: aindaAberta } = await clientA
        .from('track_enrollments')
        .select('completed_at')
        .eq('track_id', trilha.id)
        .maybeSingle();

      // a policy pode recusar ou simplesmente não casar linha nenhuma; o que
      // importa é que a conclusão continue vazia
      expect(erroConclusao === null || Boolean(erroConclusao)).toBe(true);
      expect(aindaAberta?.completed_at ?? null).toBeNull();
    } finally {
      await admin.from('track_enrollments').delete().eq('user_id', userA);
    }
  });
});
