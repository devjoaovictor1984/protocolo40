'use client';

import { useActionState, useMemo, useState, useTransition } from 'react';
import { CheckCircle2, CircleCheck, Info, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { concluirMeta, definirMeta, encerrarMeta } from '@/features/goals/actions';
import { idleState } from '@/lib/forms/action-state';
import { cn } from '@/lib/utils';
import { addDays, formatDay, monthLabel } from '@/services/calendar';
import { avaliarAlvo, formatarKg, marcosDe, ritmoSeguroSemanal } from '@/services/goals';

/**
 * Escolher o alvo.
 *
 * O formulário mostra a consequência antes de salvar: quantos degraus são, e
 * por volta de quando o alvo chega no ritmo que se sustenta. A pessoa decide
 * com a informação na frente, em vez de descobrir depois que escolheu algo que
 * levaria dois anos — ou algo que só chegaria em quatro semanas passando fome.
 *
 * Não existe campo de prazo, de propósito. Ver o cabeçalho de `services/goals.ts`.
 */
export function GoalForm({
  alvoAtual,
  pesoAtualKg,
  pesoEm,
  alturaCm,
  temMeta,
  metaAlcancavel,
  hoje,
}: {
  alvoAtual: number | null;
  pesoAtualKg: number | null;
  pesoEm: string | null;
  alturaCm: number | null;
  temMeta: boolean;
  /** true quando a tendência já cruzou o alvo e só falta fechar */
  metaAlcancavel: boolean;
  hoje: string;
}) {
  const [state, action] = useActionState(definirMeta, idleState);
  const [alvo, setAlvo] = useState(alvoAtual === null ? '' : String(alvoAtual).replace('.', ','));
  const [pendente, iniciar] = useTransition();

  const previa = useMemo(
    () => calcularPrevia(alvo, pesoAtualKg, alturaCm, hoje),
    [alvo, pesoAtualKg, alturaCm, hoje],
  );

  if (pesoAtualKg === null) {
    return (
      <div className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4">
        <p className="text-sm font-semibold">Falta o ponto de partida</p>
        <p className="text-muted-foreground text-sm">
          A meta começa no seu peso de hoje, e ainda não há nenhuma pesagem registrada. Registre
          uma em Medidas e volte aqui — leva menos de um minuto.
        </p>
        <ButtonLink href="/medidas?novo=1" className="h-12">
          REGISTRAR PESO
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-5">
        {state.status !== 'idle' && state.message ? (
          <p
            role="status"
            className={cn(
              'flex items-start gap-2 rounded-lg border p-3 text-sm',
              state.status === 'error'
                ? 'border-destructive/30 bg-destructive/8 text-destructive'
                : 'border-success/30 bg-success/8 text-success',
            )}
          >
            {state.status === 'success' ? (
              <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
            ) : (
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            )}
            {state.message}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="target_kg">Quanto você quer pesar</Label>
          <div className="flex items-center gap-2">
            <Input
              id="target_kg"
              name="target_kg"
              inputMode="decimal"
              autoComplete="off"
              value={alvo}
              onChange={(evento) => setAlvo(evento.target.value)}
              aria-invalid={state.fieldErrors?.target_kg ? true : undefined}
              aria-describedby="alvo-ajuda"
              className="h-12 text-base"
            />
            <span className="text-muted-foreground text-sm">kg</span>
          </div>

          {state.fieldErrors?.target_kg ? (
            <p className="text-destructive text-sm">{state.fieldErrors.target_kg}</p>
          ) : (
            <p id="alvo-ajuda" className="text-muted-foreground text-sm">
              Hoje você está em {formatarKg(pesoAtualKg)}
              {pesoEm ? `, registrado em ${formatDay(pesoEm)}` : ''}. É daí que a meta parte.
            </p>
          )}
        </div>

        {previa ? <Previa previa={previa} /> : null}

        <Button type="submit" className="h-12">
          {temMeta ? 'ATUALIZAR META' : 'DEFINIR META'}
        </Button>
      </form>

      {temMeta ? (
        <div className="border-border flex flex-col gap-3 border-t pt-6">
          {metaAlcancavel ? (
            <>
              <p className="text-sm font-semibold">Você chegou ao alvo</p>
              <p className="text-muted-foreground text-sm">
                Fechar guarda esta meta como concluída e libera espaço para a próxima. O histórico
                das suas pesagens não muda.
              </p>
              <Button
                type="button"
                disabled={pendente}
                onClick={() => iniciar(() => void concluirMeta())}
                className="h-12"
              >
                FECHAR META COMO ALCANÇADA
              </Button>
            </>
          ) : null}

          <p className="text-muted-foreground text-sm">
            Desistir de uma meta não apaga nada do que você registrou, e não conta como falha em
            lugar nenhum do app.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={pendente}
            onClick={() => iniciar(() => void encerrarMeta())}
            className="h-12"
          >
            REMOVER ESTA META
          </Button>
        </div>
      ) : null}
    </div>
  );
}

type Previa =
  | { tipo: 'aviso'; nivel: 'aviso' | 'recusado'; mensagem: string }
  | {
      tipo: 'ok';
      direcao: 'perder' | 'ganhar';
      distanciaKg: number;
      degraus: number;
      semanas: number;
      chegadaEm: string;
      ritmo: number;
      avisoDeFaixa: string | null;
    };

/**
 * A prévia usa sempre o ritmo de referência, e nunca um ritmo escolhido.
 *
 * É o número honesto antes de a meta existir: quanto tempo isso leva se for
 * feito de um jeito que se sustenta.
 */
function calcularPrevia(
  entrada: string,
  pesoAtualKg: number | null,
  alturaCm: number | null,
  hoje: string,
): Previa | null {
  if (pesoAtualKg === null) return null;

  const alvo = Number(entrada.trim().replace(',', '.'));
  if (!Number.isFinite(alvo) || alvo < 30 || alvo > 400) return null;

  const distancia = Math.abs(alvo - pesoAtualKg);
  if (distancia < 0.5) return null;

  const avaliacao = avaliarAlvo(alvo, alturaCm);
  if (avaliacao.nivel === 'recusado') {
    return { tipo: 'aviso', nivel: 'recusado', mensagem: avaliacao.mensagem };
  }

  const direcao = alvo < pesoAtualKg ? 'perder' : 'ganhar';
  const ritmo = ritmoSeguroSemanal(pesoAtualKg, direcao);
  const semanas = Math.ceil(distancia / ritmo);

  return {
    tipo: 'ok',
    direcao,
    distanciaKg: Math.round(distancia * 10) / 10,
    degraus: marcosDe(pesoAtualKg, alvo).length,
    semanas,
    chegadaEm: addDays(hoje, semanas * 7),
    ritmo,
    avisoDeFaixa: avaliacao.nivel === 'aviso' ? avaliacao.mensagem : null,
  };
}

function Previa({ previa }: { previa: Previa }) {
  if (previa.tipo === 'aviso') {
    return (
      <p
        role="status"
        className="border-destructive/30 bg-destructive/8 text-destructive flex items-start gap-2 rounded-lg border p-3 text-sm"
      >
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        {previa.mensagem}
      </p>
    );
  }

  const verbo = previa.direcao === 'perder' ? 'perder' : 'ganhar';

  return (
    <div className="border-border bg-muted/40 flex flex-col gap-3 rounded-xl border p-3">
      <p className="flex items-start gap-2 text-sm">
        <CircleCheck aria-hidden className="text-success mt-0.5 size-4 shrink-0" />
        <span>
          São {formatarKg(previa.distanciaKg)} a {verbo}, divididos em {previa.degraus}{' '}
          {previa.degraus === 1 ? 'degrau' : 'degraus'}. No ritmo de referência —{' '}
          {previa.ritmo.toFixed(2).replace('.', ',')} kg por semana — isso chega por volta de{' '}
          <strong className="font-semibold">{monthLabel(previa.chegadaEm)}</strong>.
        </span>
      </p>

      {previa.avisoDeFaixa ? (
        <p className="text-muted-foreground flex items-start gap-2 text-sm">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {previa.avisoDeFaixa}
        </p>
      ) : null}
    </div>
  );
}
