import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';

import type { Database } from '@/types/database';

/**
 * Quem recebe lembrete, contra o banco real.
 *
 * A escolha de quem é lembrado mora em SQL, e é o tipo de lógica onde um erro
 * não aparece em tela nenhuma — aparece como notificação no bolso de quem já
 * treinou, ou como silêncio para quem esperava. Só um teste contra o banco pega.
 *
 * O que precisa ser verdade:
 *
 * - a hora comparada é a **local** de cada pessoa, não a do servidor;
 * - quem já treinou, descansou ou já foi lembrado hoje não recebe;
 * - a sequência contada é a de ontem, porque hoje ainda está em aberto;
 * - nada de peso ou medida sai da função.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && serviceKey) && !url!.includes('placeholder');

type Client = SupabaseClient<Database>;

/** Um instante fixo: 22:00 UTC = 19:00 em São Paulo, 18:00 em Manaus. */
const AGORA = '2026-09-10T22:00:00Z';
const DIA_SP = '2026-09-10';

describe.skipIf(!configured)('quem recebe lembrete', () => {
  const admin = configured
    ? createClient<Database>(url!, serviceKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : (null as unknown as Client);

  const criados: string[] = [];

  /** Cria alguém pronto para receber lembrete às 19h no fuso pedido. */
  async function pessoa(opcoes: {
    timezone?: string;
    hora?: string;
    pushLigado?: boolean;
    ultimoLembrete?: string | null;
  }) {
    const email = `push-${crypto.randomUUID()}@p20x.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: `Teste-${crypto.randomUUID()}`,
      email_confirm: true,
    });

    if (error || !data.user) throw error ?? new Error('sem usuário');
    const id = data.user.id;
    criados.push(id);

    await admin
      .from('profiles')
      .update({ timezone: opcoes.timezone ?? 'America/Sao_Paulo', full_name: 'Maria Silva' })
      .eq('id', id);

    await admin
      .from('user_settings')
      .update({
        push_enabled: opcoes.pushLigado ?? true,
        reminder_time: opcoes.hora ?? '19:00:00',
        last_reminded_on: opcoes.ultimoLembrete ?? null,
      })
      .eq('user_id', id);

    await admin.from('push_subscriptions').insert({
      user_id: id,
      endpoint: `https://exemplo.test/${crypto.randomUUID()}`,
      p256dh: 'chave-publica-de-teste',
      auth: 'segredo-de-teste',
    });

    return id;
  }

  const chamar = async () => {
    const { data, error } = await admin.rpc('quem_lembrar', { p_agora: AGORA });
    if (error) throw error;
    return data ?? [];
  };

  const achar = async (id: string) => (await chamar()).filter((linha) => linha.user_id === id);

  const treinar = (id: string, dia: string) =>
    admin.from('workouts').insert({
      user_id: id,
      client_id: crypto.randomUUID(),
      title: 'Treino de teste',
      started_at: `${dia}T10:00:00Z`,
      finished_at: `${dia}T10:20:00Z`,
      duration_seconds: 1200,
      workout_date: dia,
    });

  afterAll(async () => {
    for (const id of criados) await admin.auth.admin.deleteUser(id);
  });

  it('lembra quem escolheu esta hora no próprio fuso', async () => {
    const id = await pessoa({ timezone: 'America/Sao_Paulo', hora: '19:00:00' });
    const linhas = await achar(id);

    expect(linhas).toHaveLength(1);
    expect(linhas[0].dia).toBe(DIA_SP);
  });

  it('não lembra quem escolheu outra hora', async () => {
    const id = await pessoa({ timezone: 'America/Sao_Paulo', hora: '07:00:00' });
    expect(await achar(id)).toHaveLength(0);
  });

  /**
   * O caso que um cron diário erraria: às 19h de São Paulo são 18h em Manaus.
   * Quem escolheu 19h em Manaus só deve ser lembrado uma hora depois.
   */
  it('a hora é a local, não a do servidor', async () => {
    const manaus19 = await pessoa({ timezone: 'America/Manaus', hora: '19:00:00' });
    const manaus18 = await pessoa({ timezone: 'America/Manaus', hora: '18:00:00' });

    expect(await achar(manaus19), 'em Manaus ainda são 18h').toHaveLength(0);
    expect(await achar(manaus18)).toHaveLength(1);
  });

  it('quem desligou não recebe, mesmo com aparelho inscrito', async () => {
    const id = await pessoa({ pushLigado: false });
    expect(await achar(id)).toHaveLength(0);
  });

  it('quem já treinou hoje não é lembrado de treinar', async () => {
    const id = await pessoa({});
    expect(await achar(id)).toHaveLength(1);

    await treinar(id, DIA_SP);
    expect(await achar(id)).toHaveLength(0);
  });

  it('quem registrou descanso não é lembrado', async () => {
    const id = await pessoa({});
    await admin.from('rest_days').insert({ user_id: id, day: DIA_SP });
    expect(await achar(id)).toHaveLength(0);
  });

  it('um por dia: quem já foi lembrado hoje não é de novo', async () => {
    const id = await pessoa({ ultimoLembrete: DIA_SP });
    expect(await achar(id)).toHaveLength(0);
  });

  it('lembrado ontem volta a ser lembrado hoje', async () => {
    const id = await pessoa({ ultimoLembrete: '2026-09-09' });
    expect(await achar(id)).toHaveLength(1);
  });

  it('conta a sequência até ontem, porque hoje ainda está em aberto', async () => {
    const id = await pessoa({});
    for (const dia of ['2026-09-07', '2026-09-08', '2026-09-09']) await treinar(id, dia);

    const [linha] = await achar(id);
    expect(linha.sequencia).toBe(3);
  });

  it('sequência quebrada não conta como viva', async () => {
    const id = await pessoa({});
    // treinou até anteontem e faltou ontem: a sequência morreu
    for (const dia of ['2026-09-06', '2026-09-07', '2026-09-08']) await treinar(id, dia);

    const [linha] = await achar(id);
    expect(linha.sequencia).toBe(0);
  });

  it('devolve o primeiro nome, e nada de peso nem medida', async () => {
    const id = await pessoa({});

    await admin.from('body_measurements').insert({
      user_id: id,
      client_id: crypto.randomUUID(),
      measured_on: DIA_SP,
      weight_kg: 91.4,
      waist_cm: 99.9,
    });

    const [linha] = await achar(id);

    expect(linha.primeiro_nome).toBe('Maria');

    const campos = Object.keys(linha);
    for (const proibido of ['weight_kg', 'waist_cm', 'peso', 'medida']) {
      expect(campos, `${proibido} não pode sair daqui`).not.toContain(proibido);
    }
    expect(JSON.stringify(linha)).not.toContain('91.4');
    expect(JSON.stringify(linha)).not.toContain('99.9');
  });

  it('traz a água do dia para o texto poder variar', async () => {
    const id = await pessoa({});
    await admin.from('water_logs').insert({ user_id: id, day: DIA_SP, ml: 750 });

    const [linha] = await achar(id);
    expect(linha.agua_ml).toBe(750);
  });

  it('dois aparelhos da mesma pessoa viram duas linhas', async () => {
    const id = await pessoa({});
    await admin.from('push_subscriptions').insert({
      user_id: id,
      endpoint: `https://exemplo.test/${crypto.randomUUID()}`,
      p256dh: 'chave-publica-de-teste',
      auth: 'segredo-de-teste',
    });

    expect(await achar(id)).toHaveLength(2);
  });

  /**
   * A função roda a partir do cron, com service role. Um cliente comum
   * chamando ela conseguiria a lista de todo mundo que está sem treinar hoje.
   */
  it('não é chamável por cliente comum', async () => {
    const anon = createClient<Database>(url!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await anon.rpc('quem_lembrar', { p_agora: AGORA });
    expect(error, 'anônimo conseguiu listar quem não treinou hoje').not.toBeNull();
  });
});
