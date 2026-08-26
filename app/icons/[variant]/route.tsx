import { renderIcon } from '@/lib/brand/icon';

/** Ícones do manifest: /icons/192, /icons/512 e /icons/maskable. */
/**
 * Só o badge sobrou aqui.
 *
 * Os ícones do app agora são arquivos de verdade em `public/icons`, servidos
 * pelo CDN. O badge continua sendo desenhado por código porque precisa ser
 * silhueta monocromática em fundo transparente — o Android recorta a forma e
 * pinta de branco, e a arte com fundo escuro viraria um quadrado sólido.
 */
const VARIANTS: Record<string, { size: number; maskable: boolean; badge?: boolean }> = {
  badge: { size: 96, maskable: false, badge: true },
};

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  const config = VARIANTS[variant];

  if (!config) {
    return new Response('Ícone não encontrado', { status: 404 });
  }

  return renderIcon(config.size, config.maskable, config.badge);
}
