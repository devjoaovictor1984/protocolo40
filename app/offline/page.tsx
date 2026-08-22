import type { Metadata } from 'next';
import Link from 'next/link';
import { CloudOff } from 'lucide-react';

import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Sem conexão',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <CloudOff aria-hidden className="text-muted-foreground size-10" />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">Você está sem conexão</h1>
        <p className="text-muted-foreground max-w-sm">
          Esta tela precisa de internet. O cronômetro e o registro do treino continuam funcionando —
          nada do que você fizer agora será perdido.
        </p>
      </div>

      <Button render={<Link href="/treino/hoje" />} size="lg" className="h-12">
        Ir para o treino
      </Button>
    </main>
  );
}
