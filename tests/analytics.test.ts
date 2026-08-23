import { describe, expect, it } from 'vitest';

import { caminhoSeguro } from '@/lib/analytics/config';

/**
 * O que sai daqui vai para o Google e para a Meta.
 *
 * Um id de treino no caminho identifica uma pessoa e uma data de treino; um
 * `?data=2026-08-07` é informação de saúde. Este teste existe para que ninguém
 * acrescente uma rota nova e mande isso embora sem perceber.
 */
describe('caminho enviado ao analytics', () => {
  it('troca o id do treino por um marcador', () => {
    expect(caminhoSeguro('/treino/9f8c1d2e-3a4b-5c6d-7e8f-9a0b1c2d3e4f')).toBe('/treino/[id]');
  });

  it('troca o nome de usuário do perfil público', () => {
    expect(caminhoSeguro('/u/joaovictorvieira')).toBe('/u/[usuario]');
  });

  it('troca o id do usuário na administração', () => {
    expect(caminhoSeguro('/admin/usuarios/9f8c1d2e-3a4b-5c6d-7e8f-9a0b1c2d3e4f')).toBe(
      '/admin/usuarios/[id]',
    );
    expect(caminhoSeguro('/admin/chamados/9f8c1d2e-3a4b-5c6d-7e8f-9a0b1c2d3e4f')).toBe(
      '/admin/chamados/[id]',
    );
  });

  it('descarta a query inteira, que é onde moram as datas', () => {
    expect(caminhoSeguro('/evolucao/fotos?data=2026-08-07&nova=1')).toBe('/evolucao/fotos');
    expect(caminhoSeguro('/medidas?novo=1&data=2026-08-07')).toBe('/medidas');
  });

  it('troca uma data que apareça como segmento', () => {
    expect(caminhoSeguro('/historico/2026-08-07')).toBe('/historico/[id]');
  });

  it('deixa as rotas públicas e fixas como estão', () => {
    expect(caminhoSeguro('/')).toBe('/');
    expect(caminhoSeguro('/entrar')).toBe('/entrar');
    expect(caminhoSeguro('/hoje')).toBe('/hoje');
    expect(caminhoSeguro('/evolucao/comparar')).toBe('/evolucao/comparar');
    expect(caminhoSeguro('/treinar')).toBe('/treinar');
  });
});
