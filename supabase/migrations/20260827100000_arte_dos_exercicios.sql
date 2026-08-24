-- =============================================================================
-- P20X · 0028 — a ilustração de cada exercício
--
-- Quem nunca fez um movimento não aprende com o nome dele. A ilustração é o
-- que transforma "flexão declinada" em algo executável sem procurar vídeo.
--
-- A arte não é gerada pelo aplicativo: é comprada ou encomendada e enviada
-- pelo admin. Por isso o campo guarda um caminho no bucket, e não um desenho —
-- e por isso ele é opcional: o exercício funciona sem, e passa a mostrar a
-- figura no dia em que ela existir.
-- =============================================================================

alter table public.exercises
  add column if not exists illustration_path text;

comment on column public.exercises.illustration_path is
  'Arquivo no bucket `exercise-art`. Nulo enquanto não houver ilustração.';

-- -----------------------------------------------------------------------------
-- O bucket
--
-- Público na leitura, ao contrário de tudo o mais neste app: a ilustração de
-- uma flexão não é dado de ninguém, e servir por URL assinada custaria uma
-- viagem ao servidor por imagem, em telas que mostram seis de uma vez.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-art', 'exercise-art', true, 2 * 1024 * 1024,
        array['image/webp', 'image/png', 'image/jpeg', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "arte leitura publica" on storage.objects for select
  using (bucket_id = 'exercise-art');

create policy "arte escrita admin" on storage.objects for insert to authenticated
  with check (bucket_id = 'exercise-art' and public.eh_admin());

create policy "arte update admin" on storage.objects for update to authenticated
  using (bucket_id = 'exercise-art' and public.eh_admin())
  with check (bucket_id = 'exercise-art' and public.eh_admin());

create policy "arte delete admin" on storage.objects for delete to authenticated
  using (bucket_id = 'exercise-art' and public.eh_admin());

-- -----------------------------------------------------------------------------
-- Só o admin escreve o caminho na tabela
--
-- `exercises` já tem policy de UPDATE para o dono de exercício próprio. Esta
-- acrescenta o admin, que é quem cuida do catálogo do sistema.
-- -----------------------------------------------------------------------------
create policy "exercicios admin atualiza" on public.exercises for update to authenticated
  using (public.eh_admin()) with check (public.eh_admin());
