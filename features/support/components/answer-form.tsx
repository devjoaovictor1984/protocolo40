'use client';

import { useActionState, useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { answerTicket } from '@/features/support/actions';
import { idleState } from '@/lib/forms/action-state';
import { cn } from '@/lib/utils';
import { TICKET_STATUS } from '@/lib/validation/support';
import { formatDay } from '@/services/calendar';
import type { TicketStatus } from '@/types/database';

/** Resposta do admin. O status muda junto, porque uma coisa segue a outra. */
export function AnswerForm({
  id,
  status,
  answer,
  respondidoEm,
}: {
  id: string;
  status: TicketStatus;
  answer: string | null;
  respondidoEm: string | null;
}) {
  const [state, action] = useActionState(answerTicket, idleState);
  const [escolhido, setEscolhido] = useState<string>(status);

  return (
    <form action={action} className="border-border flex flex-col gap-4 rounded-xl border p-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={escolhido} />

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
          {state.status === 'success' ? (
            <CheckCircle2 aria-hidden className="mt-0.5 size-4" />
          ) : null}
          {state.message}
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Status</legend>
        <div className="grid grid-cols-2 gap-2">
          {TICKET_STATUS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={escolhido === option.value}
              onClick={() => setEscolhido(option.value)}
              className={cn(
                'min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors',
                escolhido === option.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="answer">Resposta para quem escreveu</Label>
        <Textarea id="answer" name="answer" rows={5} maxLength={4000} defaultValue={answer ?? ''} />
        {respondidoEm ? (
          <p className="text-muted-foreground text-xs">
            Respondido em {formatDay(respondidoEm.slice(0, 10))}.
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            O texto aparece na tela de ajuda de quem abriu o chamado.
          </p>
        )}
      </div>

      <Button type="submit" className="h-12">
        <Send aria-hidden className="size-4" />
        Salvar
      </Button>
    </form>
  );
}
