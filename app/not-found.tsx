
import { ButtonLink } from '@/components/ui/button-link';

export default function NotFound() {
  return (
    <main className="pt-safe px-safe flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-muted-foreground font-mono text-sm tracking-widest">404</p>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">Esta página não existe</h1>
        <p className="text-muted-foreground max-w-sm">
          O endereço pode ter mudado. Volte para o seu dia de hoje.
        </p>
      </div>

      <ButtonLink href="/hoje" size="lg" className="h-12">
        Ir para o meu protocolo
      </ButtonLink>
    </main>
  );
}
