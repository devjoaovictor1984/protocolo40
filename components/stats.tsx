import { Flame } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Número grande com rótulo. Usado nas faixas de resumo. */
export function StatCard({
  value,
  label,
  hint,
  className,
}: {
  value: React.ReactNode;
  label: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className="tnum text-2xl leading-none font-extrabold tracking-tight">{value}</span>
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {hint ? <span className="text-muted-foreground/80 text-xs">{hint}</span> : null}
    </div>
  );
}

/**
 * Sequência atual.
 *
 * Quando a sequência é zero não existe repreensão: a mensagem é de recomeço,
 * nunca de perda.
 */
export function StreakBadge({
  days,
  className,
  size = 'default',
}: {
  days: number;
  className?: string;
  size?: 'default' | 'lg';
}) {
  const active = days > 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold',
        active ? 'text-streak' : 'text-muted-foreground',
        size === 'lg' ? 'text-base' : 'text-sm',
        className,
      )}
    >
      <Flame aria-hidden className={cn(size === 'lg' ? 'size-5' : 'size-4', !active && 'opacity-60')} />
      {active ? (
        <span className="tnum">
          {days} {days === 1 ? 'dia seguido' : 'dias seguidos'}
        </span>
      ) : (
        <span>Hoje começa uma nova sequência</span>
      )}
    </span>
  );
}

/**
 * Estado vazio.
 *
 * Nunca "nenhum registro encontrado": sempre um convite com a próxima ação.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-4 px-6 py-12 text-center', className)}>
      <span className="bg-secondary text-muted-foreground flex size-14 items-center justify-center rounded-2xl">
        <Icon aria-hidden className="size-6" />
      </span>

      <div className="flex flex-col gap-1.5">
        <p className="text-lg font-bold tracking-tight text-balance">{title}</p>
        {description ? (
          <p className="text-muted-foreground max-w-xs text-sm text-balance">{description}</p>
        ) : null}
      </div>

      {action}
    </div>
  );
}

/** Selo de recorde. Aparece pouco, por isso pode ser vistoso. */
export function RecordBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'bg-primary/12 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase',
        className,
      )}
    >
      <Flame aria-hidden className="size-3.5" />
      {children}
    </span>
  );
}
