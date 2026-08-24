'use client';

import { useMemo } from 'react';

import { cn } from '@/lib/utils';
import { addDays, daysBetween, formatDay } from '@/services/calendar';

/**
 * A linha do tempo do protocolo.
 *
 * Duas decisões que fazem ela não gerar ansiedade.
 *
 * **Não existe meta no fim.** A linha vai do Dia 1 até hoje, e hoje é sempre a
 * ponta direita. Uma barra que aponta para um objetivo distante transforma
 * cada dia em "quanto falta"; esta mostra "quanto você já andou", que é a
 * pergunta que sustenta a constância.
 *
 * **Ela nunca estoura a tela.** O eixo é sempre a largura disponível, então
 * acrescentar um dia não empurra nada: a escala se ajusta e as marcas ficam
 * mais próximas. Em protocolos longos as marcas viram semanas, porque 300
 * traços de um pixel não são informação, são ruído.
 */
export function Timeline({
  inicio,
  hoje,
  diasTreinados,
  diasDeDescanso = [],
}: {
  /** primeiro dia do protocolo */
  inicio: string;
  hoje: string;
  /** os dias em que houve treino, em `yyyy-MM-dd` */
  diasTreinados: string[];
  /** os dias de descanso: sustentam a sequência, mas não são treino */
  diasDeDescanso?: string[];
}) {
  const total = Math.max(1, daysBetween(inicio, hoje) + 1);

  /**
   * Cada marca é um dia ou uma semana, dependendo do tamanho.
   *
   * O limite é a legibilidade: acima de ~90 dias, um traço por dia fica com
   * menos de três pixels e some. Agrupar por semana mantém a leitura de
   * "cheio aqui, vazio ali", que é o que a linha existe para mostrar.
   */
  const marcas = useMemo(() => {
    // os conjuntos nascem aqui dentro: criados fora, seriam novos a cada
    // renderização e o memo não memorizaria nada
    const treinados = new Set(diasTreinados);
    const descansados = new Set(diasDeDescanso);

    const porSemana = total > 90;
    const passo = porSemana ? 7 : 1;
    const quantidade = Math.ceil(total / passo);

    return Array.from({ length: quantidade }, (_, indice) => {
      const primeiroDia = addDays(inicio, indice * passo);
      const dias = Array.from({ length: passo }, (_, offset) => addDays(primeiroDia, offset)).filter(
        (dia) => dia <= hoje,
      );

      const feitos = dias.filter((dia) => treinados.has(dia)).length;
      const descansos = dias.filter((dia) => !treinados.has(dia) && descansados.has(dia)).length;

      return {
        chave: primeiroDia,
        // intensidade: 0 é vazio, 1 é o período inteiro treinado
        intensidade: dias.length === 0 ? 0 : feitos / dias.length,
        soDescanso: feitos === 0 && descansos > 0,
        rotulo: porSemana
          ? `Semana de ${formatDay(primeiroDia)} — ${feitos} de ${dias.length}`
          : `${formatDay(primeiroDia)} — ${feitos > 0 ? 'treinou' : descansos > 0 ? 'descanso' : 'sem treino'}`,
      };
    });
  }, [diasDeDescanso, diasTreinados, hoje, inicio, total]);

  const feitos = diasTreinados.filter((dia) => dia >= inicio && dia <= hoje).length;

  return (
    <section aria-label="Sua linha do tempo" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Dia 1 · {formatDay(inicio)}
        </span>
        <span className="text-[11px] font-semibold tracking-wider uppercase">
          Dia {total} · hoje
        </span>
      </div>

      <div
        role="img"
        aria-label={`${feitos} dias treinados em ${total} dias de protocolo`}
        className="border-border bg-card flex h-10 w-full items-end gap-px overflow-hidden rounded-xl border p-1.5"
      >
        {marcas.map((marca) => (
          <span
            key={marca.chave}
            title={marca.rotulo}
            className={cn(
              'min-w-px flex-1 rounded-full transition-all',
              marca.intensidade === 0 && !marca.soDescanso && 'bg-secondary h-1.5',
              marca.soDescanso && 'bg-primary/25 h-2.5',
              marca.intensidade > 0 && marca.intensidade < 0.5 && 'bg-primary/40 h-3',
              marca.intensidade >= 0.5 && marca.intensidade < 1 && 'bg-primary/70 h-5',
              marca.intensidade === 1 && 'bg-primary h-full',
            )}
          />
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        <strong className="text-foreground tnum">{feitos}</strong>{' '}
        {feitos === 1 ? 'dia treinado' : 'dias treinados'} desde que você começou. Cada dia
        acrescenta um traço aqui — e nenhum deles é apagado.
      </p>
    </section>
  );
}
