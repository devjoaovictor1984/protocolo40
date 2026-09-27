import type { Metadata } from 'next';

import { conquistasDoUsuario } from '@/features/badges/repository';
import { desafiosDoHoje, meusDiasPorDesafio } from '@/features/challenges/repository';
import { Dashboard } from '@/features/dashboard/components/dashboard';
import { metaParaTela } from '@/features/goals/repository';
import { painelDeSaude } from '@/features/health/repository';
import { mensagemDoDia } from '@/features/messages/repository';
import { minhaTrilha, trilhaEmDestaque } from '@/features/tracks/repository';
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

  const [mensagem, saude, { data: descanso }, conquistas, desafios, diasPorDesafio, meta, trilha] =
    await Promise.all([
      mensagemDoDia(hoje),
      painelDeSaude(profile, hoje),
      supabase.from('rest_days').select('day').eq('user_id', profile.id).eq('day', hoje).maybeSingle(),
      conquistasDoUsuario(profile.id),
      desafiosDoHoje(hoje),
      // os dias de todos os desafios de uma vez: quais vão aparecer só se sabe
      // depois, e pedir pelo slug obrigaria a esperar a outra consulta
      meusDiasPorDesafio(),
      metaParaTela(profile.id),
      minhaTrilha(),
    ]);

  // o convite só é buscado para quem não está em trilha nenhuma: uma consulta a
  // menos em toda abertura de quem já entrou
  const trilhaOferecida = trilha ? null : await trilhaEmDestaque();

  // o convite grande do novato só existe para quem não recusou; a medalha é
  // buscada só nesse caso, que é o único em que ela aparece aqui
  const conviteDoNovato =
    trilhaOferecida && !profile.track_offer_declined_at
      ? {
          medalha: trilhaOferecida.badge_slug
            ? ((
                await supabase
                  .from('badges')
                  .select('name, tier, emblem')
                  .eq('slug', trilhaOferecida.badge_slug)
                  .maybeSingle()
              ).data ?? null)
            : null,
        }
      : null;

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
      desafios={desafios.map(({ desafio }) => ({
        desafio,
        dias: diasPorDesafio.get(desafio.id) ?? [],
      }))}
      meta={meta}
      trilha={trilha}
      trilhaOferecida={trilhaOferecida}
      conviteDoNovato={conviteDoNovato}
    />
  );
}
