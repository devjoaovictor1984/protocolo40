-- =============================================================================
-- P20X · 0012 — a data de início acompanha o que foi registrado
--
-- `protocol_started_on` nasce no dia do cadastro. Quem já treinava antes e vem
-- trazer o histórico — treinos, fotos e pesos de semanas atrás — ficava com um
-- protocolo que "começou" depois do próprio Dia 1: a galeria mostraria "Dia -12"
-- e a sequência contaria a partir da data errada.
--
-- A regra aqui é simples e não pede nada ao usuário: registrar algo mais antigo
-- que o início do protocolo puxa o início para aquele dia.
-- =============================================================================

create or replace function public.recuar_inicio_do_protocolo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dia date;
begin
  -- cada tabela guarda a data com um nome diferente
  dia := case tg_table_name
           when 'workouts' then new.workout_date
           when 'progress_photos' then new.taken_on
           when 'body_measurements' then new.measured_on
         end;

  if dia is null then
    return new;
  end if;

  update public.profiles
     set protocol_started_on = dia
   where id = new.user_id
     and protocol_started_on > dia;

  return new;
end;
$$;

comment on function public.recuar_inicio_do_protocolo is
  'Puxa profiles.protocol_started_on para trás quando um registro mais antigo entra.';

create trigger workouts_recuar_inicio
  after insert or update of workout_date on public.workouts
  for each row execute function public.recuar_inicio_do_protocolo();

create trigger progress_photos_recuar_inicio
  after insert or update of taken_on on public.progress_photos
  for each row execute function public.recuar_inicio_do_protocolo();

create trigger body_measurements_recuar_inicio
  after insert or update of measured_on on public.body_measurements
  for each row execute function public.recuar_inicio_do_protocolo();

-- -----------------------------------------------------------------------------
-- Quem já registrou dias anteriores antes desta migração
-- -----------------------------------------------------------------------------
update public.profiles p
   set protocol_started_on = menor.dia
  from (
    select user_id, min(dia) as dia
      from (
        select user_id, workout_date as dia from public.workouts where deleted_at is null
        union all
        select user_id, taken_on from public.progress_photos where deleted_at is null
        union all
        select user_id, measured_on from public.body_measurements where deleted_at is null
      ) t
     group by user_id
  ) menor
 where menor.user_id = p.id
   and p.protocol_started_on > menor.dia;
