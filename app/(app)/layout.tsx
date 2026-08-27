import { redirect } from 'next/navigation';

import { BottomNav, SideNav } from '@/components/app-nav';
import { FloatingTimer } from '@/features/timer/components/floating-timer';
import { SessionProvider } from '@/features/session/session-context';
import { needsOnboarding, requireSession } from '@/lib/auth/session';

/**
 * Shell da aplicação.
 *
 * Server Component: carrega perfil e configurações uma vez e passa para as
 * ilhas de cliente. A navegação é a única parte interativa daqui.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, settings } = await requireSession();

  if (needsOnboarding(profile)) {
    redirect('/onboarding');
  }

  return (
    <SessionProvider
      value={{
        userId: user.id,
        username: profile.username,
        fullName: profile.full_name,
        timezone: profile.timezone,
        protocolStartedOn: profile.protocol_started_on,
        dailyGoalSeconds: settings.daily_goal_seconds,
      }}
    >
      <div className="px-safe flex min-h-dvh">
        <SideNav />

        <div className="flex min-w-0 flex-1 flex-col">
          {/*
            pt-safe afasta o conteúdo da status bar e da ilha dinâmica;
            pb-28 deixa a bottom nav sem cobrir o fim da página.
          */}
          <main className="pt-safe mx-auto w-full max-w-3xl flex-1 px-4 pb-28 lg:px-8 lg:pt-4 lg:pb-12">
            {children}
          </main>
        </div>
      </div>

      {/* o cronômetro segue por todas as telas: o treino sempre continuou
          rodando ao sair daqui, o que faltava era isso aparecer */}
      <FloatingTimer />

      <BottomNav />
    </SessionProvider>
  );
}
