'use client';

import { useFormStatus } from 'react-dom';
import { Check, Loader2, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { deixarDeSeguir, seguir } from '@/features/community/actions';
import { cn } from '@/lib/utils';

/**
 * Seguir e deixar de seguir.
 *
 * Um formulário por ação, e não um botão que alterna estado no cliente: o
 * servidor é quem sabe se a relação existe. Alternar no cliente daria a
 * impressão de ter seguido mesmo quando a outra pessoa não aceita seguidores.
 */
export function FollowButton({
  userId,
  username,
  seguindo,
  compacto = false,
}: {
  userId: string;
  username: string;
  seguindo: boolean;
  compacto?: boolean;
}) {
  return (
    <form action={seguindo ? deixarDeSeguir : seguir} className="shrink-0">
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="username" value={username} />
      <Botao seguindo={seguindo} compacto={compacto} />
    </form>
  );
}

function Botao({ seguindo, compacto }: { seguindo: boolean; compacto: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={seguindo ? 'outline' : 'default'}
      disabled={pending}
      className={cn(compacto ? 'h-10 px-3 text-sm' : 'h-12 px-6')}
    >
      {pending ? (
        <Loader2 aria-hidden className="size-4 animate-spin" />
      ) : seguindo ? (
        <Check aria-hidden className="size-4" />
      ) : (
        <UserPlus aria-hidden className="size-4" />
      )}
      {seguindo ? 'Seguindo' : 'Seguir'}
    </Button>
  );
}
