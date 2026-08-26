'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

/**
 * Criar e editar desafios.
 *
 * Passa por `requireAdmin()` como o resto da administração: a policy do banco
 * já recusaria, mas uma ação que falha em silêncio é pior de diagnosticar do
 * que uma que nem começa.
 *
 * A validação aqui não substitui as constraints da tabela — ela existe para
 * devolver uma frase em português em vez de um erro do Postgres.
 */

const desafioSchema = z
  .object({
    id: z.string().uuid().optional().or(z.literal('')),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{3,40}$/, 'O endereço aceita só letras minúsculas, números e hífen.'),
    title: z.string().trim().min(3, 'O nome precisa de pelo menos 3 letras.').max(60),
    tagline: z.string().trim().max(80).optional().or(z.literal('')),
    description: z
      .string()
      .trim()
      .min(20, 'Explique o desafio em pelo menos uma frase.')
      // textarea envia CRLF por especificação; guardar só a quebra simples
      // deixa o texto igual em qualquer lugar que o leia, sem depender de quem
      // renderiza ser tolerante
      .transform((texto) => texto.replace(/\r\n/g, '\n')),
    starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de início inválida.'),
    ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de fim inválida.'),
    goal: z.coerce.number().int().positive('A meta precisa ser maior que zero.'),
    badge_slug: z.string().trim().optional().or(z.literal('')),
    image_path: z.string().trim().max(200).optional().or(z.literal('')),
    is_active: z.union([z.literal('on'), z.literal('')]).optional(),
  })
  .refine((v) => v.ends_on >= v.starts_on, {
    message: 'O fim não pode ser antes do começo.',
    path: ['ends_on'],
  });

export type EstadoDoFormulario = { status: 'idle' | 'ok' | 'erro'; mensagem?: string };

export async function salvarDesafio(
  _anterior: EstadoDoFormulario,
  formData: FormData,
): Promise<EstadoDoFormulario> {
  await requireAdmin();

  const parsed = desafioSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { status: 'erro', mensagem: parsed.error.issues[0]?.message ?? 'Confira os campos.' };
  }

  const { id, is_active, tagline, badge_slug, image_path, ...resto } = parsed.data;

  const linha = {
    ...resto,
    tagline: tagline || null,
    badge_slug: badge_slug || null,
    image_path: image_path || null,
    is_active: is_active === 'on',
  };

  const supabase = await createClient();

  const { error } = id
    ? await supabase.from('challenges').update(linha).eq('id', id)
    : await supabase.from('challenges').insert(linha);

  if (error) {
    // o caso comum é endereço repetido; dizer isso poupa uma ida ao suporte
    return {
      status: 'erro',
      mensagem: error.code === '23505' ? 'Já existe um desafio com esse endereço.' : error.message,
    };
  }

  revalidatePath('/admin/desafios');
  revalidatePath('/desafios');
  revalidatePath('/hoje');

  return { status: 'ok', mensagem: id ? 'Desafio atualizado.' : 'Desafio criado.' };
}

/**
 * Liga e desliga.
 *
 * Desligar não apaga: quem participou mantém a participação e a insígnia, e o
 * desafio some das telas. Apagar um desafio com gente dentro tiraria conquista
 * de quem cumpriu.
 */
export async function alternarDesafio(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const ligar = formData.get('valor') === '1';
  if (!id) return;

  const supabase = await createClient();
  await supabase.from('challenges').update({ is_active: ligar }).eq('id', id);

  revalidatePath('/admin/desafios');
  revalidatePath('/desafios');
  revalidatePath('/hoje');
}

/**
 * Apaga um desafio de vez.
 *
 * Diferente de desligar: o `on delete cascade` de `challenge_participants`
 * leva junto a participação de todo mundo. A insígnia de quem concluiu fica —
 * ela mora em `user_badges` e não depende do desafio existir — mas o histórico
 * de quem estava dentro some. A tela avisa o número antes de perguntar.
 */
export async function apagarDesafio(id: string): Promise<string | null> {
  await requireAdmin();
  if (!id) return 'Desafio não identificado.';

  const supabase = await createClient();
  const { error } = await supabase.from('challenges').delete().eq('id', id);

  if (error) return error.message;

  revalidatePath('/admin/desafios');
  revalidatePath('/desafios');
  revalidatePath('/hoje');

  return null;
}
