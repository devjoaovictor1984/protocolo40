import { NextResponse } from 'next/server';

import { assinaturaAtual, planoPorSlug } from '@/features/billing/repository';
import { requireUser } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { getStripe, stripeConfigurado } from '@/lib/stripe/server';

/**
 * Abre o checkout.
 *
 * O cliente manda só o slug do plano. Preço, moeda e recorrência vêm do banco
 * e do Stripe — nunca do corpo da requisição. É a diferença entre uma pessoa
 * escolher um plano e uma pessoa escolher quanto quer pagar.
 */
export async function POST(request: Request) {
  if (!stripeConfigurado) {
    return NextResponse.json({ erro: 'A cobrança ainda não está ativa.' }, { status: 503 });
  }

  const user = await requireUser();

  let slug: unknown;
  try {
    ({ slug } = (await request.json()) as { slug?: unknown });
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  if (typeof slug !== 'string') {
    return NextResponse.json({ erro: 'Plano não informado.' }, { status: 400 });
  }

  const plano = await planoPorSlug(slug);

  if (!plano || !plano.is_active || !plano.stripe_price_id || plano.price_cents === 0) {
    return NextResponse.json({ erro: 'Este plano não está disponível.' }, { status: 400 });
  }

  const stripe = getStripe();
  const assinatura = await assinaturaAtual(user.id);

  try {
    const sessao = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: plano.stripe_price_id, quantity: 1 }],
      // reaproveita o cliente quando ele já existe, para não duplicar cadastro
      ...(assinatura?.stripe_customer_id
        ? { customer: assinatura.stripe_customer_id }
        : { customer_email: user.email ?? undefined }),
      // o webhook precisa saber de quem é a assinatura, e o e-mail não serve:
      // a pessoa pode trocar de e-mail no Stripe
      client_reference_id: user.id,
      subscription_data: { metadata: { user_id: user.id, plan_slug: plano.slug } },
      metadata: { user_id: user.id, plan_slug: plano.slug },
      locale: 'pt-BR',
      allow_promotion_codes: true,
      success_url: `${env.siteUrl}/planos?assinatura=ok`,
      cancel_url: `${env.siteUrl}/planos?assinatura=cancelada`,
    });

    if (!sessao.url) {
      return NextResponse.json({ erro: 'O pagamento não pôde ser aberto.' }, { status: 502 });
    }

    return NextResponse.json({ url: sessao.url });
  } catch {
    return NextResponse.json(
      { erro: 'Não conseguimos falar com o pagamento agora.' },
      { status: 502 },
    );
  }
}
