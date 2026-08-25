/**
 * O que pode e o que não pode ficar guardado no aparelho.
 *
 * Mora fora do service worker porque é regra, não encanamento: um erro aqui não
 * aparece em nenhuma tela, some dentro de um cache que dura sete dias e volta
 * como "o app fica me deslogando". Fora do worker, dá para testar.
 */

/** Rotas de autenticação — nunca guardadas, em hipótese alguma. */
const AUTENTICACAO = ['/login', '/cadastro', '/esqueci-senha', '/auth', '/api'];

/**
 * As telas que precisam abrir sem rede. O resto vale menos que a sessão.
 *
 * `/treinar` é o cronômetro, e é a mais importante das quatro: é a tela que
 * fica aberta durante o treino, que é justamente quando o telefone costuma
 * estar no bolso, no chão da sala ou num canto sem sinal.
 */
const OFFLINE = ['/hoje', '/treinar', '/treino', '/treinos'];

const sob = (pathname: string, prefixos: string[]) =>
  prefixos.some((prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`));

/** Autenticação e chamadas de API vão sempre à rede. */
export const ehRotaDeAutenticacao = (pathname: string) => sob(pathname, AUTENTICACAO);

/** URL assinada aponta para foto de corpo e expira em 5 minutos. */
export const ehConteudoAssinado = (url: URL) =>
  url.searchParams.has('token') || url.pathname.includes('/storage/v1/object/sign/');

/** As telas de treino — o único conteúdo de sessão que aceitamos guardar. */
export const podeAbrirOffline = (pathname: string) =>
  !ehRotaDeAutenticacao(pathname) && sob(pathname, OFFLINE);

/**
 * A resposta é mesmo a página pedida?
 *
 * Um `NetworkFirst` guarda o que a rede devolver, e o que a rede devolve nem
 * sempre é o que se pediu: quando a sessão precisa ser renovada num momento de
 * rede ruim, o servidor responde com um desvio para o login. Guardado sob a
 * chave de `/hoje`, esse desvio fazia o aparelho servir a tela de login por
 * sete dias sempre que a rede demorasse mais que o tempo limite — e era essa a
 * razão de gente estar entrando de novo o tempo todo. A sessão não caía; o
 * cache é que mentia.
 *
 * `redirected` pega o desvio já seguido, `status` pega erro e página offline,
 * `type` recusa resposta opaca. Nenhuma das três é a página pedida.
 */
export const respostaEhGuardavel = (response: {
  status: number;
  redirected: boolean;
  type: string;
}) => response.status === 200 && !response.redirected && response.type === 'basic';

/**
 * Caches criados por versões anteriores do service worker.
 *
 * Trocar as regras não desfaz o que já está no aparelho: enquanto estes caches
 * existirem, quem já usa o app continua vendo a tela de login guardada. Some no
 * `activate`, quando o worker novo assume o lugar do antigo.
 */
export const CACHES_ANTIGOS = [
  'p40-treino',
  'p40-thumbs',
  'pages',
  'pages-rsc',
  'pages-rsc-prefetch',
  'others',
  'apis',
  'next-data',
  'static-data-assets',
  'cross-origin',
];

/** Caches com página renderizada — conteúdo de uma pessoa só. Some no logout. */
export const CACHES_DE_SESSAO = ['p20x-treino'];

/** Mensagem que o app manda ao worker quando alguém sai da conta. */
export const LIMPAR_SESSAO = 'P20X_LIMPAR_SESSAO';
