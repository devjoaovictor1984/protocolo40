import { ArrowRight, CalendarDays, Scale, TrendingDown, TrendingUp } from 'lucide-react';

import { cn } from '@/lib/utils';
import { daysBetween, formatDay } from '@/services/calendar';

/**
 * O antes e depois do perfil.
 *
 * Duas fotos lado a lado são duas fotos. O que transforma isso em evidência é a
 * tabela embaixo: quantos dias separam as duas e, quando o dono deixa o peso
 * visível, quanto ele mudou nesse intervalo.
 *
 * A comparação é uma tabela de verdade, e não dois cartões: a pergunta que se
 * faz olhando para isso é "quanto mudou", e responder exige as duas pontas na
 * mesma linha. Com `<table>` o leitor de tela lê "Peso, antes 92,4, depois
 * 86,1" em vez de quatro números soltos.
 *
 * O que **não** aparece: medida, série histórica, nenhum outro dia. A função do
 * banco devolve só estas duas pontas, e só se a configuração permitir.
 */
export function Showcase({
  antes,
  depois,
  antesEm,
  depoisEm,
  pesoAntes,
  pesoDepois,
}: {
  antes: string;
  depois: string;
  antesEm: string;
  depoisEm: string;
  pesoAntes: number | null;
  pesoDepois: number | null;
}) {
  const dias = daysBetween(antesEm, depoisEm);
  const temPeso = pesoAntes !== null && pesoDepois !== null;
  const delta = temPeso ? pesoDepois! - pesoAntes! : null;

  return (
    <section aria-label="Antes e depois" className="flex flex-col gap-3">
      <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
        Antes e depois
      </h2>

      <div className="grid grid-cols-2 gap-2">
        {[
          { url: antes, dia: antesEm, rotulo: 'Antes' },
          { url: depois, dia: depoisEm, rotulo: 'Depois' },
        ].map((foto) => (
          <figure key={foto.rotulo} className="relative flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada de curta duração */}
            <img
              src={foto.url}
              alt={`${foto.rotulo}: ${formatDay(foto.dia)}`}
              className="border-border aspect-3/4 w-full rounded-xl border object-cover"
            />
            <figcaption className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase backdrop-blur-sm">
              {foto.rotulo}
            </figcaption>
          </figure>
        ))}
      </div>

      <table className="w-full text-sm">
        <caption className="sr-only">Comparação entre o antes e o depois</caption>
        <thead>
          <tr className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            <th scope="col" className="w-0 pb-1 text-left font-semibold" />
            <th scope="col" className="pb-1 text-left font-semibold">
              Antes
            </th>
            <th scope="col" className="pb-1 text-left font-semibold">
              Depois
            </th>
          </tr>
        </thead>

        <tbody>
          <tr className="border-border border-t">
            <th scope="row" className="text-muted-foreground py-2 pr-3 text-left font-normal">
              <span className="flex items-center gap-1.5">
                <CalendarDays aria-hidden className="size-3.5" />
                Data
              </span>
            </th>
            <td className="tnum py-2">{formatDay(antesEm)}</td>
            <td className="tnum py-2">{formatDay(depoisEm)}</td>
          </tr>

          {temPeso ? (
            <tr className="border-border border-t">
              <th scope="row" className="text-muted-foreground py-2 pr-3 text-left font-normal">
                <span className="flex items-center gap-1.5">
                  <Scale aria-hidden className="size-3.5" />
                  Peso
                </span>
              </th>
              <td className="tnum py-2">{formatarPeso(pesoAntes!)}</td>
              <td className="tnum py-2 font-semibold">
                <span className="flex items-center gap-1.5">
                  {formatarPeso(pesoDepois!)}
                  <Variacao delta={delta!} />
                </span>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
        <ArrowRight aria-hidden className="size-3.5" />
        {dias} {dias === 1 ? 'dia' : 'dias'} entre as duas
      </p>
    </section>
  );
}

/**
 * A variação, sem julgamento.
 *
 * O app não sabe se perder peso era o objetivo de quem está olhando, então a
 * seta descreve a direção e a cor não celebra nem lamenta nenhuma das duas.
 * O sinal vai junto do número porque cor sozinha não conta nada a quem não a
 * distingue.
 */
function Variacao({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.05) {
    return <span className="text-muted-foreground text-xs font-normal">sem mudança</span>;
  }

  const Icone = delta < 0 ? TrendingDown : TrendingUp;
  const sinal = delta < 0 ? '−' : '+';

  return (
    <span className={cn('text-muted-foreground flex items-center gap-0.5 text-xs font-normal')}>
      <Icone aria-hidden className="size-3.5" />
      {sinal}
      {formatarPeso(Math.abs(delta))}
    </span>
  );
}

const formatarPeso = (valor: number) => `${valor.toFixed(1).replace('.', ',')} kg`;
