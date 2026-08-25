import { describe, expect, it } from 'vitest';

import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js';

import {
  decidirRota,
  falhaTemporaria,
  nomeDoCookieDeSessao,
  temCookieDeSessao,
} from '@/lib/supabase/guard';

const situacao = (patch: Partial<Parameters<typeof decidirRota>[0]> = {}) =>
  decidirRota({
    pathname: '/hoje',
    busca: '',
    autenticado: true,
    temCookieDeSessao: true,
    verificacaoFalhou: false,
    ...patch,
  });

describe('quem entra em cada rota', () => {
  it('logado entra na rota privada', () => {
    expect(situacao()).toEqual({ tipo: 'seguir' });
  });

  it('sem sessão nenhuma, a rota privada pede login e guarda o destino', () => {
    expect(
      situacao({
        pathname: '/treino/abc',
        busca: '?round=2',
        autenticado: false,
        temCookieDeSessao: false,
      }),
    ).toEqual({ tipo: 'pedir-login', de: '/treino/abc?round=2' });
  });

  it('rota pública passa para qualquer um', () => {
    expect(situacao({ pathname: '/', autenticado: false, temCookieDeSessao: false })).toEqual({
      tipo: 'seguir',
    });
    expect(situacao({ pathname: '/u/joao', autenticado: false, temCookieDeSessao: false })).toEqual(
      { tipo: 'seguir' },
    );
  });

  it('logado que abre o login vai para o app', () => {
    expect(situacao({ pathname: '/login' })).toEqual({ tipo: 'levar-ao-app' });
  });

  it('logado que cai na landing vai para o painel', () => {
    // a landing oferece "Entrar" a quem já está dentro, e isso lê como sessão
    // perdida — foi o que um usuário relatou depois de clicar na marca
    expect(situacao({ pathname: '/' })).toEqual({ tipo: 'levar-ao-app' });
  });

  it('a landing continua sendo a landing para quem não tem conta', () => {
    expect(situacao({ pathname: '/', autenticado: false, temCookieDeSessao: false })).toEqual({
      tipo: 'seguir',
    });
  });

  it('a regra da landing é só da landing, não de tudo que começa com barra', () => {
    // '/' é prefixo de todas as rotas: a comparação precisa ser exata
    for (const rota of ['/u/joao', '/convite/joao', '/offline']) {
      expect(situacao({ pathname: rota }), rota).toEqual({ tipo: 'seguir' });
    }
  });

  it('deslogado vê a tela de login', () => {
    expect(
      situacao({ pathname: '/login', autenticado: false, temCookieDeSessao: false }),
    ).toEqual({ tipo: 'seguir' });
  });
});

/**
 * A regra que existe por causa de um bug real: usuários relataram ter que
 * entrar de novo o tempo todo. A sessão não caía — o `getClaims()` devolve o
 * mesmo `null` quando não há sessão e quando o servidor de autenticação não
 * respondeu, e o proxy tratava as duas igual. Num túnel, num elevador ou numa
 * barra de sinal a menos, quem estava logado ia parar na tela de login.
 */
describe('falha de rede não é logout', () => {
  it('com sessão guardada e rede falhando, a rota privada segue', () => {
    expect(
      situacao({ autenticado: false, temCookieDeSessao: true, verificacaoFalhou: true }),
    ).toEqual({ tipo: 'seguir' });
  });

  it('sem sessão guardada, falha de rede não vira passe livre', () => {
    expect(
      situacao({ autenticado: false, temCookieDeSessao: false, verificacaoFalhou: true }),
    ).toEqual({ tipo: 'pedir-login', de: '/hoje' });
  });

  it('na dúvida, quem abre o login continua vendo o login', () => {
    // levar ao app sem saber se a sessão presta seria trocar um susto por outro
    expect(
      situacao({
        pathname: '/login',
        autenticado: false,
        temCookieDeSessao: true,
        verificacaoFalhou: true,
      }),
    ).toEqual({ tipo: 'seguir' });
  });

  it('sessão de verdade recusada pelo servidor ainda pede login', () => {
    // token inválido não é falha de rede: aqui o servidor respondeu, e disse não
    expect(
      situacao({ autenticado: false, temCookieDeSessao: true, verificacaoFalhou: false }),
    ).toEqual({ tipo: 'pedir-login', de: '/hoje' });
  });
});

describe('achar o cookie de sessão', () => {
  const url = 'https://thgijwptwylguorqgbrz.supabase.co';

  it('monta o nome a partir do projeto', () => {
    expect(nomeDoCookieDeSessao(url)).toBe('sb-thgijwptwylguorqgbrz-auth-token');
  });

  it('reconhece o cookie inteiro e os pedaços', () => {
    expect(temCookieDeSessao(['sb-thgijwptwylguorqgbrz-auth-token'], url)).toBe(true);
    expect(
      temCookieDeSessao(
        ['outro', 'sb-thgijwptwylguorqgbrz-auth-token.0', 'sb-thgijwptwylguorqgbrz-auth-token.1'],
        url,
      ),
    ).toBe(true);
  });

  it('não confunde com outro cookie qualquer', () => {
    expect(temCookieDeSessao(['p20x_convite', 'sb-outro-projeto-auth-token'], url)).toBe(false);
    expect(temCookieDeSessao([], url)).toBe(false);
  });
});

/**
 * A suíte de testes reproduziu isto sozinha: rodando contra o Supabase de
 * verdade, com três aparelhos em paralelo, o projeto bateu no limite de
 * requisições e o servidor passou a responder 429. O proxy leu 429 como
 * "não está logado" e jogou todo mundo no login — que é exatamente a queixa
 * que veio dos usuários. Numa operadora de celular o cenário é o mesmo: muita
 * gente sai pelo mesmo IP, e o limite é por IP.
 */
describe('o servidor recusou, ou não conseguiu responder?', () => {
  it('sem erro nenhum, não há dúvida', () => {
    expect(falhaTemporaria(null)).toBe(false);
    expect(falhaTemporaria(undefined)).toBe(false);
  });

  it('rede caída é dúvida', () => {
    expect(falhaTemporaria(new AuthRetryableFetchError('fetch failed', 0))).toBe(true);
  });

  it('429 é dúvida: o limite é por IP, e uma operadora inteira compartilha o IP', () => {
    expect(falhaTemporaria(new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit'))).toBe(true);
  });

  it('problema do lado do servidor é dúvida', () => {
    expect(falhaTemporaria(new AuthApiError('bad gateway', 502, undefined))).toBe(true);
    expect(falhaTemporaria(new AuthApiError('timeout', 408, undefined))).toBe(true);
  });

  it('recusa de verdade não é dúvida — aí a pessoa entra de novo mesmo', () => {
    expect(falhaTemporaria(new AuthApiError('invalid claim', 401, 'bad_jwt'))).toBe(false);
    expect(falhaTemporaria(new AuthApiError('not allowed', 403, undefined))).toBe(false);
    expect(falhaTemporaria(new AuthSessionMissingError())).toBe(false);
  });
});
