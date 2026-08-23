import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Paginação por link.
 *
 * Links de verdade, e não botões: a página fica no endereço, volta com o botão
 * do navegador e pode ser compartilhada. Em telas estreitas só as vizinhas
 * aparecem, senão a régua de números estoura a largura.
 */
export function Pagination({
  pagina,
  paginas,
  href,
  className,
}: {
  pagina: number;
  paginas: number;
  /** monta o endereço de uma página, preservando os outros filtros */
  href: (pagina: number) => string;
  className?: string;
}) {
  if (paginas <= 1) return null;

  const vizinhas = [pagina - 1, pagina, pagina + 1].filter(
    (numero) => numero >= 1 && numero <= paginas,
  );
  const numeros = [...new Set([1, ...vizinhas, paginas])].sort((a, b) => a - b);

  return (
    <nav
      aria-label="Paginação"
      className={cn('flex items-center justify-center gap-1.5', className)}
    >
      <Passo
        href={href(pagina - 1)}
        rotulo="Página anterior"
        desativado={pagina <= 1}
        icone={<ChevronLeft aria-hidden className="size-4" />}
      />

      {numeros.map((numero, indice) => (
        <span key={numero} className="flex items-center gap-1.5">
          {indice > 0 && numero - numeros[indice - 1] > 1 ? (
            <span className="text-muted-foreground px-1 text-sm">…</span>
          ) : null}

          <Link
            href={href(numero)}
            aria-current={numero === pagina ? 'page' : undefined}
            className={cn(
              'tnum flex size-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors',
              numero === pagina
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-muted',
            )}
          >
            {numero}
          </Link>
        </span>
      ))}

      <Passo
        href={href(pagina + 1)}
        rotulo="Próxima página"
        desativado={pagina >= paginas}
        icone={<ChevronRight aria-hidden className="size-4" />}
      />
    </nav>
  );
}

function Passo({
  href,
  rotulo,
  desativado,
  icone,
}: {
  href: string;
  rotulo: string;
  desativado: boolean;
  icone: React.ReactNode;
}) {
  if (desativado) {
    return (
      <span
        aria-hidden
        className="border-border text-muted-foreground/40 flex size-10 items-center justify-center rounded-lg border"
      >
        {icone}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={rotulo}
      className="border-border hover:bg-muted flex size-10 items-center justify-center rounded-lg border transition-colors"
    >
      {icone}
    </Link>
  );
}
