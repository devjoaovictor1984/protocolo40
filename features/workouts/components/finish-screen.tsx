'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Check, ChevronDown, Dumbbell, NotebookPen, Scale } from 'lucide-react';
import { toast } from 'sonner';

import { RecordBadge } from '@/components/stats';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { saveMeasurement } from '@/features/measurements/repository';
import { savePhoto } from '@/features/photos/repository';
import { useSession, useToday } from '@/features/session/session-context';
import { ExerciseEditor } from '@/features/workouts/components/exercise-editor';
import { updateWorkoutFields } from '@/features/workouts/repository';
import { useRecordBook, useWorkout } from '@/features/workouts/use-workout';
import { previewUrl } from '@/lib/storage/image-pipeline';
import { cn } from '@/lib/utils';
import { formatDurationShort } from '@/services/duration';
import { detectRecords, metricLabel } from '@/services/records';
import { protocolDay } from '@/services/streak';
import type { LocalWorkoutExercise } from '@/types/offline';
import { recarregar } from '@/lib/query/refresh';

/**
 * Depois do treino.
 *
 * O treino já está salvo quando esta tela abre. Tudo aqui é opcional, e a
 * ordem importa: primeiro o reconhecimento do que foi feito, depois os extras.
 */
export function FinishScreen({ clientId }: { clientId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId, protocolStartedOn } = useSession();
  const today = useToday();

  const { data: workout, isLoading } = useWorkout(clientId);
  const { data: recordBook } = useRecordBook();

  const [exercises, setExercises] = useState<LocalWorkoutExercise[] | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [weight, setWeight] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-bold">Não encontramos este treino no aparelho.</p>
        <p className="text-muted-foreground text-sm">
          Ele pode ter sido sincronizado e removido do cache local.
        </p>
        <Button onClick={() => router.replace('/app')}>Voltar para o meu dia</Button>
      </div>
    );
  }

  const currentExercises = exercises ?? workout.exercises;
  const day = protocolDay(protocolStartedOn, workout.workout_date);

  const newRecords = recordBook
    ? detectRecords(
        {
          durationSeconds: workout.duration_seconds,
          rounds: workout.rounds,
          exercises: currentExercises.map((item) => ({
            exerciseId: item.exercise_id,
            sets: item.sets,
            repetitions: item.repetitions,
            duration_seconds: item.duration_seconds,
            distance_meters: item.distance_meters,
            weight_kg: item.weight_kg,
          })),
        },
        recordBook,
      )
    : [];

  async function handlePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setSavingPhoto(true);
    try {
      const saved = await savePhoto({
        userId,
        file,
        takenOn: today,
        workoutClientId: clientId,
        weightKg: weight ? Number(weight) : null,
      });
      setPhotoPreview(previewUrl(saved.thumbnail));
      toast.success('Foto guardada.', { description: 'Ela é privada — só você vê.' });
    } catch (error) {
      toast.error('Não foi possível preparar a foto.', {
        description: error instanceof Error ? error.message : 'Tente outra imagem.',
      });
    } finally {
      setSavingPhoto(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function handleFinish() {
    setFinishing(true);

    try {
      if (exercises !== null || notes !== null) {
        await updateWorkoutFields(clientId, {
          ...(exercises !== null ? { exercises } : {}),
          ...(notes !== null ? { notes: notes.trim() || null } : {}),
        });
      }

      if (weight.trim()) {
        await saveMeasurement({ userId, measuredOn: today, weightKg: Number(weight) });
      }

      await recarregar(queryClient, ['workouts'], ['sync', 'queue']);

      router.replace('/app');
    } catch {
      setFinishing(false);
      toast.error('Não conseguimos salvar os extras.', {
        description: 'Seu treino continua registrado. Tente de novo.',
      });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="bg-success/12 text-success flex size-16 items-center justify-center rounded-2xl">
          <Check aria-hidden className="size-8" />
        </span>

        <h1 className="text-3xl font-extrabold tracking-tight">TREINO CONCLUÍDO 🔥</h1>

        <p className="text-muted-foreground tnum">
          {formatDurationShort(workout.duration_seconds)} · Dia {day}
          {workout.rounds ? ` · ${workout.rounds} rounds` : ''}
        </p>

        {newRecords.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {newRecords.map((record) => (
              <RecordBadge key={`${record.exerciseId}-${record.metric}`}>
                Novo recorde de {metricLabel(record.metric)}
              </RecordBadge>
            ))}
          </div>
        ) : null}
      </header>

      <div className="flex flex-col gap-2">
        <Section icon={Dumbbell} title="Registrar exercícios" count={currentExercises.length}>
          <ExerciseEditor value={currentExercises} onChange={setExercises} />
        </Section>

        <Section icon={Camera} title="Foto de evolução" done={photoPreview !== null}>
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              Toda foto nasce privada. Você decide depois se quer mostrar.
            </p>

            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- blob local, sem otimização do Next
              <img
                src={photoPreview}
                alt="Prévia da foto de hoje"
                className="border-border max-h-56 w-full rounded-xl border object-cover"
              />
            ) : null}

            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => void handlePhoto(event)}
              className="sr-only"
              id="foto-evolucao"
            />
            <Button
              variant="outline"
              className="h-12"
              disabled={savingPhoto}
              onClick={() => fileInput.current?.click()}
            >
              <Camera aria-hidden className="size-4" />
              {savingPhoto ? 'Preparando…' : photoPreview ? 'Trocar foto' : 'Tirar ou escolher foto'}
            </Button>
          </div>
        </Section>

        <Section icon={Scale} title="Peso de hoje" done={weight.trim() !== ''}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="peso">Peso em kg</Label>
            <Input
              id="peso"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="20"
              max="400"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              placeholder="Ex.: 86,4"
              className="tnum h-12 text-base"
            />
          </div>
        </Section>

        <Section icon={NotebookPen} title="Observações" done={(notes ?? '').trim() !== ''}>
          <Textarea
            value={notes ?? workout.notes ?? ''}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Como foi o treino? O que dá para melhorar amanhã?"
            rows={4}
            maxLength={1000}
          />
        </Section>
      </div>

      <div className="mt-auto flex flex-col gap-3 pt-4">
        <Button
          className="h-14 text-base font-bold"
          onClick={() => void handleFinish()}
          disabled={finishing}
        >
          {finishing ? 'Salvando…' : 'CONCLUIR'}
        </Button>
        <p className="text-muted-foreground text-center text-xs">
          Tudo acima é opcional. O treino já está salvo.
        </p>
      </div>
    </div>
  );
}

/** Bloco que abre sob demanda: a tela começa curta e cresce se o usuário quiser. */
function Section({
  icon: Icon,
  title,
  count,
  done,
  children,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  count?: number;
  done?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const filled = done || (count !== undefined && count > 0);

  return (
    <div className="border-border overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="hover:bg-muted flex min-h-14 w-full items-center gap-3 px-4 text-left transition-colors"
      >
        <Icon aria-hidden className={cn('size-5 shrink-0', filled ? 'text-success' : 'text-muted-foreground')} />
        <span className="flex-1 font-medium">{title}</span>
        {count !== undefined && count > 0 ? (
          <span className="text-muted-foreground tnum text-sm">{count}</span>
        ) : null}
        {filled && count === undefined ? <Check aria-hidden className="text-success size-4" /> : null}
        <ChevronDown
          aria-hidden
          className={cn('text-muted-foreground size-4 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open ? <div className="border-border border-t p-4">{children}</div> : null}
    </div>
  );
}
