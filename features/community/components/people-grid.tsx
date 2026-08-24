import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { PessoaEncontrada } from '@/features/community/repository';
import { env } from '@/lib/env';
import { avatarUrl, initialsOf } from '@/lib/storage/avatar';

/**
 * Quem está no P20X, em grade.
 *
 * Uma lista com nome, contagem e botão por linha ocupava a tela inteira com
 * seis pessoas — e a graça de uma comunidade é justamente ver que tem gente.
 * Aqui cabem vinte rostos num relance, e seguir acontece no perfil de cada um,
 * que é onde a pessoa consegue decidir se quer seguir.
 *
 * Só rosto e @usuário: quantos seguidores alguém tem não ajuda ninguém a
 * escolher, e transforma a tela num ranking.
 */
export function PeopleGrid({ pessoas }: { pessoas: PessoaEncontrada[] }) {
  return (
    <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
      {pessoas.map((pessoa) => {
        const foto = avatarUrl(pessoa, env.supabaseUrl);

        return (
          <li key={pessoa.id}>
            <Link
              href={`/u/${pessoa.username}`}
              className="group flex flex-col items-center gap-1.5"
              title={pessoa.full_name ?? pessoa.username}
            >
              <Avatar className="group-hover:ring-primary/40 size-14 transition-all group-hover:ring-2">
                {foto ? <AvatarImage src={foto} alt="" /> : null}
                <AvatarFallback className="text-sm font-semibold">
                  {initialsOf(pessoa.full_name, pessoa.username)}
                </AvatarFallback>
              </Avatar>

              <span className="text-muted-foreground w-full truncate text-center text-[10px]">
                @{pessoa.username}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
