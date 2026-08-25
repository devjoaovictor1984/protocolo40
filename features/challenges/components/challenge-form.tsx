'use client';

import { useActionState } from 'react';
import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { salvarDesafio, type EstadoDoFormulario } from '@/features/challenges/admin-actions';
import { cn } from '@/lib/utils';
import type { ChallengeRow } from '@/types/database';

const inicial: EstadoDoFormulario = { status: 'idle' };

/** Edição de um desafio. `desafio` nulo cria um novo. */
export function ChallengeForm({
  desafio,
  insignias,
}: {
  desafio: ChallengeRow | null;
  insignias: { slug: string; name: string }[];
}) {
  const [state, action] = useActionState(salvarDesafio, inicial);
  const id = desafio?.id ?? 'novo';

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.status !== 'idle' && state.mensagem ? (
        <p
          role="status"
          className={cn(
            'flex items-start gap-2 rounded-lg border p-3 text-sm',
            state.status === 'erro'
              ? 'border-destructive/30 bg-destructive/8 text-destructive'
              : 'border-success/30 bg-success/8 text-success',
          )}
        >
          {state.status === 'ok' ? <CheckCircle2 aria-hidden className="mt-0.5 size-4" /> : null}
          {state.mensagem}
        </p>
      ) : null}

      {desafio ? <input type="hidden" name="id" value={desafio.id} /> : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor={`title-${id}`}>Nome</Label>
        <Input
          id={`title-${id}`}
          name="title"
          defaultValue={desafio?.title ?? ''}
          placeholder="Desafio de Outubro"
          className="h-12"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`slug-${id}`}>Endereço</Label>
        <Input
          id={`slug-${id}`}
          name="slug"
          defaultValue={desafio?.slug ?? ''}
          placeholder="outubro-2026"
          className="h-12"
          required
        />
        {/* o endereço entra na URL e é o que a pessoa compartilha; trocar depois
            quebraria os links já enviados */}
        <p className="text-muted-foreground text-xs">
          Vira o endereço da página: /desafios/<span className="font-mono">endereco</span>. Só
          minúsculas, números e hífen — e melhor não mudar depois que alguém já compartilhou.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`tagline-${id}`}>Frase curta</Label>
        <Input
          id={`tagline-${id}`}
          name="tagline"
          defaultValue={desafio?.tagline ?? ''}
          placeholder="20 minutos. Todos os dias."
          className="h-12"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`description-${id}`}>A ideia do desafio</Label>
        <Textarea
          id={`description-${id}`}
          name="description"
          defaultValue={desafio?.description ?? ''}
          rows={8}
          placeholder="Por que este desafio existe, o que ele cobra e o que acontece se falhar um dia."
          required
        />
        <p className="text-muted-foreground text-xs">
          Linha em branco separa parágrafos. É o texto que convence alguém a entrar — vale escrever
          com calma.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`starts-${id}`}>Começa em</Label>
          <Input
            id={`starts-${id}`}
            name="starts_on"
            type="date"
            defaultValue={desafio?.starts_on ?? ''}
            className="h-12"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`ends-${id}`}>Termina em</Label>
          <Input
            id={`ends-${id}`}
            name="ends_on"
            type="date"
            defaultValue={desafio?.ends_on ?? ''}
            className="h-12"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`goal-${id}`}>Dias para concluir</Label>
          <Input
            id={`goal-${id}`}
            name="goal"
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={desafio?.goal ?? 25}
            className="h-12"
            required
          />
          <p className="text-muted-foreground text-xs">
            Deixe folga: um desafio sem margem quebra na primeira gripe e a pessoa abandona o mês.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`badge-${id}`}>Insígnia ao concluir</Label>
          <select
            id={`badge-${id}`}
            name="badge_slug"
            defaultValue={desafio?.badge_slug ?? ''}
            className="border-input bg-background h-12 rounded-md border px-3 text-sm"
          >
            <option value="">Nenhuma</option>
            {insignias.map((insignia) => (
              <option key={insignia.slug} value={insignia.slug}>
                {insignia.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={desafio?.is_active ?? true}
          className="accent-primary size-5"
        />
        Aparecer para todo mundo
      </label>

      <Button type="submit" className="h-12">
        {desafio ? 'Salvar' : 'Criar desafio'}
      </Button>
    </form>
  );
}
