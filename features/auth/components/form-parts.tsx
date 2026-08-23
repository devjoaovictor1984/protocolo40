'use client';

import { useFormStatus } from 'react-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { ActionState } from '@/lib/forms/action-state';

type FieldProps = React.ComponentProps<'input'> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
};

export function Field({ label, name, error, hint, className, ...props }: FieldProps) {
  const errorId = `${name}-erro`;
  const hintId = `${name}-dica`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(error && errorId, hint && hintId) || undefined}
        className={cn('h-12 text-base', className)}
        {...props}
      />
      {hint && !error ? (
        <p id={hintId} className="text-muted-foreground text-sm">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-destructive flex items-center gap-1.5 text-sm">
          <AlertCircle aria-hidden className="size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** O estado só é comunicado por cor junto com ícone e texto. */
export function FormMessage({ state }: { state: ActionState }) {
  if (state.status === 'idle' || !state.message) return null;

  const isError = state.status === 'error';
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-start gap-2 rounded-lg border p-3 text-sm',
        isError
          ? 'border-destructive/30 bg-destructive/8 text-destructive'
          : 'border-success/30 bg-success/8 text-success',
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{state.message}</span>
    </p>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
      {pending ? (
        <>
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Aguarde
        </>
      ) : (
        children
      )}
    </Button>
  );
}
