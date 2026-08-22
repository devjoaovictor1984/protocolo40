import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarCheck, Flame, LineChart, Timer } from 'lucide-react';

import { Wordmark } from '@/components/brand/wordmark';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env';

export const metadata: Metadata = {
  title: 'PROTOCOLO40 — 20 minutos. Todos os dias.',
  description:
    'Treine, registre e acompanhe sua evolução um dia de cada vez. Cronômetro, sequência, fotos de progresso e recordes em um só lugar.',
  alternates: { canonical: '/' },
  openGraph: {
    url: '/',
    title: 'PROTOCOLO40 — 20 minutos. Todos os dias.',
    description: 'Treine, registre e acompanhe sua evolução um dia de cada vez.',
  },
};

const PILARES = [
  {
    icon: Timer,
    title: '20 minutos',
    text: 'Treinos que cabem na rotina. Menos também conta — o que não pode é o dia passar em branco.',
  },
  {
    icon: Flame,
    title: 'Consistência',
    text: 'Acompanhe sua sequência. Um dia de cada vez, sem cobrança e sem culpa.',
  },
  {
    icon: LineChart,
    title: 'Evolução',
    text: 'Treinos, fotos, peso e progresso no mesmo lugar. A evidência aparece sozinha.',
  },
];

const LINHA_DO_TEMPO = ['Dia 1', 'Dia 30', 'Dia 60', 'Dia 90'];

export default function LandingPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'PROTOCOLO40',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web, Android, iOS',
    url: env.siteUrl,
    description: 'Plataforma de treino, consistência e evolução física. 20 minutos por dia.',
    inLanguage: 'pt-BR',
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="flex items-center justify-between px-5 py-6">
        <Wordmark href={null} />
        <Button render={<Link href="/login" />} variant="ghost" size="sm">
          Entrar
        </Button>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto flex max-w-2xl flex-col gap-7 px-5 pt-10 pb-16 md:pt-20">
          <h1 className="text-5xl leading-[0.95] font-extrabold tracking-tighter text-balance md:text-7xl">
            20 minutos.
            <br />
            <span className="text-primary">Todos os dias.</span>
          </h1>

          <p className="text-muted-foreground max-w-md text-lg text-balance md:text-xl">
            Treine, registre e acompanhe sua evolução um dia de cada vez.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              render={<Link href="/cadastro" />}
              size="lg"
              className="h-14 text-base font-semibold sm:w-auto"
            >
              COMEÇAR MEU PROTOCOLO
            </Button>
            <Button render={<Link href="/login" />} variant="ghost" size="lg" className="h-14 text-base">
              Já tenho conta
            </Button>
          </div>

          <p className="text-muted-foreground text-sm">
            Sem mensalidade para começar. Funciona no celular, inclusive sem internet.
          </p>
        </section>

        {/* Pilares */}
        <section className="border-border border-t">
          <div className="mx-auto grid max-w-4xl gap-px px-5 md:grid-cols-3 md:px-0">
            {PILARES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="border-border flex flex-col gap-3 border-b py-9 md:border-b-0 md:px-6">
                <Icon aria-hidden className="text-primary size-6" />
                <h2 className="text-xl font-bold tracking-tight">{title}</h2>
                <p className="text-muted-foreground text-[15px]">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Diferencial */}
        <section className="bg-secondary/60 border-border border-t">
          <div className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
              Veja sua transformação acontecer.
            </h2>

            <p className="text-muted-foreground text-lg">
              Uma foto por dia vira um vídeo no fim do trimestre. Você não precisa lembrar de nada —
              o PROTOCOLO40 guarda tudo em ordem, e as fotos são privadas até você decidir o
              contrário.
            </p>

            <ol className="flex flex-wrap items-center gap-2" aria-label="Linha do tempo da evolução">
              {LINHA_DO_TEMPO.map((dia, index) => (
                <li key={dia} className="flex items-center gap-2">
                  <span className="border-border bg-background rounded-lg border px-3 py-2 font-mono text-sm font-medium">
                    {dia}
                  </span>
                  {index < LINHA_DO_TEMPO.length - 1 ? (
                    <span aria-hidden className="text-muted-foreground">
                      →
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>

            <div>
              <Button render={<Link href="/cadastro" />} size="lg" className="h-14 text-base font-semibold">
                COMEÇAR MEU PROTOCOLO
              </Button>
            </div>
          </div>
        </section>

        {/* Fechamento */}
        <section className="mx-auto max-w-2xl px-5 py-16">
          <div className="flex items-start gap-4">
            <CalendarCheck aria-hidden className="text-primary mt-1 size-6 shrink-0" />
            <p className="text-2xl leading-snug font-bold tracking-tight text-balance md:text-3xl">
              Deixe de &ldquo;preciso começar a treinar&rdquo; e passe a
              <span className="text-primary"> &ldquo;só preciso fazer meus 20 minutos hoje&rdquo;</span>.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-border text-muted-foreground border-t px-5 py-8 text-sm">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Wordmark href={null} showTagline />
          <p>© {new Date().getFullYear()} PROTOCOLO40</p>
        </div>
      </footer>
    </div>
  );
}
