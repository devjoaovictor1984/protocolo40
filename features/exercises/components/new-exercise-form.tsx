'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CATEGORY_LABELS,
  createCustomExercise,
  MODALITY_LABELS,
  type CatalogExercise,
} from '@/features/exercises/catalog';
import { useSession } from '@/features/session/session-context';
import { cn } from '@/lib/utils';
import type { ExerciseCategory, ExerciseModality } from '@/types/database';

/**
 * Criar um exercício que não está na biblioteca.
 *
 * A modalidade define quais métricas fazem sentido depois — é a única pergunta
 * que o formulário faz além do nome.
 */
export function NewExerciseForm({ onCreated }: { onCreated: (exercise: CatalogExercise) => void }) {
  const { userId } = useSession();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('corpo_inteiro');
  const [modality, setModality] = useState<ExerciseModality>('reps');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" className="h-12 justify-start" onClick={() => setOpen(true)}>
        <Plus aria-hidden className="size-4" />
        Criar exercício
      </Button>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const exercise = await createCustomExercise({ userId, name, category, modality });
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'exercises'] });
      onCreated(exercise);
      setOpen(false);
      setName('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível criar o exercício.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-border flex flex-col gap-4 rounded-xl border p-4">
      {error ? (
        <p
          role="status"
          className="border-destructive/30 bg-destructive/8 text-destructive rounded-lg border p-3 text-sm"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="novo-exercicio">Nome</Label>
        <Input
          id="novo-exercicio"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Remada no TRX"
          maxLength={60}
          required
          autoFocus
          className="h-12 text-base"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Grupo</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Grupo muscular">
          {(Object.entries(CATEGORY_LABELS) as [ExerciseCategory, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
              className={cn(
                'min-h-9 rounded-lg border px-3 text-sm transition-colors',
                category === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Como você mede</span>
        <div className="flex gap-1.5" role="group" aria-label="Como o exercício é medido">
          {(Object.entries(MODALITY_LABELS) as [ExerciseModality, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={modality === value}
              onClick={() => setModality(value)}
              className={cn(
                'min-h-9 flex-1 rounded-lg border text-sm transition-colors',
                modality === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="h-12" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button type="submit" className="h-12 flex-1 font-semibold" disabled={saving || !name.trim()}>
          {saving ? 'Criando…' : 'Criar e adicionar'}
        </Button>
      </div>
    </form>
  );
}
