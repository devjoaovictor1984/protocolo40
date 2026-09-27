import { describe, expect, it } from 'vitest';

import { precisaAtualizar } from '@/lib/versao';

/**
 * O PWA aberto durante um deploy chamava Server Actions que não existiam mais,
 * e "Entrar no desafio" falhava sem dizer nada. A regra decide quando o app
 * se recarrega sozinho para pegar a versão nova.
 */
describe('quando o app se atualiza sozinho', () => {
  it('versão nova publicada: recarrega', () => {
    expect(precisaAtualizar('dpl_antigo', 'dpl_novo', '/hoje')).toBe(true);
  });

  it('mesma versão: não mexe', () => {
    expect(precisaAtualizar('dpl_novo', 'dpl_novo', '/hoje')).toBe(false);
  });

  it('no meio do treino, espera', () => {
    expect(precisaAtualizar('dpl_antigo', 'dpl_novo', '/treinar')).toBe(false);
    expect(precisaAtualizar('dpl_antigo', 'dpl_novo', '/treino/abc')).toBe(false);
  });

  it('"/treinos" não é o treino em andamento', () => {
    expect(precisaAtualizar('dpl_antigo', 'dpl_novo', '/treinos')).toBe(true);
  });

  it('sem resposta do servidor ou em desenvolvimento, nunca recarrega', () => {
    expect(precisaAtualizar('dpl_antigo', null, '/hoje')).toBe(false);
    expect(precisaAtualizar('dev', 'dpl_novo', '/hoje')).toBe(false);
    expect(precisaAtualizar('dpl_antigo', 'dev', '/hoje')).toBe(false);
  });
});
