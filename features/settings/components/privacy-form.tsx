'use client';

import { useState, useTransition } from 'react';
import { Globe, Lock, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Switch } from '@/components/ui/switch';
import { updateAllowFollowers, updateVisibility } from '@/features/settings/actions';
import { cn } from '@/lib/utils';
import type { Visibility } from '@/types/database';

/**
 * Privacidade.
 *
 * Cada item é independente. O perfil e a sequência nascem públicos — é o que
 * permite alguém te achar e seguir; sem isso a comunidade nasce vazia. Tudo o
 * que este app tem de sensível de verdade — treinos, fotos, peso e medidas —
 * nasce privado e só sai daqui por escolha explícita.
 *
 * Nada muda sozinho depois disso.
 */

const OPTIONS: { value: Visibility; label: string; icon: typeof Lock }[] = [
  { value: 'private', label: 'Só eu', icon: Lock },
  { value: 'followers', label: 'Quem me segue', icon: Users },
  { value: 'public', label: 'Todos', icon: Globe },
];

const ITEMS = [
  {
    key: 'profile_visibility',
    label: 'Perfil',
    hint: 'Nome, foto, bio e insígnias em /u/seu-usuario. Público por padrão.',
  },
  { key: 'workouts_visibility', label: 'Treinos', hint: 'Duração, rounds e exercícios' },
  {
    key: 'photos_visibility',
    label: 'Fotos',
    // a dica antiga dizia "vale para as fotos novas; as antigas ficam como
    // estão" — era a descrição do bug, não da regra. A configuração vale para
    // o álbum inteiro.
    hint: 'Vale para o álbum inteiro, antigas e novas. O antes-e-depois do perfil é escolhido à parte.',
  },
  { key: 'weight_visibility', label: 'Peso', hint: 'O número e a curva' },
  { key: 'measurements_visibility', label: 'Medidas', hint: 'Cintura, peito, braço e demais' },
  { key: 'streak_visibility', label: 'Sequência', hint: 'Dias seguidos e maior sequência' },
] as const;

type SettingsShape = Record<string, Visibility | boolean>;

export function PrivacyForm({ settings }: { settings: SettingsShape }) {
  const [values, setValues] = useState(settings);
  const [pending, startTransition] = useTransition();

  function change(key: string, value: Visibility) {
    const previous = values[key];
    setValues((current) => ({ ...current, [key]: value }));

    startTransition(async () => {
      try {
        await updateVisibility(key as never, value);
      } catch {
        setValues((current) => ({ ...current, [key]: previous }));
        toast.error('Não conseguimos salvar essa configuração.', {
          description: 'Verifique sua conexão e tente de novo.',
        });
      }
    });
  }

  function toggleFollowers(allow: boolean) {
    const previous = values.allow_followers;
    setValues((current) => ({ ...current, allow_followers: allow }));

    startTransition(async () => {
      try {
        await updateAllowFollowers(allow);
      } catch {
        setValues((current) => ({ ...current, allow_followers: previous }));
        toast.error('Não conseguimos salvar essa configuração.');
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border-border bg-secondary/50 flex flex-col gap-2 rounded-xl border p-4 text-sm">
        <p>
          <strong>Seu perfil e sua sequência começam públicos.</strong> É o que permite outra
          pessoa te encontrar e seguir. Se preferir sumir das buscas, mude o Perfil para “Só eu”
          logo abaixo.
        </p>
        <p className="text-muted-foreground">
          Treinos, fotos, peso e medidas começam privados e continuam assim até você mudar aqui.
          Nenhuma parte do aplicativo publica nada sozinha.
        </p>
      </div>

      {/*
        "Todos" é a palavra curta que cabe no botão, e ela esconde uma
        diferença que importa: público aqui alcança quem não tem conta, porque
        o perfil em /u/usuario é uma página aberta. Dizer isso uma vez, em
        cima, é melhor do que repetir em seis dicas.
      */}
      <p className="text-muted-foreground text-sm">
        <strong className="text-foreground">Só eu</strong> é só você.{' '}
        <strong className="text-foreground">Quem me segue</strong> alcança quem já te segue hoje.{' '}
        <strong className="text-foreground">Todos</strong> alcança qualquer pessoa com o endereço
        do seu perfil — inclusive quem não tem conta no P20X.
      </p>

      <ul className="flex flex-col gap-5">
        {ITEMS.map((item) => (
          <li key={item.key} className="flex flex-col gap-2">
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-muted-foreground text-sm">{item.hint}</p>
            </div>

            <div className="flex gap-2" role="group" aria-label={`Visibilidade: ${item.label}`}>
              {OPTIONS.map((option) => {
                const active = values[item.key] === option.value;
                const Icon = option.icon;

                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    disabled={pending}
                    onClick={() => change(item.key, option.value)}
                    className={cn(
                      'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-muted',
                    )}
                  >
                    <Icon aria-hidden className="size-3.5" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      <div className="border-border flex items-center justify-between gap-4 rounded-xl border p-4">
        <div>
          <p className="font-medium">Permitir seguidores</p>
          <p className="text-muted-foreground text-sm">
            Desligado, ninguém consegue começar a te seguir.
          </p>
        </div>
        <Switch
          checked={Boolean(values.allow_followers)}
          onCheckedChange={toggleFollowers}
          disabled={pending}
          aria-label="Permitir seguidores"
        />
      </div>
    </div>
  );
}
