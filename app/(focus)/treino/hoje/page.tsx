import type { Metadata } from 'next';

import { TimerScreen } from '@/features/timer/components/timer-screen';

export const metadata: Metadata = {
  title: 'Treino de hoje',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TreinoHojePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const template = typeof params.template === 'string' ? params.template : null;

  return <TimerScreen templateId={template} autoStart={params.auto === '1'} />;
}
