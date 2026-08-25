import { AlertTriangle, CheckCircle2, Lightbulb, Target } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { FocoDaSemana, Ponto } from '@/services/objective';

/**
 * O foco por objetivo.
 *
 * Abre a tela de análise porque responde a pergunta que a pessoa realmente
 * faz — "o que eu faço esta semana" — antes da leitura exercício por exercício,
 * que responde "o que está errado".
 *
 * Os três números do topo existem para dar contexto ao texto: um conselho sobre
 * frequência sem mostrar a frequência é opinião; com o número do lado, é
 * diagnóstico. E cada um vem com o alvo, para a pessoa saber de onde saiu.
 */
export function FocusBlock({ foco }: { foco: FocoDaSemana }) {
  return (
    <section aria-label="Foco da semana" className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl"
        >
          <Target className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold tracking-tight">Seu foco agora</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Para {foco.nome}, o que decide é {foco.oQueDecide}.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Numero
          valor={formatar(foco.diasPorSemana)}
          unidade="dias/sem"
          alvo={`alvo ${foco.alvoDeDias[0]}–${foco.alvoDeDias[1]}`}
          dentro={foco.diasPorSemana >= foco.alvoDeDias[0] - 0.5}
        />
        <Numero
          valor={foco.esforcoMedio === null ? '—' : formatar(foco.esforcoMedio)}
          unidade="esforço"
          alvo={`alvo ${foco.alvoDeEsforco[0]}–${foco.alvoDeEsforco[1]}`}
          dentro={
            foco.esforcoMedio !== null &&
            foco.esforcoMedio >= foco.alvoDeEsforco[0] - 0.5 &&
            foco.esforcoMedio <= foco.alvoDeEsforco[1] + 0.5
          }
        />
        <Numero
          valor={formatar(foco.descansoPorSemana)}
          unidade="folgas/sem"
          alvo={`alvo ${foco.alvoDeDescanso[0]}–${foco.alvoDeDescanso[1]}`}
          dentro={foco.descansoPorSemana >= foco.alvoDeDescanso[0] - 0.5}
        />
      </div>

      <ul className="flex flex-col gap-2">
        {foco.pontos.map((ponto) => (
          <li key={ponto.chave}>
            <PontoDoFoco ponto={ponto} />
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground text-xs leading-relaxed">
        As faixas vêm do consenso de treinamento, aplicadas ao objetivo que você escolheu no perfil.
        Isto não é conselho médico — dor persistente e lesão são assunto de profissional.
      </p>
    </section>
  );
}

/** Um número com o alvo embaixo. A cor confirma; o texto é quem informa. */
function Numero({
  valor,
  unidade,
  alvo,
  dentro,
}: {
  valor: string;
  unidade: string;
  alvo: string;
  dentro: boolean;
}) {
  return (
    <div className="border-border flex flex-col items-center gap-0.5 rounded-xl border p-3 text-center">
      <span className={cn('tnum text-2xl font-extrabold', dentro && 'text-success')}>{valor}</span>
      <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {unidade}
      </span>
      <span className="text-muted-foreground text-[10px]">{alvo}</span>
    </div>
  );
}

const ESTILO: Record<Ponto['severidade'], { classe: string; icone: typeof AlertTriangle }> = {
  atencao: { classe: 'border-destructive/40 bg-destructive/5', icone: AlertTriangle },
  ajuste: { classe: 'border-border', icone: Lightbulb },
  elogio: { classe: 'border-success/40 bg-success/5', icone: CheckCircle2 },
};

function PontoDoFoco({ ponto }: { ponto: Ponto }) {
  const { classe, icone: Icone } = ESTILO[ponto.severidade];

  return (
    <div className={cn('flex items-start gap-3 rounded-xl border p-4', classe)}>
      <Icone
        aria-hidden
        className={cn(
          'mt-0.5 size-4 shrink-0',
          ponto.severidade === 'atencao' && 'text-destructive',
          ponto.severidade === 'elogio' && 'text-success',
          ponto.severidade === 'ajuste' && 'text-muted-foreground',
        )}
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{ponto.titulo}</p>
        <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">{ponto.detalhe}</p>
      </div>
    </div>
  );
}

/** Um decimal, e sem o ",0" quando é inteiro. */
function formatar(valor: number): string {
  const arredondado = Math.round(valor * 10) / 10;
  return Number.isInteger(arredondado)
    ? String(arredondado)
    : arredondado.toFixed(1).replace('.', ',');
}
