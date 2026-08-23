import type { Metadata } from 'next';

import { PhotoGallery } from '@/features/photos/components/photo-gallery';

export const metadata: Metadata = { title: 'Fotos', robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FotosPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const data = typeof params.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.data)
    ? params.data
    : undefined;

  return <PhotoGallery openCameraOnMount={params.nova === '1'} dataInicial={data} />;
}
