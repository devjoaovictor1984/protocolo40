import { describe, expect, it } from 'vitest';

import {
  CACHES_ANTIGOS,
  CACHES_DE_SESSAO,
  ehConteudoAssinado,
  ehRotaDeAutenticacao,
  podeAbrirOffline,
  respostaEhGuardavel,
} from '@/lib/offline/cache-policy';

/**
 * O bug que estes testes existem para não deixar voltar:
 *
 * o service worker guardava com `NetworkFirst` toda navegação de `/hoje`. Quando
 * a rede estava ruim e a sessão precisava ser renovada, o servidor respondia com
 * um desvio para o login — e esse desvio virava o conteúdo de `/hoje` por sete
 * dias. A pessoa abria o app, via a tela de login, entrava, e no dia seguinte a
 * mesma coisa. Parecia sessão caindo; era cache guardando a resposta errada.
 */
describe('o que pode ficar guardado no aparelho', () => {
  const resposta = (patch: Partial<{ status: number; redirected: boolean; type: string }> = {}) => ({
    status: 200,
    redirected: false,
    type: 'basic',
    ...patch,
  });

  it('guarda a página que o servidor entregou', () => {
    expect(respostaEhGuardavel(resposta())).toBe(true);
  });

  it('recusa o desvio para o login — o bug que deslogava todo mundo', () => {
    expect(respostaEhGuardavel(resposta({ redirected: true }))).toBe(false);
  });

  it('recusa erro do servidor, para não congelar uma falha por uma semana', () => {
    expect(respostaEhGuardavel(resposta({ status: 500 }))).toBe(false);
    expect(respostaEhGuardavel(resposta({ status: 404 }))).toBe(false);
    expect(respostaEhGuardavel(resposta({ status: 307 }))).toBe(false);
  });

  it('recusa resposta opaca, que não dá para inspecionar', () => {
    expect(respostaEhGuardavel(resposta({ type: 'opaqueredirect' }))).toBe(false);
    expect(respostaEhGuardavel(resposta({ type: 'opaque' }))).toBe(false);
  });
});

describe('quais telas abrem sem rede', () => {
  it('as do treino, que são a razão de o app existir', () => {
    expect(podeAbrirOffline('/hoje')).toBe(true);
    // o cronômetro: a tela que fica aberta justamente quando falta sinal
    expect(podeAbrirOffline('/treinar')).toBe(true);
    expect(podeAbrirOffline('/treino')).toBe(true);
    expect(podeAbrirOffline('/treino/abc-123')).toBe(true);
    expect(podeAbrirOffline('/treinos')).toBe(true);
  });

  it('nenhuma tela de outra pessoa fica no disco deste aparelho', () => {
    for (const rota of [
      '/perfil',
      '/comunidade',
      '/saude',
      '/analise',
      '/evolucao',
      '/medidas',
      '/historico',
      '/conquistas',
      '/configuracoes',
      '/admin',
      '/admin/usuarios',
      '/u/joao',
    ]) {
      expect(podeAbrirOffline(rota), `${rota} não pode ficar guardada`).toBe(false);
    }
  });

  it('não confunde prefixo com rota', () => {
    // /treinos-do-vizinho não é /treinos
    expect(podeAbrirOffline('/hojex')).toBe(false);
    expect(podeAbrirOffline('/treinamento')).toBe(false);
  });
});

describe('o que nunca passa por cache', () => {
  it('autenticação, sempre pela rede', () => {
    for (const rota of [
      '/login',
      '/cadastro',
      '/esqueci-senha',
      '/auth/callback',
      '/api/stripe/webhook',
    ]) {
      expect(ehRotaDeAutenticacao(rota), rota).toBe(true);
    }
  });

  it('a rota do treino não é rota de autenticação', () => {
    expect(ehRotaDeAutenticacao('/hoje')).toBe(false);
  });

  it('URL assinada aponta para foto de corpo e expira em 5 minutos', () => {
    expect(
      ehConteudoAssinado(new URL('https://x.supabase.co/storage/v1/object/sign/photos/a.webp')),
    ).toBe(true);
    expect(ehConteudoAssinado(new URL('https://p20x.com.br/hoje?token=abc'))).toBe(true);
    expect(ehConteudoAssinado(new URL('https://p20x.com.br/hoje'))).toBe(false);
  });
});

describe('faxina dos caches', () => {
  it('a versão antiga do worker é apagada, senão a correção não chega em ninguém', () => {
    // eram estes os caches que guardavam página autenticada
    expect(CACHES_ANTIGOS).toContain('p40-treino');
    expect(CACHES_ANTIGOS).toContain('pages');
    expect(CACHES_ANTIGOS).toContain('pages-rsc');
    expect(CACHES_ANTIGOS).toContain('pages-rsc-prefetch');
  });

  it('o cache de sessão não está na lista de faxina — ele some no logout', () => {
    for (const nome of CACHES_DE_SESSAO) {
      expect(CACHES_ANTIGOS).not.toContain(nome);
    }
  });
});
