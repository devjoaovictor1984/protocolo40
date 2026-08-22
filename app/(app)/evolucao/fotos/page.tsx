import type { Metadata } from 'next';

import { PhotoGallery } from '@/features/photos/components/photo-gallery';

export const metadata: Metadata = { title: 'Fotos', robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FotosPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return <PhotoGallery openCameraOnMount={params.nova === '1'} />;
}
