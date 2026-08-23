import { IMC_LIMITES, posicaoNaRegua, type FaixaImc } from '@/services/health';
import { cn } from '@/lib/utils';

/**
 * Régua de IMC.
 *
 * As quatro faixas em uma barra, com o marcador onde a pessoa está. A faixa
 * adequada é a única colorida — o resto fica neutro, porque tingir de vermelho
 * o corpo de alguém não ajuda ninguém a treinar amanhã.
 *
 * A posição nunca é a única informação: o número e o rótulo aparecem escritos.
 */

const FAIXAS: { ate: number; rotulo: string; nome: FaixaImc }[] = [
  { ate: IMC_LIMITES.magreza, rotulo: 'abaixo', nome: 'abaixo' },
  { ate: IMC_LIMITES.sobrepeso, rotulo: 'adequado', nome: 'adequado' },
  { ate: IMC_LIMITES.obesidade, rotulo: 'acima', nome: 'sobrepeso' },
  { ate: 35, rotulo: '', nome: 'obesidade' },
];

export function BmiScale({ imc, faixa }: { imc: number; faixa: FaixaImc }) {
  const posicao = posicaoNaRegua(imc);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <div className="flex h-3 w-full overflow-hidden rounded-full">
          {FAIXAS.map((item, indice) => {
            const inicio = indice === 0 ? 0 : posicaoNaRegua(FAIXAS[indice - 1].ate);
            const largura = posicaoNaRegua(item.ate) - inicio;

            return (
              <span
                key={item.nome}
                aria-hidden
                className={cn(
                  'h-full',
                  item.nome === 'adequado' ? 'bg-success/70' : 'bg-secondary',
                  indice > 0 && 'border-background border-l-2',
                )}
                style={{ width: `${largura * 100}%` }}
              />
            );
          })}
        </div>

        {/* o marcador do usuário, com o número escrito ao lado */}
        <span
          aria-hidden
          className="border-background bg-foreground absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{ left: `${posicao * 100}%` }}
        />
      </div>

      <div className="text-muted-foreground tnum flex justify-between text-[10px]">
        <span>15</span>
        <span>18,5</span>
        <span>25</span>
        <span>30</span>
        <span>35</span>
      </div>

      <p className="text-sm">
        Seu IMC é <strong className="tnum">{imc.toFixed(1).replace('.', ',')}</strong> —{' '}
        {faixa === 'adequado' ? (
          <span className="text-success font-semibold">dentro da faixa adequada</span>
        ) : faixa === 'abaixo' ? (
          <span className="font-semibold">abaixo da faixa adequada</span>
        ) : (
          <span className="font-semibold">acima da faixa adequada</span>
        )}
        .
      </p>
    </div>
  );
}
