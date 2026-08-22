'use client';

import { useId, useMemo, useState } from 'react';
import { Table2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Gráficos do PROTOCOLO40.
 *
 * Todos são de série única: o título nomeia a série, então não existe legenda —
 * e nenhuma identidade depende de cor. Cada gráfico traz uma tabela equivalente
 * atrás de um botão, para leitor de tela e para quem prefere o número exato.
 *
 * As marcas usam `--chart-1`, cujo contraste contra as duas superfícies e a
 * separação entre vizinhos foram verificados nos dois temas.
 */

export type Point = {
  /** rótulo do eixo x, já formatado para leitura */
  label: string;
  value: number;
  /** descrição completa para a tabela e o tooltip */
  caption?: string;
};

type ChartProps = {
  title: string;
  unit?: string;
  data: Point[];
  /** formatação do valor; o padrão arredonda para inteiro */
  format?: (value: number) => string;
  emptyMessage?: string;
  className?: string;
};

const PAD = { top: 16, right: 12, bottom: 26, left: 40 };
const WIDTH = 640;
const HEIGHT = 220;

function defaultFormat(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

/** Moldura comum: título, área do gráfico e a tabela equivalente. */
function ChartFrame({
  title,
  unit,
  data,
  format,
  children,
  className,
}: ChartProps & { children: React.ReactNode }) {
  const [showTable, setShowTable] = useState(false);
  const fmt = format ?? defaultFormat;

  return (
    <figure className={cn('border-border flex flex-col gap-3 rounded-xl border p-4', className)}>
      <figcaption className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight">
          {title}
          {unit ? <span className="text-muted-foreground font-normal"> ({unit})</span> : null}
        </h3>

        <button
          type="button"
          onClick={() => setShowTable((value) => !value)}
          aria-pressed={showTable}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
        >
          <Table2 aria-hidden className="size-3.5" />
          {showTable ? 'Ver gráfico' : 'Ver números'}
        </button>
      </figcaption>

      {showTable ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground sticky top-0 bg-inherit text-left text-xs">
              <tr>
                <th scope="col" className="py-1 font-medium">
                  Período
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {unit ?? 'Valor'}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((point, index) => (
                <tr key={`${point.label}-${index}`} className="border-border border-t">
                  <td className="py-1.5">{point.caption ?? point.label}</td>
                  <td className="tnum py-1.5 text-right">{fmt(point.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </figure>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <p className="text-muted-foreground flex h-40 items-center justify-center text-center text-sm text-balance">
      {message}
    </p>
  );
}

/** Escala com uma folga de 8% para a linha não encostar nas bordas. */
function scaleOf(values: number[], zeroBased: boolean) {
  const max = Math.max(...values, zeroBased ? 0 : -Infinity);
  const min = zeroBased ? 0 : Math.min(...values);
  const span = max - min || 1;
  const pad = zeroBased ? 0 : span * 0.08;
  return { min: min - pad, max: max + pad };
}

/**
 * Linha para séries contínuas — peso ao longo do tempo.
 * Traço de 2px, grade recessiva, ponto de 9px no item sob o cursor.
 */
export function LineChart({ emptyMessage = 'Sem dados ainda.', ...props }: ChartProps) {
  const { data, format } = props;
  const fmt = format ?? defaultFormat;
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (data.length === 0) return null;

    const { min, max } = scaleOf(
      data.map((point) => point.value),
      false,
    );
    const innerW = WIDTH - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const step = data.length > 1 ? innerW / (data.length - 1) : 0;

    const points = data.map((point, index) => ({
      ...point,
      x: PAD.left + index * step,
      y: PAD.top + innerH - ((point.value - min) / (max - min)) * innerH,
    }));

    return { points, min, max, innerH, step };
  }, [data]);

  if (!geometry) {
    return (
      <ChartFrame {...props}>
        <EmptyChart message={emptyMessage} />
      </ChartFrame>
    );
  }

  const { points, min, max } = geometry;
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `${PAD.left},${HEIGHT - PAD.bottom} ${line} ${points[points.length - 1].x},${HEIGHT - PAD.bottom}`;
  const current = active !== null ? points[active] : null;

  return (
    <ChartFrame {...props}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-48 w-full"
          role="img"
          aria-label={`${props.title}: de ${fmt(points[0].value)} a ${fmt(points[points.length - 1].value)}`}
          onPointerLeave={() => setActive(null)}
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
            let nearest = 0;
            for (let i = 1; i < points.length; i += 1) {
              if (Math.abs(points[i].x - x) < Math.abs(points[nearest].x - x)) nearest = i;
            }
            setActive(nearest);
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* grade recessiva: três linhas, sem moldura */}
          {[0, 0.5, 1].map((ratio) => {
            const y = PAD.top + (HEIGHT - PAD.top - PAD.bottom) * ratio;
            return (
              <line
                key={ratio}
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y}
                y2={y}
                stroke="var(--chart-grid)"
                strokeWidth="1"
              />
            );
          })}

          <polygon points={area} fill={`url(#${gradientId})`} />
          <polyline
            points={line}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* extremos rotulados: o leitor não precisa passar o mouse para saber
              onde a série começou e onde chegou */}
          <text x={PAD.left - 6} y={PAD.top + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
            {fmt(max)}
          </text>
          <text
            x={PAD.left - 6}
            y={HEIGHT - PAD.bottom}
            textAnchor="end"
            className="fill-muted-foreground text-[11px]"
          >
            {fmt(min)}
          </text>

          <text
            x={PAD.left}
            y={HEIGHT - 8}
            className="fill-muted-foreground text-[11px]"
            textAnchor="start"
          >
            {points[0].label}
          </text>
          {points.length > 1 ? (
            <text
              x={WIDTH - PAD.right}
              y={HEIGHT - 8}
              className="fill-muted-foreground text-[11px]"
              textAnchor="end"
            >
              {points[points.length - 1].label}
            </text>
          ) : null}

          {current ? (
            <g>
              <line
                x1={current.x}
                x2={current.x}
                y1={PAD.top}
                y2={HEIGHT - PAD.bottom}
                stroke="var(--chart-grid)"
                strokeWidth="1"
              />
              {/* anel na cor da superfície separa o ponto da linha */}
              <circle cx={current.x} cy={current.y} r="6" fill="var(--card)" />
              <circle cx={current.x} cy={current.y} r="4.5" fill="var(--chart-1)" />
            </g>
          ) : null}
        </svg>

        {current ? (
          <div
            className="border-border bg-popover pointer-events-none absolute top-0 rounded-lg border px-2.5 py-1.5 text-xs shadow-sm"
            style={{
              left: `${(current.x / WIDTH) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <p className="text-muted-foreground">{current.caption ?? current.label}</p>
            <p className="tnum font-semibold">
              {fmt(current.value)}
              {props.unit ? ` ${props.unit}` : ''}
            </p>
          </div>
        ) : null}
      </div>
    </ChartFrame>
  );
}

/**
 * Barras para contagens por período — treinos e minutos por semana.
 * Topo arredondado em 4px, base ancorada no zero, 2px de respiro entre barras.
 */
export function BarChart({ emptyMessage = 'Sem dados ainda.', ...props }: ChartProps) {
  const { data, format } = props;
  const fmt = format ?? defaultFormat;
  const [active, setActive] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <ChartFrame {...props}>
        <EmptyChart message={emptyMessage} />
      </ChartFrame>
    );
  }

  const { max } = scaleOf(
    data.map((point) => point.value),
    true,
  );
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barWidth = Math.max(6, Math.min(44, slot - 6));
  const current = active !== null ? data[active] : null;

  return (
    <ChartFrame {...props}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-48 w-full"
          role="img"
          aria-label={`${props.title}: ${data.length} períodos, máximo de ${fmt(max)}`}
          onPointerLeave={() => setActive(null)}
        >
          {[0, 0.5, 1].map((ratio) => {
            const y = PAD.top + innerH * ratio;
            return (
              <line
                key={ratio}
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y}
                y2={y}
                stroke="var(--chart-grid)"
                strokeWidth="1"
              />
            );
          })}

          <text x={PAD.left - 6} y={PAD.top + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
            {fmt(max)}
          </text>
          <text
            x={PAD.left - 6}
            y={HEIGHT - PAD.bottom}
            textAnchor="end"
            className="fill-muted-foreground text-[11px]"
          >
            0
          </text>

          {data.map((point, index) => {
            const height = max > 0 ? (point.value / max) * innerH : 0;
            const x = PAD.left + index * slot + (slot - barWidth) / 2;
            const y = PAD.top + innerH - height;

            return (
              <g key={`${point.label}-${index}`}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(height, point.value > 0 ? 2 : 0)}
                  rx="4"
                  fill="var(--chart-1)"
                  opacity={active === null || active === index ? 1 : 0.45}
                />
                {/* alvo de toque maior que a barra */}
                <rect
                  x={PAD.left + index * slot}
                  y={PAD.top}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  onPointerEnter={() => setActive(index)}
                />
              </g>
            );
          })}

          {/* rótulos seletivos: primeiro, último e o do meio */}
          {[0, Math.floor((data.length - 1) / 2), data.length - 1]
            .filter((index, position, list) => list.indexOf(index) === position && index >= 0)
            .map((index) => (
              <text
                key={index}
                x={PAD.left + index * slot + slot / 2}
                y={HEIGHT - 8}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                {data[index].label}
              </text>
            ))}
        </svg>

        {current && active !== null ? (
          <div
            className="border-border bg-popover pointer-events-none absolute top-0 rounded-lg border px-2.5 py-1.5 text-xs shadow-sm"
            style={{
              left: `${((PAD.left + active * slot + slot / 2) / WIDTH) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <p className="text-muted-foreground">{current.caption ?? current.label}</p>
            <p className="tnum font-semibold">
              {fmt(current.value)}
              {props.unit ? ` ${props.unit}` : ''}
            </p>
          </div>
        ) : null}
      </div>
    </ChartFrame>
  );
}
