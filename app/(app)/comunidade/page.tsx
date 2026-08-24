import type { Metadata } from 'next';
import Link from 'next/link';
import { Search, UserPlus } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/stats';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { FollowButton } from '@/features/community/components/follow-button';
import { VisibilityCard } from '@/features/community/components/visibility-card';
import {
  buscarPessoas,
  minhaRede,
  pessoasNoApp,
  type Pessoa,
} from '@/features/community/repository';
import { requireSession } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { avatarUrl, initialsOf } from '@/lib/storage/avatar';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Comunidade',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ComunidadePage({ searchParams }: { searchParams: SearchParams }) {
  const { settings } = await requireSession();

  const params = await searchParams;
  const termo = typeof params.q === 'string' ? params.q : '';

  const [encontrados, todos, seguindo, seguidores] = await Promise.all([
    buscarPessoas(termo),
    pessoasNoApp(),
    minhaRede('seguindo'),
    minhaRede('seguidores'),
  ]);

  const seguindoIds = new Set(seguindo.map((pessoa) => pessoa.id));
  const visivel = settings.profile_visibility === 'public' && settings.allow_followers;

  // quem já sigo sai da vitrine: ela existe para descobrir, não para repetir
  const paraDescobrir = todos.filter((pessoa) => !seguindoIds.has(pessoa.id));

  return (
    <div className="flex flex-col gap-8 py-6">
      <header className="flex flex-col gap-4">
        <PageHeader
          titulo="Comunidade"
          descricao="Acompanhe quem também está fazendo os 20 minutos."
          trilha={[{ href: '/perfil', label: 'Perfil' }]}
        />

        {/* GET simples: a busca vira endereço e o voltar do navegador funciona */}
        <form action="/comunidade" className="relative">
          <Search aria-hidden className="text-muted-foreground absolute top-3.5 left-3 size-4" />
          <Input
            name="q"
            defaultValue={termo}
            placeholder="Buscar por nome ou @usuário"
            aria-label="Buscar pessoas"
            className="h-12 pl-9"
          />
        </form>
      </header>

      <VisibilityCard visivel={visivel} />

      <Link
        href="/convidar"
        className="border-primary/40 bg-primary/5 hover:bg-primary/10 flex min-h-14 items-center gap-3 rounded-xl border px-4 transition-colors"
      >
        <UserPlus aria-hidden className="text-primary size-5 shrink-0" />
        <span className="flex-1">
          <span className="block text-sm font-semibold">Convidar um amigo</span>
          <span className="text-muted-foreground text-sm">
            Cada pessoa que entra pelo seu link vira insígnia
          </span>
        </span>
      </Link>

      {termo ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Resultados para “{termo}”
          </h2>

          {encontrados.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {termo.trim().length < 2
                ? 'Escreva pelo menos duas letras.'
                : 'Ninguém com esse nome por aqui. Só aparecem perfis públicos.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {encontrados.map((pessoa) => (
                <li key={pessoa.id}>
                  <LinhaDePessoa
                    pessoa={pessoa}
                    detalhe={`${pessoa.seguidores} ${pessoa.seguidores === 1 ? 'seguidor' : 'seguidores'}`}
                    jaSegue={seguindoIds.has(pessoa.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {!termo && paraDescobrir.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              Pessoas no P20X
            </h2>
            <span className="text-muted-foreground tnum text-xs">{paraDescobrir.length}</span>
          </div>

          <ul className="flex flex-col gap-2">
            {paraDescobrir.map((pessoa) => (
              <li key={pessoa.id}>
                <LinhaDePessoa
                  pessoa={pessoa}
                  detalhe={`${pessoa.seguidores} ${pessoa.seguidores === 1 ? 'seguidor' : 'seguidores'}`}
                  jaSegue={false}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!termo && paraDescobrir.length === 0 && seguindo.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-xl border p-4 text-sm leading-relaxed">
          Ninguém mais liberou o perfil ainda. Convide quem treina com você: mande o endereço{' '}
          <strong className="text-foreground">p20x.com.br</strong> e peça para tocar em “Quero
          aparecer” aqui nesta tela.
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Você segue ({seguindo.length})
        </h2>

        {seguindo.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="Você ainda não segue ninguém."
            description="Busque pelo @usuário de alguém que treina com você. Ver a sequência de outra pessoa é o que faz não querer quebrar a sua."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {seguindo.map((pessoa) => (
              <li key={pessoa.id}>
                <LinhaDePessoa
                  pessoa={pessoa}
                  detalhe={
                    pessoa.dias_treinados === null
                      ? 'não mostra os números'
                      : `${pessoa.dias_treinados} dias treinados · sequência de ${pessoa.sequencia}`
                  }
                  jaSegue
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {seguidores.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Seguem você ({seguidores.length})
          </h2>

          <ul className="flex flex-col gap-2">
            {seguidores.map((pessoa) => (
              <li key={pessoa.id}>
                <LinhaDePessoa
                  pessoa={pessoa}
                  detalhe={
                    pessoa.dias_treinados === null
                      ? 'não mostra os números'
                      : `${pessoa.dias_treinados} dias treinados`
                  }
                  jaSegue={seguindoIds.has(pessoa.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {seguidores.length === 0 && seguindo.length === 0 && !termo ? (
        <p className="text-muted-foreground border-border rounded-xl border p-4 text-xs leading-relaxed">
          Ninguém vê o que você não liberou. Peso, medidas e fotos continuam privados mesmo para
          quem te segue — a única exceção é o par de fotos que você escolher expor no perfil.
        </p>
      ) : null}
    </div>
  );
}

function LinhaDePessoa({
  pessoa,
  detalhe,
  jaSegue,
}: {
  pessoa: Pessoa;
  detalhe: string;
  jaSegue: boolean;
}) {
  const foto = avatarUrl(pessoa, env.supabaseUrl);

  return (
    <div className="border-border flex items-center gap-3 rounded-xl border p-3">
      <Link href={`/u/${pessoa.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar className="size-11 shrink-0">
          {foto ? <AvatarImage src={foto} alt="" /> : null}
          <AvatarFallback>{initialsOf(pessoa.full_name, pessoa.username)}</AvatarFallback>
        </Avatar>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{pessoa.full_name ?? pessoa.username}</span>
          <span className={cn('text-muted-foreground block truncate text-xs')}>
            @{pessoa.username} · {detalhe}
          </span>
        </span>
      </Link>

      <FollowButton userId={pessoa.id} username={pessoa.username} seguindo={jaSegue} compacto />
    </div>
  );
}
