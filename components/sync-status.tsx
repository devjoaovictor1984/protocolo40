'use client';

import { AlertTriangle, Check, CloudOff, Loader2, RefreshCw } from 'lucide-react';

import { useSync } from '@/features/sync/use-sync';
import { cn } from '@/lib/utils';

/**
 * Chip de sincronização.
 *
 * Sempre ícone + texto: o estado nunca é comunicado só por cor. Fica discreto
 * quando está tudo certo e só ganha peso quando exige ação.
 */
export function SyncStatus({ className }: { className?: string }) {
  const { status, pending, failed, syncing, retry } = useSync();

  const base =
    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors';

  if (status === 'failed') {
    return (
      <button
        type="button"
        onClick={() => void retry()}
        className={cn(base, 'border-destructive/40 text-destructive hover:bg-destructive/10', className)}
      >
        <AlertTriangle aria-hidden className="size-3.5" />
        <span>
          {failed === 1 ? '1 item não subiu' : `${failed} itens não subiram`} — tentar novamente
        </span>
      </button>
    );
  }

  if (syncing) {
    return (
      <span className={cn(base, 'border-border text-muted-foreground', className)} role="status">
        <Loader2 aria-hidden className="size-3.5 animate-spin" />
        Sincronizando
      </span>
    );
  }

  if (status === 'offline') {
    return (
      <span className={cn(base, 'border-border text-muted-foreground', className)} role="status">
        <CloudOff aria-hidden className="size-3.5" />
        {pending > 0 ? `Offline — ${pending} para enviar` : 'Offline — salvo no aparelho'}
      </span>
    );
  }

  if (status === 'pending') {
    return (
      <button
        type="button"
        onClick={() => void retry()}
        className={cn(base, 'border-border text-muted-foreground hover:bg-muted', className)}
      >
        <RefreshCw aria-hidden className="size-3.5" />
        Aguardando sincronização · {pending}
      </button>
    );
  }

  return (
    <span className={cn(base, 'text-success border-transparent', className)} role="status">
      <Check aria-hidden className="size-3.5" />
      Sincronizado
    </span>
  );
}
