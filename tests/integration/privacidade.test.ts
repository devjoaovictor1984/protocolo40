import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Database, Visibility } from '@/types/database';

/**
 * A configuração de privacidade vale de verdade?
 *
 * O bug que originou este arquivo: dava para marcar tudo como público na tela
 * de Privacidade, salvar, e continuar invisível para todo mundo — porque a
 * policy lia a coluna de cada linha (`workouts.visibility`, que nasce privada) e
 * não a configuração do perfil. Sem erro e sem aviso: a pessoa achava que tinha
 * compartilhado e não tinha.
 *
 * É a pior forma de bug de privacidade, a que mente na direção de quem confiou
 * na interface. E o teste precisa cobrir os dois sentidos: o que passou a
 * aparecer, e principalmente o que **continua** escondido.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && anonKey && serviceKey) && !url!.includes('placeholder');

type Client = SupabaseClient<Database>;

describe.skipIf(!configured)('privacidade', () => {
  const admin = configured
    ? createClient<Database>(url!, serviceKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : (null as unknown as Client);

  const senha = `p20x-priv-${crypto.randomUUID()}`;
  const emailDono = `priv-dono-${crypto.randomUUID()}@p20x.test`;
  const emailVisita = `priv-visita-${crypto.randomUUID()}@p20x.test`;

  let dono = '';
  let visitante = '';
  let comoVisitante: Client;
  let treinoId = '';
  let fotoId = '';

  const criar = async (email: string) => {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error('sem usuário');
    return data.user.id;
  };

  /** Muda uma configuração do dono e devolve o controle. */
  const configurar = (campo: string, valor: Visibility) =>
    admin
      .from('user_settings')
      .update({ [campo]: valor } as never)
      .eq('user_id', dono);

  beforeAll(async () => {
    dono = await criar(emailDono);
    visitante = await criar(emailVisita);

    comoVisitante = createClient<Database>(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await comoVisitante.auth.signInWithPassword({ email: emailVisita, password: senha });

    // um treino e uma foto, ambos nascendo privados como manda o padrão
    const { data: treino } = await admin
      .from('workouts')
      .insert({
        user_id: dono,
        client_id: crypto.randomUUID(),
        title: 'Treino do dono',
        started_at: '2026-09-10T10:00:00Z',
        finished_at: '2026-09-10T10:20:00Z',
        duration_seconds: 1200,
        workout_date: '2026-09-10',
      })
      .select('id')
      .single();
    treinoId = treino!.id;

    const { data: foto } = await admin
      .from('progress_photos')
      .insert({
        user_id: dono,
        client_id: crypto.randomUUID(),
        storage_path: `${dono}/a.webp`,
        thumbnail_path: `${dono}/a-thumb.webp`,
        taken_on: '2026-09-10',
      })
      .select('id')
      .single();
    fotoId = foto!.id;
  }, 60_000);

  afterAll(async () => {
    for (const id of [dono, visitante]) if (id) await admin.auth.admin.deleteUser(id);
  });

  const visitanteVeTreinos = async () => {
    const { data } = await comoVisitante.from('workouts').select('id').eq('user_id', dono);
    return (data ?? []).length;
  };

  const visitanteVeFotos = async () => {
    const { data } = await comoVisitante.from('progress_photos').select('id').eq('user_id', dono);
    return (data ?? []).length;
  };

  describe('treinos', () => {
    it('nascem invisíveis para os outros', async () => {
      await configurar('workouts_visibility', 'private');
      expect(await visitanteVeTreinos()).toBe(0);
    });

    /** O bug: marcar público na tela não mudava nada. */
    it('marcar público na configuração passa a mostrar', async () => {
      await configurar('workouts_visibility', 'public');
      expect(await visitanteVeTreinos()).toBe(1);
    });

    it('voltar para privado esconde de novo', async () => {
      await configurar('workouts_visibility', 'private');
      expect(await visitanteVeTreinos()).toBe(0);
    });

    it('"seguidores" não mostra para quem não segue', async () => {
      await configurar('workouts_visibility', 'followers');
      expect(await visitanteVeTreinos()).toBe(0);
    });

    it('"seguidores" mostra para quem segue', async () => {
      await admin.from('user_settings').update({ allow_followers: true }).eq('user_id', dono);
      await admin
        .from('followers')
        .insert({ follower_id: visitante, following_id: dono, status: 'accepted' });

      await configurar('workouts_visibility', 'followers');
      expect(await visitanteVeTreinos()).toBe(1);

      await admin
        .from('followers')
        .delete()
        .eq('follower_id', visitante)
        .eq('following_id', dono);
    });

    it('um treino compartilhado aparece mesmo com a configuração privada', async () => {
      // é o que permitiria um botão de "compartilhar este treino" no futuro
      await configurar('workouts_visibility', 'private');
      await admin.from('workouts').update({ visibility: 'public' }).eq('id', treinoId);

      expect(await visitanteVeTreinos()).toBe(1);

      await admin.from('workouts').update({ visibility: 'private' }).eq('id', treinoId);
      expect(await visitanteVeTreinos()).toBe(0);
    });
  });

  describe('fotos', () => {
    it('nascem privadas, como manda a regra da casa', async () => {
      await configurar('photos_visibility', 'private');
      expect(await visitanteVeFotos()).toBe(0);
    });

    it('a vitrine mostra a foto escolhida sem abrir o álbum inteiro', async () => {
      // é assim que o antes-e-depois do perfil funciona
      await configurar('photos_visibility', 'private');
      await admin.from('progress_photos').update({ visibility: 'public' }).eq('id', fotoId);

      expect(await visitanteVeFotos()).toBe(1);

      await admin.from('progress_photos').update({ visibility: 'private' }).eq('id', fotoId);
    });

    it('abrir as fotos na configuração mostra todas', async () => {
      await configurar('photos_visibility', 'public');
      expect(await visitanteVeFotos()).toBe(1);
      await configurar('photos_visibility', 'private');
    });
  });

  /**
   * O que esta migration NÃO podia fazer: expor algo que ninguém pediu para
   * expor. Peso e medida têm configuração própria e continuam privados por
   * padrão.
   */
  describe('o que continua escondido', () => {
    it('peso e medida não vazam junto com o treino', async () => {
      await admin.from('body_measurements').insert({
        user_id: dono,
        client_id: crypto.randomUUID(),
        measured_on: '2026-09-10',
        weight_kg: 88.8,
        waist_cm: 95.5,
      });

      // treino aberto, corpo fechado: são configurações separadas
      await configurar('workouts_visibility', 'public');
      await configurar('measurements_visibility', 'private');

      const { data } = await comoVisitante
        .from('body_measurements')
        .select('weight_kg')
        .eq('user_id', dono);

      expect(data ?? []).toHaveLength(0);
    });

    /**
     * "Todos" alcança mesmo todos, inclusive quem não tem conta — o perfil em
     * `/u/usuario` é uma página aberta, e seria incoerente o perfil ser público
     * e o treino dele não. Está escrito na tela de Privacidade com essas
     * palavras; este teste existe para o texto e o comportamento não separarem.
     */
    it('"todos" inclui quem não tem conta', async () => {
      await configurar('workouts_visibility', 'public');

      const anon = createClient<Database>(url!, anonKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data } = await anon.from('workouts').select('id').eq('user_id', dono);
      expect(data ?? []).toHaveLength(1);
    });

    it('e "quem me segue" não vaza para anônimo', async () => {
      await configurar('workouts_visibility', 'followers');

      const anon = createClient<Database>(url!, anonKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data } = await anon.from('workouts').select('id').eq('user_id', dono);
      expect(data ?? []).toHaveLength(0);
    });
  });
});
