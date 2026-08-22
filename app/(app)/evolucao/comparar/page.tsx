import type { Metadata } from 'next';

import { PhotoComparison } from '@/features/photos/components/photo-comparison';

export const metadata: Metadata = { title: 'Comparar fotos', robots: { index: false, follow: false } };

export default function CompararPage() {
  return <PhotoComparison />;
}
