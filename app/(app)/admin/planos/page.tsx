import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CircleAlert } from 'lucide-react';

import { PlanForm } from '@/features/billing/components/plan-form';
import { precoEmReais } from '@/features/billing/repository';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { stripeConfigurado } from '@/lib/stripe/server';
import { cn } from '@/lib/utils';
import type { PlanRow } from '@/types/database';

export const metadata: Metadata = {
  title: 'Planos',
  robots: { index: false, follow: false },
};

export default async function AdminPlanosPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase.from('plans').select('*').order('sort_order');
  const planos = (data ?? []) as PlanRow[];

  const semPreco = planos.filter(
    (plano) => plano.price_cents > 0 && plano.is_active && !plano.stripe_price_id,
  );

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-4">
        <Link
          href="/admin"
          className="text-muted-foreground hover:text-foreground -ml-1 flex min-h-11 items-center gap-1.5 self-start text-sm"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Administração
        </Link>

        <h1 className="text-2xl font-extrabold tracking-tight">Planos</h1>
      </header>

      {!stripeConfigurado ? (
        <p className="border-warning/40 bg-warning/5 flex items-start gap-2 rounded-xl border p-4 text-sm">
          <CircleAlert aria-hidden className="text-warning mt-0.5 size-4 shrink-0" />
          <span>
            A cobrança está desligada: falta <code>STRIPE_SECRET_KEY</code> no ambiente. Os planos
            aparecem na tela de Planos, mas o botão de assinar fica indisponível. Você ainda pode
            conceder acesso à mão pela ficha de cada usuário.
          </span>
        </p>
      ) : semPreco.length > 0 ? (
        <p className="border-warning/40 bg-warning/5 flex items-start gap-2 rounded-xl border p-4 text-sm">
          <CircleAlert aria-hidden className="text-warning mt-0.5 size-4 shrink-0" />
          <span>
            {semPreco.length === 1 ? 'Um plano pago está' : `${semPreco.length} planos pagos estão`}{' '}
            sem o identificador de preço do Stripe. Sem ele o botão de assinar não aparece.
          </span>
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        {planos.map((plano) => (
          <details
            key={plano.slug}
            className={cn(
              'border-border rounded-2xl border p-4',
              !plano.is_active && 'opacity-60',
            )}
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
              <span>
                <span className="font-bold">{plano.name}</span>
                <span className="text-muted-foreground tnum ml-2 text-sm">
                  {plano.price_cents === 0 ? 'grátis' : `R$ ${precoEmReais(plano.price_cents)}`}
                </span>
              </span>

              <span className="text-muted-foreground text-xs">
                {plano.is_active ? 'ativo' : 'inativo'}
                {plano.price_cents > 0 && !plano.stripe_price_id ? ' · sem preço no Stripe' : ''}
              </span>
            </summary>

            <div className="mt-4">
              <PlanForm plano={plano} />
            </div>
          </details>
        ))}
      </div>

      <details className="border-border rounded-2xl border p-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center font-bold">
          Criar um plano novo
        </summary>
        <div className="mt-4">
          <PlanForm plano={null} />
        </div>
      </details>
    </div>
  );
}
