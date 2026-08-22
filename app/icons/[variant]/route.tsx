import { renderIcon } from '@/lib/brand/icon';

/** Ícones do manifest: /icons/192, /icons/512 e /icons/maskable. */
const VARIANTS: Record<string, { size: number; maskable: boolean }> = {
  '192': { size: 192, maskable: false },
  '512': { size: 512, maskable: false },
  maskable: { size: 512, maskable: true },
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

  return renderIcon(config.size, config.maskable);
}
