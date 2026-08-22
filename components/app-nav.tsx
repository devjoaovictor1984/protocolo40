'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  Camera,
  History,
  LineChart,
  Home,
  Plus,
  Scale,
  Timer,
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
  { href: '/treinos', label: 'Treinos', icon: Timer },
  { href: '/calendario', label: 'Calendário', icon: CalendarDays },
  { href: '/medidas', label: 'Medidas', icon: Scale },
];

const QUICK_ACTIONS = [
  {
    href: '/treino/hoje',
    label: 'Começar treino agora',
    description: 'Abre o cronômetro em 20:00',
    icon: Timer,
    primary: true,
  },
  {
    href: '/treino/novo',
    label: 'Registrar treino passado',
    description: 'Já treinou e quer anotar depois',
    icon: History,
    primary: false,
  },
  {
    href: '/medidas?novo=1',
    label: 'Registrar peso',
    description: 'Peso e medidas de hoje',
    icon: Scale,
    primary: false,
  },
  {
    href: '/evolucao/fotos?nova=1',
    label: 'Foto de evolução',
    description: 'Fica privada até você decidir o contrário',
    icon: Camera,
    primary: false,
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
          <DrawerTitle>O que você quer registrar?</DrawerTitle>
        </DrawerHeader>

        <nav className="flex flex-col gap-2 px-4 pb-8">
          {QUICK_ACTIONS.map(({ href, label, description, icon: Icon, primary }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-4 rounded-xl border p-4 transition-colors',
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
              aria-label="Registrar treino, peso ou foto"
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

        <div className="mt-auto">
          <Link
            href="/treino/hoje"
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
