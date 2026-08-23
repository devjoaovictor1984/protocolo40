'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Play } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/features/session/session-context';
import { createTemplate } from '@/features/templates/repository';
import { ExerciseEditor } from '@/features/workouts/components/exercise-editor';
import { cn } from '@/lib/utils';
import type { WorkoutLevel } from '@/types/database';
import type { LocalWorkoutExercise } from '@/types/offline';

/**
 * Montar um treino próprio.
 *
 * A promessa é não precisar preencher tudo de novo toda vez: o circuito fica
 * salvo em Treinos e passa a ter USAR HOJE, recorde e última marca, igual aos
 * do sistema.
 *
 * O método é o mesmo de toda a biblioteca — repetir o circuito por 20 minutos —
 * então o formulário não pergunta isso: pergunta o circuito.
 */

const NIVEIS: { value: WorkoutLevel; label: string }[] = [
  { value: 'iniciante', label: 'Iniciante' },
  { value: 'intermediario', label: 'Moderado' },
  { value: 'avancado', label: 'Avançado' },
];

const OBJETIVOS = [
  { value: 'corpo_inteiro', label: 'Corpo inteiro' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'core', label: 'Core' },
  { value: 'superiores', label: 'Superiores' },
  { value: 'inferiores', label: 'Pernas' },
  { value: 'recuperacao_ativa', label: 'Recuperação' },
];

export function TemplateForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId, dailyGoalSeconds } = useSession();

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [minutos, setMinutos] = useState(String(Math.round(dailyGoalSeconds / 60)));
  const [nivel, setNivel] = useState<WorkoutLevel>('intermediario');
  const [objetivos, setObjetivos] = useState<string[]>([]);
  const [exercicios, setExercicios] = useState<LocalWorkoutExercise[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(iniciarDepois: boolean) {
    const duracao = Math.round(Number(minutos) * 60);

    if (titulo.trim().length < 2) {
      setErro('Dê um nome ao seu treino.');
      return;
    }
    if (exercicios.length === 0) {
      setErro('Adicione ao menos um exercício ao circuito.');
      return;
    }
    if (!Number.isFinite(duracao) || duracao < 60) {
      setErro('A duração precisa ser de pelo menos 1 minuto.');
      return;
    }

    setErro(null);
    setSalvando(true);

    try {
      const id = await createTemplate({
        userId,
        title: titulo.trim(),
        description: descricao.trim() || null,
        level: nivel,
        tags: objetivos,
        estimatedSeconds: duracao,
        exercises: exercicios,
      });

      await queryClient.invalidateQueries({ queryKey: ['catalog', 'templates'] });
      toast.success('Treino salvo.', { description: 'Ele já aparece em Treinos.' });

      router.replace(iniciarDepois ? `/treino/hoje?template=${id}&auto=1` : '/treinos/favoritos');
    } catch (caught) {
      setSalvando(false);
      setErro(caught instanceof Error ? caught.message : 'Não conseguimos salvar agora.');
    }
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="self-start" onClick={() => router.back()}>
          <ArrowLeft aria-hidden className="size-4" />
          Voltar
        </Button>

        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Montar meu treino</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Monte o circuito uma vez. Depois é só tocar em USAR HOJE — sem preencher nada de novo.
          </p>
        </div>
      </header>

      {erro ? (
        <p
          role="status"
          className="border-destructive/30 bg-destructive/8 text-destructive rounded-lg border p-3 text-sm"
        >
          {erro}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="titulo">Nome</Label>
        <Input
          id="titulo"
          value={titulo}
          onChange={(event) => setTitulo(event.target.value)}
          placeholder="Ex.: Meu 5•10•15"
          maxLength={80}
          className="h-12 text-base"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Nível</span>
        <div className="border-border flex rounded-xl border p-1" role="group" aria-label="Nível">
          {NIVEIS.map((opcao) => (
            <button
              key={opcao.value}
              type="button"
              aria-pressed={nivel === opcao.value}
              onClick={() => setNivel(opcao.value)}
              className={cn(
                'min-h-11 flex-1 rounded-lg text-sm font-medium transition-colors',
                nivel === opcao.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {opcao.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Objetivo</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Objetivo">
          {OBJETIVOS.map((opcao) => {
            const ativo = objetivos.includes(opcao.value);
            return (
              <button
                key={opcao.value}
                type="button"
                aria-pressed={ativo}
                onClick={() =>
                  setObjetivos((atual) =>
                    ativo ? atual.filter((item) => item !== opcao.value) : [...atual, opcao.value],
                  )
                }
                className={cn(
                  'min-h-10 rounded-full border px-4 text-sm font-medium transition-colors',
                  ativo
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted',
                )}
              >
                {opcao.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">O circuito</span>
        <p className="text-muted-foreground -mt-1 text-sm">
          Um round. Você repete quantas vezes conseguir no tempo.
        </p>
        <ExerciseEditor value={exercicios} onChange={setExercicios} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="minutos">Duração (min)</Label>
        <Input
          id="minutos"
          type="number"
          inputMode="numeric"
          min="1"
          max="1440"
          value={minutos}
          onChange={(event) => setMinutos(event.target.value)}
          className="tnum h-12 w-32 text-base"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="descricao">Observação (opcional)</Label>
        <Textarea
          id="descricao"
          value={descricao}
          onChange={(event) => setDescricao(event.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Ex.: descansar 1 minuto entre os rounds"
        />
      </div>

      <div className="flex flex-col gap-2 pt-2">
        <Button
          className="h-14 text-base font-bold"
          disabled={salvando}
          onClick={() => void salvar(true)}
        >
          <Play aria-hidden className="size-4" />
          {salvando ? 'Salvando…' : 'SALVAR E COMEÇAR AGORA'}
        </Button>

        <Button
          variant="outline"
          className="h-12"
          disabled={salvando}
          onClick={() => void salvar(false)}
        >
          Salvar para depois
        </Button>
      </div>
    </div>
  );
}
