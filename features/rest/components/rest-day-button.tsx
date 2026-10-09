'use client';

import { BedDouble, Check, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToday } from '@/features/session/session-context';
import { useRegistrarDescanso } from '@/features/rest/use-registrar-descanso';

/**
 * Registrar descanso.
 *
 * Fica discreto de propósito, abaixo do botão de treinar: é a segunda opção
 * do dia, não a primeira. Um botão de descanso do mesmo tamanho do de treinar
 * convida a escolher o mais fácil.
 */
export function RestDayButton({
  jaDescansou,
  principal = false,
}: {
  jaDescansou: boolean;
  /**
   * No dia de descanso da trilha, descansar É o que o programa pede — aí o
   * botão deixa de ser a segunda opção discreta e vira o botão do dia.
   */
  principal?: boolean;
}) {
  const hoje = useToday();
  const { registrar, salvando } = useRegistrarDescanso();

  if (jaDescansou) {
    return (
      <p className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
        <Check aria-hidden className="text-success size-4" />
        Descanso registrado. Sua sequência continua de pé.
      </p>
    );
  }

  return (
    <Button
      variant={principal ? 'default' : 'ghost'}
      className={principal ? 'h-16 w-full text-base font-bold' : 'text-muted-foreground h-11'}
      disabled={salvando}
      onClick={() => void registrar(hoje)}
    >
      {salvando ? (
        <Loader2 aria-hidden className="size-4 animate-spin" />
      ) : (
        <BedDouble aria-hidden className={principal ? 'size-5' : 'size-4'} />
      )}
      {principal ? 'REGISTRAR MEU DESCANSO' : 'Hoje é dia de descanso'}
    </Button>
  );
}
