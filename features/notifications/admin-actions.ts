'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { enviarEmLote, pushConfigurado, resumir } from '@/lib/push/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { todayIn } from '@/services/calendar';
import { orcamentoDeCampanhas } from '@/services/campaign-budget';
import { textoDaCampanha } from '@/services/notifications';

/**
 * Campanhas de notificação.
 *
 * Isto manda um aviso para o bolso de todo mundo ao mesmo tempo. Três coisas
 * seguram a mão:
 *
 * 1. **Fica registrado.** Quem mandou, o quê, quando e para quantos. Sem isso
 *    não há como responder "por que recebi isso?", e é a pergunta que sempre vem.
 * 2. **O destino é validado.** Só caminho interno — uma notificação com a marca
 *    do P20X levando para fora é exatamente o que um phishing precisaria.
 * 3. **O texto é cortado no tamanho que a tela mostra.** Escrever cinco linhas e
 *    ver duas no aparelho é o jeito mais fácil de mandar uma frase pela metade.
 */

const campanhaSchema = z.object({
  title: z.string().trim().min(3, 'O título precisa de pelo menos 3 letras.').max(60),
  body: z.string().trim().min(3, 'Escreva a mensagem.').max(180),
  url: z.string().trim().optional().or(z.literal('')),
});

export type EstadoDaCampanha = { status: 'idle' | 'ok' | 'erro'; mensagem?: string };

export async function dispararCampanha(
  _anterior: EstadoDaCampanha,
  formData: FormData,
): Promise<EstadoDaCampanha> {
  const { user } = await requireAdmin();

  if (!pushConfigurado) {
    return {
      status: 'erro',
      mensagem: 'As chaves VAPID não estão configuradas neste ambiente.',
    };
  }

  const parsed = campanhaSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { status: 'erro', mensagem: parsed.error.issues[0]?.message ?? 'Confira os campos.' };
  }

  const texto = textoDaCampanha(parsed.data);
  const admin = createAdminClient();

  /**
   * O orçamento é conferido no servidor, e não só desenhado na tela.
   *
   * O botão desabilitado impede o toque distraído; isto impede o resto. Não é
   * cota de terceiro — é proteção contra o único erro irreversível aqui, que é
   * cansar as pessoas até elas desligarem os avisos. Desligar é definitivo: o
   * navegador não pergunta duas vezes.
   */
  const { data: jaEnviadas } = await admin
    .from('notification_campaigns')
    .select('sent_at')
    .eq('status', 'enviada');

  const orcamento = orcamentoDeCampanhas(
    (jaEnviadas ?? []).map((linha) => linha.sent_at),
    todayIn('America/Sao_Paulo'),
  );

  if (!orcamento.podeEnviar) {
    return { status: 'erro', mensagem: orcamento.motivo ?? 'Limite de envios atingido.' };
  }

  // a campanha nasce registrada, antes de sair: se o envio morrer no meio, o
  // que foi mandado continua sabido
  const { data: campanha, error: erroAoCriar } = await admin
    .from('notification_campaigns')
    .insert({
      title: texto.title,
      body: texto.body,
      url: texto.url,
      status: 'enviando',
      created_by: user.id,
    })
    .select('id')
    .single();

  if (erroAoCriar || !campanha) {
    return { status: 'erro', mensagem: erroAoCriar?.message ?? 'Não deu para registrar a campanha.' };
  }

  const { data: aparelhos } = await admin.rpc('aparelhos_inscritos');

  if (!aparelhos || aparelhos.length === 0) {
    await admin
      .from('notification_campaigns')
      .update({ status: 'enviada', sent_at: new Date().toISOString() })
      .eq('id', campanha.id);

    return { status: 'ok', mensagem: 'Nenhum aparelho inscrito ainda. Nada foi enviado.' };
  }

  const resultados = await enviarEmLote(aparelhos, texto);
  const resumo = resumir(resultados);

  if (resumo.mortos.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', resumo.mortos);
  }

  await admin
    .from('notification_campaigns')
    .update({
      status: 'enviada',
      sent_at: new Date().toISOString(),
      entregues: resumo.entregues,
      falhas: resumo.falhas,
    })
    .eq('id', campanha.id);

  revalidatePath('/admin/notificacoes');

  const removidos = resumo.mortos.length
    ? ` ${resumo.mortos.length} aparelho(s) desinstalado(s) foram removidos.`
    : '';

  return {
    status: 'ok',
    mensagem: `Enviada para ${resumo.entregues} de ${aparelhos.length} aparelhos.${removidos}`,
  };
}

/**
 * Um envio de teste, só para o admin.
 *
 * Existe porque não dá para conferir como uma notificação fica sem ver uma —
 * e ver mandando para a base inteira é caro demais para descobrir que o título
 * estava cortado.
 */
export async function testarNoMeuAparelho(
  _anterior: EstadoDaCampanha,
  formData: FormData,
): Promise<EstadoDaCampanha> {
  const { user } = await requireAdmin();

  if (!pushConfigurado) {
    return { status: 'erro', mensagem: 'As chaves VAPID não estão configuradas.' };
  }

  const parsed = campanhaSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { status: 'erro', mensagem: parsed.error.issues[0]?.message ?? 'Confira os campos.' };
  }

  const admin = createAdminClient();
  const { data: meus } = await admin
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .eq('user_id', user.id);

  if (!meus || meus.length === 0) {
    return {
      status: 'erro',
      mensagem: 'Este aparelho ainda não recebe notificações. Ative em Configurações.',
    };
  }

  const resumo = resumir(await enviarEmLote(meus, textoDaCampanha(parsed.data)));

  return resumo.entregues > 0
    ? { status: 'ok', mensagem: 'Enviada só para você. Confira o aparelho.' }
    : { status: 'erro', mensagem: 'Não chegou. Verifique a permissão no navegador.' };
}

/**
 * Apaga uma campanha do histórico.
 *
 * Some o registro, não a notificação — o que já chegou ao aparelho de alguém
 * não volta atrás, e nenhum botão aqui pode prometer isso. Serve para limpar a
 * lista de testes e rascunhos.
 */
export async function apagarCampanha(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const admin = createAdminClient();
  await admin.from('notification_campaigns').delete().eq('id', id);

  revalidatePath('/admin/notificacoes');
}
