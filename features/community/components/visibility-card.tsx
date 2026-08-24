'use client';

import { useFormStatus } from 'react-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { aparecerNaComunidade, sairDaComunidade } from '@/features/community/actions';

/**
 * O consentimento para aparecer.
 *
 * O perfil nasce privado, e isso está certo: ninguém entra num app de corpo e
 * é listado sem ter pedido. Mas o efeito colateral é uma comunidade que nasce
 * invisível — todo mundo procurando, ninguém aparecendo.
 *
 * Então o convite fica na frente, com o que muda escrito por extenso. Sem
 * letra miúda e sem mandar a pessoa para outra tela decidir.
 */
export function VisibilityCard({ visivel }: { visivel: boolean }) {
  if (visivel) {
    return (
      <div className="border-border flex flex-col gap-3 rounded-2xl border p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Eye aria-hidden className="text-success size-4" />
          Você aparece na comunidade
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Outras pessoas encontram o seu perfil pelo nome ou @usuário e veem sua sequência e suas
          insígnias. Peso, medidas e fotos continuam privados.
        </p>

        <form action={sairDaComunidade}>
          <Botao variant="ghost" icone={<EyeOff aria-hidden className="size-4" />}>
            Sair da lista
          </Botao>
        </form>
      </div>
    );
  }

  return (
    <div className="border-primary/40 bg-primary/5 flex flex-col gap-3 rounded-2xl border p-4">
      <p className="flex items-center gap-2 font-bold">
        <EyeOff aria-hidden className="text-muted-foreground size-4" />
        Ninguém consegue te encontrar
      </p>

      <p className="text-sm leading-relaxed">
        Seu perfil está privado, então você não aparece para as outras pessoas — nem quando alguém
        digita o seu @usuário.
      </p>

      <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
        <li>Ao aparecer, ficam visíveis: seu nome, @usuário, sequência e insígnias.</li>
        <li>Continuam privados: peso, medidas, fotos e treinos.</li>
        <li>Dá para sair da lista quando quiser, com um toque.</li>
      </ul>

      <form action={aparecerNaComunidade}>
        <Botao icone={<Eye aria-hidden className="size-4" />}>QUERO APARECER</Botao>
      </form>
    </div>
  );
}

function Botao({
  children,
  icone,
  variant,
}: {
  children: React.ReactNode;
  icone: React.ReactNode;
  variant?: 'ghost';
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} className="h-12 w-full font-semibold" disabled={pending}>
      {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : icone}
      {children}
    </Button>
  );
}
