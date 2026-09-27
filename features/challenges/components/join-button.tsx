'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  entrarNoDesafio,
  sairDoDesafio,
  type EstadoDaInscricao,
} from '@/features/challenges/actions';

/** Estado inicial: mora aqui porque `'use server'` só exporta função. */
const semErro: EstadoDaInscricao = { erro: null };

/**
 * Entrar e sair do desafio.
 *
 * Existe como componente cliente por um motivo só: **mostrar o que aconteceu.**
 * A versão anterior era um `<form>` com Server Action que devolvia `void` — se
 * a inscrição falhasse, a página revalidava, o botão continuava dizendo
 * "ENTRAR NO DESAFIO" e a pessoa saía achando que estava inscrita. Foi
 * exatamente o que aconteceu: alguém clicou, não entrou, e não teve como saber.
 */
export function JoinButton({
  slug,
  participando,
  dataPessoal = null,
}: {
  slug: string;
  participando: boolean;
  /**
   * Desafio de data pessoal: a pessoa escolhe o início entre `min` e `max`.
   * Nulo nos de janela única, em que a data é a mesma para todo mundo.
   */
  dataPessoal?: { min: string; max: string; duracao: number } | null;
}) {
  const [estado, action] = useActionState<EstadoDaInscricao, FormData>(
    participando ? sairDoDesafio : entrarNoDesafio,
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

      {!participando && dataPessoal ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`inicio-${slug}`}>Quando você começa?</Label>
          <Input
            id={`inicio-${slug}`}
            name="started_on"
            type="date"
            defaultValue={dataPessoal.min}
            min={dataPessoal.min}
            max={dataPessoal.max}
            className="h-12"
            required
          />
          <p className="text-muted-foreground text-xs">
            Hoje ou até 30 dias à frente. Seus {dataPessoal.duracao} dias contam a partir daí.
          </p>
        </div>
      ) : null}

      <Botao participando={participando} rotulo={dataPessoal ? `COMEÇAR MEUS ${dataPessoal.duracao} DIAS` : null} />

      {participando ? null : (
        // dito antes do clique, não depois: entrar coloca a pessoa numa lista
        // que outras pessoas veem
        <p className="text-muted-foreground text-center text-xs leading-relaxed">
          Participar mostra seu @usuário e seus dias na lista abaixo. Peso, medidas e fotos
          continuam privados.
        </p>
      )}
    </form>
  );
}

function Botao({ participando, rotulo }: { participando: boolean; rotulo: string | null }) {
  const { pending } = useFormStatus();

  if (participando) {
    return (
      <Button type="submit" variant="outline" disabled={pending} className="h-12 w-full">
        {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        Sair do desafio
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
      {pending ? 'ENTRANDO…' : (rotulo ?? 'ENTRAR NO DESAFIO')}
    </Button>
  );
}
