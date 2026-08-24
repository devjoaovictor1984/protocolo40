'use client';

import { useFormStatus } from 'react-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { aparecerNaComunidade, sairDaComunidade } from '@/features/community/actions';

/**
 * Ficar privado, direto do perfil.
 *
 * O perfil nasce público, e quem não quer isso precisa de um caminho curto —
 * não de uma caça a uma configuração dentro de duas telas. Fica aqui porque é
 * aqui que a pessoa está quando pensa "quem é que vê isso?".
 *
 * O texto diz o que muda em vez de prometer privacidade genérica: nem tudo
 * fica escondido, e nem tudo estava exposto.
 */
export function PrivacyToggle({ visivel }: { visivel: boolean }) {
  return (
    <section className="border-border flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        {visivel ? (
          <Eye aria-hidden className="text-success mt-0.5 size-4 shrink-0" />
        ) : (
          <EyeOff aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {visivel ? 'Seu perfil está público' : 'Seu perfil está privado'}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            {visivel
              ? 'Outras pessoas podem te encontrar e ver seu nome, sequência e insígnias. Peso, medidas, fotos e treinos continuam privados.'
              : 'Ninguém te encontra nas buscas nem consegue te seguir. Você continua vendo e seguindo quem quiser.'}
          </p>
        </div>
      </div>

      <form action={visivel ? sairDaComunidade : aparecerNaComunidade}>
        <Alternar visivel={visivel} />
      </form>
    </section>
  );
}

function Alternar({ visivel }: { visivel: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" className="h-11 w-full" disabled={pending}>
      {pending ? (
        <Loader2 aria-hidden className="size-4 animate-spin" />
      ) : visivel ? (
        <EyeOff aria-hidden className="size-4" />
      ) : (
        <Eye aria-hidden className="size-4" />
      )}
      {visivel ? 'Deixar meu perfil privado' : 'Deixar meu perfil público'}
    </Button>
  );
}
