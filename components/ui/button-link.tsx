import Link from 'next/link';
import type { VariantProps } from 'class-variance-authority';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Um link com aparência de botão.
 *
 * Não é o `Button` renderizando um `<a>` por dentro: aquilo promete ao leitor
 * de tela um botão e entrega um link, e as duas coisas não se comportam igual
 * no teclado — botão dispara com espaço, link com Enter, e link abre em nova
 * aba com o clique do meio.
 *
 * Aqui o elemento é um link de verdade, vestido com as classes do botão.
 */
export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return <Link className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
