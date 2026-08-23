import { Flame } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Número com rótulo.
 *
 * A anatomia é fixa: o rótulo lê primeiro, o ícone ancora à direita, e o número
 * domina embaixo com a unidade em texto menor ao lado. Repetir essa ordem em
 * todos os cards é o que faz uma faixa de estatísticas ser lida de relance.
 */
export function StatCard({
  value,
  label,
  unit,
  hint,
  icon: Icon,
  className,
}: {
  value: React.ReactNode;
  label: string;
  unit?: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border bg-card flex flex-col justify-between gap-3 rounded-2xl border p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-muted-foreground text-sm leading-tight font-medium text-balance">
          {label}
        </span>
        {Icon ? (
          <span className="bg-secondary text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
            <Icon aria-hidden className="size-4" />
          </span>
        ) : null}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="tnum text-3xl leading-none font-extrabold tracking-tight">{value}</span>
        {unit ? <span className="text-muted-foreground text-sm">{unit}</span> : null}
      </div>

      {hint ? <span className="text-muted-foreground/80 -mt-1 text-xs">{hint}</span> : null}
    </div>
  );
}

/** Versão sem moldura, para faixas dentro de um card que já tem borda. */
export function StatInline({
  value,
  label,
  className,
}: {
  value: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className="tnum text-2xl leading-none font-extrabold tracking-tight">{value}</span>
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
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
