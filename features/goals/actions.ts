'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '@/lib/auth/session';
import { invalidState, type ActionState } from '@/lib/forms/action-state';
import { createClient } from '@/lib/supabase/server';
import { metaDePesoSchema } from '@/lib/validation/goal';
import { todayIn } from '@/services/calendar';
import { avaliarAlvo } from '@/services/goals';
import { metaAtiva, pesoMaisRecente } from '@/features/goals/repository';

/**
 * Definir ou mudar a meta de peso.
 *
 * Três coisas acontecem aqui e valem explicação:
 *
 * 1. **O peso de partida é congelado.** `start_kg` vira a pesagem mais recente
 *    no dia em que a meta nasce, e não muda depois. Sem isso, registrar uma
 *    medida antiga (o app permite, porque `bm_day_key` é por dia e não por
 *    ordem de chegada) faria a barra de progresso andar sozinha para trás.
 * 2. **Mudar o alvo não reinicia a jornada.** O que já foi percorrido continua
 *    contando. A exceção é inverter o sentido — quem estava perdendo e agora
 *    quer ganhar começou outra coisa, e aí a partida é hoje.
 * 3. **O piso é conferido duas vezes.** Aqui, para dar uma mensagem que explica;
 *    e no gatilho `weight_goals_piso`, que é quem garante. Uma regra que
 *    protege alguém não pode depender de qual caminho de código escreveu.
 */
export async function definirMeta(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, profile } = await requireSession();

  const parsed = metaDePesoSchema.safeParse({ target_kg: formData.get('target_kg') });
  if (!parsed.success) return invalidState(parsed.error.issues);

  const alvoKg = parsed.data.target_kg;

  const avaliacao = avaliarAlvo(alvoKg, profile.height_cm);
  if (avaliacao.nivel === 'recusado') {
    return {
      status: 'error',
      message: avaliacao.mensagem,
      fieldErrors: { target_kg: 'Escolha um peso dentro do intervalo que dá para acompanhar.' },
    };
  }

  const hoje = todayIn(profile.timezone);
  const peso = await pesoMaisRecente(user.id);

  if (peso === null) {
    return {
      status: 'error',
      message:
        'Registre seu peso de hoje antes de definir a meta — é dele que sai o ponto de partida.',
      fieldErrors: { target_kg: 'Falta o peso atual.' },
    };
  }

  if (Math.abs(peso.kg - alvoKg) < 0.5) {
    return {
      status: 'error',
      message:
        'A meta está a menos de meio quilo do seu peso atual, que é menos do que a balança ' +
        'varia de um dia para o outro. Escolha um alvo um pouco mais distante.',
      fieldErrors: { target_kg: 'Alvo muito perto do peso atual.' },
    };
  }

  const supabase = await createClient();
  const atual = await metaAtiva(user.id);

  if (atual) {
    const sentidoAntigo = Number(atual.target_kg) < Number(atual.start_kg) ? 'perder' : 'ganhar';
    const sentidoNovo = alvoKg < peso.kg ? 'perder' : 'ganhar';
    const inverteu = sentidoAntigo !== sentidoNovo;

    const { error } = await supabase
      .from('weight_goals')
      .update({
        target_kg: alvoKg,
        // inverter o sentido é começar outra jornada, não continuar a mesma
        ...(inverteu ? { start_kg: peso.kg, started_on: hoje } : {}),
      })
      .eq('id', atual.id);

    if (error) return erroDeGravacao(error);

    revalidatePath('/evolucao');
    return { status: 'success', message: 'Meta atualizada.' };
  }

  const { error } = await supabase.from('weight_goals').insert({
    user_id: user.id,
    target_kg: alvoKg,
    start_kg: peso.kg,
    started_on: hoje,
  });

  if (error) return erroDeGravacao(error);

  revalidatePath('/evolucao');
  return { status: 'success', message: 'Meta definida.' };
}

/**
 * Fechar a meta como alcançada.
 *
 * É um botão, e não uma gravação automática quando a tendência cruza o alvo.
 * Duas razões: a conta que decide isso roda no navegador, e escrever no banco a
 * partir de um cálculo do cliente é confiar no lugar errado; e chegar na meta é
 * momento da pessoa — quem fecha é ela.
 */
export async function concluirMeta(): Promise<void> {
  const { user, profile } = await requireSession();

  const atual = await metaAtiva(user.id);
  if (!atual) return;

  const supabase = await createClient();
  await supabase
    .from('weight_goals')
    .update({ achieved_on: todayIn(profile.timezone) })
    .eq('id', atual.id);

  revalidatePath('/evolucao');
}

/** Desistir da meta atual. Sai da tela e libera o índice para a próxima. */
export async function encerrarMeta(): Promise<void> {
  const { user } = await requireSession();

  const atual = await metaAtiva(user.id);
  if (!atual) return;

  const supabase = await createClient();
  await supabase
    .from('weight_goals')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', atual.id);

  revalidatePath('/evolucao');
}

/**
 * O gatilho do piso devolve `check_violation`. Sem esta tradução a pessoa
 * receberia a mensagem crua do Postgres na tela — que é justamente o que a
 * regra de escrita do projeto proíbe.
 */
function erroDeGravacao(error: { code?: string; message?: string }): ActionState {
  if (error.code === '23514' || error.message?.includes('meta_abaixo_do_piso')) {
    return {
      status: 'error',
      message:
        'Esse peso fica abaixo do limite que dá para acompanhar aqui com segurança. ' +
        'Um objetivo nessa faixa pede acompanhamento de profissional de saúde.',
      fieldErrors: { target_kg: 'Peso abaixo do limite aceito.' },
    };
  }

  return { status: 'error', message: 'Não conseguimos salvar agora. Tente de novo.' };
}
