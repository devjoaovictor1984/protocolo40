import Image from 'next/image';
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

/**
 * A marca do P20X.
 *
 * Duas artes, uma por tema, e as duas sempre no HTML: a troca é por CSS
 * (`dark:`) e não por JavaScript. Decidir no cliente faria a marca piscar na
 * cor errada no primeiro quadro, que é justamente onde ela mais é olhada.
 *
 * O peso disso é pequeno — 11 KB cada — e o navegador só baixa a que está
 * visível, porque a outra fica com `display: none`.
 *
 * `priority` porque a marca costuma estar acima da dobra em toda tela onde
 * aparece; sem isso ela entra depois do resto e a página parece montar torta.
 */
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
    <span className="flex flex-col gap-1">
      <span className="relative block h-7 w-[132px]">
        <Image
          src="/marca/logo-claro.webp"
          alt="P20X"
          fill
          sizes="132px"
          priority
          className="object-contain object-left dark:hidden"
        />
        <Image
          src="/marca/logo-escuro.webp"
          alt=""
          fill
          sizes="132px"
          priority
          aria-hidden
          className="hidden object-contain object-left dark:block"
        />
      </span>

      {showTagline ? (
        <span className="text-muted-foreground text-[11px] font-medium tracking-wide">
          20 minutos. Todos os dias.
        </span>
      ) : null}
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
