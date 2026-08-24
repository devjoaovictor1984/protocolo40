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
 */

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Domínios que só existem em teste. Nenhuma conta real usa. */
const DOMINIOS_DE_TESTE = /@(protocolo40|p20x)\.test$/;

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
}
