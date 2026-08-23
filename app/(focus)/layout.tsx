import { SessionProvider } from '@/features/session/session-context';
import { requireSession } from '@/lib/auth/session';

/**
 * Shell sem navegação.
 *
 * Cronômetro, finalização e onboarding ocupam a tela inteira: nesses momentos
 * existe uma única coisa a fazer, e a barra de navegação só atrapalharia.
 */
export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, settings } = await requireSession();

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
      <div className="pt-safe px-safe flex min-h-dvh flex-col">{children}</div>
    </SessionProvider>
  );
}
