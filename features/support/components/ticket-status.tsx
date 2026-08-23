import { CheckCircle2, CircleDot, Clock, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { TicketStatus } from '@/types/database';

/**
 * Estado de um chamado.
 *
 * Cor nunca sozinha: o ícone e a palavra dizem o mesmo, para quem não
 * distingue as cores e para quem está no sol.
 */
const ESTADOS: Record<TicketStatus, { label: string; icon: typeof Clock; className: string }> = {
  aberto: {
    label: 'Aberto',
    icon: CircleDot,
    className: 'border-primary/40 text-primary',
  },
  em_analise: {
    label: 'Em análise',
    icon: Clock,
    className: 'border-warning/40 text-warning',
  },
  resolvido: {
    label: 'Resolvido',
    icon: CheckCircle2,
    className: 'border-success/40 text-success',
  },
  fechado: {
    label: 'Fechado',
    icon: XCircle,
    className: 'border-border text-muted-foreground',
  },
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const estado = ESTADOS[status];
  const Icon = estado.icon;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        estado.className,
      )}
    >
      <Icon aria-hidden className="size-3" />
      {estado.label}
    </span>
  );
}
