'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { profileSchema } from '@/lib/validation/profile';
import type { WorkoutGoal, WorkoutLevel, WorkoutPlace } from '@/types/database';

export type OnboardingState = {
  status: 'idle' | 'error' | 'success';
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const idleOnboarding: OnboardingState = { status: 'idle' };

/**
 * Conclui o onboarding.
 *
 * Nada aqui é obrigatório além do nível e do local, que já vêm com um padrão
 * selecionado: o usuário pode pular tudo e completar o perfil depois.
 */
export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    full_name: formData.get('full_name') ?? undefined,
    username: formData.get('username'),
    birth_date: formData.get('birth_date') ?? undefined,
    height_cm: formData.get('height_cm'),
    goal: formData.get('goal') || null,
    level: formData.get('level') ?? 'iniciante',
    default_location: formData.get('default_location') ?? 'casa',
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      fieldErrors[key] ??= issue.message;
    }
    return { status: 'error', message: 'Confira os campos destacados.', fieldErrors };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name,
      username: parsed.data.username,
      birth_date: parsed.data.birth_date,
      height_cm: parsed.data.height_cm,
      goal: (parsed.data.goal as WorkoutGoal | null) ?? null,
      level: parsed.data.level as WorkoutLevel,
      default_location: parsed.data.default_location as WorkoutPlace,
      // fuso do aparelho: é o que define o dia do treino e a sequência
      timezone: String(formData.get('timezone') || 'America/Sao_Paulo'),
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    if (error.code === '23505') {
      return {
        status: 'error',
        message: 'Esse nome de usuário já está em uso.',
        fieldErrors: { username: 'Escolha outro nome de usuário.' },
      };
    }

    return {
      status: 'error',
      message: 'Não conseguimos salvar seu perfil agora. Tente novamente.',
    };
  }

  // o peso inicial entra como a primeira medida do protocolo
  const weightRaw = String(formData.get('weight_kg') ?? '').replace(',', '.');
  const weight = weightRaw ? Number(weightRaw) : null;

  if (weight !== null && Number.isFinite(weight) && weight >= 20 && weight <= 400) {
    await supabase.from('body_measurements').insert({
      user_id: user.id,
      client_id: crypto.randomUUID(),
      measured_on: new Date().toISOString().slice(0, 10),
      weight_kg: weight,
    });
  }

  revalidatePath('/', 'layout');
  return { status: 'success' };
}

/** Pula o onboarding sem preencher nada. O perfil fica completável depois. */
export async function skipOnboarding(): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();

  await supabase
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', user.id);

  revalidatePath('/', 'layout');
}
