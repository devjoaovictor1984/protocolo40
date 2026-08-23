import { cn } from '@/lib/utils';
import type { BadgeTier } from '@/types/database';

/**
 * Emblema de conquista.
 *
 * Um escudo desenhado à mão, com um símbolo dentro — não um ícone de biblioteca
 * redimensionado. A patente romana é o eixo: as primeiras marcas ganham galões,
 * as do meio ganham insígnias de comando e as últimas, coroa e louro.
 *
 * O dourado é reservado a conquista e não aparece em nenhum outro lugar do
 * produto; é o que faz o topo da escada valer alguma coisa.
 */

type Paleta = { fundo: string; borda: string; traco: string; brilho: string };

const TIERS: Record<BadgeTier, Paleta> = {
  bronze: {
    fundo: '#3A2A1E',
    borda: '#A9743F',
    traco: '#E7C39A',
    brilho: '#C98F52',
  },
  ferro: {
    fundo: '#23262B',
    borda: '#6E757F',
    traco: '#C3C9D2',
    brilho: '#8A919B',
  },
  prata: {
    fundo: '#2A2E34',
    borda: '#AEB6C2',
    traco: '#F1F4F8',
    brilho: '#D6DCE4',
  },
  ouro: {
    fundo: '#332608',
    borda: '#D6A72C',
    traco: '#FFE9A8',
    brilho: '#F0C64F',
  },
  imperial: {
    fundo: '#2A1338',
    borda: '#D6A72C',
    traco: '#FFE9A8',
    brilho: '#B678E8',
  },
};

const ESCUDO = 'M24 2 L44 8 V27 C44 41 34 50 24 54 C14 50 4 41 4 27 V8 Z';

/** Galões: a patente mais baixa se lê pela contagem. */
function Galoes({ quantidade, cor }: { quantidade: number; cor: string }) {
  return (
    <g stroke={cor} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
      {Array.from({ length: quantidade }, (_, i) => (
        <path key={i} d={`M15 ${20 + i * 7} L24 ${26 + i * 7} L33 ${20 + i * 7}`} />
      ))}
    </g>
  );
}

function Lanca({ cor, quantidade = 1 }: { cor: string; quantidade?: number }) {
  return (
    <g stroke={cor} strokeWidth="2.4" strokeLinecap="round" fill="none">
      {quantidade === 1 ? (
        <>
          <path d="M24 14 V40" />
          <path d="M20 19 L24 13 L28 19 Z" fill={cor} />
        </>
      ) : (
        <>
          <path d="M16 40 L32 14" />
          <path d="M32 40 L16 14" />
          <path d="M13 17 L17 11 L20 17 Z" fill={cor} />
          <path d="M28 17 L31 11 L35 17 Z" fill={cor} />
        </>
      )}
    </g>
  );
}

/** Elmo de crista — a marca de quem comanda. */
function Elmo({ cor, brilho, pluma }: { cor: string; brilho: string; pluma?: boolean }) {
  return (
    <g fill="none" stroke={cor} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
      {pluma ? <path d="M24 9 C31 12 33 18 32 23" stroke={brilho} strokeWidth="3.4" /> : null}
      <path d="M24 12 C31 12 35 17 35 24 V30 C35 36 30 40 24 42 C18 40 13 36 13 30 V24 C13 17 17 12 24 12 Z" />
      {/* a fenda vertical do elmo romano */}
      <path d="M24 18 V38" stroke={brilho} strokeWidth="2" />
      <path d="M15 27 H33" strokeWidth="1.8" />
    </g>
  );
}

