import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

import { Providers } from '@/components/providers';
import { env } from '@/lib/env';

import './globals.css';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

const mono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: 'PROTOCOLO40 — 20 minutos. Todos os dias.',
    template: '%s · PROTOCOLO40',
  },
  description:
    'Treine, registre e acompanhe sua evolução um dia de cada vez. 20 minutos por dia, sequência, fotos de progresso e recordes em um só lugar.',
  applicationName: 'Protocolo40',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'P40',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'PROTOCOLO40',
    title: 'PROTOCOLO40 — 20 minutos. Todos os dias.',
    description: 'Treine, registre e acompanhe sua evolução um dia de cada vez.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PROTOCOLO40 — 20 minutos. Todos os dias.',
    description: 'Treine, registre e acompanhe sua evolução um dia de cada vez.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  // a bottom nav precisa respeitar a safe area do iOS
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#15171c' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
