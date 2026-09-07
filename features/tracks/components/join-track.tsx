'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { entrarNaTrilha, sairDaTrilha, type EstadoDaMatricula } from '@/features/tracks/actions';

/** Estado inicial: mora aqui porque `'use server'` só exporta função. */
const semErro: EstadoDaMatricula = { erro: null };

/**
 * Entrar e sair da trilha.
 *
 * Componente cliente por um motivo só, o mesmo do desafio: **mostrar o que
 * aconteceu.** Uma Server Action que devolve `void` revalida a página, deixa o
 * botão dizendo a mesma coisa e a pessoa sai sem saber se o toque valeu.
 */
export function JoinTrack({ slug, matriculado }: { slug: string; matriculado: boolean }) {
  const [estado, action] = useActionState<EstadoDaMatricula, FormData>(
    matriculado ? sairDaTrilha : entrarNaTrilha,
    semErro,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="slug" value={slug} />

      {estado.erro ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/8 text-destructive flex items-start gap-2 rounded-lg border p-3 text-sm"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {estado.erro}
        </p>
      ) : null}

      <Botao matriculado={matriculado} />

      <p className="text-muted-foreground text-center text-xs leading-relaxed">
        {matriculado
          ? // dito antes do clique: sair apaga o ponto de partida, e é isso que
            // faz a contagem recomeçar. Os treinos ficam no histórico.
            'Sair apaga o seu ponto de partida: voltar depois recomeça da sessão 1. Seus treinos continuam no histórico.'
          : 'A trilha é sua e só sua — ninguém vê em que sessão você está. Você pode sair quando quiser.'}
      </p>
    </form>
  );
}

function Botao({ matriculado }: { matriculado: boolean }) {
  const { pending } = useFormStatus();

  if (matriculado) {
    return (
      <Button type="submit" variant="outline" disabled={pending} className="h-12 w-full">
        {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        Sair da trilha
      </Button>
    );
  }

  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      className="h-14 w-full text-base font-semibold"
    >
      {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
      {pending ? 'ABRINDO…' : 'COMEÇAR A TRILHA'}
    </Button>
  );
}