/** Águia da legião. */
function Aguia({ cor, brilho }: { cor: string; brilho: string }) {
  return (
    <g fill="none" stroke={cor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 16 L24 42" />
      <path d="M24 20 C18 16 12 17 9 21 C14 22 18 25 24 27" fill={brilho} stroke={cor} />
      <path d="M24 20 C30 16 36 17 39 21 C34 22 30 25 24 27" fill={brilho} stroke={cor} />
      <circle cx="24" cy="15" r="3" fill={cor} />
    </g>
  );
}

/** Louro — a coroa de quem venceu. */
function Louro({ cor, dentro }: { cor: string; dentro?: React.ReactNode }) {
  return (
    <g>
      <g fill="none" stroke={cor} strokeWidth="2.2" strokeLinecap="round">
        <path d="M17 38 C10 32 10 22 16 16" />
        <path d="M31 38 C38 32 38 22 32 16" />
        <path d="M16 32 L12 30 M17 27 L13 24 M19 22 L16 19" />
        <path d="M32 32 L36 30 M31 27 L35 24 M29 22 L32 19" />
      </g>
      {dentro}
    </g>
  );
}

function Coroa({ cor, brilho }: { cor: string; brilho: string }) {
  return (
    <g stroke={cor} strokeWidth="2.2" strokeLinejoin="round" fill="none">
      <path
        d="M12 34 L14 18 L20 25 L24 15 L28 25 L34 18 L36 34 Z"
        fill={brilho}
        fillOpacity="0.25"
      />
      <path d="M12 38 H36" strokeLinecap="round" />
    </g>
  );
}

function Estrela({
  cor,
  cx = 24,
  cy = 26,
  r = 9,
}: {
  cor: string;
  cx?: number;
  cy?: number;
  r?: number;
}) {
  const pontos = Array.from({ length: 10 }, (_, i) => {
    const raio = i % 2 === 0 ? r : r * 0.45;
    const angulo = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + raio * Math.cos(angulo)).toFixed(1)},${(cy + raio * Math.sin(angulo)).toFixed(1)}`;
  });

  return <polygon points={pontos.join(' ')} fill={cor} />;
}

/** Barra fixa: as conquistas de volume falam do aparelho, não da patente. */
function Barra({ cor }: { cor: string }) {
  return (
    <g stroke={cor} strokeWidth="2.4" strokeLinecap="round" fill="none">
      <path d="M11 18 H37" />
      <path d="M13 14 V22 M35 14 V22" />
      <path d="M19 18 V26 M29 18 V26" />
      <path d="M24 26 A5 5 0 0 1 24 36" />
      <circle cx="24" cy="24" r="2.4" fill={cor} stroke="none" />
    </g>
  );
}

function Muralha({ cor }: { cor: string }) {
  return (
    <g stroke={cor} strokeWidth="2" strokeLinejoin="round" fill="none">
      <path d="M12 18 H16 V21 H20 V18 H24 V21 H28 V18 H32 V21 H36" />
      <rect x="12" y="21" width="24" height="6" />
      <rect x="12" y="27" width="24" height="6" />
      <rect x="12" y="33" width="24" height="6" />
      <path d="M18 21 V27 M30 21 V27 M24 27 V33 M18 33 V39 M30 33 V39" strokeWidth="1.4" />
    </g>
  );
}

/** Falange: escudos encostados, que é o ponto da formação. */
function Falange({ cor, brilho }: { cor: string; brilho: string }) {
  return (
    <g fill="none" stroke={cor} strokeWidth="2">
      {[13, 24, 35].map((x) => (
        <path
          key={x}
          d={`M${x} 16 L${x + 7} 19 V29 C${x + 7} 35 ${x + 3} 38 ${x} 40 C${x - 3} 38 ${x - 7} 35 ${x - 7} 29 V19 Z`}
          fill={brilho}
          fillOpacity="0.18"
        />
      ))}
    </g>
  );
}

const DESENHOS: Record<string, (p: Paleta) => React.ReactNode> = {
  recruta: (p) => <Galoes quantidade={1} cor={p.traco} />,
  legionario: (p) => <Galoes quantidade={2} cor={p.traco} />,
  hastati: (p) => <Lanca cor={p.traco} />,
  principes: (p) => <Lanca cor={p.traco} quantidade={2} />,
  triario: (p) => <Galoes quantidade={3} cor={p.traco} />,
  optio: (p) => <Elmo cor={p.traco} brilho={p.brilho} />,
  centuriao: (p) => <Elmo cor={p.traco} brilho={p.brilho} pluma />,
  aquilifero: (p) => <Aguia cor={p.traco} brilho={p.brilho} />,
  primus: (p) => <Louro cor={p.traco} dentro={<Estrela cor={p.brilho} r={6} />} />,
  pretoriano: (p) => (
    <>
      <Elmo cor={p.traco} brilho={p.brilho} pluma />
      <Estrela cor={p.brilho} cx={24} cy={47} r={4} />
    </>
  ),
  tribuno: (p) => <Louro cor={p.traco} dentro={<Aguia cor={p.brilho} brilho={p.fundo} />} />,
  legado: (p) => <Coroa cor={p.traco} brilho={p.brilho} />,
  imperator: (p) => <Louro cor={p.traco} dentro={<Coroa cor={p.brilho} brilho={p.traco} />} />,
  gancho: (p) => <Barra cor={p.traco} />,
  muralha: (p) => <Muralha cor={p.traco} />,
  falange: (p) => <Falange cor={p.traco} brilho={p.brilho} />,
  fundador: (p) => <Louro cor={p.traco} dentro={<Estrela cor={p.brilho} r={8} />} />,
};

export function Emblem({
  emblem,
  tier,
  earned = true,
  className,
}: {
  emblem: string;
  tier: BadgeTier;
  earned?: boolean;
  className?: string;
}) {
  const paleta = TIERS[tier];
  const desenho = DESENHOS[emblem] ?? DESENHOS.recruta;

  return (
    <svg
      viewBox="0 0 48 56"
      role="presentation"
      aria-hidden
      className={cn('size-14 shrink-0', !earned && 'opacity-35 saturate-0', className)}
    >
      <path d={ESCUDO} fill={paleta.fundo} stroke={paleta.borda} strokeWidth="2.5" />
      {/* brilho interno: dá volume sem virar gradiente pesado */}
      <path
        d={ESCUDO}
        fill="none"
        stroke={paleta.brilho}
        strokeWidth="0.8"
        opacity="0.5"
        transform="scale(0.88) translate(3.3 3.5)"
      />
      {desenho(paleta)}
    </svg>
  );
}
