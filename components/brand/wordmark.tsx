import Link from 'next/link';

import { cn } from '@/lib/utils';

/** Anel do cronômetro — a mesma figura do ícone do app. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'border-border border-t-primary border-r-primary inline-block size-4 rotate-45 rounded-full border-[3px]',
        className,
      )}
    />
  );
}

export function Wordmark({
  href = '/',
  className,
  showTagline = false,
}: {
  href?: string | null;
  className?: string;
  showTagline?: boolean;
}) {
  const content = (
    <span className="flex items-center gap-2.5">
      <BrandMark />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-extrabold tracking-tight">PROTOCOLO40</span>
        {showTagline ? (
          <span className="text-muted-foreground mt-1 text-[11px] font-medium tracking-wide">
            20 minutos. Todos os dias.
          </span>
        ) : null}
      </span>
    </span>
  );

  if (!href) {
    return <span className={className}>{content}</span>;
  }

  return (
    <Link href={href} className={cn('rounded-md', className)}>
      {content}
    </Link>
  );
}
