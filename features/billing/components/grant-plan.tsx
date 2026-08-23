'use client';

import { useActionState, useState } from 'react';
import { CheckCircle2, Gift, ShieldMinus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { concederPlano, revogarPlano } from '@/features/billing/actions';
import { idleState } from '@/lib/forms/action-state';
import { cn } from '@/lib/utils';
import { formatDay } from '@/services/calendar';

/**
 * Conceder plano à mão.
 *
 * Serve para cortesia, teste e para resolver problema de cobrança sem esperar
 * o Stripe. O motivo é obrigatório porque vai para o registro de auditoria —
 * e é ele que responde "por que essa pessoa tem acesso de graça?" meses
 * depois.
 */
export function GrantPlan({
  userId,
  planos,
  atual,
}: {
  userId: string;
  planos: { slug: string; name: string }[];
  atual: { plan_slug: string; status: string; current_period_end: string | null; granted_reason: string | null } | null;
}) {
  const [state, action] = useActionState(concederPlano, idleState);
  const [escolhido, setEscolhido] = useState(planos[0]?.slug ?? '');

  const ativo = atual && ['active', 'trialing'].includes(atual.status);

  return (
    <section className="border-border flex flex-col gap-4 rounded-xl border p-4">
      <h2 className="text-[11px] font-semibold tracking-wider uppercase">Plano</h2>

      <p className="text-sm">
        {ativo ? (
          <>
            <strong>{atual.plan_slug}</strong> · {atual.status}
            {atual.current_period_end
              ? ` · até ${formatDay(atual.current_period_end.slice(0, 10))}`
              : ' · sem prazo'}
            {atual.granted_reason ? (
              <span className="text-muted-foreground block text-xs">
                Concedido à mão: {atual.granted_reason}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">Sem plano pago. Está no Livre.</span>
        )}
      </p>

      {state.status !== 'idle' && state.message ? (
        <p
          role="status"
          className={cn(
            'flex items-start gap-2 rounded-lg border p-3 text-sm',
            state.status === 'error'
              ? 'border-destructive/30 bg-destructive/8 text-destructive'
              : 'border-success/30 bg-success/8 text-success',
          )}
        >
          {state.status === 'success' ? <CheckCircle2 aria-hidden className="mt-0.5 size-4" /> : null}
          {state.message}
        </p>
      ) : null}

      <form action={action} className="flex flex-col gap-3 border-t pt-4">
        <input type="hidden" name="user_id" value={userId} />
        <input type="hidden" name="plan_slug" value={escolhido} />

        <div className="flex flex-wrap gap-2">
          {planos.map((plano) => (
            <button
              key={plano.slug}
              type="button"
              aria-pressed={escolhido === plano.slug}
              onClick={() => setEscolhido(plano.slug)}
              className={cn(
                'min-h-11 rounded-lg border px-4 text-sm font-medium transition-colors',
                escolhido === plano.slug
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted',
              )}
            >
              {plano.name}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="ate">Até quando</Label>
          <Input id="ate" name="ate" type="date" className="h-12" />
          <p className="text-muted-foreground text-xs">Em branco significa acesso sem prazo.</p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="motivo">Motivo</Label>
          <Input
            id="motivo"
            name="motivo"
            placeholder="cortesia de lançamento, teste, problema de cobrança…"
            maxLength={200}
            className="h-12"
          />
          {state.fieldErrors?.motivo ? (
            <p className="text-destructive text-sm">{state.fieldErrors.motivo}</p>
          ) : null}
        </div>

        <Button type="submit" variant="outline" className="h-12">
          <Gift aria-hidden className="size-4" />
          Conceder
        </Button>
      </form>

      {ativo ? (
        <form action={revogarPlano} className="flex flex-col gap-2 border-t pt-4">
          <input type="hidden" name="user_id" value={userId} />
          <Input
            name="motivo"
            placeholder="Motivo da remoção"
            maxLength={200}
            className="h-11"
          />
          <Button type="submit" variant="ghost" className="h-11 justify-start">
            <ShieldMinus aria-hidden className="size-4" />
            Remover o acesso pago
          </Button>
        </form>
      ) : null}
    </section>
  );
}
