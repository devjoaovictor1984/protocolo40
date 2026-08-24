import type { Metadata } from 'next';
import Link from 'next/link';
import { Beef, Flame, HeartPulse, Scale } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/stats';
import { ButtonLink } from '@/components/ui/button-link';
import { BmiScale } from '@/features/health/components/bmi-scale';
import { WaterTracker } from '@/features/health/components/water-tracker';
import { Paywall } from '@/features/billing/components/paywall';
import { temAcesso } from '@/features/billing/repository';
import { painelDeSaude } from '@/features/health/repository';
import { requireSession } from '@/lib/auth/session';
import { formatDay, todayIn } from '@/services/calendar';

export const metadata: Metadata = {
  title: 'Saúde',
  robots: { index: false, follow: false },
};

const COMO_PREENCHER: Record<string, { texto: string; href: string }> = {
  peso: { texto: 'Registrar o peso', href: '/medidas?novo=1' },
  altura: { texto: 'Informar a altura', href: '/configuracoes/conta' },
  nascimento: { texto: 'Informar a data de nascimento', href: '/configuracoes/conta' },
  sexo: { texto: 'Informar o sexo biológico', href: '/configuracoes/conta' },
};

export default async function SaudePage() {
  const { profile } = await requireSession();

  if (!(await temAcesso('saude'))) {
    return (
      <Paywall
        titulo="Saúde e metas do dia"
        descricao="Água, calorias, proteína e faixa de peso calculados a partir do que você já registra aqui."
        amostra={[
          'Meta de água do dia, com o acréscimo do que você suou no treino de hoje.',
          'Gasto calórico estimado pela sua frequência real de treino, e não por uma pergunta.',
          'Faixa de peso para a sua altura e quanto falta para entrar nela, sem prometer número mágico.',
        ]}
      />
    );
  }

  const hoje = todayIn(profile.timezone);
  const painel = await painelDeSaude(profile, hoje);
  const { metas } = painel;

  if (painel.pesoKg === null && painel.alturaCm === null) {
    return (
      <div className="py-6">
        <h1 className="mb-6 text-2xl font-extrabold tracking-tight">Saúde</h1>
        <EmptyState
          icon={HeartPulse}
          title="Faltam dois números para começar."
          description="Com o seu peso e a sua altura, esta tela calcula faixa de peso, calorias, proteína e água — tudo a partir do que você já treina aqui."
          action={
            <div className="flex flex-col items-center gap-2">
              <ButtonLink href="/medidas?novo=1" className="h-12">
                REGISTRAR PESO
              </ButtonLink>
              <ButtonLink href="/configuracoes/conta" variant="ghost" className="h-11">
                Informar altura no perfil
              </ButtonLink>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-6">
      <PageHeader titulo="Saúde" trilha={[{ href: '/evolucao', label: 'Evolução' }]} />
      <div className="-mt-6">
        <p className="text-muted-foreground text-sm">
          Calculado a partir do seu peso
          {painel.pesoEm ? ` de ${formatDay(painel.pesoEm)}` : ''}, da sua altura e da frequência
          real com que você treina — {painel.diasDeTreinoPorSemana.toFixed(1)} dias por semana no
          último mês.
        </p>
      </div>

      <WaterTracker dia={hoje} inicial={painel.aguaMl} meta={metas.aguaMl} />

      {metas.imc !== null && metas.faixa !== null ? (
        <section className="border-border flex flex-col gap-4 rounded-2xl border p-4">
          <h2 className="flex items-center gap-2 font-bold">
            <Scale aria-hidden className="text-primary size-4" />
            Peso e IMC
          </h2>

          <BmiScale imc={metas.imc} faixa={metas.faixa} />

          {metas.pesoDeReferencia ? (
            <div className="border-border flex flex-col gap-1 border-t pt-3 text-sm">
              <p>
                Para {painel.alturaCm} cm, a faixa de referência vai de{' '}
                <strong className="tnum">
                  {metas.pesoDeReferencia.min.toFixed(1).replace('.', ',')} kg
                </strong>{' '}
                a{' '}
                <strong className="tnum">
                  {metas.pesoDeReferencia.max.toFixed(1).replace('.', ',')} kg
                </strong>
                .
              </p>

              {metas.diferencaParaFaixa !== null && metas.diferencaParaFaixa !== 0 ? (
                <p className="text-muted-foreground">
                  Você está a{' '}
                  <strong className="tnum text-foreground">
                    {Math.abs(metas.diferencaParaFaixa).toFixed(1).replace('.', ',')} kg
                  </strong>{' '}
                  {metas.diferencaParaFaixa > 0 ? 'acima' : 'abaixo'} dela.
                </p>
              ) : (
                <p className="text-success">Você está dentro dela.</p>
              )}
            </div>
          ) : null}

          <p className="text-muted-foreground text-xs leading-relaxed">
            O IMC não separa músculo de gordura. Quem treina há tempo costuma aparecer na faixa de
            cima sem que isso signifique excesso — a foto e a medida de cintura dizem mais.
          </p>
        </section>
      ) : null}

      {metas.metaCalorica !== null ? (
        <section className="border-border flex flex-col gap-4 rounded-2xl border p-4">
          <h2 className="flex items-center gap-2 font-bold">
            <Flame aria-hidden className="text-primary size-4" />
            Calorias
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <Numero rotulo="Gasto estimado" valor={`${metas.gastoDiario} kcal`} nota="por dia" />
            <Numero
              rotulo="Meta"
              valor={`${metas.metaCalorica} kcal`}
              nota={
                metas.ajusteCalorico === 0
                  ? 'manutenção'
                  : `${metas.ajusteCalorico! > 0 ? '+' : '−'}${Math.abs(metas.ajusteCalorico!)} kcal`
              }
              destaque
            />
          </div>

          <p className="text-muted-foreground text-xs leading-relaxed">
            Taxa basal de {metas.taxaBasal} kcal (equação de Mifflin‑St Jeor) multiplicada por{' '}
            {metas.fatorAtividade.toFixed(3).replace('.', ',')}, o fator correspondente a treinar{' '}
            {painel.diasDeTreinoPorSemana.toFixed(1)} dias por semana.
            {metas.ajusteCalorico !== null && metas.ajusteCalorico < 0
              ? ' O corte fica em torno de 18% do gasto: perder gordura mais rápido que isso custa massa magra.'
              : metas.ajusteCalorico !== null && metas.ajusteCalorico > 0
                ? ' O acréscimo é pequeno de propósito: superávit grande vira gordura, não músculo.'
                : ''}
            {metas.estimativaGrosseira
              ? ' Como o sexo biológico não foi informado, este número é a média das duas equações — informe no perfil para afinar.'
              : ''}
          </p>
        </section>
      ) : null}

      {metas.proteinaGramas !== null ? (
        <section className="border-border flex flex-col gap-4 rounded-2xl border p-4">
          <h2 className="flex items-center gap-2 font-bold">
            <Beef aria-hidden className="text-primary size-4" />
            Proteína
          </h2>

          <Numero
            rotulo="Por dia"
            valor={`${metas.proteinaGramas} g`}
            nota={`${metas.proteinaPorKg!.toFixed(1).replace('.', ',')} g por quilo`}
            destaque
          />

          <p className="text-muted-foreground text-xs leading-relaxed">
            É o suficiente para sustentar ganho de massa em quem treina. Comer bem acima disso não
            acelera nada.
            {metas.proteinaPorKg === 2
              ? ' A quantidade está mais alta porque você está em déficit: a proteína é o que protege o músculo enquanto o peso cai.'
              : ''}{' '}
            Na prática: cerca de {Math.round(metas.proteinaGramas / 30)} porções ao longo do dia,
            de aproximadamente 30 g cada.
          </p>
        </section>
      ) : null}

      {painel.faltando.length > 0 ? (
        <section className="border-primary/40 bg-primary/5 flex flex-col gap-3 rounded-2xl border p-4">
          <h2 className="font-bold">Para os números ficarem mais precisos</h2>
          <ul className="flex flex-col gap-2">
            {painel.faltando.map((item) => {
              const acao = COMO_PREENCHER[item];
              return (
                <li key={item}>
                  <Link
                    href={acao.href}
                    className="border-border hover:bg-muted flex min-h-12 items-center rounded-lg border px-4 text-sm font-medium transition-colors"
                  >
                    {acao.texto}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p className="text-muted-foreground border-border rounded-xl border p-4 text-xs leading-relaxed">
        Estes números são estimativas de população aplicadas a você, calculadas a partir do que
        está registrado aqui. Servem de ponto de partida e de direção, não de prescrição. Quem tem
        condição de saúde, faz uso de medicação ou está grávida deve conversar com um profissional
        antes de mudar alimentação ou hidratação.
      </p>
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  nota,
  destaque,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  destaque?: boolean;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
        {rotulo}
      </p>
      <p className={destaque ? 'tnum text-2xl font-extrabold' : 'tnum text-2xl font-bold'}>
        {valor}
      </p>
      {nota ? <p className="text-muted-foreground tnum text-xs">{nota}</p> : null}
    </div>
  );
}
