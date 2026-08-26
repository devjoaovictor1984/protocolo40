import { describe, expect, it } from 'vitest';

import {
  LIMITE_DIARIO,
  LIMITE_MENSAL,
  orcamentoDeCampanhas,
} from '@/services/campaign-budget';

/**
 * O teto de campanhas não é cota de terceiro — é escolha nossa.
 *
 * As cotas do Firebase e da Apple são altas demais para alguém alcançar
 * mandando campanha à mão. O limite que importa é humano: cada aviso a mais
 * aumenta a chance de a pessoa desligar todos, e desligar é definitivo porque o
 * navegador não pergunta de novo.
 *
 * Por ser regra de produto, mora aqui e se testa.
 */
const HOJE = '2026-09-15';

const em = (...datas: string[]) => datas.map((d) => `${d}T14:00:00.000Z`);

describe('orçamento de campanhas', () => {
  it('sem nada enviado, o mês está inteiro disponível', () => {
    const o = orcamentoDeCampanhas([], HOJE);

    expect(o).toMatchObject({
      hoje: 0,
      mes: 0,
      restanteHoje: LIMITE_DIARIO,
      restanteMes: LIMITE_MENSAL,
      podeEnviar: true,
      motivo: null,
    });
  });

  it('uma campanha hoje fecha o dia', () => {
    const o = orcamentoDeCampanhas(em(HOJE), HOJE);

    expect(o.hoje).toBe(1);
    expect(o.podeEnviar).toBe(false);
    expect(o.motivo).toMatch(/desligarem/);
  });

  it('a de ontem não conta para hoje', () => {
    const o = orcamentoDeCampanhas(em('2026-09-14'), HOJE);

    expect(o.hoje).toBe(0);
    expect(o.mes).toBe(1);
    expect(o.podeEnviar).toBe(true);
  });

  it('o teto do mês segura mesmo com o dia livre', () => {
    const dias = Array.from(
      { length: LIMITE_MENSAL },
      (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`,
    );
    const o = orcamentoDeCampanhas(em(...dias), HOJE);

    expect(o.hoje).toBe(0);
    expect(o.mes).toBe(LIMITE_MENSAL);
    expect(o.podeEnviar, 'o dia está livre, mas o mês acabou').toBe(false);
    expect(o.motivo).toMatch(/mês/);
  });

  it('o mês passado não pesa no atual', () => {
    const agosto = Array.from(
      { length: 20 },
      (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`,
    );
    const o = orcamentoDeCampanhas(em(...agosto), HOJE);

    expect(o.mes).toBe(0);
    expect(o.podeEnviar).toBe(true);
  });

  it('campanha sem data de envio não conta — rascunho não gasta', () => {
    const o = orcamentoDeCampanhas([null, null, ...em(HOJE)], HOJE);
    expect(o.hoje).toBe(1);
  });

  it('o restante nunca fica negativo', () => {
    // se o teto mudar para menos com envios já feitos, a conta não pode virar
    const muitos = Array.from({ length: 40 }, () => HOJE);
    const o = orcamentoDeCampanhas(em(...muitos), HOJE);

    expect(o.restanteHoje).toBe(0);
    expect(o.restanteMes).toBe(0);
  });

  it('o motivo do dia vem antes do motivo do mês', () => {
    // quando os dois estouram, o mais imediato é o que ajuda a decidir
    const muitos = Array.from({ length: 20 }, () => HOJE);
    expect(orcamentoDeCampanhas(em(...muitos), HOJE).motivo).toMatch(/hoje/);
  });

  it('explica sem culpar quem administra', () => {
    const proibidos = /você errou|não pode|proibido|bloqueado/i;
    const o = orcamentoDeCampanhas(em(HOJE), HOJE);

    expect(o.motivo!).not.toMatch(proibidos);
  });
});
