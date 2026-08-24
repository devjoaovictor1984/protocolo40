import Link from 'next/link';

import { Emblem } from '@/features/badges/components/emblem';
import { cn } from '@/lib/utils';
import type { BadgeTier } from '@/types/database';

/**
 * A última insígnia conquistada, em destaque.
 *
 * Ela abre a tela de hoje porque é a única coisa ali que fala do passado — e
 * é justamente lembrar do que já foi feito que faz alguém não querer quebrar
 * a sequência. Fica centralizada e com nome embaixo: sem o nome, o desenho é
 * bonito e não diz nada.
 */
export function BadgeSpotlight({
  emblem,
  tier,
  nome,
  conquistadaEm,
}: {
  emblem: string;
  tier: BadgeTier;
  nome: string;
  conquistadaEm?: string | null;
}) {
  return (
    <Link
      href="/conquistas"
      aria-label={`Sua última insígnia: ${nome}. Ver todas as conquistas.`}
      className="group flex flex-col items-center gap-1.5"
    >
      <span
        className={cn(
          'border-border bg-card flex size-20 items-center justify-center rounded-full border-2',
          'group-hover:border-primary/40 transition-colors',
        )}
      >
        <Emblem emblem={emblem} tier={tier} className="size-14" />
      </span>

      <span className="text-sm font-bold">{nome}</span>

      {conquistadaEm ? (
        <span className="text-muted-foreground text-[11px]">Sua última insígnia</span>
      ) : null}
    </Link>
  );
}

/** Versão pequena, para ficar ao lado do nome no perfil. */
export function BadgeChip({
  emblem,
  tier,
  nome,
}: {
  emblem: string;
  tier: BadgeTier;
  nome: string;
}) {
  return (
    <Link
      href="/conquistas"
      aria-label={`Última insígnia: ${nome}. Ver todas as conquistas.`}
      className="border-border hover:border-primary/40 flex shrink-0 flex-col items-center gap-1 rounded-2xl border px-3 py-2 transition-colors"
    >
      <Emblem emblem={emblem} tier={tier} className="size-10" />
      <span className="max-w-16 text-center text-[10px] leading-tight font-semibold">{nome}</span>
    </Link>
  );
}
