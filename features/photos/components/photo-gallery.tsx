'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, CloudOff, GitCompareArrows, Lock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/stats';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { removePhoto, savePhoto } from '@/features/photos/repository';
import { useFullPhoto, useGroupedPhotos, type GalleryPhoto } from '@/features/photos/use-photos';
import { useSession, useToday } from '@/features/session/session-context';
import { formatDay } from '@/services/calendar';
import { protocolDay } from '@/services/streak';

/**
 * Galeria de evolução.
 *
 * Toda foto é privada. A grade mostra apenas miniaturas — carregar a imagem
 * cheia de cada dia deixaria a tela pesada e não ajudaria a comparar.
 */
export function PhotoGallery({
  openCameraOnMount = false,
  dataInicial,
}: {
  openCameraOnMount?: boolean;
  dataInicial?: string;
}) {
  const { userId, protocolStartedOn } = useSession();
  const today = useToday();
  const queryClient = useQueryClient();
  const { groups, isLoading } = useGroupedPhotos();

  const [selected, setSelected] = useState<GalleryPhoto | null>(null);
  const [saving, setSaving] = useState(false);
  /**
   * O dia da foto.
   *
   * Quase sempre é hoje, mas quem está trazendo o histórico precisa poder
   * lançar a foto no dia certo — senão a comparação "dia 1 e dia 60" nasce
   * com as datas erradas.
   */
  const [data, setData] = useState(dataInicial ?? today);
  const fileInput = useRef<HTMLInputElement>(null);
  const dataInput = useRef<HTMLInputElement>(null);
  const opened = useRef(false);

  useEffect(() => {
    if (openCameraOnMount && !opened.current) {
      opened.current = true;
      fileInput.current?.click();
    }
  }, [openCameraOnMount]);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setSaving(true);
    try {
      // ler do DOM, e não do estado: quem escolhe a data antes da página
      // hidratar não pode ver a foto cair no dia de hoje em silêncio
      const escolhida = dataInput.current?.value || data;
      await savePhoto({ userId, file, takenOn: escolhida });
      await queryClient.invalidateQueries({ queryKey: ['photos'] });
      await queryClient.invalidateQueries({ queryKey: ['sync', 'queue'] });
      toast.success('Foto guardada.', {
        description:
          (dataInput.current?.value || data) === today
            ? 'Privada — só você vê.'
            : `Registrada em ${formatDay(dataInput.current?.value || data)}.`,
      });
    } catch (error) {
      toast.error('Não foi possível preparar a foto.', {
        description: error instanceof Error ? error.message : 'Tente outra imagem.',
      });
    } finally {
      setSaving(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function handleDelete(photo: GalleryPhoto) {
    if (!photo.clientId) return;
    const confirmed = window.confirm('Apagar esta foto? Não dá para desfazer.');
    if (!confirmed) return;

    await removePhoto(photo.clientId);
    await queryClient.invalidateQueries({ queryKey: ['photos'] });
    setSelected(null);
    toast.success('Foto apagada.');
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Fotos</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
            <Lock aria-hidden className="size-3.5" />
            Privadas por padrão
          </p>
        </div>

        <ButtonLink href="/evolucao/comparar"
          variant="outline"
          size="sm"
          className="h-10"
        >
          <GitCompareArrows aria-hidden className="size-4" />
          Comparar
        </ButtonLink>
      </header>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => void handleFile(event)}
        className="sr-only"
        id="nova-foto"
      />

      <section className="border-border flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex items-end gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="data-foto" className="text-muted-foreground text-xs">
              Dia da foto
            </Label>
            <Input
              ref={dataInput}
              id="data-foto"
              type="date"
              defaultValue={dataInicial ?? today}
              max={today}
              // `onInput` além de `onChange`: o Input do Base UI não repassa o
              // onChange do date picker em toda plataforma, e o rótulo abaixo
              // precisa acompanhar o campo
              onInput={(event) => setData(event.currentTarget.value || today)}
              onChange={(event) => setData(event.target.value || today)}
              className="h-12 text-base"
            />
          </div>

          {data !== today ? (
            <Button
              variant="ghost"
              className="h-12"
              onClick={() => {
                if (dataInput.current) dataInput.current.value = today;
                setData(today);
              }}
            >
              Hoje
            </Button>
          ) : null}
        </div>

        <Button
          className="h-14 text-base font-semibold"
          disabled={saving}
          onClick={() => fileInput.current?.click()}
        >
          <Camera aria-hidden className="size-5" />
          {saving ? 'Preparando…' : data === today ? 'Registrar foto de hoje' : `Registrar foto de ${formatDay(data)}`}
        </Button>
      </section>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <Skeleton key={index} className="aspect-3/4 rounded-lg" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="Sua primeira foto é o Dia 1."
          description="Uma foto por dia vira um vídeo daqui a três meses. Ninguém vê além de você."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(([day, photos]) => (
            <section key={day} className="flex flex-col gap-2">
              <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                Dia {protocolDay(protocolStartedOn, day)} · {formatDay(day)}
              </h2>

              <ul className="grid grid-cols-3 gap-2">
                {photos.map((photo) => (
                  <li key={photo.key}>
                    <button
                      type="button"
                      onClick={() => setSelected(photo)}
                      className="group border-border relative block aspect-3/4 w-full overflow-hidden rounded-lg border"
                    >
                      {photo.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- blob local ou URL assinada de curta duração
                        <img
                          src={photo.thumbUrl}
                          alt={`Foto de ${formatDay(photo.takenOn)}`}
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="bg-secondary flex size-full items-center justify-center">
                          <Camera aria-hidden className="text-muted-foreground size-5" />
                        </span>
                      )}

                      {photo.pending ? (
                        <span
                          title="Aguardando envio"
                          className="bg-background/90 absolute top-1 right-1 rounded-full p-1"
                        >
                          <CloudOff aria-hidden className="text-muted-foreground size-3" />
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Drawer open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{selected ? formatDay(selected.takenOn) : ''}</DrawerTitle>
          </DrawerHeader>
          {selected ? (
            <PhotoDetail photo={selected} onDelete={() => void handleDelete(selected)} />
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function PhotoDetail({ photo, onDelete }: { photo: GalleryPhoto; onDelete: () => void }) {
  const url = useFullPhoto(photo);

  return (
    <div className="flex flex-col gap-4 px-4 pb-8">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob local ou URL assinada
        <img
          src={url}
          alt={`Foto de ${formatDay(photo.takenOn)}`}
          className="border-border max-h-[55vh] w-full rounded-xl border object-contain"
        />
      ) : (
        <Skeleton className="h-72 w-full rounded-xl" />
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground tnum text-sm">
          {photo.weightKg ? `${photo.weightKg.toFixed(1).replace('.', ',')} kg` : 'Sem peso registrado'}
          {photo.pending ? ' · aguardando envio' : ''}
        </p>

        <Button variant="ghost" size="sm" onClick={onDelete} disabled={!photo.clientId}>
          <Trash2 aria-hidden className="size-4" />
          Apagar
        </Button>
      </div>
    </div>
  );
}
