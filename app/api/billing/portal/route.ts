import { NextResponse } from 'next/server';

import { assinaturaAtual } from '@/features/billing/repository';
import { requireUser } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { getStripe, stripeConfigurado } from '@/lib/stripe/server';

/**
 * Portal de cobrança.
 *
 * Trocar cartão, baixar recibo e cancelar acontecem do lado do Stripe. Não
 * reimplementamos nada disso: uma tela caseira de cancelamento é onde mora a
 * maior parte dos golpes de retenção, e não é o que este produto quer ser.
 */
export async function GET() {
  const user = await requireUser();

  if (!stripeConfigurado) {
    return NextResponse.redirect(`${env.siteUrl}/planos`);
  }

  const assinatura = await assinaturaAtual(user.id);

  if (!assinatura?.stripe_customer_id) {
    return NextResponse.redirect(`${env.siteUrl}/planos`);
  }

  try {
    const sessao = await getStripe().billingPortal.sessions.create({
      customer: assinatura.stripe_customer_id,
      return_url: `${env.siteUrl}/planos`,
      locale: 'pt-BR',
    });

    return NextResponse.redirect(sessao.url);
  } catch {
    return NextResponse.redirect(`${env.siteUrl}/planos?erro=portal`);
  }
}
