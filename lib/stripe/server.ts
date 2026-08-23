import 'server-only';

import Stripe from 'stripe';

/**
 * Cliente do Stripe.
 *
 * A chave secreta só existe no servidor, como a service role do Supabase. Se
 * ela não estiver configurada, a cobrança simplesmente não está ligada — e o
 * app inteiro continua funcionando, porque o núcleo é livre e o admin ainda
 * pode conceder plano à mão. Nada aqui pode derrubar um build sem chave.
 */

export const stripeConfigurado = Boolean(process.env.STRIPE_SECRET_KEY?.trim());

let cliente: Stripe | null = null;

export function getStripe(): Stripe {
  const chave = process.env.STRIPE_SECRET_KEY?.trim();

  if (!chave) {
    throw new Error(
      'STRIPE_SECRET_KEY ausente. A cobrança está desligada; configure a chave no ambiente.',
    );
  }

  cliente ??= new Stripe(chave, {
    // fixar a versão evita que uma mudança do lado deles quebre o webhook
    apiVersion: '2026-07-29.dahlia',
    typescript: true,
  });

  return cliente;
}

export const webhookSecret = () => process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? '';
