'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Play } from 'lucide-react';

import { Wordmark } from '@/components/brand/wordmark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  completeOnboarding,
  idleOnboarding,
  skipOnboarding,
} from '@/features/onboarding/actions';
import { GOALS, LEVELS, PLACES } from '@/lib/validation/profile';
import { cn } from '@/lib/utils';

/**
 * Primeiro acesso.
 *
 * Três passos curtos, todos puláveis. O objetivo não é montar um cadastro
 * completo: é chegar ao primeiro treino o mais rápido possível.
 */
export function OnboardingFlow({
  defaultUsername,
  defaultName,
}: {
  defaultUsername: string;
  defaultName: string | null;
}) {
  const router = useRouter();
  const [state, action] = useActionState(completeOnboarding, idleOnboarding);
  const [step, setStep] = useState(0);
  const [skipping, startSkip] = useTransition();

  if (state.status === 'success') {
    return <DayOne />;
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-6">
      <header className="flex items-center justify-between gap-4">
        <Wordmark href={null} />
        <Button
          variant="ghost"
          size="sm"
          disabled={skipping}
          onClick={() =>
            startSkip(async () => {
              await skipOnboarding();
              router.replace('/app');
            })
          }
        >
          Pular
        </Button>
      </header>

      <div className="mt-6 flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              index <= step ? 'bg-primary' : 'bg-secondary',
            )}
          />
        ))}
      </div>
      <p className="text-muted-foreground mt-2 text-xs">Passo {step + 1} de 3</p>

      <form action={action} className="mt-6 flex flex-1 flex-col">
        <input type="hidden" name="timezone" value={timezone} />

        {/* Todos os passos ficam montados: o formulário é enviado inteiro no fim,
            e voltar um passo não perde o que já foi digitado. */}
        <fieldset className={cn('flex flex-col gap-6', step !== 0 && 'hidden')}>
          <legend className="sr-only">Quem é você</legend>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Como podemos te chamar?</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Só o necessário. O resto você completa quando quiser.
            </p>
          </div>

          <Field
            label="Nome"
            name="full_name"
            defaultValue={defaultName ?? ''}
            placeholder="João"
            autoComplete="given-name"
            error={state.fieldErrors?.full_name}
          />
          <Field
            label="Nome de usuário"
            name="username"
            defaultValue={defaultUsername}
            hint="Aparece no seu perfil público, se você ativar um."
            error={state.fieldErrors?.username}
          />
        </fieldset>

        <fieldset className={cn('flex flex-col gap-6', step !== 1 && 'hidden')}>
          <legend className="sr-only">Seu objetivo</legend>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">O que te trouxe aqui?</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Usamos isso para sugerir treinos — nada fica travado por causa da resposta.
            </p>
          </div>

          <ChoiceGroup label="Objetivo" name="goal" options={GOALS} />
          <ChoiceGroup label="Nível" name="level" options={LEVELS} defaultValue="iniciante" required />
          <ChoiceGroup
            label="Onde você treina"
            name="default_location"
            options={PLACES}
            defaultValue="casa"
            required
          />
        </fieldset>

        <fieldset className={cn('flex flex-col gap-6', step !== 2 && 'hidden')}>
          <legend className="sr-only">Ponto de partida</legend>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Seu ponto de partida</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Serve para você comparar depois. Pode deixar em branco e preencher outro dia.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Altura (cm)"
              name="height_cm"
              type="number"
              inputMode="numeric"
              min="80"
              max="260"
              placeholder="178"
              error={state.fieldErrors?.height_cm}
            />
            <Field
              label="Peso (kg)"
              name="weight_kg"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="20"
              max="400"
              placeholder="86,4"
            />
          </div>

          <Field
            label="Data de nascimento"
            name="birth_date"
            type="date"
            hint="Opcional. O 40 é o nome do método, não uma regra de idade."
            error={state.fieldErrors?.birth_date}
          />
        </fieldset>

        {state.status === 'error' && state.message ? (
          <p
            role="status"
            className="border-destructive/30 bg-destructive/8 text-destructive mt-6 rounded-lg border p-3 text-sm"
          >
            {state.message}
          </p>
        ) : null}

        <div className="mt-auto flex gap-3 pt-8">
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="h-12"
              onClick={() => setStep((value) => value - 1)}
            >
              <ArrowLeft aria-hidden className="size-4" />
              Voltar
            </Button>
          ) : null}

          {step < 2 ? (
            <Button
              type="button"
              className="h-12 flex-1 text-base"
              onClick={() => setStep((value) => value + 1)}
            >
              Continuar
              <ArrowRight aria-hidden className="size-4" />
            </Button>
          ) : (
            <Button type="submit" className="h-12 flex-1 text-base font-semibold">
              Começar meu protocolo
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  hint,
  error,
  ...props
}: React.ComponentProps<'input'> & { label: string; name: string; hint?: string; error?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-erro` : hint ? `${name}-dica` : undefined}
        className="h-12 text-base"
        {...props}
      />
      {hint && !error ? (
        <p id={`${name}-dica`} className="text-muted-foreground text-sm">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-erro`} className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ChoiceGroup({
  label,
  name,
  options,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  options: readonly { value: string; label: string; hint?: string }[];
  defaultValue?: string;
  required?: boolean;
}) {
  const [selected, setSelected] = useState(defaultValue ?? '');

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <input type="hidden" name={name} value={selected} />

      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => {
          const active = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(required && active ? selected : active ? '' : option.value)}
              className={cn(
                'min-h-11 rounded-xl border px-4 text-sm font-medium transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {options.find((option) => option.value === selected)?.hint ? (
        <p className="text-muted-foreground text-sm">
          {options.find((option) => option.value === selected)?.hint}
        </p>
      ) : null}
    </div>
  );
}

/** A tela que fecha o cadastro: um número, uma frase e um botão. */
function DayOne() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      <div>
        <p className="text-primary text-sm font-bold tracking-[0.24em] uppercase">Dia 1</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-balance">
          Seu protocolo começa hoje.
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xs text-balance">
          Vinte minutos é a referência. Menos também conta. O que não conta é o dia passar em branco.
        </p>
      </div>

      <Button
        render={<Link href="/treino/hoje?auto=1" />}
        className="h-16 w-full max-w-sm text-base font-bold"
      >
        <Play aria-hidden className="size-5" />
        INICIAR MEUS 20 MINUTOS
      </Button>

      <Link href="/app" className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4">
        Prefiro conhecer o app primeiro
      </Link>
    </div>
  );
}
