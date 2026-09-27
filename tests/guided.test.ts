import { describe, expect, it } from 'vitest';

import {
  exerciciosPorVolta,
  fracaoDoGuiado,
  passosDoGuiado,
  porTempo,
  restanteDoDescanso,
  restanteDoExercicio,
  voltasCompletas,
  type ItemGuiado,
} from '@/services/guided';

const item = (name: string, repetitions: number | null, durationSeconds: number | null = null): ItemGuiado => ({
  exerciseId: name,
  name,
  slug: null,
  repetitions,
  durationSeconds,
});

// o dia 1 da trilha: 10 polichinelos, 5 agachamentos, 3 flexões, 15 s de prancha
const DIA_1 = [item('Polichinelo', 10), item('Agachamento', 5), item('Flexão', 3), item('Prancha', null, 15)];

describe('a sequência do treino guiado', () => {
  const passos = passosDoGuiado(DIA_1, 3, 30, 60);

  it('exercício, descanso, exercício — na ordem do circuito', () => {
    expect(passos.slice(0, 4).map((p) => (p.tipo === 'exercicio' ? p.item.name : `descanso ${p.segundos}`))).toEqual([
      'Polichinelo',
      'descanso 30',
      'Agachamento',
      'descanso 30',
    ]);
  });

  it('entre as voltas, o descanso é o mais longo', () => {
    const entre = passos.find((p) => p.tipo === 'descanso' && p.entreVoltas);
    expect(entre).toMatchObject({ segundos: 60, volta: 1, proximo: { name: 'Polichinelo' } });
  });

  it('o treino termina no último exercício, sem descanso sobrando', () => {
    expect(passos.at(-1)).toMatchObject({ tipo: 'exercicio', volta: 3, item: { name: 'Prancha' } });
  });

  it('3 voltas de 4 exercícios: 12 exercícios e 11 descansos', () => {
    expect(passos.filter((p) => p.tipo === 'exercicio')).toHaveLength(12);
    expect(passos.filter((p) => p.tipo === 'descanso')).toHaveLength(11);
    expect(exerciciosPorVolta(passos)).toBe(4);
  });

  it('descanso zero não vira passo', () => {
    const sem = passosDoGuiado(DIA_1, 1, 0, 0);
    expect(sem.every((p) => p.tipo === 'exercicio')).toBe(true);
  });

  it('o descanso mostra o que vem a seguir', () => {
    const primeiro = passos[1];
    expect(primeiro.tipo === 'descanso' && primeiro.proximo.name).toBe('Agachamento');
  });
});

describe('o tempo do guiado', () => {
  it('o descanso conta pelos segundos do treino, não por contador', () => {
    // começou aos 100 s de treino, 30 s de descanso: aos 112 faltam 18
    expect(restanteDoDescanso(30, 100, 112)).toBe(18);
  });

  it('pausa congela o descanso: sem segundos decorridos, nada muda', () => {
    // o cronômetro não anda pausado, então o decorrido fica parado também
    expect(restanteDoDescanso(30, 100, 100)).toBe(30);
  });

  it('descanso vencido fica em zero, nunca negativo', () => {
    expect(restanteDoDescanso(30, 100, 200)).toBe(0);
  });

  it('a prancha conta a partir do toque em começar', () => {
    expect(restanteDoExercicio(15, 50, 60)).toBe(5);
  });

  it('sabe quando um exercício é por tempo', () => {
    expect(porTempo(item('Prancha', null, 15))).toBe(true);
    expect(porTempo(item('Polichinelo', 10))).toBe(false);
  });
});

describe('o que vai para o histórico', () => {
  const passos = passosDoGuiado(DIA_1, 3, 30, 60);

  it('no começo, nenhuma volta', () => {
    expect(voltasCompletas(passos, 0)).toBe(0);
  });

  it('no descanso entre voltas, a volta fechada já conta', () => {
    const indice = passos.findIndex((p) => p.tipo === 'descanso' && p.entreVoltas);
    expect(voltasCompletas(passos, indice)).toBe(1);
  });

  it('parou no meio da terceira volta: duas feitas', () => {
    const indice = passos.findIndex((p) => p.tipo === 'exercicio' && p.volta === 3 && p.indice === 1);
    expect(voltasCompletas(passos, indice)).toBe(2);
  });

  it('terminou: todas as voltas', () => {
    expect(voltasCompletas(passos, passos.length)).toBe(3);
  });

  it('a barra anda por exercício feito, não por descanso', () => {
    expect(fracaoDoGuiado(passos, 0)).toBe(0);
    // depois do primeiro exercício, no descanso: 1 de 12
    expect(fracaoDoGuiado(passos, 1)).toBeCloseTo(1 / 12);
    expect(fracaoDoGuiado(passos, 2)).toBeCloseTo(1 / 12);
    expect(fracaoDoGuiado(passos, passos.length)).toBe(1);
  });
});
