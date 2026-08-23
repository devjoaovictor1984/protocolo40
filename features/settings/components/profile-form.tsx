'use client';

import { useActionState, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateProfile } from '@/features/settings/actions';
import { idleState } from '@/lib/forms/action-state';
import { GOALS, LEVELS, PLACES, SEXOS } from '@/lib/validation/profile';
import { cn } from '@/lib/utils';
import type { ProfileRow } from '@/types/database';

/** Edição do perfil. Os mesmos campos do onboarding, agora sem pressa. */
export function ProfileForm({ profile }: { profile: ProfileRow }) {
  const [state, action] = useActionState(updateProfile, idleState);
  const [goal, setGoal] = useState(profile.goal ?? '');
  const [level, setLevel] = useState(profile.level);
  const [place, setPlace] = useState(profile.default_location);
  const [sexo, setSexo] = useState<string>(profile.biological_sex);

  return (
    <form action={action} className="flex flex-col gap-5">
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="full_name">Nome</Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={profile.full_name ?? ''}
          maxLength={80}
          className="h-12 text-base"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="username">Nome de usuário</Label>
        <Input
          id="username"
          name="username"
          defaultValue={profile.username}
          aria-invalid={state.fieldErrors?.username ? true : undefined}
          className="h-12 text-base"
        />
        {state.fieldErrors?.username ? (
          <p className="text-destructive text-sm">{state.fieldErrors.username}</p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Seu endereço público seria /u/{profile.username}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" name="bio" defaultValue={profile.bio ?? ''} rows={3} maxLength={280} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="height_cm">Altura (cm)</Label>
          <Input
            id="height_cm"
            name="height_cm"
            type="number"
            inputMode="numeric"
            min="80"
            max="260"
            defaultValue={profile.height_cm ?? ''}
            className="tnum h-12 text-base"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="birth_date">Nascimento</Label>
          <Input
            id="birth_date"
            name="birth_date"
            type="date"
            defaultValue={profile.birth_date ?? ''}
            className="h-12 text-base"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="protocol_started_on">Comecei o protocolo em</Label>
        <Input
          id="protocol_started_on"
          name="protocol_started_on"
          type="date"
          defaultValue={profile.protocol_started_on}
          className="h-12 text-base"
        />
        <p className="text-muted-foreground text-xs">
          É a data do seu Dia 1. Se você já treinava antes de instalar o app, coloque o dia em que
          começou de verdade — as fotos e os treinos antigos entram na contagem certa.
        </p>
      </div>

      <ChipField
        label="Sexo biológico"
        name="biological_sex"
        options={SEXOS}
        value={sexo}
        onChange={setSexo}
        required
      />
      <p className="text-muted-foreground -mt-3 text-xs">
        Usado apenas para estimar o gasto calórico na tela de Saúde. Sem ele, a estimativa é a
        média das duas equações.
      </p>

      <ChipField label="Objetivo" name="goal" options={GOALS} value={goal} onChange={setGoal} />
      <ChipField
        label="Nível"
        name="level"
        options={LEVELS}
        value={level}
        onChange={(next) => setLevel(next as typeof level)}
        required
      />
      <ChipField
        label="Onde você treina"
        name="default_location"
        options={PLACES}
        value={place}
        onChange={(next) => setPlace(next as typeof place)}
        required
      />

      <Button type="submit" className="h-12 font-semibold">
        Salvar perfil
      </Button>
    </form>
  );
}

function ChipField({
  label,
  name,
  options,
  value,
  onChange,
  required,
}: {
  label: string;
  name: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(required && active ? value : active ? '' : option.value)}
              className={cn(
                'min-h-11 rounded-xl border px-4 text-sm font-medium transition-colors',
                active ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
