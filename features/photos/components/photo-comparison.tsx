'use client';

import { useMemo, useState } from 'react';
import { Camera, Columns2, SlidersHorizontal } from 'lucide-react';

import { EmptyState } from '@/components/stats';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useFullPhoto,
  usePhotos,
  useThumbUrl,
  type GalleryPhoto,
} from '@/features/photos/use-photos';
import { useSession } from '@/features/session/session-context';
import { cn } from '@/lib/utils';
import { daysBetween, formatDay } from '@/services/calendar';
import { protocolDay } from '@/services/streak';

/**
 * Comparação de duas fotos.
 *
 * Dois modos: lado a lado e slider antes/depois. Nenhum filtro, nenhum ajuste —
 * a imagem do corpo da pessoa não é alterada.
 */
export function PhotoComparison() {
  const { protocolStartedOn } = useSession();
  const { data: photos, isLoading } = usePhotos();
  const [mode, setMode] = useState<'lado' | 'slider'>('slider');
  const [aKey, setAKey] = useState<string | null>(null);
  const [bKey, setBKey] = useState<string | null>(null);

  const ordered = useMemo(
    () => [...(photos ?? [])].sort((x, y) => x.takenAt.localeCompare(y.takenAt)),
    [photos],
  );

  const a = ordered.find((photo) => photo.key === aKey) ?? ordered[0] ?? null;
  const b = ordered.find((photo) => photo.key === bKey) ?? ordered[ordered.length - 1] ?? null;

  if (isLoading) {
    return <Skeleton className="mt-6 h-96 w-full rounded-2xl" />;
  }

  if (ordered.length < 2) {
    return (
      <div className="py-6">
        <h1 className="mb-6 text-2xl font-extrabold tracking-tight">Comparar</h1>
        <EmptyState
          icon={Camera}
          title="Você precisa de pelo menos duas fotos."
          description="Tire uma hoje e outra daqui a algumas semanas — a diferença aparece sozinha."
          action={
            <ButtonLink href="/evolucao/fotos" className="h-12">
              Ir para as fotos
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const elapsed = a && b ? Math.abs(daysBetween(a.takenOn, b.takenOn)) : 0;
  const weightDiff =
    a?.weightKg !== null && a?.weightKg !== undefined && b?.weightKg !== null && b?.weightKg !== undefined
      ? b.weightKg - a.weightKg
      : null;

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Comparar</h1>

        <div className="border-border flex rounded-lg border p-0.5" role="group" aria-label="Modo">
          <button
            type="button"
            aria-pressed={mode === 'slider'}
            onClick={() => setMode('slider')}
            className={cn(
              'flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
              mode === 'slider' ? 'bg-secondary' : 'text-muted-foreground',
            )}
          >
            <SlidersHorizontal aria-hidden className="size-3.5" />
            Slider
          </button>
          <button
            type="button"
            aria-pressed={mode === 'lado'}
            onClick={() => setMode('lado')}
            className={cn(
              'flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
              mode === 'lado' ? 'bg-secondary' : 'text-muted-foreground',
            )}
          >
            <Columns2 aria-hidden className="size-3.5" />
            Lado a lado
          </button>
        </div>
      </header>

      {a && b ? (
        mode === 'slider' ? (
          <BeforeAfterSlider before={a} after={b} />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <PhotoPane photo={a} />
            <PhotoPane photo={b} />
          </div>
        )
      ) : null}

      {a && b ? (
        <section className="border-border grid grid-cols-2 gap-4 rounded-xl border p-4 text-center">
          <div>
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              Dia {protocolDay(protocolStartedOn, a.takenOn)}
            </p>
            <p className="tnum mt-1 text-sm">{formatDay(a.takenOn)}</p>
            <p className="tnum mt-1 text-lg font-bold">
              {a.weightKg ? `${a.weightKg.toFixed(1).replace('.', ',')} kg` : '—'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              Dia {protocolDay(protocolStartedOn, b.takenOn)}
            </p>
            <p className="tnum mt-1 text-sm">{formatDay(b.takenOn)}</p>
            <p className="tnum mt-1 text-lg font-bold">
              {b.weightKg ? `${b.weightKg.toFixed(1).replace('.', ',')} kg` : '—'}
            </p>
          </div>

          <p className="text-muted-foreground col-span-2 border-t pt-3 text-sm">
            {elapsed} {elapsed === 1 ? 'dia' : 'dias'} entre as duas
            {weightDiff !== null && weightDiff !== 0
              ? ` · ${weightDiff < 0 ? '−' : '+'}${Math.abs(weightDiff).toFixed(1).replace('.', ',')} kg`
              : ''}
          </p>
        </section>
      ) : null}

      <div className="flex flex-col gap-3">
        <PhotoPicker label="Foto A" photos={ordered} selected={a} onSelect={(photo) => setAKey(photo.key)} />
        <PhotoPicker label="Foto B" photos={ordered} selected={b} onSelect={(photo) => setBKey(photo.key)} />
      </div>
    </div>
  );
}

function PhotoPane({ photo }: { photo: GalleryPhoto }) {
  const url = useFullPhoto(photo);

  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- blob local ou URL assinada
    <img
      src={url}
      alt={`Foto de ${formatDay(photo.takenOn)}`}
      className="border-border aspect-3/4 w-full rounded-xl border object-cover"
    />
  ) : (
    <Skeleton className="aspect-3/4 w-full rounded-xl" />
  );
}

function BeforeAfterSlider({ before, after }: { before: GalleryPhoto; after: GalleryPhoto }) {
  const beforeUrl = useFullPhoto(before);
  const afterUrl = useFullPhoto(after);
  const [position, setPosition] = useState(50);

  if (!beforeUrl || !afterUrl) {
    return <Skeleton className="aspect-3/4 w-full rounded-xl" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="border-border relative aspect-3/4 w-full overflow-hidden rounded-xl border select-none">
        {/* eslint-disable-next-line @next/next/no-img-element -- blob local ou URL assinada */}
        <img
          src={afterUrl}
          alt={`Foto de ${formatDay(after.takenOn)}`}
          className="absolute inset-0 size-full object-cover"
          draggable={false}
        />
        {/* clip-path recorta sem redimensionar: as duas imagens ficam sempre
            no mesmo enquadramento, que é o ponto de uma comparação */}
        {/* eslint-disable-next-line @next/next/no-img-element -- blob local ou URL assinada */}
        <img
          src={beforeUrl}
          alt={`Foto de ${formatDay(before.takenOn)}`}
          className="absolute inset-0 size-full object-cover"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          draggable={false}
        />

        <div
          aria-hidden
          className="bg-background absolute inset-y-0 w-0.5"
          style={{ left: `${position}%` }}
        />

        <span className="bg-background/90 absolute top-2 left-2 rounded-md px-2 py-1 text-[11px] font-semibold">
          {formatDay(before.takenOn)}
        </span>
        <span className="bg-background/90 absolute top-2 right-2 rounded-md px-2 py-1 text-[11px] font-semibold">
          {formatDay(after.takenOn)}
        </span>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="sr-only">Posição da comparação</span>
        <input
          type="range"
          min="0"
          max="100"
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          className="accent-primary h-11 w-full"
          aria-label="Arraste para comparar as duas fotos"
        />
      </label>
    </div>
  );
}

function PhotoPicker({
  label,
  photos,
  selected,
  onSelect,
}: {
  label: string;
  photos: GalleryPhoto[];
  selected: GalleryPhoto | null;
  onSelect: (photo: GalleryPhoto) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
        {label}
      </span>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={label}>
        {photos.map((photo) => (
          <button
            key={photo.key}
            type="button"
            aria-pressed={selected?.key === photo.key}
            onClick={() => onSelect(photo)}
            className={cn(
              'relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
              selected?.key === photo.key ? 'border-primary' : 'border-border',
            )}
          >
            <Miniatura photo={photo} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Miniatura do seletor. A object URL nasce e morre com este componente. */
function Miniatura({ photo }: { photo: GalleryPhoto }) {
  const url = useThumbUrl(photo);

  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- blob local ou URL assinada
    <img src={url} alt={formatDay(photo.takenOn)} className="size-full object-cover" />
  ) : (
    <span className="bg-secondary block size-full" />
  );
}
