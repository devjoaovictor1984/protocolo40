'use client';

import { useActionState, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { salvarPlano } from '@/features/billing/actions';
import { idleState } from '@/lib/forms/action-state';
import { cn } from '@/lib/utils';
import { INTERVALOS, RECURSOS_DISPONIVEIS } from '@/lib/validation/billing';
import type { PlanRow } from '@/types/database';

/** Edição de um plano. `plano` nulo cria um novo. */
export function PlanForm({ plano }: { plano: PlanRow | null }) {
  const [state, action] = useActionState(salvarPlano, idleState);
  const [intervalo, setIntervalo] = useState<string>(plano?.interval ?? 'mes');
  const [recursos, setRecursos] = useState<string[]>(plano?.features ?? []);

  function alternar(valor: string) {
    setRecursos((atual) =>
      atual.includes(valor) ? atual.filter((item) => item !== valor) : [...atual, valor],
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
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

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`slug-${plano?.slug ?? 'novo'}`}>Identificador</Label>
          <Input
            id={`slug-${plano?.slug ?? 'novo'}`}
            name="slug"
            defaultValue={plano?.slug ?? ''}
            readOnly={Boolean(plano)}
            placeholder="mensal"
            className="h-12"
          />
          {state.fieldErrors?.slug ? (
            <p className="text-destructive text-sm">{state.fieldErrors.slug}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`price-${plano?.slug ?? 'novo'}`}>Preço (R$)</Label>
          <Input
            id={`price-${plano?.slug ?? 'novo'}`}
            name="price_reais"
            type="text"
            inputMode="decimal"
            defaultValue={plano ? (plano.price_cents / 100).toFixed(2).replace('.', ',') : '0'}
            className="tnum h-12"
          />
          {state.fieldErrors?.price_reais ? (
            <p className="text-destructive text-sm">{state.fieldErrors.price_reais}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`name-${plano?.slug ?? 'novo'}`}>Nome</Label>
        <Input
          id={`name-${plano?.slug ?? 'novo'}`}
          name="name"
          defaultValue={plano?.name ?? ''}
          className="h-12"
        />
        {state.fieldErrors?.name ? (
          <p className="text-destructive text-sm">{state.fieldErrors.name}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`tagline-${plano?.slug ?? 'novo'}`}>Chamada curta</Label>
        <Input
          id={`tagline-${plano?.slug ?? 'novo'}`}
          name="tagline"
          defaultValue={plano?.tagline ?? ''}
          maxLength={80}
          className="h-12"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`desc-${plano?.slug ?? 'novo'}`}>Descrição</Label>
        <Textarea
          id={`desc-${plano?.slug ?? 'novo'}`}
          name="description"
          defaultValue={plano?.description ?? ''}
          rows={3}
          maxLength={500}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Cobrança</legend>
        <input type="hidden" name="interval" value={intervalo} />
        <div className="flex gap-2">
          {INTERVALOS.map((opcao) => (
            <button
              key={opcao.value}
              type="button"
              aria-pressed={intervalo === opcao.value}
              onClick={() => setIntervalo(opcao.value)}
              className={cn(
                'min-h-11 flex-1 rounded-lg border text-sm font-medium transition-colors',
                intervalo === opcao.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted',
              )}
            >
              {opcao.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">O que este plano libera</legend>
        {recursos.map((recurso) => (
          <input key={recurso} type="hidden" name="features" value={recurso} />
        ))}
        <div className="flex flex-col gap-2">
          {RECURSOS_DISPONIVEIS.map((opcao) => (
            <button
              key={opcao.value}
              type="button"
              aria-pressed={recursos.includes(opcao.value)}
              onClick={() => alternar(opcao.value)}
              className={cn(
                'flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium transition-colors',
                recursos.includes(opcao.value)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted',
              )}
            >
              {opcao.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`stripe-${plano?.slug ?? 'novo'}`}>Identificador do preço no Stripe</Label>
        <Input
          id={`stripe-${plano?.slug ?? 'novo'}`}
          name="stripe_price_id"
          defaultValue={plano?.stripe_price_id ?? ''}
          placeholder="price_1AbC…"
          className="h-12 font-mono text-sm"
        />
        <p className="text-muted-foreground text-xs">
          Sem ele o plano aparece na tela, mas não dá para assinar.
        </p>
        {state.fieldErrors?.stripe_price_id ? (
          <p className="text-destructive text-sm">{state.fieldErrors.stripe_price_id}</p>
        ) : null}
      </div>

      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={plano?.is_active ?? true}
          className="accent-primary size-4"
        />
        Mostrar este plano na tela de Planos
      </label>

      <Button type="submit" className="h-12">
        {plano ? 'Salvar' : 'Criar plano'}
      </Button>
    </form>
  );
}
