'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { apagarDesafio } from '@/features/challenges/admin-actions';

/**
 * Apagar um desafio.
 *
 * Separado de "Desligar" porque são coisas diferentes, e a diferença é
 * irreversível: desligar tira o desafio das telas e mantém quem participou;
 * apagar destrói a participação de todo mundo, inclusive a insígnia de quem
 * concluiu.
 *
 * Por isso a confirmação diz o número de pessoas em vez de perguntar "tem
 * certeza?". "Tem certeza" não informa nada — "isto tira a participação de 340
 * pessoas" informa.
 */
export function DeleteChallenge({
  id,
  titulo,
  participantes,
}: {
  id: string;
  titulo: string;
  participantes: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={`Apagar desafio: ${titulo}`}
      className="text-muted-foreground hover:text-destructive h-10 shrink-0"
      onClick={() => {
        const aviso =
          participantes > 0
            ? `Apagar "${titulo}" tira a participação de ${participantes} ${
                participantes === 1 ? 'pessoa' : 'pessoas'
              } e não tem volta.\n\nPara só tirar das telas sem perder nada, use Desligar.`
            : `Apagar "${titulo}"? Não tem volta.`;

        if (!window.confirm(aviso)) return;

        startTransition(async () => {
          const erro = await apagarDesafio(id);
          if (erro) toast.error(erro);
          else toast.success('Desafio apagado.');
        });
      }}
    >
      <Trash2 aria-hidden className="size-4" />
    </Button>
  );
}
