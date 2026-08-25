'use client';

import { useState } from 'react';
import { Check, Download, Plus, Share, Smartphone, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useDispensa, useInstall, type Plataforma } from '@/features/pwa/use-install';

/**
 * O convite para instalar.
 *
 * Some sozinho quando o app já está instalado, e pode ser dispensado por trinta
 * dias — um convite que volta todo dia deixa de ser convite.
 *
 * A razão dada é concreta, e não "instale nosso app": abrir num toque, treinar
 * sem internet e receber lembrete. São as três coisas que só existem instalado.
 */
export function InstallCard() {
  const { instalado, plataforma, podeInstalarDireto, instalar } = useInstall();
  const [dispensado, dispensar] = useDispensa();
  const [instalando, setInstalando] = useState(false);

  if (instalado || dispensado) return null;

  return (
    <section
      aria-label="Instalar o app"
      className="border-border relative flex flex-col gap-3 rounded-2xl border p-4"
    >
      <button
        type="button"
        onClick={dispensar}
        aria-label="Dispensar por enquanto"
        className="text-muted-foreground hover:text-foreground absolute top-2 right-2 flex size-9 items-center justify-center rounded-lg transition-colors"
      >
        <X aria-hidden className="size-4" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <span
          aria-hidden
          className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl"
        >
          <Smartphone className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-base font-extrabold tracking-tight">Instale o P20X no aparelho</p>
          <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
            Abre num toque, funciona sem internet durante o treino e pode avisar você na hora de
            treinar.
          </p>
        </div>
      </div>

      {podeInstalarDireto ? (
        <Button
          onClick={async () => {
            setInstalando(true);
            await instalar();
            setInstalando(false);
          }}
          disabled={instalando}
          className="h-12 w-full font-semibold"
        >
          <Download aria-hidden className="size-4" />
          INSTALAR AGORA
        </Button>
      ) : (
        <Instrucoes plataforma={plataforma} />
      )}
    </section>
  );
}

/**
 * O passo a passo, quando não há botão nativo.
 *
 * Sempre é o caso no iPhone, e às vezes no Android — o Chrome só oferece o
 * prompt depois de alguns minutos de uso. Em vez de esconder o convite, o app
 * mostra o caminho manual, com o desenho do botão que a pessoa precisa achar.
 */
function Instrucoes({ plataforma }: { plataforma: Plataforma }) {
  const passos = PASSOS[plataforma];

  return (
    <Dialog>
      {/* Base UI usa `render` no lugar do `asChild` do Radix */}
      <DialogTrigger
        render={
          <Button variant="outline" className="h-12 w-full font-semibold">
            COMO INSTALAR
          </Button>
        }
      />

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{passos.titulo}</DialogTitle>
          <DialogDescription>{passos.resumo}</DialogDescription>
        </DialogHeader>

        <ol className="flex flex-col gap-4 py-2">
          {passos.itens.map((passo, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                aria-hidden
                className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              >
                {i + 1}
              </span>

              <p className="flex-1 pt-0.5 text-sm leading-relaxed">
                {passo.antes}
                {passo.icone ? (
                  <span className="border-border mx-1 inline-flex translate-y-1 items-center gap-1 rounded-md border px-1.5 py-0.5 align-baseline">
                    <passo.icone aria-hidden className="size-3.5" />
                    <span className="text-xs font-semibold">{passo.rotulo}</span>
                  </span>
                ) : null}
                {passo.depois}
              </p>
            </li>
          ))}
        </ol>

        <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
          <Check aria-hidden className="text-success mt-0.5 size-3.5 shrink-0" />
          Depois disso o P20X abre como aplicativo, em tela cheia e sem a barra do navegador.
        </p>
      </DialogContent>
    </Dialog>
  );
}

type Passo = {
  antes: string;
  icone?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  rotulo?: string;
  depois?: string;
};

const PASSOS: Record<string, { titulo: string; resumo: string; itens: Passo[] }> = {
  ios: {
    titulo: 'Instalar no iPhone',
    resumo: 'Precisa ser pelo Safari — o Chrome no iPhone não instala aplicativos.',
    itens: [
      { antes: 'Toque no botão de compartilhar,', icone: Share, rotulo: 'Compartilhar', depois: 'na barra de baixo do Safari.' },
      { antes: 'Role a lista e toque em', icone: Plus, rotulo: 'Adicionar à Tela de Início', depois: '.' },
      { antes: 'Confirme em Adicionar, no canto de cima.' },
    ],
  },
  android: {
    titulo: 'Instalar no Android',
    resumo: 'Pelo Chrome, em dois toques.',
    itens: [
      { antes: 'Toque nos três pontinhos, no canto de cima do Chrome.' },
      { antes: 'Escolha Instalar aplicativo ou Adicionar à tela inicial.' },
      { antes: 'Confirme em Instalar.' },
    ],
  },
  desktop: {
    titulo: 'Instalar no computador',
    resumo: 'Pelo Chrome ou Edge.',
    itens: [
      { antes: 'Clique no ícone de instalar, do lado direito da barra de endereço.' },
      { antes: 'Confirme em Instalar.' },
    ],
  },
};
