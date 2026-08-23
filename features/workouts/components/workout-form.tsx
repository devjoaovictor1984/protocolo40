'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSession, useToday } from '@/features/session/session-context';
import { ExerciseEditor } from '@/features/workouts/components/exercise-editor';
import { saveWorkout } from '@/features/workouts/repository';
import { PLACES } from '@/lib/validation/profile';
import { cn } from '@/lib/utils';
import type { WorkoutPlace } from '@/types/database';
import type { LocalWorkout, LocalWorkoutExercise } from '@/types/offline';
import { recarregar } from '@/lib/query/refresh';

/**
 * Registro manual de treino.
 *
 * Serve para quem treinou sem o cronômetro e quer anotar depois, e para corrigir
 * um treino já salvo. Mesmo formulário, mesma gravação local-first.
 */
export function WorkoutForm({ workout }: { workout?: LocalWorkout }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId } = useSession();
  const today = useToday();

  const editing = workout !== undefined;

  const [title, setTitle] = useState(workout?.title ?? '');
  const [date, setDate] = useState(workout?.workout_date ?? today);
  const [minutes, setMinutes] = useState(
    workout ? String(Math.round(workout.duration_seconds / 60)) : '20',
  );
  const [rounds, setRounds] = useState(workout?.rounds ? String(workout.rounds) : '');
  const [effort, setEffort] = useState(workout?.effort ?? 0);
  const [place, setPlace] = useState<WorkoutPlace | ''>(workout?.location ?? '');
  const [notes, setNotes] = useState(workout?.notes ?? '');
  const [exercises, setExercises] = useState<LocalWorkoutExercise[]>(workout?.exercises ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const duration = Math.round(Number(minutes) * 60);

    if (!Number.isFinite(duration) || duration <= 0) {
      setError('Informe quantos minutos você treinou.');
      return;
    }
    if (duration > 86_400) {
      setError('A duração precisa ser menor que 24 horas.');
      return;
    }
    if (date > today) {
      setError('Não dá para registrar um treino no futuro.');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const startedAt = workout?.started_at ?? new Date(`${date}T12:00:00`).toISOString();

      await saveWorkout({
        clientId: workout?.client_id ?? crypto.randomUUID(),
        userId,
        templateId: workout?.template_id ?? null,
        templateTitle: workout?.template_title ?? null,
        title: title.trim() || null,
        startedAt,
        finishedAt: new Date(new Date(startedAt).getTime() + duration * 1000).toISOString(),
        durationSeconds: duration,
        workoutDate: date,
        rounds: rounds ? Number(rounds) : null,
        effort: effort > 0 ? effort : null,
        location: place || null,
        notes: notes.trim() || null,
        exercises,
      });

      await recarregar(queryClient, ['workouts']);
      toast.success(editing ? 'Treino atualizado.' : 'Treino registrado.');
      router.replace(editing ? `/treino/${workout.client_id}` : '/app');
    } catch {
      setSaving(false);
      setError('Não conseguimos salvar agora. Tente novamente.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {editing ? 'Editar treino' : 'Registrar treino'}
        </h1>
        <p className="text-muted-foreground text-sm">
          Qualquer duração vale. Dez minutos contam tanto quanto sessenta.
        </p>
      </header>

      {error ? (
        <p
          role="status"
          className="border-destructive/30 bg-destructive/8 text-destructive rounded-lg border p-3 text-sm"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="titulo">Nome do treino</Label>
        <Input
          id="titulo"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Tom Holland, treino livre, pernas…"
          maxLength={80}
          className="h-12 text-base"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="data">Data</Label>
          <Input
            id="data"
            type="date"
            value={date}
            max={today}
            onChange={(event) => setDate(event.target.value)}
            className="h-12 text-base"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="minutos">Duração (min)</Label>
          <Input
            id="minutos"
            type="number"
            inputMode="numeric"
            min="1"
            max="1440"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            className="tnum h-12 text-base"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="rounds">Rounds</Label>
          <Input
            id="rounds"
            type="number"
            inputMode="numeric"
            min="0"
            max="999"
            value={rounds}
            onChange={(event) => setRounds(event.target.value)}
            placeholder="Opcional"
            className="tnum h-12 text-base"
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Onde</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Onde você treinou">
            {PLACES.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={place === option.value}
                onClick={() => setPlace(place === option.value ? '' : option.value)}
                className={cn(
                  'min-h-9 rounded-lg border px-3 text-sm transition-colors',
                  place === option.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Como foi o esforço</legend>
        <div className="flex gap-1" role="group" aria-label="Esforço percebido de 1 a 10">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={effort === value}
              aria-label={`Esforço ${value} de 10`}
              onClick={() => setEffort(effort === value ? 0 : value)}
              className={cn(
                'tnum h-10 flex-1 rounded-lg border text-sm font-medium transition-colors',
                effort >= value && effort > 0
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border hover:bg-muted',
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Exercícios</span>
        <ExerciseEditor value={exercises} onChange={setExercises} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="obs">Observações</Label>
        <Textarea
          id="obs"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Opcional"
        />
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="h-12" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" className="h-12 flex-1 text-base font-semibold" disabled={saving}>
          {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Registrar treino'}
        </Button>
      </div>
    </form>
  );
}
