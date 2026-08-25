import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

/**
 * Inscrever e desinscrever um aparelho.
 *
 * A inscrição é por aparelho: quem usa celular e tablet tem duas linhas. O
 * `endpoint` é a chave — é o que o navegador entrega e o que o serviço de push
 * reconhece —, então reinscrever o mesmo aparelho atualiza em vez de duplicar.
 */

const inscricaoSchema = z.object({
  endpoint: z.string().url().min(10).max(2000),
  keys: z.object({
    p256dh: z.string().min(10),
    auth: z.string().min(10),
  }),
});

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ erro: 'sem sessão' }, { status: 401 });

  const parsed = inscricaoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: 'inscrição inválida' }, { status: 400 });

  const supabase = await createClient();

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
    },
    { onConflict: 'endpoint' },
  );

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // autorizar no navegador e continuar desligado no app seria uma armadilha:
  // a pessoa clicou em receber
  await supabase.from('user_settings').update({ push_enabled: true }).eq('user_id', user.id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ erro: 'sem sessão' }, { status: 401 });

  const corpo = await request.json().catch(() => null);
  const endpoint = typeof corpo?.endpoint === 'string' ? corpo.endpoint : null;
  if (!endpoint) return NextResponse.json({ erro: 'endpoint ausente' }, { status: 400 });

  const supabase = await createClient();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id);

  // sem aparelho nenhum, não faz sentido continuar marcado como ligado
  const { count } = await supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if ((count ?? 0) === 0) {
    await supabase.from('user_settings').update({ push_enabled: false }).eq('user_id', user.id);
  }

  return NextResponse.json({ ok: true });
}
