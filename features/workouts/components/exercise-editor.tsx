'use client';

import { useId, useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { CATEGORY_LABELS, useExercises, type CatalogExercise } from '@/features/exercises/catalog';
import { NewExerciseForm } from '@/features/exercises/components/new-exercise-form';
import { cn } from '@/lib/utils';
import type { LocalWorkoutExercise } from '@/types/offline';

/**
 * Editor de exercícios de um treino.
 *
 * Progressive disclosure: a lista mostra só o essencial, e os campos de métrica
 * que aparecem dependem de como o exercício é medido. Ninguém precisa preencher
 * carga numa flexão.
 */
export function ExerciseEditor({
  value,
  onChange,
}: {
  value: LocalWorkoutExercise[];
  onChange: (next: LocalWorkoutExercise[]) => void;
}) {
  const [open, setOpen] = useState(false);

  function add(exercise: CatalogExercise) {
    const item: LocalWorkoutExercise = {
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      sets: null,
      repetitions: exercise.modality === 'reps' || exercise.modality === 'load' ? 10 : null,
      duration_seconds: exercise.modality === 'time' ? 30 : null,
      distance_meters: exercise.modality === 'distance' ? 1000 : null,
      weight_kg: null,
      order_index: value.length,
      notes: null,
    };

    onChange([...value, item]);
    setOpen(false);
  }

  function update(index: number, patch: Partial<LocalWorkoutExercise>) {
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index).map((item, i) => ({ ...item, order_index: i })));
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {value.map((item, index) => (
            <li key={`${item.exercise_id}-${index}`} className="border-border rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{item.exercise_name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  aria-label={`Remover ${item.exercise_name}`}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MetricField
                  label="Séries"
                  value={item.sets}
                  onChange={(next) => update(index, { sets: next })}
                />
                <MetricField
                  label="Repetições"
                  value={item.repetitions}
                  onChange={(next) => update(index, { repetitions: next })}
                />
                <MetricField
                  label="Tempo (s)"
                  value={item.duration_seconds}
                  onChange={(next) => update(index, { duration_seconds: next })}
                />
                <MetricField
                  label="Carga (kg)"
                  value={item.weight_kg}
                  step="0.5"
                  onChange={(next) => update(index, { weight_kg: next })}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger
          render={
            <Button variant="outline" className="h-12 justify-start">
              <Plus aria-hidden className="size-4" />
              Adicionar exercício
            </Button>
          }
        />
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Adicionar exercício</DrawerTitle>
          </DrawerHeader>
          <ExercisePicker onPick={add} />
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function MetricField({
  label,
  value,
  step = '1',
  onChange,
}: {
  label: string;
  value: number | null;
  step?: string;
  onChange: (value: number | null) => void;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min="0"
        value={value ?? ''}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === '' ? null : Number(raw));
        }}
        className="tnum h-11"
      />
    </div>
  );
}

function ExercisePicker({ onPick }: { onPick: (exercise: CatalogExercise) => void }) {
  const { data, isLoading } = useExercises();
  const [term, setTerm] = useState('');

  const groups = useMemo(() => {
    const filtered = (data ?? []).filter((exercise) =>
      exercise.name.toLowerCase().includes(term.trim().toLowerCase()),
    );

    const map = new Map<string, CatalogExercise[]>();
    for (const exercise of filtered) {
      const key = CATEGORY_LABELS[exercise.category];
      map.set(key, [...(map.get(key) ?? []), exercise]);
    }
    return [...map.entries()];
  }, [data, term]);

  return (
    <div className="flex max-h-[70vh] flex-col gap-3 px-4 pb-8">
      <div className="relative">
        <Search aria-hidden className="text-muted-foreground absolute top-3.5 left-3 size-4" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar exercício"
          aria-label="Buscar exercício"
          className="h-12 pl-9"
        />
      </div>

      <NewExerciseForm onCreated={onPick} />

      {isLoading ? (
        <p className="text-muted-foreground py-8 text-center text-sm">Carregando exercícios…</p>
      ) : groups.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          Nenhum exercício com esse nome. Crie um acima.
        </p>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {groups.map(([category, exercises]) => (
            <section key={category} className="mb-4">
              <h3 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wider uppercase">
                {category}
              </h3>
              <ul>
                {exercises.map((exercise) => (
                  <li key={exercise.id}>
                    <button
                      type="button"
                      onClick={() => onPick(exercise)}
                      className={cn(
                        'hover:bg-muted flex min-h-12 w-full items-center justify-between rounded-lg px-3 text-left transition-colors',
                      )}
                    >
                      <span className="font-medium">{exercise.name}</span>
                      {exercise.isCustom ? (
                        <span className="text-muted-foreground text-xs">seu</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
