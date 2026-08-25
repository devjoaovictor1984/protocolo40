'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth/session';
import { invalidState, type ActionState } from '@/lib/forms/action-state';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { profileSchema } from '@/lib/validation/profile';
import type {
  BiologicalSex,
  Visibility,
  WorkoutGoal,
  WorkoutLevel,
  WorkoutPlace,
} from '@/types/database';

const VISIBILITY_KEYS = [
  'profile_visibility',
  'workouts_visibility',
  'photos_visibility',
  'weight_visibility',
  'measurements_visibility',
  'streak_visibility',
] as const;

type VisibilityKey = (typeof VISIBILITY_KEYS)[number];

function isVisibility(value: unknown): value is Visibility {
  return value === 'private' || value === 'followers' || value === 'public';
}

/** Atualiza uma configuração de privacidade por vez. */
export async function updateVisibility(key: VisibilityKey, value: Visibility): Promise<void> {
  if (!VISIBILITY_KEYS.includes(key) || !isVisibility(value)) {
    throw new Error('Configuração inválida.');
  }

  const user = await requireUser();
  const supabase = await createClient();

  // chave computada precisa de um tipo estreito, senão vira índice de string
  const patch: Partial<Record<VisibilityKey, Visibility>> = { [key]: value };

  await supabase.from('user_settings').update(patch).eq('user_id', user.id);

  revalidatePath('/configuracoes/privacidade');
}

export async function updateAllowFollowers(allow: boolean): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();

  await supabase.from('user_settings').update({ allow_followers: allow }).eq('user_id', user.id);
  revalidatePath('/configuracoes/privacidade');
}

export async function updateDailyGoal(seconds: number): Promise<void> {
  const user = await requireUser();

  if (!Number.isFinite(seconds) || seconds < 60 || seconds > 86_400) {
    throw new Error('Meta fora do intervalo aceito.');
  }

  const supabase = await createClient();
  await supabase
    .from('user_settings')
    .update({ daily_goal_seconds: Math.round(seconds) })
    .eq('user_id', user.id);

  revalidatePath('/', 'layout');
}

/** Edição do perfil, reaproveitando o schema do onboarding. */
/**
 * Horário do lembrete.
 *
 * Guardado como hora local da pessoa, e não como instante: o fuso já mora no
 * perfil, e o cron faz a conta. Guardar em UTC quebraria para quem viaja e para
 * o horário de verão.
 */
export async function updateReminderTime(hora: string | null): Promise<void> {
  const user = await requireUser();

  // aceita só HH:MM; o resto vira nulo, que significa "não me lembre"
  const valida = hora && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora) ? `${hora}:00` : null;

  const supabase = await createClient();
  await supabase.from('user_settings').update({ reminder_time: valida }).eq('user_id', user.id);

  revalidatePath('/configuracoes');
}

export async function updateProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    full_name: formData.get('full_name') ?? undefined,
    username: formData.get('username'),
    bio: formData.get('bio') ?? undefined,
    birth_date: formData.get('birth_date') ?? undefined,
    protocol_started_on: formData.get('protocol_started_on') ?? undefined,
    height_cm: formData.get('height_cm'),
    biological_sex: formData.get('biological_sex') || undefined,
    goal: formData.get('goal') || null,
    level: formData.get('level') ?? 'iniciante',
    default_location: formData.get('default_location') ?? 'casa',
  });

  if (!parsed.success) {
    return invalidState(parsed.error.issues);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name,
      username: parsed.data.username,
      bio: parsed.data.bio,
      birth_date: parsed.data.birth_date,
      // vazio significa "não mexer": o gatilho no banco já cuida do recuo
      ...(parsed.data.protocol_started_on
        ? { protocol_started_on: parsed.data.protocol_started_on }
        : {}),
      height_cm: parsed.data.height_cm,
      ...(parsed.data.biological_sex
        ? { biological_sex: parsed.data.biological_sex as BiologicalSex }
        : {}),
      goal: (parsed.data.goal as WorkoutGoal | null) ?? null,
      level: parsed.data.level as WorkoutLevel,
      default_location: parsed.data.default_location as WorkoutPlace,
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
    return { status: 'error', message: 'Não conseguimos salvar agora. Tente novamente.' };
  }

  revalidatePath('/', 'layout');
  return { status: 'success', message: 'Perfil atualizado.' };
}

/**
 * Exclusão de conta.
 *
 * Apaga os arquivos dos três buckets antes de remover o usuário do Auth — o
 * cascade cuida das tabelas, mas o storage não é alcançado por foreign key.
 * Precisa da service role, por isso roda só aqui, no servidor.
 */
export async function deleteAccount(confirmation: string): Promise<void> {
  if (confirmation.trim().toUpperCase() !== 'EXCLUIR') {
    throw new Error('Digite EXCLUIR para confirmar.');
  }

  const user = await requireUser();
  const admin = createAdminClient();

  for (const bucket of ['avatars', 'progress-photos', 'video-exports'] as const) {
    const { data } = await admin.storage.from(bucket).list(user.id, { limit: 1000 });
    const paths: string[] = [];

    for (const entry of data ?? []) {
      if (entry.id === null) {
        // pasta: desce um nível (progress-photos/{user}/{ano}/{mes})
        const { data: nested } = await admin.storage
          .from(bucket)
          .list(`${user.id}/${entry.name}`, { limit: 1000 });

        for (const child of nested ?? []) {
          if (child.id === null) {
            const { data: leaves } = await admin.storage
              .from(bucket)
              .list(`${user.id}/${entry.name}/${child.name}`, { limit: 1000 });
            for (const leaf of leaves ?? []) {
              paths.push(`${user.id}/${entry.name}/${child.name}/${leaf.name}`);
            }
          } else {
            paths.push(`${user.id}/${entry.name}/${child.name}`);
          }
        }
      } else {
        paths.push(`${user.id}/${entry.name}`);
      }
    }

    if (paths.length > 0) {
      await admin.storage.from(bucket).remove(paths);
    }
  }

  // remover do Auth dispara o cascade em profiles e em tudo que depende dele
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    throw new Error('Não conseguimos excluir a conta agora. Tente novamente em instantes.');
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath('/', 'layout');
  redirect('/?conta=excluida');
}
