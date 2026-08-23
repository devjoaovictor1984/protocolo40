-- =============================================================================
-- P20X · 0010 — ordem deliberada da biblioteca
--
-- Ordenar por título deixava "P20X Base" antes de "P20X Start", que é o mais
-- fácil de todos e deveria abrir a lista. A biblioteca tem uma progressão
-- pensada; ela precisa de uma coluna própria para ser respeitada.
-- =============================================================================

alter table public.workout_templates
  add column sort_order smallint not null default 100;

comment on column public.workout_templates.sort_order is
  'Ordem de exibição dentro do nível. Menor aparece primeiro.';

create index workout_templates_ordem_idx
  on public.workout_templates (level, sort_order)
  where owner_id is null and is_active;

-- A progressão pensada de cada nível
update public.workout_templates set sort_order = case id
  -- iniciante: do mais leve ao mais completo
  when 'b0000001-0000-4000-8000-000000000001'::uuid then 1   -- Start
  when 'b0000001-0000-4000-8000-000000000002'::uuid then 2   -- Base
  when 'b0000001-0000-4000-8000-000000000005'::uuid then 3   -- Move
  when 'b0000001-0000-4000-8000-000000000004'::uuid then 4   -- Core Start
  when 'b0000001-0000-4000-8000-000000000003'::uuid then 5   -- Cardio Start
  -- moderado: o 5•10•15 abre, por ser o padrão do método
  when 'b0000001-0000-4000-8000-000000000006'::uuid then 1   -- 5•10•15
  when 'b0000001-0000-4000-8000-000000000008'::uuid then 2   -- Runner
  when 'b0000001-0000-4000-8000-000000000007'::uuid then 3   -- 100
  when 'b0000001-0000-4000-8000-000000000009'::uuid then 4   -- Core 40
  when 'b0000001-0000-4000-8000-00000000000a'::uuid then 5   -- Legs
  -- avançado: termina no Challenge
  when 'b0000001-0000-4000-8000-00000000000b'::uuid then 1   -- 5•10•15 X
  when 'b0000001-0000-4000-8000-00000000000c'::uuid then 2   -- 100•20•20
  when 'b0000001-0000-4000-8000-00000000000d'::uuid then 3   -- Upper
  when 'b0000001-0000-4000-8000-00000000000e'::uuid then 4   -- Core X
  when 'b0000001-0000-4000-8000-00000000000f'::uuid then 5   -- Challenge
  else sort_order
end
where owner_id is null;
