import { Wordmark } from '@/components/brand/wordmark';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 py-6">
        <Wordmark />
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pb-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
