import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe, stripeConfigurado, webhookSecret } from '@/lib/stripe/server';
import type { SubscriptionStatus } from '@/types/database';

/**
 * Webhook do Stripe.
 *
 * Este é o único lugar que grava assinatura. Três cuidados que valem mais que
 * o código em si:
 *
 * 1. **A assinatura do evento é verificada antes de qualquer leitura.** Sem
 *    isso, qualquer pessoa que descubra a URL poderia se dar um plano vitalício
 *    com um `curl`. Por isso o corpo é lido cru, e não como JSON.
 * 2. **Quem escreve é a service role.** A tabela não tem policy de escrita
 *    para o cliente; nem o próprio dono pode alterar a própria assinatura.
 * 3. **Nada de concessão manual é sobrescrito.** Se o admin deu acesso de
 *    cortesia, um evento antigo do Stripe não pode tirá-lo sem querer.
 */

// o corpo precisa chegar exatamente como saiu para a assinatura conferir
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS: Record<string, SubscriptionStatus> = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  incomplete: 'incomplete',
  incomplete_expired: 'incomplete_expired',
  unpaid: 'unpaid',
};

/** O plano correspondente ao preço que o Stripe cobrou. */
async function planoDoPreco(priceId: string | null | undefined): Promise<string | null> {
  if (!priceId) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from('plans')
    .select('slug')
    .eq('stripe_price_id', priceId)
    .maybeSingle();

  return data?.slug ?? null;
}

async function gravar(assinatura: Stripe.Subscription): Promise<void> {
  const userId =
    typeof assinatura.metadata?.user_id === 'string' ? assinatura.metadata.user_id : null;

  if (!userId) return;

  const item = assinatura.items.data[0];
  const slug =
    (await planoDoPreco(item?.price?.id)) ??
    (typeof assinatura.metadata?.plan_slug === 'string' ? assinatura.metadata.plan_slug : null);

  if (!slug) return;

  const fim = item?.current_period_end ?? null;

  const admin = createAdminClient();
  await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      plan_slug: slug,
      status: STATUS[assinatura.status] ?? 'incomplete',
      current_period_end: fim ? new Date(fim * 1000).toISOString() : null,
      cancel_at_period_end: assinatura.cancel_at_period_end,
      stripe_customer_id:
        typeof assinatura.customer === 'string' ? assinatura.customer : assinatura.customer.id,
      stripe_subscription_id: assinatura.id,
      // o Stripe assumiu a assinatura: a cortesia anterior deixa de valer
      granted_by: null,
      granted_reason: null,
    },
    { onConflict: 'user_id' },
  );
}

export async function POST(request: Request) {
  if (!stripeConfigurado || !webhookSecret()) {
    return NextResponse.json({ erro: 'Webhook não configurado.' }, { status: 503 });
  }

  const assinaturaDoEvento = request.headers.get('stripe-signature');
  if (!assinaturaDoEvento) {
    return NextResponse.json({ erro: 'Sem assinatura.' }, { status: 400 });
  }

  const corpo = await request.text();
  const stripe = getStripe();

  let evento: Stripe.Event;
  try {
    evento = await stripe.webhooks.constructEventAsync(
      corpo,
      assinaturaDoEvento,
      webhookSecret(),
    );
  } catch {
    // assinatura inválida: nem loga o corpo, que pode ser forjado
    return NextResponse.json({ erro: 'Assinatura inválida.' }, { status: 400 });
  }

  try {
    switch (evento.type) {
      case 'checkout.session.completed': {
        const sessao = evento.data.object;
        if (sessao.mode !== 'subscription' || !sessao.subscription) break;

        const id =
          typeof sessao.subscription === 'string' ? sessao.subscription : sessao.subscription.id;
        const assinatura = await stripe.subscriptions.retrieve(id);

        // o checkout carrega o id do usuário; a assinatura pode não carregar
        if (!assinatura.metadata?.user_id && sessao.client_reference_id) {
          assinatura.metadata = {
            ...assinatura.metadata,
            user_id: sessao.client_reference_id,
          };
        }

        await gravar(assinatura);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await gravar(evento.data.object);
        break;
      }

      default:
        break;
    }
  } catch {
    // devolver 500 faz o Stripe tentar de novo, que é o comportamento certo
    return NextResponse.json({ erro: 'Falha ao processar.' }, { status: 500 });
  }

  return NextResponse.json({ recebido: true });
}
