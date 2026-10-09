'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { recarregar } from '@/lib/query/refresh';
import { createClient } from '@/lib/supabase/client';

/**
 * Registrar um dia de descanso — hoje ou ontem.
 *
 * As regras vivem no banco e voltam como código — um por semana, nunca num dia
 * já treinado, nunca no futuro nem antes de ontem. A tela traduz o motivo em
 * vez de dizer "erro".
 */

const MOTIVOS: Record<string, string> = {
  limite: 'Você já tem um descanso nesta semana. Um por semana é o limite.',
  ja_treinou: 'Este dia já tem treino — ele já está garantido.',
  futuro: 'Só dá para registrar o descanso no próprio dia.',
  antigo: 'O descanso pode ser registrado até o dia seguinte. Esse já passou.',
  sem_sessao: 'Sua sessão expirou. Entre de novo.',
};

export function useRegistrarDescanso() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [salvando, setSalvando] = useState(false);

  async function registrar(dia: string): Promise<boolean> {
    setSalvando(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('registrar_descanso', { p_day: dia });

      if (error) throw error;

      if (data !== 'ok') {
        toast.error('Não deu para registrar o descanso.', {
          description: MOTIVOS[String(data)] ?? 'Tente novamente.',
        });
        return false;
      }

      // a sequência da tela de Hoje é calculada com a lista de descansos: sem
      // recarregá-la, o descanso de ontem ficava gravado e a sequência, quebrada
      await recarregar(queryClient, ['rest-days'], ['dashboard'], ['workouts']);
      // a trilha e o "já descansou" vêm do servidor: sem isto o dia de
      // descanso ficava pedindo o descanso que acabou de ser registrado
      router.refresh();
      toast.success('Descanso registrado.', {
        description: 'Recuperar faz parte. Sua sequência continua.',
      });
      return true;
    } catch {
      toast.error('Não conseguimos registrar agora.', { description: 'Confira a conexão.' });
      return false;
    } finally {
      setSalvando(false);
    }
  }

  return { registrar, salvando };
}
