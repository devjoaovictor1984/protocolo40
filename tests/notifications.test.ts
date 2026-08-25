import { describe, expect, it } from 'vitest';

import { lembreteDoDia, textoDaCampanha, type ContextoDoLembrete } from '@/services/notifications';

const base: ContextoDoLembrete = {
  primeiroNome: 'João',
  sequencia: 0,
  aguaMl: 500,
  dia: '2026-09-10',
};

const ctx = (patch: Partial<ContextoDoLembrete> = {}) => ({ ...base, ...patch });

/**
 * Uma notificação é a única coisa deste app que aparece sem ser chamada, e
 * aparece na tela bloqueada — à vista de quem estiver por perto. O que ela pode
 * dizer é decisão de projeto, e por isso está aqui e não dentro de um envio.
 */
describe('o lembrete diário', () => {
  it('leva para a tela certa', () => {
    expect(lembreteDoDia(ctx()).url).toMatch(/^\/(treinar|saude)$/);
  });

  it('com sequência viva, o assunto é a sequência', () => {
    const texto = lembreteDoDia(ctx({ sequencia: 12 }));
    expect(`${texto.title} ${texto.body}`).toMatch(/12|13/);
  });

  it('sequência curta não vira assunto — ninguém protege dois dias', () => {
    const texto = lembreteDoDia(ctx({ sequencia: 2 }));
    expect(`${texto.title} ${texto.body}`).not.toMatch(/\b2 dias seguidos\b/);
  });

  it('sem água registrada, a água entra no rodízio', () => {
    // um dia de cada três: entre dez dias seguidos, ao menos um fala de água
    const dias = Array.from({ length: 10 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
    const assuntos = dias.map((dia) => lembreteDoDia(ctx({ aguaMl: 0, dia })).url);

    expect(assuntos).toContain('/saude');
    expect(assuntos).toContain('/treinar');
  });

  it('quem já bebeu água nunca é lembrado de beber água', () => {
    const dias = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);

    for (const dia of dias) {
      expect(lembreteDoDia(ctx({ aguaMl: 2000, dia })).url, dia).toBe('/treinar');
    }
  });

  it('o texto muda de um dia para o outro', () => {
    const dias = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'];
    const textos = new Set(dias.map((dia) => lembreteDoDia(ctx({ sequencia: 7, dia })).body));

    // repetir a mesma frase cinco dias seguidos é como não notificar
    expect(textos.size).toBeGreaterThan(1);
  });

  it('o mesmo dia gera sempre o mesmo texto', () => {
    // sem isto, uma reexecução do cron mandaria uma frase diferente
    const a = lembreteDoDia(ctx({ sequencia: 7 }));
    const b = lembreteDoDia(ctx({ sequencia: 7 }));
    expect(a).toEqual(b);
  });

  it('usa o primeiro nome quando existe, e não quebra sem ele', () => {
    expect(lembreteDoDia(ctx({ primeiroNome: null, aguaMl: 0, dia: '2026-09-03' }))).toBeTruthy();
    const comNome = lembreteDoDia(ctx({ primeiroNome: 'Letícia', sequencia: 0 }));
    expect(comNome.body.startsWith('undefined')).toBe(false);
  });

  it('nunca cobra nem acusa', () => {
    const dias = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
    const proibidos = /você não treinou|faltou|perdeu|desistiu|preguiça|vergonha/i;

    for (const sequencia of [0, 2, 7, 40]) {
      for (const aguaMl of [0, 1500]) {
        for (const dia of dias) {
          const texto = lembreteDoDia(ctx({ sequencia, aguaMl, dia }));
          expect(`${texto.title} ${texto.body}`, `${sequencia}/${aguaMl}/${dia}`).not.toMatch(
            proibidos,
          );
        }
      }
    }
  });

  it('nunca fala de peso nem de medida', () => {
    const dias = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
    const corpo = /\bkg\b|peso|cintura|medida|gordura|IMC/i;

    for (const sequencia of [0, 5, 30]) {
      for (const dia of dias) {
        const texto = lembreteDoDia(ctx({ sequencia, aguaMl: 0, dia }));
        expect(`${texto.title} ${texto.body}`).not.toMatch(corpo);
      }
    }
  });

  it('cabe na tela: título curto e corpo dentro do corte do Android', () => {
    const dias = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);

    for (const sequencia of [0, 5, 120]) {
      for (const dia of dias) {
        const texto = lembreteDoDia(ctx({ sequencia, aguaMl: 0, dia }));
        expect(texto.title.length, texto.title).toBeLessThanOrEqual(40);
        expect(texto.body.length, texto.body).toBeLessThanOrEqual(120);
      }
    }
  });
});

/**
 * A campanha é texto livre digitado por uma pessoa. O que ela não pode fazer é
 * levar para fora do app: uma notificação com a marca do P20X apontando para
 * outro site é exatamente o que um phishing precisaria.
 */
describe('a campanha do admin', () => {
  it('mantém o que foi escrito', () => {
    expect(textoDaCampanha({ title: 'Desafio de Setembro', body: 'Começa amanhã.' })).toMatchObject({
      title: 'Desafio de Setembro',
      body: 'Começa amanhã.',
      url: '/hoje',
    });
  });

  it('aceita caminho interno', () => {
    expect(textoDaCampanha({ title: 'a', body: 'b', url: '/desafios/setembro-2026' }).url).toBe(
      '/desafios/setembro-2026',
    );
  });

  it('recusa site externo', () => {
    expect(textoDaCampanha({ title: 'a', body: 'b', url: 'https://outro.site' }).url).toBe('/hoje');
  });

  it('recusa a URL absoluta disfarçada de caminho', () => {
    // //outro.site é absoluta e o navegador segue; começa com barra e engana
    expect(textoDaCampanha({ title: 'a', body: 'b', url: '//outro.site' }).url).toBe('/hoje');
  });

  it('corta no tamanho que a tela mostra', () => {
    const longo = textoDaCampanha({ title: 'T'.repeat(200), body: 'B'.repeat(500) });
    expect(longo.title).toHaveLength(60);
    expect(longo.body).toHaveLength(180);
  });

  it('tira espaço sobrando das pontas', () => {
    expect(textoDaCampanha({ title: '  Oi  ', body: '  Tudo bem  ' })).toMatchObject({
      title: 'Oi',
      body: 'Tudo bem',
    });
  });
});
