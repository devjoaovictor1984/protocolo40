"use client";

import { useEffect, useMemo, useRef } from "react";
import { Check, ChevronLeft, Play, SkipForward, Timer } from "lucide-react";

import { ProgressRing } from "@/components/progress-ring";
import { Button } from "@/components/ui/button";
import type { CatalogTemplate } from "@/features/exercises/catalog";
import type { useTimer } from "@/features/timer/use-timer";
import type { PreferenciasDoSino } from "@/features/timer/use-interval-prefs";
import { tocar, vibrar } from "@/lib/audio/apito";
import { cn } from "@/lib/utils";
import { formatClock } from "@/services/duration";
import {
  exerciciosPorVolta,
  fracaoDoGuiado,
  INICIO_DO_GUIA,
  passosDoGuiado,
  porTempo,
  restanteDoDescanso,
  restanteDoExercicio,
  voltasCompletas,
  type EstadoDoGuia,
  type ItemGuiado,
} from "@/services/guided";
import { AVISO_ANTES } from "@/services/intervals";

/** Os itens do template no formato do guiado. */
export function itensDoTemplate(template: CatalogTemplate): ItemGuiado[] {
  return template.exercises.map((item) => ({
    exerciseId: item.exerciseId,
    name: item.name,
    slug: item.slug,
    repetitions: item.repetitions,
    durationSeconds: item.durationSeconds,
  }));
}

/** Quanto se soma ao descanso num toque: o bastante para recuperar, pouco para esfriar. */
const MAIS_DESCANSO = 15;

/**
 * O treino guiado, um passo por vez.
 *
 * A tela inteira é um passo só: o exercício com o número grande, ou o descanso
 * com a contagem. Quem está no chão entre uma flexão e outra lê de longe, toca
 * um botão grande e não precisa pensar no que vem — o app já mostra.
 *
 * O descanso acaba sozinho e chama o próximo exercício, com o mesmo som do
 * sino. A prancha e a corrida parada contam sozinhas depois do toque em
 * "Começar". O resto espera o "Feito": repetição não se conta pelo relógio.
 */
