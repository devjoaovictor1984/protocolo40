import type { Metadata } from 'next';

import { TemplateList } from '@/features/templates/components/template-list';

export const metadata: Metadata = {
  title: 'Seus treinos',
  robots: { index: false, follow: false },
};

export default function FavoritosPage() {
  return <TemplateList onlyFavorites />;
}
