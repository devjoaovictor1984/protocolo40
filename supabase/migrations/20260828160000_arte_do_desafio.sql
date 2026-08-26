-- =============================================================================
-- P20X · 0040 — arte do desafio
--
-- Coluna e bucket, e não um arquivo em `public/`: em outubro vem outro desafio,
-- e trocar arte por deploy transforma uma decisão de comunicação em tarefa de
-- programador. Com a coluna, sai do painel de administração.
--
-- **A arte é fundo, nunca cartaz.** O nome, a frase e a contagem de dias são
-- desenhados pelo app em cima dela. Texto embutido na imagem vira mancha ilegível
-- num telefone de 360px, não acompanha tema claro e escuro, não é lido em voz
-- alta por leitor de tela e não dá para corrigir uma vírgula sem gerar tudo de
-- novo. O `image_path` é opcional de propósito: sem arte, o cartão continua
-- inteiro — a imagem melhora, não sustenta.
-- =============================================================================

alter table public.challenges
  add column if not exists image_path text;

comment on column public.challenges.image_path is
  'Caminho da arte no bucket `challenge-art`. Fundo, não cartaz: o texto é desenhado pelo app.';

-- -----------------------------------------------------------------------------
-- O bucket
--
-- Público na leitura, como o de arte dos exercícios: é material de divulgação e
-- vai aparecer para quem ainda não tem conta. Escrita só de admin.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('challenge-art', 'challenge-art', true)
on conflict (id) do nothing;

drop policy if exists "arte do desafio leitura" on storage.objects;
create policy "arte do desafio leitura" on storage.objects for select to anon, authenticated
  using (bucket_id = 'challenge-art');

drop policy if exists "arte do desafio escrita" on storage.objects;
create policy "arte do desafio escrita" on storage.objects for all to authenticated
  using (bucket_id = 'challenge-art' and public.eh_admin())
  with check (bucket_id = 'challenge-art' and public.eh_admin());
