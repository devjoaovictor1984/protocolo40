import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * O serviço de push trocou a inscrição por conta própria.
 *
 * Chega do `pushsubscriptionchange` do service worker, que roda sem sessão
 * nenhuma — não há cookie ali. O que identifica a pessoa é o `endpoint` antigo,
 * que já está no banco ligado a ela.
 *
 * Isso exige service role, e por isso a rota é estreita de propósito: só troca
 * o endereço de uma linha que já existe. Sem o antigo, ou se ele não bater com
 * nada, nada acontece — não dá para criar inscrição por aqui.
 */

const corpoSchema = z.object({
  antigo: z.string().url().nullable(),
  nova: z.object({
    endpoint: z.string().url().min(10).max(2000),
    keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(10) }),
  }),
});

export async function POST(request: NextRequest) {
  const parsed = corpoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.antigo) {
    return NextResponse.json({ ok: false });
  }

  const admin = createAdminClient();

  const { data: existente } = await admin
    .from('push_subscriptions')
    .select('id')
    .eq('endpoint', parsed.data.antigo)
    .maybeSingle();

  if (!existente) return NextResponse.json({ ok: false });

  await admin
    .from('push_subscriptions')
    .update({
      endpoint: parsed.data.nova.endpoint,
      p256dh: parsed.data.nova.keys.p256dh,
      auth: parsed.data.nova.keys.auth,
    })
    .eq('id', existente.id);

  return NextResponse.json({ ok: true });
}
