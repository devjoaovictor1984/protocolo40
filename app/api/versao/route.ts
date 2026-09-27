import { NextResponse } from 'next/server';

import { VERSAO } from '@/lib/versao';

/**
 * A versão publicada agora, para o app aberto no celular saber se ficou velho.
 *
 * Sem cache em lugar nenhum: a resposta só serve se for a do deploy atual. O
 * service worker já trata `/api` como rede pura.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ versao: VERSAO }, { headers: { 'Cache-Control': 'no-store' } });
}
