'use client';

import { BedDouble, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useRegistrarDescanso } from '@/features/rest/use-registrar-descanso';
import { addDays, daysBetween } from '@/services/calendar';

/**
 * "Ontem foi descanso?"
 *
 * Quem descansou e esqueceu de marcar acordava com a sequência quebrada sem ter
 * feito nada de errado. O convite aparece só quando ele resolve alguma coisa:
 * ontem sem treino nem descanso, um descanso ainda livre na semana, e alguém
 * que já vinha treinando antes de ontem — no primeiro dia, "ontem" não existe.
 *
 * O banco aceita até ontem e não mais: é ontem que decide se a sequência vive.
 */
export function YesterdayRest({
  hoje,
  diasTreinados,
  descansos,
}: {
  hoje: string;
  diasTreinados: string[];
  descansos: string[];
}) {
  const { registrar, salvando } = useRegistrarDescanso();
  const ontem = addDays(hoje, -1);

  const ontemResolvido = diasTreinados.includes(ontem) || descansos.includes(ontem);
  // a mesma janela que `registrar_descanso` confere: oferecer um botão que o
  // banco vai recusar seria pedir um toque para dar uma notícia ruim
  const semanaOcupada = descansos.some((dia) => Math.abs(daysBetween(dia, ontem)) <= 6);
  const vinhaTreinando = diasTreinados.some((dia) => dia < ontem);

  if (ontemResolvido || semanaOcupada || !vinhaTreinando) return null;

  return (
    <section
      aria-label="Descanso de ontem"
      className="border-border flex items-center gap-3 rounded-xl border border-dashed p-4"
    >
      <BedDouble aria-hidden className="text-muted-foreground size-5 shrink-0" />
      <p className="flex-1 text-sm">
        <span className="block font-semibold">Ontem foi dia de descanso?</span>
        <span className="text-muted-foreground">Registre agora e sua sequência continua.</span>
      </p>
      <Button
        variant="outline"
        className="h-11 shrink-0"
        disabled={salvando}
        onClick={() => void registrar(ontem)}
      >
        {salvando ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        Foi descanso
      </Button>
    </section>
  );
}
