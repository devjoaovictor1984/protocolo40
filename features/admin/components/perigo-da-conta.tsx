'use client';

import { useState } from 'react';
import { Shield, ShieldOff, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { alternarAdmin, apagarUsuario } from '@/features/admin/actions';

/**
 * O que não dá para desfazer.
 *
 * Apagar uma conta leva junto treinos, fotos e conquistas, por cascade. Por
 * isso pede o @usuário digitado: um clique errado não pode bastar.
 */
export function PerigoDaConta({
  id,
  nome,
  isAdmin,
  ehVoce,
}: {
  id: string;
  nome: string;
  isAdmin: boolean;
  ehVoce: boolean;
}) {
  const [confirmacao, setConfirmacao] = useState('');
  const podeApagar = confirmacao.trim() === nome && !ehVoce;

  return (
    <section className="border-destructive/30 flex flex-col gap-5 rounded-xl border p-4">
      <h2 className="text-[11px] font-semibold tracking-wider uppercase">Ações administrativas</h2>

      {ehVoce ? (
        <p className="text-muted-foreground text-sm">
          Esta é a sua própria conta. Tirar o seu acesso ou apagá-la deixaria a administração sem
          dono, então as duas ações estão desligadas aqui.
        </p>
      ) : (
        <>
          <form action={alternarAdmin} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="valor" value={isAdmin ? '0' : '1'} />

            <Button type="submit" variant="outline" className="h-12 justify-start">
              {isAdmin ? (
                <ShieldOff aria-hidden className="size-4" />
              ) : (
                <Shield aria-hidden className="size-4" />
              )}
              {isAdmin ? 'Remover o acesso de admin' : 'Tornar admin'}
            </Button>
            <p className="text-muted-foreground text-xs">
              {isAdmin
                ? 'Esta pessoa hoje enxerga todos os usuários e responde chamados.'
                : 'Admin enxerga todos os usuários e responde chamados.'}
            </p>
          </form>

          <form action={apagarUsuario} className="flex flex-col gap-2 border-t pt-5">
            <input type="hidden" name="id" value={id} />

            <Label htmlFor="confirmacao" className="text-destructive">
              Apagar a conta de {nome}
            </Label>
            <p className="text-muted-foreground text-xs">
              Some tudo: treinos, fotos, medidas e conquistas. Não dá para desfazer. Digite{' '}
              <strong className="text-foreground">{nome}</strong> para liberar.
            </p>

            <Input
              id="confirmacao"
              value={confirmacao}
              onChange={(event) => setConfirmacao(event.target.value)}
              placeholder={nome}
              className="h-12"
            />

            <Button type="submit" variant="destructive" className="h-12" disabled={!podeApagar}>
              <Trash2 aria-hidden className="size-4" />
              Apagar esta conta
            </Button>
          </form>
        </>
      )}
    </section>
  );
}
