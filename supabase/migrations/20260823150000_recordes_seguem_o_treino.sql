-- =============================================================================
-- P20X · 0011 — o recorde morre com o treino que o criou
--
-- `personal_records.workout_id` tem ON DELETE CASCADE, mas treino é apagado
-- por soft delete: a linha continua existindo com `deleted_at` preenchido, e o
-- cascade nunca dispara. O resultado é um recorde fantasma — o treino sumiu do
-- histórico e a marca continuou na tela.
-- =============================================================================

create or replace function public.limpar_recordes_do_treino()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- só no momento em que o treino passa a ser considerado apagado
  if old.deleted_at is null and new.deleted_at is not null then
    delete from public.personal_records where workout_id = new.id;
  end if;

  return new;
end;
$$;

comment on function public.limpar_recordes_do_treino is
  'Apaga os recordes conquistados num treino quando ele é apagado.';

create trigger workouts_limpar_recordes
  after update of deleted_at on public.workouts
  for each row execute function public.limpar_recordes_do_treino();

-- -----------------------------------------------------------------------------
-- Os fantasmas que já existem
-- -----------------------------------------------------------------------------
delete from public.personal_records pr
 where exists (
   select 1 from public.workouts w
    where w.id = pr.workout_id and w.deleted_at is not null
 );
