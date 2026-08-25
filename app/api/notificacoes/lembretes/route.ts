import { NextResponse, type NextRequest } from 'next/server';

import { enviarEmLote, pushConfigurado, resumir, type Aparelho } from '@/lib/push/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { lembreteDoDia } from '@/services/notifications';

/**
 * O lembrete diário.
 *
 * O horário é o da pessoa: às 19h de Brasília são 18h em Manaus e 20h em
 * Fernando de Noronha. Quem decide são as contas de fuso dentro de
 * `quem_lembrar()`, no banco — trazer todo mundo para a memória do servidor só
 * para descartar 95% seria caro e ficaria errado no horário de verão.
 *
 * A rota não sabe de que frequência ela é chamada, e isso é de propósito. O
 * plano Hobby da Vercel só aceita cron diário, então o `vercel.json` agenda uma
 * rodada às 01h UTC (22h de Brasília) e `quem_lembrar()` devolve quem já passou
 * da hora escolhida. Chamando de hora em hora — por um disparador externo ou no
 * plano Pro — a mesma regra entrega no horário exato, porque a primeira rodada
 * a partir da hora escolhida é ela mesma. A trava de um por dia cuida do resto.
 *
 * Chamado pelo cron da Vercel, que manda o `CRON_SECRET` no Authorization. Sem
 * a checagem, qualquer um poderia disparar notificação para a base inteira.
 */

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim();

  if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }

  if (!pushConfigurado) {
    return NextResponse.json({ erro: 'push não configurado' }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: alvos, error } = await admin.rpc('quem_lembrar');

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!alvos || alvos.length === 0) return NextResponse.json({ enviados: 0 });

  /**
   * Uma pessoa pode ter vários aparelhos, e o texto tem que ser o mesmo nos
   * dois — receber duas frases diferentes no celular e no tablet parece defeito.
   */
  const porPessoa = new Map<string, { texto: ReturnType<typeof lembreteDoDia>; dia: string; aparelhos: Aparelho[] }>();

  for (const alvo of alvos) {
    const existente = porPessoa.get(alvo.user_id);

    if (existente) {
      existente.aparelhos.push(alvo);
      continue;
    }

    porPessoa.set(alvo.user_id, {
      dia: alvo.dia,
      texto: lembreteDoDia({
        primeiroNome: alvo.primeiro_nome,
        sequencia: alvo.sequencia,
        aguaMl: alvo.agua_ml,
        dia: alvo.dia,
      }),
      aparelhos: [alvo],
    });
  }

  let entregues = 0;
  const mortos: string[] = [];

  for (const [userId, { texto, dia, aparelhos }] of porPessoa) {
    const resultados = await enviarEmLote(aparelhos, texto);
    const resumo = resumir(resultados);

    entregues += resumo.entregues;
    mortos.push(...resumo.mortos);

    // a trava é marcada mesmo quando todos os aparelhos falham: insistir na
    // mesma hora, a cada rodada, transformaria uma falha em enxurrada
    await admin.rpc('marcar_lembrete', { p_user: userId, p_dia: dia });
  }

  // aparelho que respondeu 404 ou 410 não existe mais; guardar a linha só faz a
  // próxima rodada demorar mais
  if (mortos.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', mortos);
  }

  return NextResponse.json({
    pessoas: porPessoa.size,
    entregues,
    removidos: mortos.length,
  });
}
