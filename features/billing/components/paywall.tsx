import { Check, Lock } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button-link';

/**
 * Tela de recurso pago.
 *
 * Não é um bloqueio genérico: diz o que este recurso específico faz, mostra
 * uma amostra do que a pessoa veria, e deixa claro que o resto do app
 * continua livre. Um paywall que parece punição faz a pessoa desinstalar.
 */
export function Paywall({
  titulo,
  descricao,
  amostra,
}: {
  titulo: string;
  descricao: string;
  /** três frases curtas do que o recurso entrega */
  amostra: string[];
}) {
  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="bg-secondary text-muted-foreground flex size-14 items-center justify-center rounded-2xl">
          <Lock aria-hidden className="size-6" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight">{titulo}</h1>
        <p className="text-muted-foreground text-sm text-balance">{descricao}</p>
      </header>

      <ul className="border-border flex flex-col gap-3 rounded-2xl border p-4">
        {amostra.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm">
            <Check aria-hidden className="text-success mt-0.5 size-4 shrink-0" />
            {item}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <ButtonLink href="/planos" className="h-14 text-base font-semibold">
          VER OS PLANOS
        </ButtonLink>
        <p className="text-muted-foreground text-center text-xs text-balance">
          Treinar, registrar, histórico, fotos e conquistas seguem livres para sempre — isso não
          muda.
        </p>
      </div>
    </div>
  );
}