export function GuidedPlayer({
  template,
  timer,
  preferencias,
  onFinalizar,
  salvando,
}: {
  template: CatalogTemplate;
  timer: ReturnType<typeof useTimer>;
  preferencias: PreferenciasDoSino;
  onFinalizar: () => void;
  salvando: boolean;
}) {
  const passos = useMemo(
    () =>
      passosDoGuiado(
        itensDoTemplate(template),
        template.rounds ?? 1,
        template.restSeconds ?? 0,
        template.roundRestSeconds ?? template.restSeconds ?? 0,
      ),
    [template],
  );

  const guia: EstadoDoGuia = timer.session?.guia ?? INICIO_DO_GUIA;
  const decorrido = timer.elapsed;
  const atual = passos[guia.passo] ?? null;
  const porVolta = exerciciosPorVolta(passos);
  const totalVoltas = template.rounds ?? 1;

  const irPara = (indice: number) => {
    const destino = Math.max(0, Math.min(indice, passos.length));
    timer.setGuia({ passo: destino, desde: decorrido, contando: null }, voltasCompletas(passos, destino));
  };

  const avancar = () => irPara(guia.passo + 1);

  // ---- o que acaba sozinho: o descanso e o exercício por tempo
  const restante =
    atual?.tipo === "descanso"
      ? restanteDoDescanso(atual.segundos, guia.desde, decorrido)
      : atual?.tipo === "exercicio" && porTempo(atual.item) && guia.contando !== null
        ? restanteDoExercicio(atual.item.durationSeconds ?? 0, guia.contando, decorrido)
        : null;

  const contando = restante !== null;

  /*
   * Um sinal por segundo, no máximo, e nunca repetido: o relógio re-renderiza
   * várias vezes por segundo, e sem esta trava o aviso tocaria em rajada.
   */
  const ultimoSinal = useRef<string | null>(null);

  useEffect(() => {
    if (restante === null || timer.paused) return;

    const chave = `${guia.passo}:${restante}`;
    if (ultimoSinal.current === chave) return;
    ultimoSinal.current = chave;

    if (restante === 0) {
      // fim do descanso chama o esforço; fim da prancha, o descanso
      const sinal = atual?.tipo === "descanso" ? "comecar" : "parar";
      tocar(sinal, preferencias);
      vibrar(sinal, preferencias.vibrar);
      avancar();
      return;
    }

    if (restante <= AVISO_ANTES) {
      tocar("contagem", preferencias);
      vibrar("contagem", preferencias.vibrar);
    }
    // `avancar` muda a cada render; a trava de chave é o que impede repetição
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restante, guia.passo, timer.paused]);

  const fracao = fracaoDoGuiado(passos, guia.passo);

  // ---- terminou
  if (!atual) {
    return (
      <section
        aria-label="Treino concluído"
        className="flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 text-center"
      >
        <span className="bg-success/12 text-success flex size-20 items-center justify-center rounded-full">
          <Check aria-hidden className="size-10" />
        </span>
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Treino completo</h2>
          <p className="text-muted-foreground mt-2 text-balance">
            {totalVoltas} {totalVoltas === 1 ? "volta" : "voltas"} em {formatClock(decorrido)}. Salve para o dia contar
            na sua trilha e na sua sequência.
          </p>
        </div>
        <Button className="h-16 w-full text-base font-bold" onClick={onFinalizar} disabled={salvando}>
          {salvando ? "Salvando…" : "FINALIZAR E SALVAR"}
        </Button>
        <button
          type="button"
          onClick={() => irPara(passos.length - 1)}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm underline-offset-4 hover:underline"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Voltar ao último exercício
        </button>
      </section>
    );
  }

  const volta = atual.volta;

  return (
    <section
      aria-label="Treino guiado"
      aria-live="polite"
      className="flex w-full max-w-sm flex-1 flex-col items-center gap-6"
    >
      {/* onde estou: volta, exercício e o treino inteiro numa barra */}
      <div className="flex w-full flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-muted-foreground text-xs font-bold tracking-[0.16em] uppercase">
            Volta {volta} de {totalVoltas}
            {atual.tipo === "exercicio" ? ` · ${atual.indice + 1} de ${porVolta}` : ""}
          </p>
          <p className="text-muted-foreground tnum flex items-center gap-1 text-xs font-semibold">
            <Timer aria-hidden className="size-3.5" />
            {formatClock(decorrido)}
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Progresso do treino"
          aria-valuenow={Math.round(fracao * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
        >
          <div className="bg-primary h-full rounded-full transition-[width] duration-500" style={{ width: `${fracao * 100}%` }} />
        </div>
      </div>

      {atual.tipo === "descanso" ? (
        <Descanso
          restante={restante ?? atual.segundos}
          total={atual.segundos}
          entreVoltas={atual.entreVoltas}
          proximo={atual.proximo}
          pausado={timer.paused}
          onPular={avancar}
          onMais={() =>
            timer.setGuia(
              { ...guia, desde: guia.desde + MAIS_DESCANSO },
              voltasCompletas(passos, guia.passo),
            )
          }
        />
      ) : (
        <Exercicio
          item={atual.item}
          restante={contando ? restante : null}
          pausado={timer.paused}
          onComecar={() =>
            timer.setGuia({ ...guia, contando: decorrido }, voltasCompletas(passos, guia.passo))
          }
          onFeito={avancar}
        />
      )}

      {guia.passo > 0 ? (
        <button
          type="button"
          onClick={() => irPara(guia.passo - 1)}
          className="text-muted-foreground hover:text-foreground flex min-h-11 items-center gap-1 text-sm underline-offset-4 hover:underline"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Voltar um passo
        </button>
      ) : null}
    </section>
  );
}

function Exercicio({
  item,
  restante,
  pausado,
  onComecar,
  onFeito,
}: {
  item: ItemGuiado;
  /** Nulo enquanto o exercício por tempo não começou (ou não é por tempo). */
  restante: number | null;
  pausado: boolean;
  onComecar: () => void;
  onFeito: () => void;
}) {
  const tempo = porTempo(item);
  const duracao = item.durationSeconds ?? 0;

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center gap-8 text-center">
      {tempo && restante !== null ? (
        <ProgressRing value={(restante / Math.max(1, duracao)) * 100} size={232} strokeWidth={12}>
          <span className={cn("tnum text-7xl font-extrabold tracking-tight", pausado && "text-muted-foreground")}>
            {restante}
          </span>
          <span className="text-muted-foreground mt-1 text-xs font-bold tracking-[0.16em] uppercase">
            {pausado ? "Pausado" : "segundos"}
          </span>
        </ProgressRing>
      ) : (
        <p className="tnum text-[7.5rem] leading-none font-extrabold tracking-tighter">
          {tempo ? duracao : item.repetitions}
          <span className="text-muted-foreground ml-1 text-3xl font-bold tracking-normal">{tempo ? "s" : "×"}</span>
        </p>
      )}

      <div>
        <h2 className="text-3xl font-extrabold tracking-tight text-balance">{item.name}</h2>
        {/* a meta é o piso, não o teto: quem conseguir mais, faz mais — sem
            trocar a ordem nem pular o descanso */}
        <p className="text-muted-foreground mt-2 text-sm text-balance">
          {tempo
            ? restante === null
              ? "Posicione-se e toque em começar. O app conta para você."
              : "Segure firme. O app avisa quando acabar."
            : "Se sair mais, melhor. Faça no seu ritmo e toque em feito."}
        </p>
      </div>

      {tempo && restante === null ? (
        <Button className="h-16 w-full text-base font-bold" onClick={onComecar}>
          <Play aria-hidden className="size-5" />
          COMEÇAR {duracao} S
        </Button>
      ) : tempo ? (
        <Button variant="secondary" className="h-14 w-full text-base font-semibold" onClick={onFeito}>
          <SkipForward aria-hidden className="size-4" />
          Encerrar antes
        </Button>
      ) : (
        <Button className="h-16 w-full text-base font-bold" onClick={onFeito}>
          <Check aria-hidden className="size-5" />
          FEITO
        </Button>
      )}
    </div>
  );
}

function Descanso({
  restante,
  total,
  entreVoltas,
  proximo,
  pausado,
  onPular,
  onMais,
}: {
  restante: number;
  total: number;
  entreVoltas: boolean;
  proximo: ItemGuiado;
  pausado: boolean;
  onPular: () => void;
  onMais: () => void;
}) {
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center gap-7 text-center">
      <p className="text-primary text-sm font-extrabold tracking-[0.2em] uppercase">
        {entreVoltas ? "Fim da volta · Descanse" : "Descanse"}
      </p>

      <ProgressRing value={Math.min(100, (restante / Math.max(1, total)) * 100)} size={232} strokeWidth={12}>
        <span className={cn("tnum text-7xl font-extrabold tracking-tight", pausado && "text-muted-foreground")}>
          {formatClock(restante)}
        </span>
        <span className="text-muted-foreground mt-1 text-xs font-bold tracking-[0.16em] uppercase">
          {pausado ? "Pausado" : "respire"}
        </span>
      </ProgressRing>

      {/* o próximo aparece no descanso para a pessoa já se posicionar */}
      <div className="border-border bg-muted/40 w-full rounded-2xl border px-4 py-3">
        <p className="text-muted-foreground text-[11px] font-bold tracking-[0.16em] uppercase">A seguir</p>
        <p className="mt-0.5 text-lg font-extrabold tracking-tight">
          {porTempo(proximo) ? `${proximo.durationSeconds} s` : `${proximo.repetitions}×`} {proximo.name}
        </p>
      </div>

      <div className="flex w-full gap-3">
        <Button variant="secondary" className="h-14 flex-1 text-base font-semibold" onClick={onMais}>
          +{MAIS_DESCANSO} s
        </Button>
        <Button className="h-14 flex-[2] text-base font-bold" onClick={onPular}>
          <SkipForward aria-hidden className="size-4" />
          PULAR DESCANSO
        </Button>
      </div>
    </div>
  );
}
