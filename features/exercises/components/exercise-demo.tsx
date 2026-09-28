'use client';

import { XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { getExerciseDemo } from '@/features/exercises/demos';
import { cn } from '@/lib/utils';

/**
 * O mascote fazendo o exercício: miniatura na lista, grande ao tocar.
 *
 * Ocupa o tamanho de quem o envolve — a lista decide o espaço, e o desenho se
 * encaixa sem distorcer (`object-contain`). Exercício sem demonstração não
 * desenha nada; é a lista que decide se reserva o lugar.
 *
 * Nada de JavaScript trocando quadros: a animação é um WebP animado, que o
 * navegador toca sozinho e deixa de decodificar quando sai da tela. Por isso
 * também não há estado aqui além do da janela.
 *
 * O que cada tela baixa:
 * - a miniatura (~15 KB) só quando chega perto da tela (`loading="lazy"`);
 * - a animação grande só quando alguém abre a janela — o conteúdo do Dialog
 *   não existe no DOM enquanto ele está fechado;
 * - com "reduzir movimento" ligado no aparelho, o `<picture>` troca as duas por
 *   um quadro parado, e a animação nem é pedida.
 */
export function ExerciseDemo({ slug, name, className }: {
  slug: string | null | undefined;
  name: string;
  className?: string;
}) {
  const demo = getExerciseDemo(slug);
  if (!demo) return null;

  return (
    <Dialog>
      <DialogTrigger
        aria-label={`Ver execução: ${name}`}
        className={cn(
          'hover:bg-muted focus-visible:ring-ring/50 block size-full cursor-pointer rounded-lg transition-colors outline-none focus-visible:ring-3',
          className,
        )}
      >
        <picture className="block size-full">
          <source media="(prefers-reduced-motion: reduce)" srcSet={demo.still} />
          {/* `<img>` e não `next/image`: o otimizador serviria o WebP animado parado */}
          <img
            src={demo.thumb}
            alt=""
            loading="lazy"
            decoding="async"
            width={demo.width}
            height={demo.height}
            className="size-full object-contain"
          />
        </picture>
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/70"
        className="gap-3 p-4 sm:max-w-lg"
      >
        <DialogTitle className="pr-10 text-lg font-extrabold tracking-tight">{name}</DialogTitle>
        <DialogDescription className="sr-only">
          Demonstração do exercício {name}, repetindo sem parar. Feche para voltar ao treino.
        </DialogDescription>

        <picture>
          <source media="(prefers-reduced-motion: reduce)" srcSet={demo.still} />
          {/* `<img>` e não `next/image`: o otimizador serviria o WebP animado parado */}
          <img
            src={demo.demo}
            alt={`Demonstração do exercício ${name}`}
            decoding="async"
            width={demo.width}
            height={demo.height}
            className="mx-auto h-auto max-h-[70vh] w-full object-contain"
          />
        </picture>

        <DialogClose
          aria-label="Fechar demonstração"
          render={<Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" />}
        >
          <XIcon aria-hidden />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
