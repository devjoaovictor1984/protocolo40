import type { Metadata } from 'next';

import { Dashboard } from '@/features/dashboard/components/dashboard';
import { mensagemDoDia } from '@/features/messages/repository';
import { requireSession } from '@/lib/auth/session';
import { todayIn } from '@/services/calendar';

export const metadata: Metadata = {
  title: 'Hoje',
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const { profile } = await requireSession();
  // o dia é o do usuário: quem abre o app à meia-noite e meia em Manaus não
  // pode receber a mensagem de ontem
  const mensagem = await mensagemDoDia(todayIn(profile.timezone));

  return <Dashboard mensagem={mensagem} />;
}
