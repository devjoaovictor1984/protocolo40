import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Cabeçalho com o caminho até aqui.
 *
 * No celular, a barra de baixo tem quatro destinos e o `+`; tudo o que está
 * fora deles é alcançado por dentro de outra tela — e sem um caminho de volta
 * a pessoa usa o gesto do sistema, que às vezes sai do app inteiro.
 *
 * A trilha aqui não é decorativa: ela existe porque estas telas têm mesmo um
 * lugar de origem. Onde não houver, o cabeçalho é só o título — inventar um
 * nível intermediário para "parecer" breadcrumb seria mentir sobre a
 * estrutura.
 *
 * Em telas estreitas, só o último salto aparece, com a seta apontando para
 * trás; a trilha inteira fica no desktop, onde cabe.
 */
export type Passo = { href: string; label: string };

export function PageHeader({
  titulo,
  descricao,
  trilha = [],
  acao,
  className,
}: {
  titulo: string;
  descricao?: string;
  /** do mais distante ao mais próximo; o título atual não entra */
  trilha?: Passo[];
  acao?: React.ReactNode;
  className?: string;
}) {
  const anterior = trilha.at(-1);

  return (
    <header className={cn('flex flex-col gap-3', className)}>
      {anterior ? (
        <>
          {/* celular: um salto, o de volta */}
          <Link
            href={anterior.href}
            className="text-muted-foreground hover:text-foreground -ml-1 flex min-h-11 items-center gap-1.5 self-start text-sm lg:hidden"
          >
            <ChevronRight aria-hidden className="size-4 rotate-180" />
            {anterior.label}
          </Link>

          {/* desktop: a trilha inteira */}
          <nav aria-label="Você está em" className="hidden items-center gap-1 text-sm lg:flex">
            {trilha.map((passo) => (
              <span key={passo.href} className="flex items-center gap-1">
                <Link
                  href={passo.href}
                  className="text-muted-foreground hover:text-foreground min-h-9 py-1"
                >
                  {passo.label}
                </Link>
                <ChevronRight aria-hidden className="text-muted-foreground size-3.5" />
              </span>
            ))}
            <span aria-current="page" className="font-medium">
              {titulo}
            </span>
          </nav>
        </>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight">{titulo}</h1>
          {descricao ? <p className="text-muted-foreground mt-1 text-sm">{descricao}</p> : null}
        </div>
        {acao ? <div className="shrink-0">{acao}</div> : null}
      </div>
    </header>
  );
}
