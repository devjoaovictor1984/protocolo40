'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

/**
 * Login com Google.
 *
 * Precisa acontecer no navegador: o fluxo PKCE guarda o verifier no cliente e
 * volta para /auth/callback, que troca o código pela sessão.
 */
export function GoogleButton({ next = '/app' }: { next?: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });

    if (error) {
      setLoading(false);
      toast.error('Não foi possível abrir o login do Google.', {
        description: 'Verifique sua conexão e tente novamente.',
      });
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="h-12 w-full text-base"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? (
        <Loader2 aria-hidden className="size-4 animate-spin" />
      ) : (
        <svg aria-hidden viewBox="0 0 24 24" className="size-5">
          <path
            fill="#4285F4"
            d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.64h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.17-2 3.44-4.95 3.44-8.57Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.02-6.45-4.74H1.7v2.98A11.5 11.5 0 0 0 12 24Z"
          />
          <path
            fill="#FBBC05"
            d="M5.55 14.68a6.9 6.9 0 0 1 0-4.36V7.34H1.7a11.5 11.5 0 0 0 0 10.32l3.85-2.98Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.69 0 3.2.58 4.4 1.72l3.3-3.3C17.72 1.2 15.1 0 12 0 7.5 0 3.6 2.57 1.7 6.34l3.85 2.98C6.46 6.77 9 4.75 12 4.75Z"
          />
        </svg>
      )}
      Continuar com Google
    </Button>
  );
}
