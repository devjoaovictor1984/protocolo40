-- =============================================================================
-- PROTOCOLO40 · 0007 — Storage
-- Fotos de corpo em bucket privado. Nenhuma URL pública permanente.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',         'avatars',         true,    512 * 1024,        array['image/webp', 'image/jpeg', 'image/png']),
  ('progress-photos', 'progress-photos', false,  2 * 1024 * 1024,    array['image/webp', 'image/jpeg']),
  ('video-exports',   'video-exports',   false, 100 * 1024 * 1024,   array['video/mp4'])
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- A primeira pasta do caminho é sempre o id do dono:
--   progress-photos/{user_id}/{yyyy}/{MM}/{uuid}.webp
-- -----------------------------------------------------------------------------

-- avatars: leitura pública, escrita só na própria pasta
create policy "avatars leitura publica" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars escrita propria" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars update proprio" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars delete proprio" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- progress-photos: privado de ponta a ponta.
-- Terceiros nunca leem por policy: leem por signed URL emitida no servidor,
-- depois de uma checagem em progress_photos, que é sujeita à RLS.
create policy "fotos leitura propria" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "fotos escrita propria" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "fotos update proprio" on storage.objects for update to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "fotos delete proprio" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- video-exports: quem escreve é o worker (service role); o dono só lê e apaga
create policy "videos leitura propria" on storage.objects for select to authenticated
  using (bucket_id = 'video-exports' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "videos delete proprio" on storage.objects for delete to authenticated
  using (bucket_id = 'video-exports' and (storage.foldername(name))[1] = auth.uid()::text);
