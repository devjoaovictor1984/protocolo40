import type { Metadata } from 'next';

import { MeasurementsPage } from '@/features/measurements/components/measurements-page';

export const metadata: Metadata = { title: 'Medidas', robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MedidasPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const data =
    typeof params.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.data)
      ? params.data
      : undefined;

  return <MeasurementsPage openFormOnMount={params.novo === '1'} dataInicial={data} />;
}
