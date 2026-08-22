'use client';

import { useEffect, useState, useTransition } from 'react';

import { useHydrated } from '@/hooks/use-hydrated';
import { useTheme } from 'next-themes';
import { LogOut, Monitor, Moon, Sun, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signOut } from '@/features/auth/actions';
import { deleteAccount, updateDailyGoal } from '@/features/settings/actions';
import { wipeLocalData } from '@/lib/offline/db';
import { summarize } from '@/lib/offline/queue';
import { cn } from '@/lib/utils';

/** Tema: claro, escuro ou o do sistema. A preferência fica no aparelho. */
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  // o tema real só é conhecido no cliente; marcar antes causaria hidratação errada
  const mounted = useHydrated();

  const options = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Escuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ];

  return (
    <div className="flex gap-2" role="group" aria-label="Tema">
      {options.map((option) => {
        const Icon = option.icon;
        const active = mounted && theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(option.value)}
            className={cn(
              'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors',
              active ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted',
            )}
          >
            <Icon aria-hidden className="size-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Meta diária. 20 minutos é o padrão, mas o método não trava ninguém. */
export function DailyGoalField({ seconds }: { seconds: number }) {
  const [minutes, setMinutes] = useState(String(Math.round(seconds / 60)));
  const [pending, startTransition] = useTransition();

  function save() {
    const value = Number(minutes);
    if (!Number.isFinite(value) || value < 1 || value > 1440) {
      toast.error('Escolha entre 1 e 1440 minutos.');
      setMinutes(String(Math.round(seconds / 60)));
      return;
    }

    startTransition(async () => {
      try {
        await updateDailyGoal(value * 60);
        toast.success('Meta atualizada.');
      } catch {
        toast.error('Não conseguimos salvar a meta.');
      }
    });
  }

  return (
    <div className="flex items-end gap-3">
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="meta">Meta diária (minutos)</Label>
        <Input
          id="meta"
          type="number"
          inputMode="numeric"
          min="1"
          max="1440"
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
          className="tnum h-12 text-base"
        />
      </div>
      <Button onClick={save} disabled={pending} className="h-12">
        Salvar
      </Button>
    </div>
  );
}

/** Sair: limpa o banco local para não deixar dado de um usuário no aparelho de outro. */
export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      className="h-12 w-full justify-start"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await wipeLocalData();
          await signOut();
        })
      }
    >
      <LogOut aria-hidden className="size-4" />
      Sair da conta
    </Button>
  );
}

/**
 * Exclusão de conta.
 *
 * O impacto é dito antes, em texto claro, e a confirmação é digitada — não é
 * um botão que se aperta sem querer.
 */
export function DeleteAccountSection({ pendingCount }: { pendingCount?: number }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [pending, startTransition] = useTransition();
  const [queue, setQueue] = useState(pendingCount ?? 0);

  useEffect(() => {
    void summarize().then((summary) => setQueue(summary.pending));
  }, []);

  if (!open) {
    return (
      <Button
        variant="ghost"
        className="text-destructive hover:bg-destructive/10 h-12 w-full justify-start"
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden className="size-4" />
        Excluir minha conta
      </Button>
    );
  }

  return (
    <div className="border-destructive/40 flex flex-col gap-4 rounded-xl border p-4">
      <div>
        <p className="text-destructive font-semibold">Excluir a conta apaga tudo</p>
        <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>seus treinos, sequência e recordes</li>
          <li>suas fotos de evolução, do servidor e deste aparelho</li>
          <li>seu peso, medidas e vídeos gerados</li>
          <li>seu perfil e o endereço público, se existir</li>
        </ul>
        <p className="text-muted-foreground mt-2 text-sm">Não há como desfazer.</p>

        {queue > 0 ? (
          <p className="text-warning-foreground bg-warning/15 mt-3 rounded-lg p-2 text-sm">
            {queue} {queue === 1 ? 'item ainda não foi enviado' : 'itens ainda não foram enviados'}.
            Espere a sincronização terminar se quiser guardar uma cópia antes.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmar">
          Digite <strong>EXCLUIR</strong> para confirmar
        </Label>
        <Input
          id="confirmar"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          className="h-12"
        />
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="h-12 flex-1"
          onClick={() => {
            setOpen(false);
            setConfirmation('');
          }}
        >
          Cancelar
        </Button>
        <Button
          variant="destructive"
          className="h-12 flex-1"
          disabled={pending || confirmation.trim().toUpperCase() !== 'EXCLUIR'}
          onClick={() =>
            startTransition(async () => {
              try {
                await wipeLocalData();
                await deleteAccount(confirmation);
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : 'Não conseguimos excluir a conta agora.',
                );
              }
            })
          }
        >
          {pending ? 'Excluindo…' : 'Excluir para sempre'}
        </Button>
      </div>
    </div>
  );
}
