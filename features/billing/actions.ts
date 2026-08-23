'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth/session';
import { invalidState, type ActionState } from '@/lib/forms/action-state';
import { createClient } from '@/lib/supabase/server';
import { planoSchema } from '@/lib/validation/billing';
import type { BillingInterval } from '@/types/database';

/**
 * Administração de planos e assinaturas.
 *
 * Conceder e revogar passam por funções do banco, não por UPDATE direto: as
 * funções registram quem fez, quando e por quê. Cortesia sem registro é o tipo
 * de coisa que ninguém consegue explicar seis meses depois.
 */

export async function salvarPlano(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = planoSchema.safeParse({
    slug: formData.get('slug'),
    name: formData.get('name'),
    tagline: formData.get('tagline') ?? undefined,
    description: formData.get('description') ?? undefined,
    price_reais: formData.get('price_reais'),
    interval: formData.get('interval') ?? 'mes',
    stripe_price_id: formData.get('stripe_price_id') ?? undefined,
    features: formData.getAll('features').map(String),
    is_active: formData.get('is_active') === 'on',
  });

  if (!parsed.success) {
    return invalidState(parsed.error.issues);
  }

  const supabase = await createClient();
  const { error } = await supabase.from('plans').upsert(
    {
      slug: parsed.data.slug,
      name: parsed.data.name,
      tagline: parsed.data.tagline,
      description: parsed.data.description,
      // o admin digita em reais; o banco guarda em centavos
      price_cents: Math.round(parsed.data.price_reais * 100),
      interval: parsed.data.interval as BillingInterval,
      stripe_price_id: parsed.data.stripe_price_id,
      features: parsed.data.features,
      is_active: parsed.data.is_active,
    },
    { onConflict: 'slug' },
  );

  if (error) {
    return { status: 'error', message: 'Não conseguimos salvar o plano.' };
  }

  revalidatePath('/admin/planos');
  revalidatePath('/planos');

  return { status: 'success', message: 'Plano salvo.' };
}

export async function concederPlano(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const userId = String(formData.get('user_id') ?? '');
  const plano = String(formData.get('plan_slug') ?? '');
  const ate = String(formData.get('ate') ?? '').trim();
  const motivo = String(formData.get('motivo') ?? '').trim();

  if (!userId || !plano) {
    return { status: 'error', message: 'Informe o usuário e o plano.' };
  }

  if (!motivo) {
    return {
      status: 'error',
      message: 'Escreva o motivo.',
      fieldErrors: { motivo: 'O motivo fica no registro de auditoria.' },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('conceder_plano', {
    p_user: userId,
    p_plan: plano,
    // sem data significa acesso sem prazo, que é o caso de cortesia vitalícia
    p_ate: ate ? new Date(`${ate}T23:59:59`).toISOString() : null,
    p_motivo: motivo,
  });

  if (error) {
    return { status: 'error', message: 'Não conseguimos conceder o plano.' };
  }

  revalidatePath(`/admin/usuarios/${userId}`);
  revalidatePath('/admin/auditoria');

  return { status: 'success', message: 'Plano concedido.' };
}

export async function revogarPlano(formData: FormData): Promise<void> {
  await requireAdmin();

  const userId = String(formData.get('user_id') ?? '');
  if (!userId) return;

  const supabase = await createClient();
  await supabase.rpc('revogar_plano', {
    p_user: userId,
    p_motivo: String(formData.get('motivo') ?? '').trim() || 'sem motivo informado',
  });

  revalidatePath(`/admin/usuarios/${userId}`);
  revalidatePath('/admin/auditoria');
}
