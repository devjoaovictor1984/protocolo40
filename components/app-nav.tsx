'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  CalendarPlus,
  Camera,
  History,
  Home,
  LineChart,
  ListChecks,
  Plus,
  Scale,
  Timer,
  Trophy,
  User,
} from 'lucide-react';

import { Wordmark } from '@/components/brand/wordmark';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

/**
 * Navegação principal.
 *
 * Cinco itens no celular, com o `+` no centro — a ação de registrar precisa
 * estar debaixo do polegar. No desktop os mesmos destinos viram uma sidebar
 * discreta, e o `+` volta a ser um botão comum.
 */

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
};

const PRIMARY: NavItem[] = [
  { href: '/app', label: 'Hoje', icon: Home },
  { href: '/historico', label: 'Histórico', icon: History },
  { href: '/evolucao', label: 'Evolução', icon: LineChart },
  { href: '/perfil', label: 'Perfil', icon: User },
];

const SECONDARY: NavItem[] = [
  { href: '/treinos', label: 'Treinos', icon: ListChecks },
  { href: '/calendario', label: 'Calendário', icon: CalendarDays },
  { href: '/medidas', label: 'Medidas', icon: Scale },
  { href: '/recordes', label: 'Recordes', icon: Trophy },
];

/**
 * O que o `+` oferece.
 *
 * Dividido em duas perguntas, porque são momentos diferentes: vou treinar
 * agora, ou vou anotar algo que já aconteceu. No celular esta folha também é o
 * caminho para as telas que não cabem nos cinco itens da barra.
 */
const QUICK_ACTIONS: {
  grupo: string;
  itens: {
    href: string;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    primary?: boolean;
  }[];
}[] = [
  {
    grupo: 'Treinar agora',
    itens: [
      {
        href: '/treino/hoje?auto=1',
        label: 'Começar treino livre',
        description: 'Abre o cronômetro em 20:00',
        icon: Timer,
        primary: true,
      },
      {
        href: '/treinos',
        label: 'Escolher um treino',
        description: 'Circuitos prontos de 20 minutos e os seus salvos',
        icon: ListChecks,
      },
    ],
  },
  {
    grupo: 'Registrar',
    itens: [
      {
        href: '/treino/registrar-dias',
        label: 'Vários dias de uma vez',
        description: 'Marque no calendário os dias em que treinou',
        icon: CalendarPlus,
      },
      {
        href: '/treino/novo',
        label: 'Um treino passado',
        description: 'Com duração, rounds e exercícios',
        icon: History,
      },
      {
        href: '/medidas?novo=1',
        label: 'Peso e medidas',
        description: 'Só a data é obrigatória',
        icon: Scale,
      },
      {
        href: '/evolucao/fotos?nova=1',
        label: 'Foto de evolução',
        description: 'Fica privada até você decidir o contrário',
        icon: Camera,
      },
    ],
  },
  {
    grupo: 'Ver',
    itens: [
      {
        href: '/calendario',
        label: 'Calendário',
        description: 'O mês inteiro, dia a dia',
        icon: CalendarDays,
      },
      {
        href: '/recordes',
        label: 'Recordes',
        description: 'Suas melhores marcas',
        icon: Trophy,
      },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/app') return pathname === '/app';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function QuickActions({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={children as React.ReactElement} />
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>O que você quer fazer?</DrawerTitle>
        </DrawerHeader>

        <nav className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-4 pb-8">
          {QUICK_ACTIONS.map(({ grupo, itens }) => (
            <section key={grupo} className="flex flex-col gap-2">
              <h3 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                {grupo}
              </h3>

              {itens.map(({ href, label, description, icon: Icon, primary }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex min-h-16 items-center gap-4 rounded-xl border p-4 transition-colors',
                    primary
                      ? 'border-primary/40 bg-primary/8 hover:bg-primary/12'
                      : 'border-border hover:bg-muted',
                  )}
                >
                  <Icon aria-hidden className={cn('size-5 shrink-0', primary && 'text-primary')} />
                  <span className="flex flex-col">
                    <span className="font-semibold">{label}</span>
                    <span className="text-muted-foreground text-sm">{description}</span>
                  </span>
                </Link>
              ))}
            </section>
          ))}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="border-border bg-background/95 pb-safe fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2 pt-1.5">
        {PRIMARY.slice(0, 2).map((item) => (
          <NavTab key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}

        <li className="flex items-center px-1">
          <QuickActions>
            <button
              type="button"
              aria-label="Começar treino, registrar ou navegar"
              className="bg-primary text-primary-foreground flex size-13 items-center justify-center rounded-2xl shadow-lg transition-transform active:scale-95"
            >
              <Plus aria-hidden className="size-6" />
            </button>
          </QuickActions>
        </li>

        {PRIMARY.slice(2).map((item) => (
          <NavTab key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </ul>
    </nav>
  );
}

function NavTab({ item, active }: { item: NavItem; active: boolean }) {
  const { href, label, icon: Icon } = item;

  return (
    <li className="flex-1">
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors',
          active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Icon aria-hidden className="size-5" />
        {label}
        {/* o item ativo não é indicado só pela cor */}
        <span
          aria-hidden
          className={cn('h-0.5 w-6 rounded-full', active ? 'bg-primary' : 'bg-transparent')}
        />
      </Link>
    </li>
  );
}

export function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="border-border hidden w-60 shrink-0 border-r lg:block">
      <div className="sticky top-0 flex h-dvh flex-col gap-6 px-4 py-6">
        <Wordmark href="/app" className="px-2" />

        <nav aria-label="Navegação principal" className="flex flex-col gap-1">
          {PRIMARY.map((item) => (
            <SideLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>

        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground px-3 text-[11px] font-semibold tracking-wider uppercase">
            Registrar
          </p>
          {SECONDARY.map((item) => (
            <SideLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          {/* as mesmas ações do botão central do celular: sem isto, registrar um
              treino passado ou uma foto não teria caminho no desktop */}
          <QuickActions>
            <button
              type="button"
              aria-label="Começar treino, registrar ou navegar"
              className="border-border hover:bg-muted flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors"
            >
              <Plus aria-hidden className="size-4" />
              Registrar
            </button>
          </QuickActions>

          <Link
            href="/treino/hoje?auto=1"
            className="bg-primary text-primary-foreground flex h-12 items-center justify-center gap-2 rounded-xl font-semibold transition-opacity hover:opacity-90"
          >
            <Timer aria-hidden className="size-4" />
            Começar treino
          </Link>
        </div>
      </div>
    </aside>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const { href, label, icon: Icon } = item;

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
        active
          ? 'bg-secondary text-foreground border-primary border-l-2'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground border-l-2 border-transparent',
      )}
    >
      <Icon aria-hidden className="size-4.5" />
      {label}
    </Link>
  );
}
