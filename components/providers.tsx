'use client';

import { useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { SerwistProvider } from '@serwist/next/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Toaster } from '@/components/ui/sonner';

/**
 * Providers de cliente.
 *
 * Fica no topo da árvore, mas é uma casca fina: as páginas continuam sendo
 * Server Components. TanStack Query cuida do estado que muda por interação ou
 * por sincronização — streak, fila offline, status. Leitura de página é RSC.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 24 * 60 * 60 * 1000,
            // offline-first: sem rede, serve o cache em vez de mostrar erro
            networkMode: 'offlineFirst',
            retry: 2,
            refetchOnWindowFocus: true,
          },
          mutations: {
            networkMode: 'offlineFirst',
          },
        },
      }),
  );

  return (
    <SerwistProvider
      swUrl="/sw.js"
      // no desenvolvimento o service worker atrapalha mais do que ajuda
      disable={process.env.NODE_ENV === 'development'}
      reloadOnOnline
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </QueryClientProvider>
    </SerwistProvider>
  );
}
