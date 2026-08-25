import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { analisar, type Analise, type TreinoFeito } from '@/services/analysis';
import { focoDaSemana, type FocoDaSemana, type Objetivo } from '@/services/objective';

/**
 * Dados da consultoria.
 *
 * Oito semanas: quatro para a janela atual e quatro para comparar. Buscar mais
 * não melhora o diagnóstico e deixa a tela lenta justo para quem treina há
 * mais tempo.
 */

const SEMANAS = 8;

type LinhaExercicio = {
  exercise_id: string;
  sets: number | null;
  repetitions: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  weight_kg: number | null;
  exercises: { name: string; category: string } | null;
};

/**
 * Os treinos da janela, crus.
 *
 * Separado do diagnóstico porque duas leituras diferentes partem dos mesmos
 * dados: a consultoria exercício por exercício e o foco por objetivo. Buscar
 * duas vezes seria pagar a consulta em dobro.
 */
async function treinosDaJanela(userId: string): Promise<TreinoFeito[]> {
  const supabase = await createClient();
  const desde = new Date(Date.now() - SEMANAS * 7 * 86_400_000).toISOString().slice(0, 10);

  const { data } = await supabase
    .from('workouts')
    .select(
      'workout_date, duration_seconds, rounds, effort, workout_exercises(exercise_id, sets, repetitions, duration_seconds, distance_meters, weight_kg, exercises(name, category))',
    )
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('workout_date', desde)
    .order('workout_date', { ascending: false });

  const treinos: TreinoFeito[] = (data ?? []).map((linha) => {
    const itens = (linha.workout_exercises ?? []) as unknown as LinhaExercicio[];

    return {
      workout_date: linha.workout_date,
      duration_seconds: linha.duration_seconds,
      rounds: linha.rounds,
      effort: linha.effort,
      exercises: itens.map((item) => ({
        exercise_id: item.exercise_id,
        exercise_name: item.exercises?.name ?? 'Exercício',
        category: item.exercises?.category ?? null,
        sets: item.sets,
        repetitions: item.repetitions,
        duration_seconds: item.duration_seconds,
        distance_meters: item.distance_meters,
        weight_kg: item.weight_kg,
      })),
    };
  });

  return treinos;
}

export async function analiseDoUsuario(userId: string, hoje: string): Promise<Analise> {
  return analisar(await treinosDaJanela(userId), hoje);
}

/**
 * O foco por objetivo.
 *
 * Puxa os dias de descanso junto: sem eles, quem descansa direito aparece como
 * quem simplesmente faltou — e levaria um conselho para corrigir algo que já
 * está certo.
 */
export async function focoDoUsuario(
  userId: string,
  objetivo: Objetivo | null,
  hoje: string,
): Promise<FocoDaSemana> {
  const supabase = await createClient();
  const desde = new Date(Date.now() - SEMANAS * 7 * 86_400_000).toISOString().slice(0, 10);

  const [treinos, { data: descansos }] = await Promise.all([
    treinosDaJanela(userId),
    supabase.from('rest_days').select('day').eq('user_id', userId).gte('day', desde),
  ]);

  return focoDaSemana(treinos, (descansos ?? []).map((linha) => linha.day), objetivo, hoje);
}
