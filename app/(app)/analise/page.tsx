import type { Metadata } from 'next';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Lightbulb,
  Stethoscope,
} from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/stats';
import { ButtonLink } from '@/components/ui/button-link';
import { analiseDoUsuario, focoDoUsuario } from '@/features/analysis/repository';
import { FocusBlock } from '@/features/analysis/components/focus-block';
import { Paywall } from '@/features/billing/components/paywall';
import { temAcesso } from '@/features/billing/repository';
import { requireSession } from '@/lib/auth/session';
import { cn } from '@/lib/utils';
import { todayIn } from '@/services/calendar';
import type { Recomendacao, Severidade } from '@/services/analysis';

export const metadata: Metadata = {
  title: 'Análise',
  robots: { index: false, follow: false },
};

const ESTILO: Record<Severidade, { icon: typeof AlertTriangle; classe: string; rotulo: string }> = {
  atencao: {
    icon: AlertTriangle,
    classe: 'border-warning/40 bg-warning/5',
    rotulo: 'Atenção',
  },
  ajuste: {
    icon: Lightbulb,
    classe: 'border-primary/40 bg-primary/5',
    rotulo: 'Ajuste',
  },
  elogio: {
    icon: CheckCircle2,
    classe: 'border-success/40 bg-success/5',
    rotulo: 'Continue',
  },
};

export default async function AnalisePage() {
  const { user, profile } = await requireSession();

  if (!(await temAcesso('analise'))) {
    return (
      <Paywall
        titulo="Análise do seu treino"
        descricao="A leitura do que você já fez, exercício por exercício, com o que mudar e por quê."
        amostra={[
          'Cruza esforço, volume e frequência das últimas quatro semanas com as quatro anteriores.',
          'Diz o que fazer em uma frase executável — número de séries, tipo de progressão, dias de descanso.',
          'Explica a razão de cada recomendação, com a faixa de treinamento em que ela se apoia.',
        ]}
      />
    );
  }

  const hoje = todayIn(profile.timezone);
  const [analise, foco] = await Promise.all([
    analiseDoUsuario(user.id, hoje),
    focoDoUsuario(user.id, profile.goal, hoje),
  ]);

  if (analise.treinos === 0) {
    return (
      <div className="py-6">
        <h1 className="mb-6 text-2xl font-extrabold tracking-tight">Análise</h1>
        <EmptyState
          icon={Stethoscope}
          title="Ainda não há o que analisar."
          description="A partir de alguns treinos registrados, esta tela passa a dizer o que mudar em cada exercício — e por quê."
          action={
            <ButtonLink href="/treinar" className="h-12">
              COMEÇAR TREINO
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-6">
      <PageHeader
        titulo="Análise"
        trilha={[{ href: '/evolucao', label: 'Evolução' }]}
        descricao={undefined}
      />
      <div className="-mt-6">
        <p className="text-muted-foreground text-sm">
          Últimas quatro semanas: {analise.treinos}{' '}
          {analise.treinos === 1 ? 'treino' : 'treinos'}
          {analise.esforcoMedio !== null
            ? `, esforço médio ${analise.esforcoMedio.toFixed(1)}/10`
            : ''}
          . Comparado com as quatro semanas anteriores.
        </p>
      </div>

      {/* o foco abre a tela: responde "o que eu faço esta semana", que é a
          pergunta que a pessoa faz, antes do exercício por exercício */}
      <FocusBlock foco={foco} />

      {analise.gerais.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            No conjunto
          </h2>
          {analise.gerais.map((item) => (
            <Cartao key={item.id} recomendacao={item} />
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-5">
        <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Exercício por exercício
        </h2>

        {analise.exercicios.map((exercicio) => {
          const cresceu = exercicio.volume > exercicio.volumeAnterior;
          const primeiraVez = exercicio.volumeAnterior === 0;
          const variacao = primeiraVez
            ? null
            : Math.round(
                ((exercicio.volume - exercicio.volumeAnterior) / exercicio.volumeAnterior) * 100,
              );

          return (
            <article
              key={exercicio.exerciseId}
              className="border-border flex flex-col gap-4 rounded-2xl border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-extrabold">{exercicio.nome}</h3>
                  <p className="text-muted-foreground tnum text-xs">
                    {exercicio.sessoes} {exercicio.sessoes === 1 ? 'sessão' : 'sessões'} ·{' '}
                    {exercicio.vezesPorSemana.toFixed(1)}× por semana
                    {exercicio.esforcoMedio !== null
                      ? ` · esforço ${exercicio.esforcoMedio.toFixed(1)}/10`
                      : ' · sem esforço declarado'}
                  </p>
                </div>

                {variacao !== null ? (
                  <span
                    className={cn(
                      'tnum flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                      cresceu ? 'border-success/40 text-success' : 'border-warning/40 text-warning',
                    )}
                  >
                    {cresceu ? (
                      <ArrowUpRight aria-hidden className="size-3" />
                    ) : (
                      <ArrowDownRight aria-hidden className="size-3" />
                    )}
                    {variacao > 0 ? '+' : ''}
                    {variacao}%
                  </span>
                ) : null}
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground text-[11px] tracking-wider uppercase">
                    Volume (4 semanas)
                  </dt>
                  <dd className="tnum font-bold">
                    {Math.round(exercicio.volume)} {exercicio.unidade}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-[11px] tracking-wider uppercase">
                    Séries por semana
                  </dt>
                  <dd className="tnum font-bold">{exercicio.seriesPorSemana.toFixed(1)}</dd>
                </div>
              </dl>

              {exercicio.recomendacoes.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nada a mudar por enquanto. Siga somando uma repetição por série a cada semana.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {exercicio.recomendacoes.map((item) => (
                    <Cartao key={item.id} recomendacao={item} />
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </section>

      <p className="text-muted-foreground border-border rounded-xl border p-4 text-xs">
        Esta análise olha apenas o que você registrou aqui e segue faixas gerais de treinamento de
        força — volume semanal por grupo muscular, proximidade da falha e tempo de recuperação. Não
        é avaliação médica nem substitui um profissional que veja você treinando. Dor que não passa,
        procure atendimento.
      </p>
    </div>
  );
}

function Cartao({ recomendacao }: { recomendacao: Recomendacao }) {
  const estilo = ESTILO[recomendacao.severidade];
  const Icon = estilo.icon;

  return (
    <div className={cn('flex flex-col gap-2 rounded-xl border p-4', estilo.classe)}>
      <p className="flex items-center gap-2 font-bold">
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="sr-only">{estilo.rotulo}: </span>
        {recomendacao.titulo}
      </p>

      <p className="text-sm">{recomendacao.acao}</p>

      <details className="text-muted-foreground text-xs">
        <summary className="hover:text-foreground flex min-h-9 cursor-pointer list-none items-center font-medium">
          Por que isso funciona
        </summary>
        <p className="mt-1 leading-relaxed">{recomendacao.porque}</p>
      </details>
    </div>
  );
}
