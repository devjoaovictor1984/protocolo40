import { Lock } from 'lucide-react';

import { Emblem } from '@/features/badges/components/emblem';
import type { Conquista } from '@/features/badges/repository';
import { cn } from '@/lib/utils';
import { formatDay } from '@/services/calendar';

/**
 * Vitrine das conquistas.
 *
 * As bloqueadas continuam visíveis, com o nome e o que falta: uma insígnia
 * escondida não motiva ninguém. O estado nunca depende só da cor — o cadeado e
 * a data dizem a mesma coisa.
 */
export function BadgeGrid({
  badges,
  vazio = 'Nada por aqui ainda.',
}: {
  badges: Conquista[];
  vazio?: string;
}) {
  if (badges.length === 0) {
    return <p className="text-muted-foreground text-sm">{vazio}</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {badges.map((badge) => (
        <li
          key={badge.slug}
          className={cn(
            'flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-colors',
            badge.earned
              ? 'border-primary/30 bg-card'
              : 'border-border/60 bg-muted/30',
          )}
        >
          <Emblem emblem={badge.emblem} tier={badge.tier} earned={badge.earned} />

          <p className="flex items-center gap-1.5 text-sm font-bold">
            {badge.earned ? null : <Lock aria-hidden className="text-muted-foreground size-3" />}
            {badge.name}
          </p>

          <p className="text-muted-foreground text-xs leading-snug">{badge.description}</p>

          <p className="text-muted-foreground tnum mt-auto pt-1 text-[11px]">
            {badge.earned && badge.earnedOn
              ? `Conquistada em ${formatDay(badge.earnedOn)}`
              : legendaBloqueada(badge)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function legendaBloqueada(badge: Conquista): string {
  switch (badge.metric) {
    case 'dias':
      return `${badge.threshold} dias treinados`;
    case 'barras':
      return `${badge.threshold} barras acumuladas`;
    case 'flexoes':
      return `${badge.threshold} flexões acumuladas`;
    default:
      return 'Bloqueada';
  }
}
