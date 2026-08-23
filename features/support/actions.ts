'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin, requireUser } from '@/lib/auth/session';
import { invalidState, type ActionState } from '@/lib/forms/action-state';
import { createClient } from '@/lib/supabase/server';
import { MAX_SCREENSHOT_BYTES, ticketAnswerSchema, ticketSchema } from '@/lib/validation/support';
import type { TicketKind, TicketStatus } from '@/types/database';

/**
 * Canal de suporte.
 *
 * O print sobe para um bucket privado antes do ticket existir: se o upload
 * falhar, o chamado é criado mesmo assim, sem a imagem. Perder o texto de quem
 * se deu ao trabalho de escrever por causa de um anexo seria o pior desfecho.
 */

const TIPOS_ACEITOS = ['image/png', 'image/jpeg', 'image/webp'];

async function enviarPrint(userId: string, file: File): Promise<string | null> {
  if (file.size === 0) return null;
  if (file.size > MAX_SCREENSHOT_BYTES) return null;
  if (!TIPOS_ACEITOS.includes(file.type)) return null;

  const supabase = await createClient();
  const extensao = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const caminho = `${userId}/${crypto.randomUUID()}.${extensao}`;

  const { error } = await supabase.storage
    .from('support')
    .upload(caminho, file, { contentType: file.type, upsert: false });

  return error ? null : caminho;
}

export async function createTicket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  const parsed = ticketSchema.safeParse({
    kind: formData.get('kind') ?? 'outro',
    title: formData.get('title'),
    body: formData.get('body'),
    page_url: formData.get('page_url') ?? undefined,
  });

  if (!parsed.success) {
    return invalidState(parsed.error.issues);
  }

  const arquivo = formData.get('screenshot');
  const anexo = arquivo instanceof File ? arquivo : null;

  if (anexo && anexo.size > MAX_SCREENSHOT_BYTES) {
    return {
      status: 'error',
      message: 'A imagem é grande demais.',
      fieldErrors: { screenshot: 'Escolha um print de até 3 MB.' },
    };
  }

  const screenshotPath = anexo ? await enviarPrint(user.id, anexo) : null;

  const supabase = await createClient();
  const { error } = await supabase.from('support_tickets').insert({
    user_id: user.id,
    kind: parsed.data.kind as TicketKind,
    title: parsed.data.title,
    body: parsed.data.body,
    page_url: parsed.data.page_url,
    user_agent: String(formData.get('user_agent') ?? '').slice(0, 300) || null,
    app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
    screenshot_path: screenshotPath,
  });

  if (error) {
    return {
      status: 'error',
      message: 'Não conseguimos enviar agora. Tente novamente.',
    };
  }

  revalidatePath('/ajuda');

  return {
    status: 'success',
    message:
      anexo && !screenshotPath
        ? 'Recebemos seu contato — mas não conseguimos anexar a imagem.'
        : 'Recebemos seu contato. Obrigado.',
  };
}

/** Resposta do admin, com a mudança de status junto. */
export async function answerTicket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const parsed = ticketAnswerSchema.safeParse({
    status: formData.get('status') ?? 'aberto',
    answer: formData.get('answer') ?? undefined,
  });

  if (!id || !parsed.success) {
    return parsed.success
      ? { status: 'error', message: 'Chamado não identificado.' }
      : invalidState(parsed.error.issues);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('support_tickets')
    .update({
      status: parsed.data.status as TicketStatus,
      answer: parsed.data.answer,
      answered_at: parsed.data.answer ? new Date().toISOString() : null,
      answered_by: parsed.data.answer ? user.id : null,
    })
    .eq('id', id);

  if (error) {
    return { status: 'error', message: 'Não conseguimos salvar a resposta.' };
  }

  revalidatePath('/admin/chamados');
  revalidatePath(`/admin/chamados/${id}`);
  revalidatePath('/ajuda');

  return { status: 'success', message: 'Resposta registrada.' };
}

export async function deleteTicket(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const supabase = await createClient();
  await supabase.from('support_tickets').delete().eq('id', id);

  revalidatePath('/admin/chamados');
}
