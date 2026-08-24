'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { definirVitrine } from '@/features/community/actions';
import { useThumbUrl, type GalleryPhoto } from '@/features/photos/use-photos';
import { cn } from '@/lib/utils';
import { formatDay } from '@/services/calendar';

/**
 * Escolher o antes e o depois que ficam no perfil.
 *
 * Duas decisões deliberadas:
 *
 * **Só um par, escolhido a dedo.** Não existe "publicar a galeria". Foto de
 * corpo é o dado mais sensível deste app; expor um conjunto inteiro seria
 * fácil de fazer sem querer e impossível de desfazer da cabeça de quem viu.
 *
 * **Só fotos que já subiram.** Uma foto ainda na fila não tem id no servidor,
 * então não há o que apontar — e prometer exposição de algo que ainda não
 * existe seria mentir para quem escolheu.
 */
export function ShowcasePicker({
  fotos,
  antesAtual,
  depoisAtual,
}: {
  fotos: GalleryPhoto[];
  antesAtual: string | null;
  depoisAtual: string | null;
}) {
  const disponiveis = fotos.filter((foto) => foto.remoteId !== null);

  const [antes, setAntes] = useState<string | null>(antesAtual);
  const [depois, setDepois] = useState<string | null>(depoisAtual);

  const publicado = Boolean(antesAtual && depoisAtual);
  const mudou = antes !== antesAtual || depois !== depoisAtual;
  const completo = Boolean(antes && depois && antes !== depois);

  if (disponiveis.length < 2) {
    return null;
  }

  return (
    <details className="border-border rounded-2xl border p-4" open={publicado}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-bold">
        {publicado ? (
          <Eye aria-hidden className="text-primary size-4" />
        ) : (
          <EyeOff aria-hidden className="text-muted-foreground size-4" />
        )}
        Antes e depois no seu perfil
        <span className="text-muted-foreground ml-auto text-xs font-normal">
          {publicado ? 'publicado' : 'nada exposto'}
        </span>
      </summary>

      <div className="mt-4 flex flex-col gap-5">
        <p className="text-muted-foreground text-xs leading-relaxed">
          Escolha duas fotos para aparecerem no seu perfil público. Só essas duas ficam visíveis —
          o resto da galeria continua privado, inclusive para quem te segue. Dá para tirar do ar a
          qualquer momento.
        </p>

        <Fileira titulo="Antes" fotos={disponiveis} escolhida={antes} onEscolher={setAntes} />
        <Fileira titulo="Depois" fotos={disponiveis} escolhida={depois} onEscolher={setDepois} />

        {antes && depois && antes === depois ? (
          <p className="text-destructive text-sm">Escolha duas fotos diferentes.</p>
        ) : null}

        <div className="flex flex-col gap-2">
          <form action={definirVitrine}>
            <input type="hidden" name="antes" value={antes ?? ''} />
            <input type="hidden" name="depois" value={depois ?? ''} />
            <Salvar desabilitado={!completo || !mudou} />
          </form>

          {publicado ? (
            <form action={definirVitrine}>
              <input type="hidden" name="antes" value="" />
              <input type="hidden" name="depois" value="" />
              <Button type="submit" variant="ghost" className="h-11 w-full">
                <EyeOff aria-hidden className="size-4" />
                Tirar do perfil
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </details>
  );
}

function Salvar({ desabilitado }: { desabilitado: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="h-12 w-full" disabled={desabilitado || pending}>
      {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
      {pending ? 'Publicando…' : 'Publicar no perfil'}
    </Button>
  );
}

function Fileira({
  titulo,
  fotos,
  escolhida,
  onEscolher,
}: {
  titulo: string;
  fotos: GalleryPhoto[];
  escolhida: string | null;
  onEscolher: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
        {titulo}
      </p>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={titulo}>
        {fotos.map((foto) => (
          <Miniatura
            key={foto.key}
            foto={foto}
            selecionada={escolhida === foto.remoteId}
            onEscolher={() => onEscolher(foto.remoteId!)}
            rotulo={titulo}
          />
        ))}
      </div>
    </div>
  );
}

function Miniatura({
  foto,
  selecionada,
  onEscolher,
  rotulo,
}: {
  foto: GalleryPhoto;
  selecionada: boolean;
  onEscolher: () => void;
  rotulo: string;
}) {
  const url = useThumbUrl(foto);

  return (
    <button
      type="button"
      aria-pressed={selecionada}
      aria-label={`${rotulo}: foto de ${formatDay(foto.takenOn)}`}
      onClick={onEscolher}
      className={cn(
        'relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
        selecionada ? 'border-primary' : 'border-border',
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob local ou URL assinada
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <span className="bg-secondary block size-full" />
      )}
    </button>
  );
}
