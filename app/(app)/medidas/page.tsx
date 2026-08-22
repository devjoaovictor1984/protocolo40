import type { Metadata } from 'next';

import { MeasurementsPage } from '@/features/measurements/components/measurements-page';

export const metadata: Metadata = { title: 'Medidas', robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MedidasPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return <MeasurementsPage openFormOnMount={params.novo === '1'} />;
}
