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


/** Torre de vigia: quem monta guarda todo dia. */
function Torre({ cor, brilho }: { cor: string; brilho: string }) {
  return (
    <g fill="none" stroke={cor} strokeWidth="2.2" strokeLinejoin="round">
      <path d="M17 20 H31 V40 H17 Z" fill={brilho} fillOpacity="0.15" />
      <path d="M15 20 H17 V17 H20 V20 H24 V17 H27 V20 H31 H33" />
      <path d="M21 27 H27" strokeWidth="1.8" />
      <path d="M24 32 V40" strokeWidth="1.8" />
      <path d="M14 40 H34" strokeLinecap="round" />
    </g>
  );
}

/** Tocha: o turno de guarda que atravessa a noite. */
function Tocha({ cor, brilho }: { cor: string; brilho: string }) {
  return (
    <g fill="none" stroke={cor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 12 C28 17 29 21 27 24 C26 22 25 21 24 21 C23 22 22 24 21 24 C19 21 20 17 24 12 Z" fill={brilho} />
      <path d="M19 26 H29 L27 30 H21 Z" />
      <path d="M24 30 V42" />
    </g>
  );
}

/** Coluna: o que sustenta o templo. */
function Coluna({ cor, brilho }: { cor: string; brilho: string }) {
  return (
    <g fill="none" stroke={cor} strokeWidth="2.2" strokeLinejoin="round">
      <path d="M15 15 H33" strokeLinecap="round" />
      <path d="M18 18 H30 V37 H18 Z" fill={brilho} fillOpacity="0.15" />
      <path d="M21 18 V37 M27 18 V37" strokeWidth="1.4" />
      <path d="M14 41 H34" strokeLinecap="round" />
    </g>
  );
}

/** Âncora: o que não se move mesmo quando tudo balança. */
function Ancora({ cor }: { cor: string }) {
  return (
    <g fill="none" stroke={cor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="15" r="3.2" />
      <path d="M24 18 V40" />
      <path d="M17 23 H31" />
      <path d="M13 31 C13 38 18 42 24 42 C30 42 35 38 35 31" />
    </g>
  );
}

/** Martelo: o começo da forja. */
function Martelo({ cor, brilho }: { cor: string; brilho: string }) {
  return (
    <g fill="none" stroke={cor} strokeWidth="2.2" strokeLinejoin="round">
      <path d="M14 16 H30 V25 H14 Z" fill={brilho} fillOpacity="0.2" />
      <path d="M22 25 L26 41" strokeLinecap="round" />
      <path d="M30 18 L36 20 V22 L30 24" />
    </g>
  );
}

/** Bigorna: o que aguenta apanhar. */
function Bigorna({ cor, brilho }: { cor: string; brilho: string }) {
  return (
    <g fill="none" stroke={cor} strokeWidth="2.2" strokeLinejoin="round">
      <path d="M12 20 H32 L36 24 L30 27 H20 L16 24 H12 Z" fill={brilho} fillOpacity="0.2" />
      <path d="M22 27 V34" />
      <path d="M16 40 H32 L30 34 H18 Z" />
    </g>
  );
}

function Espada({ cor, brilho }: { cor: string; brilho: string }) {
  return (
    <g fill="none" stroke={cor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 9 L27 15 V30 H21 V15 Z" fill={brilho} fillOpacity="0.25" />
      <path d="M16 31 H32" />
      <path d="M24 31 V41" />
      <path d="M21 41 H27" />
    </g>
  );
}

/** Aríete: o tronco que derruba portão, para o volume de empurrar. */
function Ariete({ cor, brilho }: { cor: string; brilho: string }) {
  return (
    <g fill="none" stroke={cor} strokeWidth="2.2" strokeLinejoin="round">
      <path d="M12 24 H32 V32 H12 Z" fill={brilho} fillOpacity="0.18" />
      <path d="M32 22 L38 28 L32 34 Z" fill={cor} />
      <path d="M17 20 V24 M27 20 V24" strokeLinecap="round" />
      <path d="M17 32 V36 M27 32 V36" strokeLinecap="round" />
    </g>
  );
}

/** Bota: a legião andava trinta quilômetros por dia. */
function Bota({ cor, brilho }: { cor: string; brilho: string }) {
  return (
    <g fill="none" stroke={cor} strokeWidth="2.2" strokeLinejoin="round">
      <path d="M19 12 H26 V28 C26 31 29 32 32 33 C35 34 36 36 36 39 H19 Z" fill={brilho} fillOpacity="0.15" />
      <path d="M19 20 H26 M19 25 H26" strokeWidth="1.4" />
      <path d="M15 39 H37" strokeLinecap="round" />
    </g>
  );
}

/** Peitoral: o tronco é a armadura que não se tira. */
function Peitoral({ cor, brilho }: { cor: string; brilho: string }) {
  return (
    <g fill="none" stroke={cor} strokeWidth="2.2" strokeLinejoin="round">
      <path d="M16 15 L24 18 L32 15 V30 C32 37 28 41 24 43 C20 41 16 37 16 30 Z" fill={brilho} fillOpacity="0.15" />
      <path d="M16 25 H32 M16 32 H32" strokeWidth="1.4" />
      <path d="M24 18 V43" strokeWidth="1.4" />
    </g>
  );
}

/** Olho: o espelho esquece, a foto não. */
function Olho({ cor, brilho }: { cor: string; brilho: string }) {
  return (
    <g fill="none" stroke={cor} strokeWidth="2.2" strokeLinejoin="round">
      <path d="M10 27 C15 20 33 20 38 27 C33 34 15 34 10 27 Z" fill={brilho} fillOpacity="0.15" />
      <circle cx="24" cy="27" r="5" />
      <circle cx="24" cy="27" r="2" fill={cor} stroke="none" />
    </g>
  );
}

function Pergaminho({ cor, brilho }: { cor: string; brilho: string }) {
  return (
    <g fill="none" stroke={cor} strokeWidth="2.2" strokeLinejoin="round">
      <path d="M14 16 H34 V38 H14 Z" fill={brilho} fillOpacity="0.15" />
      <path d="M14 16 C11 16 11 21 14 21 M34 38 C37 38 37 33 34 33" />
      <path d="M19 24 H29 M19 29 H29" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

/** Sol nascendo: quem treina antes dele. */
function Sol({ cor, brilho }: { cor: string; brilho: string }) {
  return (
    <g fill="none" stroke={cor} strokeWidth="2.2" strokeLinecap="round">
      <path d="M14 34 A10 10 0 0 1 34 34" fill={brilho} fillOpacity="0.25" />
      <path d="M10 34 H38" />
      <path d="M24 14 V18 M14 19 L17 22 M34 19 L31 22 M9 27 H13 M35 27 H39" />
      <path d="M13 40 H35" strokeWidth="1.6" opacity="0.6" />
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

  // sequência, tempo acumulado, volume por movimento e evidência em foto
  torre: (p) => <Torre cor={p.traco} brilho={p.brilho} />,
  tocha: (p) => <Tocha cor={p.traco} brilho={p.brilho} />,
  coluna: (p) => <Coluna cor={p.traco} brilho={p.brilho} />,
  ancora: (p) => <Ancora cor={p.traco} />,
  louro: (p) => <Louro cor={p.traco} dentro={<Estrela cor={p.brilho} r={5} />} />,
  martelo: (p) => <Martelo cor={p.traco} brilho={p.brilho} />,
  bigorna: (p) => <Bigorna cor={p.traco} brilho={p.brilho} />,
  espada: (p) => <Espada cor={p.traco} brilho={p.brilho} />,
  ariete: (p) => <Ariete cor={p.traco} brilho={p.brilho} />,
  bota: (p) => <Bota cor={p.traco} brilho={p.brilho} />,
  peitoral: (p) => <Peitoral cor={p.traco} brilho={p.brilho} />,
  olho: (p) => <Olho cor={p.traco} brilho={p.brilho} />,
  pergaminho: (p) => <Pergaminho cor={p.traco} brilho={p.brilho} />,
  sol: (p) => <Sol cor={p.traco} brilho={p.brilho} />,
  lancas: (p) => <Lanca cor={p.traco} quantidade={2} />,
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
      className={cn(
        'size-14 shrink-0 transition-all',
        // conquistada: cor cheia. Bloqueada: cinza e recuada, para que a
        // diferença apareça de longe e não dependa de ler o cadeado.
        earned
          ? '[filter:drop-shadow(0_0_6px_color-mix(in_oklab,currentColor_35%,transparent))]'
          : 'opacity-30 grayscale',
        className,
      )}
      style={earned ? { color: paleta.borda } : undefined}
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
