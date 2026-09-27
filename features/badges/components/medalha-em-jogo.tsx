import { Emblem } from '@/features/badges/components/emblem';
import type { BadgeTier } from '@/types/database';

/**
 * A medalha que um desafio ou uma trilha entrega.
 *
 * Cinza até ser conquistada, com o mesmo desenho da grade de conquistas — para
 * a medalha prometida aqui e a que aparece lá serem, aos olhos de quem usa, a
 * mesma coisa. Mostrada antes do botão de entrar: é o que se leva no fim, e
 * quem decide se começa precisa ver o que está em jogo.
 */
export function MedalhaEmJogo({
  medalha,
  conquistada,
  exigencia,
}: {
  medalha: { name: string; description: string; tier: BadgeTier; emblem: string };
  conquistada: boolean;
  /** O que falta para ganhar, em uma frase: "Sai com 18 dias vencidos dos seus 21." */
  exigencia: string;
}) {
  return (
    <section
      aria-label={conquistada ? 'Medalha conquistada' : 'A medalha em jogo'}
      className="border-border flex items-center gap-4 rounded-2xl border p-4"
    >
      <Emblem emblem={medalha.emblem} tier={medalha.tier} earned={conquistada} className="size-16" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          {conquistada ? 'Medalha conquistada' : 'A medalha de quem chegar ao fim'}
        </p>
        <p className="font-extrabold tracking-tight">{medalha.name}</p>
        <p className="text-muted-foreground text-sm leading-snug">
          {conquistada ? medalha.description : exigencia}
        </p>
      </div>
    </section>
  );
}
