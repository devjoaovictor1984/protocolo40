import type { NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Tudo, menos:
     * - arquivos estáticos e otimização de imagem do Next
     * - service worker, manifest e ícones (precisam ser servidos sem redirect)
     * - qualquer arquivo com extensão
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.[\\w]+$).*)',
  ],
};
