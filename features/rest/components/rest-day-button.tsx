'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BedDouble, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useToday } from '@/features/session/session-context';
import { recarregar } from '@/lib/query/refresh';
import { createClient } from '@/lib/supabase/client';

/**
 * Registrar descanso.
 *
 * Fica discreto de propósito, abaixo do botão de treinar: é a segunda opção
 * do dia, não a primeira. Um botão de descanso do mesmo tamanho do de treinar
 * convida a escolher o mais fácil.
 *
 * As regras vivem no banco e voltam como código — um por semana, e nunca num
 * dia já treinado. A tela traduz o motivo em vez de dizer "erro".
 */

const MOTIVOS: Record<string, string> = {
  limite: 'Você já tem um descanso nesta semana. Um por semana é o limite.',
  ja_treinou: 'Você já treinou hoje — este dia já está garantido.',
  sem_sessao: 'Sua sessão expirou. Entre de novo.',
};

export function RestDayButton({ jaDescansou }: { jaDescansou: boolean }) {
  const hoje = useToday();
  const queryClient = useQueryClient();
  const [salvando, setSalvando] = useState(false);

  if (jaDescansou) {
    return (
      <p className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
        <Check aria-hidden className="text-success size-4" />
        Descanso registrado. Sua sequência continua de pé.
      </p>
    );
  }

  async function registrar() {
    setSalvando(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('registrar_descanso', { p_day: hoje });

      if (error) throw error;

      if (data !== 'ok') {
        toast.error('Não deu para registrar o descanso.', {
          description: MOTIVOS[String(data)] ?? 'Tente novamente.',
        });
        return;
      }

      await recarregar(queryClient, ['dashboard'], ['workouts']);
      toast.success('Descanso registrado.', {
        description: 'Recuperar faz parte. Sua sequência continua.',
      });
    } catch {
      toast.error('Não conseguimos registrar agora.', { description: 'Confira a conexão.' });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Button
      variant="ghost"
      className="text-muted-foreground h-11"
      disabled={salvando}
      onClick={() => void registrar()}
    >
      {salvando ? (
        <Loader2 aria-hidden className="size-4 animate-spin" />
      ) : (
        <BedDouble aria-hidden className="size-4" />
      )}
      Hoje é dia de descanso
    </Button>
  );
}
