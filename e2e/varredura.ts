/**
 * Varredura no fim da suíte.
 *
 * Cada teste apaga a conta que criou, mas basta um `afterEach` esquecer o id
 * para a conta ficar no projeto de produção — foi assim que oito usuários de
 * teste apareceram na lista real de cadastrados, e o número no painel de
 * administração passou a mentir.
 *
 * Esta varredura fecha a classe inteira do problema: qualquer conta com
 * domínio de teste que sobrar é apagada aqui, e o que sobrou é impresso, para
 * que o vazamento apareça em vez de sumir em silêncio.
 *
 * Desafios entram na mesma varredura pela mesma razão, e por uma pior: um
 * desafio de teste com janela em volta de hoje fica **em curso**, e a regra de
 * destaque prefere o que está rolando ao que vai começar — então ele toma o
 * lugar do desafio real na tela inicial de todo mundo. Aconteceu: uma corrida
 * interrompida morreu antes do `finally` que apaga, e o Desafio de Setembro
 * sumiu da tela de Hoje.
 */

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Domínios que só existem em teste. Nenhuma conta real usa. */
const DOMINIOS_DE_TESTE = /@(protocolo40|p20x)\.test$/;

/** Todo desafio criado por teste nasce com este prefixo. */
const PREFIXO_DE_TESTE = 'teste-';

export default async function varrer(): Promise<void> {
  if (!SUPABASE || !SECRET || SUPABASE.includes('placeholder')) return;

  const cabecalho = { apikey: SECRET, Authorization: `Bearer ${SECRET}` };

  try {
    const resposta = await fetch(`${SUPABASE}/auth/v1/admin/users?per_page=500`, {
      headers: cabecalho,
    });

    if (!resposta.ok) return;

    const { users = [] } = (await resposta.json()) as { users?: { id: string; email?: string }[] };
    const sobras = users.filter((usuario) => DOMINIOS_DE_TESTE.test(usuario.email ?? ''));

    if (sobras.length === 0) return;

    for (const usuario of sobras) {
      await fetch(`${SUPABASE}/auth/v1/admin/users/${usuario.id}`, {
        method: 'DELETE',
        headers: cabecalho,
      });
    }

    console.warn(
      `\n[varredura] ${sobras.length} conta(s) de teste sobraram e foram apagadas:\n` +
        sobras.map((usuario) => `  ${usuario.email}`).join('\n') +
        '\nAlgum teste não guardou o id no afterEach. Vale corrigir na origem.\n',
    );
  } catch {
    // a varredura é uma rede de segurança: falhar aqui não pode derrubar a suíte
  }

  await varrerDesafios(cabecalho);
}

/**
 * Desafios de teste que sobraram.
 *
 * Mais urgente que as contas: um desafio de teste aparece na tela inicial de
 * quem usa o app, e se a janela dele cobrir hoje ele vira o destaque.
 */
async function varrerDesafios(cabecalho: Record<string, string>): Promise<void> {
  try {
    const resposta = await fetch(
      `${SUPABASE}/rest/v1/challenges?select=slug,title&slug=like.${PREFIXO_DE_TESTE}*`,
      { headers: cabecalho },
    );

    if (!resposta.ok) return;

    const sobras = (await resposta.json()) as { slug: string; title: string }[];
    if (sobras.length === 0) return;

    await fetch(`${SUPABASE}/rest/v1/challenges?slug=like.${PREFIXO_DE_TESTE}*`, {
      method: 'DELETE',
      headers: cabecalho,
    });

    const lista = sobras.map((desafio) => `  ${desafio.slug} — ${desafio.title}`).join('\n');

    console.warn(
      [
        '',
        `[varredura] ${sobras.length} desafio(s) de teste sobraram e foram apagados:`,
        lista,
        'Um desafio de teste aparece na tela inicial de quem usa o app.',
        '',
      ].join('\n'),
    );
  } catch {
    // idem
  }
}
