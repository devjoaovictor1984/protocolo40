/**
 * Quem entra em cada rota — a decisão, separada do encanamento.
 *
 * Mora fora do proxy para poder ser testada sem servidor, sem navegador e sem
 * rede. É uma decisão pequena e cheia de casos, e um deles custou caro.
 */

import { isAuthRetryableFetchError } from '@supabase/supabase-js';

/**
 * O servidor disse "não", ou não conseguiu dizer nada?
 *
 * O `getClaims()` devolve `null` nos dois casos, e a diferença é tudo. Só conta
 * como deslogado quando o servidor de autenticação respondeu e recusou — token
 * inválido, sessão inexistente, 401. Tudo o mais é ruído passageiro:
 *
 * - falha de rede (`AuthRetryableFetchError`, status 0): túnel, elevador, sinal;
 * - 429: o Supabase limita renovações por IP, e uma operadora inteira sai pelo
 *   mesmo IP — dá para um usuário ser barrado por causa do vizinho;
 * - 408 e 5xx: o problema é do outro lado.
 *
 * Em nenhum desses casos existe motivo para pedir a senha de novo a quem já
 * entrou. Confundir os dois é o que fazia o app parecer que desloga sozinho.
 */
export function falhaTemporaria(error: unknown): boolean {
  if (!error) return false;
  if (isAuthRetryableFetchError(error)) return true;

  const status = (error as { status?: unknown }).status;
  if (typeof status !== 'number') return false;

  return status === 0 || status === 408 || status === 429 || status >= 500;
}

/** Prefixos que exigem sessão. */
export const ROTAS_PRIVADAS = [
  '/hoje',
  '/onboarding',
  '/treinar',
  '/treino',
  '/treinos',
  '/historico',
  '/calendario',
  '/evolucao',
  '/medidas',
  '/recordes',
  '/analise',
  '/saude',
  '/conquistas',
  '/desafios',
  '/comunidade',
  '/convidar',
  '/perfil',
  '/configuracoes',
  '/ajuda',
  '/planos',
  '/admin',
];

/** Rotas que não fazem sentido para quem já está logado. */
export const ROTAS_DE_ENTRADA = ['/login', '/cadastro', '/esqueci-senha'];

/**
 * A landing entra na mesma regra, mas só ela — por isso a comparação exata.
 *
 * Ela existe para quem ainda não conhece o P20X. Para quem já entrou, é uma
 * tela que oferece "Entrar" a alguém que já está dentro, e isso lê como sessão
 * perdida. Quem tem sessão vai direto para o painel.
 */
export const ENTRADA_EXATA = ['/'];

const sob = (pathname: string, prefixos: string[]) =>
  prefixos.some((prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`));

export type Decisao =
  | { tipo: 'seguir' }
  | { tipo: 'pedir-login'; de: string }
  | { tipo: 'levar-ao-app' };

export type Situacao = {
  pathname: string;
  /** Query string original, para devolver a pessoa ao lugar certo depois. */
  busca: string;
  /** O token foi verificado e é de alguém. */
  autenticado: boolean;
  /** Existe cookie de sessão no request, verificado ou não. */
  temCookieDeSessao: boolean;
  /** A verificação não deu não — deu erro de rede, que é outra coisa. */
  verificacaoFalhou: boolean;
};

/**
 * A regra que faltava: **falha de rede não é logout.**
 *
 * O `getClaims()` devolve o mesmo `null` em duas situações muito diferentes:
 * quando não existe sessão, e quando o servidor de autenticação não respondeu.
 * Tratar as duas igual manda para a tela de login gente que está logada —
 * bastando um túnel, um elevador ou uma barra de sinal a menos. Era isso que
 * fazia o app parecer que "desloga toda hora": a sessão não caía, o app é que
 * desistia dela no primeiro soluço de rede. E de quebra derrubava o modo
 * offline, porque o desvio chega antes de o service worker servir a tela
 * guardada.
 *
 * Deixar passar não abre brecha: quem autoriza é a RLS, no banco. Sem token
 * válido a consulta não volta dado de ninguém — a pessoa vê a própria tela
 * vazia ou a versão guardada, e não um pedido de senha que ela já deu.
 */
export function decidirRota(situacao: Situacao): Decisao {
  const { pathname, busca, autenticado, temCookieDeSessao, verificacaoFalhou } = situacao;

  // na dúvida por causa da rede, e havendo sessão guardada, a rota segue
  const naDuvida = verificacaoFalhou && temCookieDeSessao;

  if (sob(pathname, ROTAS_PRIVADAS)) {
    return autenticado || naDuvida ? { tipo: 'seguir' } : { tipo: 'pedir-login', de: `${pathname}${busca}` };
  }

  if (sob(pathname, ROTAS_DE_ENTRADA) || ENTRADA_EXATA.includes(pathname)) {
    // sem certeza de que está logado, a tela de entrada é o lugar mais seguro
    return autenticado ? { tipo: 'levar-ao-app' } : { tipo: 'seguir' };
  }

  return { tipo: 'seguir' };
}

/**
 * O nome do cookie onde o `@supabase/ssr` guarda a sessão.
 *
 * Ele parte o valor em `.0`, `.1`… quando passa de ~3 KB, então a checagem é
 * por prefixo.
 */
export function nomeDoCookieDeSessao(supabaseUrl: string): string {
  const ref = new URL(supabaseUrl).hostname.split('.')[0];
  return `sb-${ref}-auth-token`;
}

/** Há sessão guardada no request? Vale o cookie inteiro ou qualquer pedaço. */
export function temCookieDeSessao(nomes: string[], supabaseUrl: string): boolean {
  const cookie = nomeDoCookieDeSessao(supabaseUrl);
  return nomes.some((nome) => nome === cookie || nome.startsWith(`${cookie}.`));
}
