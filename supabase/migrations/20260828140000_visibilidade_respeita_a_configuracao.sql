-- =============================================================================
-- P20X · 0038 — a configuração de privacidade passa a valer para treino e foto
--
-- Existiam dois lugares guardando "quem pode ver", e eles nunca conversaram:
--
-- - `user_settings.workouts_visibility` / `photos_visibility`, que é o que a
--   tela de Privacidade escreve quando alguém escolhe;
-- - `workouts.visibility` / `progress_photos.visibility`, coluna por linha, que
--   nasce `private` e é o que as policies liam.
--
-- Resultado: dava para deixar tudo como público na tela, salvar, e continuar
-- invisível para todo mundo. Sem erro, sem aviso — a pessoa achava que tinha
-- compartilhado e não tinha. É a pior forma de bug de privacidade: a que mente
-- na direção de quem confiou na interface.
--
-- `profiles`, `body_measurements` e `user_badges` já usavam `can_view_setting`.
-- Só estas duas ficaram para trás.
--
-- **A regra nova:** visível quando a configuração permite **ou** quando aquela
-- linha foi compartilhada de propósito. O `or` é o que preserva a vitrine do
-- perfil, que marca duas fotos escolhidas como públicas enquanto todo o resto
-- continua privado — se a configuração passasse a mandar sozinha, escolher um
-- antes e depois exigiria abrir o álbum inteiro.
--
-- **O que NÃO muda:** o padrão continua privado dos dois lados. Foto nasce
-- privada, treino nasce privado, e `photos_visibility` nasce `private`. Nada
-- passa a ser exposto por causa desta migration — só passa a ser exposto o que
-- alguém pediu para expor.
-- =============================================================================

drop policy if exists workouts_select on public.workouts;

create policy workouts_select on public.workouts for select
  using (
    user_id = auth.uid()
    or (
      deleted_at is null
      and (
        -- o que a pessoa escolheu na tela de Privacidade
        public.can_view_setting(user_id, 'workouts')
        -- ou este treino especificamente, se um dia houver esse botão
        or public.can_view(user_id, visibility)
      )
    )
  );

drop policy if exists photos_select on public.progress_photos;

create policy photos_select on public.progress_photos for select
  using (
    user_id = auth.uid()
    or (
      deleted_at is null
      and (
        public.can_view_setting(user_id, 'photos')
        -- a vitrine do perfil vive aqui: duas fotos marcadas como públicas
        -- enquanto o álbum inteiro segue privado
        or public.can_view(user_id, visibility)
      )
    )
  );

comment on policy workouts_select on public.workouts is
  'Visível ao dono; a terceiros, quando a configuração de privacidade permite ou o treino foi compartilhado.';

comment on policy photos_select on public.progress_photos is
  'Visível ao dono; a terceiros, quando a configuração permite ou a foto entrou na vitrine.';
