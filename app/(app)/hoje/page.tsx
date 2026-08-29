import type { Metadata } from 'next';

import { conquistasDoUsuario } from '@/features/badges/repository';
import { desafioEmDestaque, meusDiasPorDesafio } from '@/features/challenges/repository';
import { Dashboard } from '@/features/dashboard/components/dashboard';
import { metaParaTela } from '@/features/goals/repository';
import { painelDeSaude } from '@/features/health/repository';
import { mensagemDoDia } from '@/features/messages/repository';
import { requireSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { todayIn } from '@/services/calendar';

export const metadata: Metadata = {
  title: 'Hoje',
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const { profile } = await requireSession();
  // o dia é o do usuário: quem abre o app à meia-noite e meia em Manaus não
  // pode receber a mensagem de ontem
  const hoje = todayIn(profile.timezone);

  const supabase = await createClient();

  const [mensagem, saude, { data: descanso }, conquistas, desafio, diasPorDesafio, meta] =
    await Promise.all([
      mensagemDoDia(hoje),
      painelDeSaude(profile, hoje),
      supabase.from('rest_days').select('day').eq('user_id', profile.id).eq('day', hoje).maybeSingle(),
      conquistasDoUsuario(profile.id),
      desafioEmDestaque(hoje),
      // os dias de todos os desafios de uma vez: qual deles vai aparecer só se
      // sabe depois, e pedir pelo slug obrigaria a esperar a outra consulta
      meusDiasPorDesafio(),
      metaParaTela(profile.id),
    ]);

  // as conquistadas já vêm da mais recente para a mais antiga
  const ultima = conquistas.conquistadas[0] ?? null;

  return (
    <Dashboard
      mensagem={mensagem}
      agua={saude.aguaMl}
      metaAgua={saude.metas.aguaMl}
      descansouHoje={Boolean(descanso)}
      ultimaInsignia={
        ultima ? { emblem: ultima.emblem, tier: ultima.tier, name: ultima.name } : null
      }
      desafio={desafio}
      diasNoDesafio={desafio ? (diasPorDesafio.get(desafio.id) ?? []) : []}
      meta={meta}
    />
  );
}
