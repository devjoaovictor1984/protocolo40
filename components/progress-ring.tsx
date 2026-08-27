import { cn } from '@/lib/utils';

type ProgressRingProps = {
  /** 0 a 1 */
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  trackClassName?: string;
  indicatorClassName?: string;
  children?: React.ReactNode;
  /** Descrição para leitor de tela. O anel sozinho não comunica nada. */
  label?: string;
  /**
   * Riscos ao longo da volta, de 0 a 1.
   *
   * São os intervalos do treino, lidos como as marcas de hora de um relógio.
   * Ficam dentro da espessura do traço para não engordar o anel.
   */
  marks?: { fracao: number; forte: boolean }[];
};

/**
 * Anel de progresso.
 *
 * A mesma figura da marca. Desenhado em SVG e não em bordas CSS porque o
 * cronômetro atualiza a cada quadro, e mudar `stroke-dashoffset` não força
 * recálculo de layout.
 */
export function ProgressRing({
  value,
  size = 240,
  strokeWidth = 10,
  className,
  trackClassName,
  indicatorClassName,
  children,
  label,
  marks,
}: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden={label ? undefined : true}
        role={label ? 'img' : undefined}
        aria-label={label}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={cn('stroke-border', trackClassName)}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('stroke-primary transition-[stroke-dashoffset] duration-300', indicatorClassName)}
        />
        {/*
          Os riscos vêm por último para ficarem por cima do progresso. Cada um é
          uma linha radial atravessando a espessura do anel — a marca de um
          relógio, no mesmo lugar onde o olho já procura. Desenhados na cor do
          fundo, eles recortam o anel em vez de somar tinta a ele.
        */}
        {marks?.map((marca) => {
          const angulo = marca.fracao * 2 * Math.PI;
          const interno = radius - strokeWidth / 2;
          const externo = radius + strokeWidth / 2;
          const meio = size / 2;

          return (
            <line
              key={`${marca.fracao}-${marca.forte}`}
              x1={meio + Math.cos(angulo) * interno}
              y1={meio + Math.sin(angulo) * interno}
              x2={meio + Math.cos(angulo) * externo}
              y2={meio + Math.sin(angulo) * externo}
              strokeWidth={marca.forte ? 2.5 : 1.5}
              strokeLinecap="butt"
              className={cn(marca.forte ? 'stroke-background' : 'stroke-background/60')}
            />
          );
        })}
      </svg>

      {children ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
      ) : null}
    </div>
  );
}
