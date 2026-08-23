-- =============================================================================
-- P20X · 0013 — o recuo do início lê a data sem citar campos de outra tabela
--
-- A versão anterior escolhia a coluna com `case tg_table_name ... new.taken_on`.
-- PL/pgSQL resolve TODOS os campos citados na expressão, não só o ramo que
-- vale: inserir uma foto tentava ler `new.workout_date` e o insert morria com
-- "record new has no field". Convertendo a linha para jsonb, a leitura é por
-- chave e o campo ausente vira null — sem citar nada que não exista.
-- =============================================================================

create or replace function public.recuar_inicio_do_protocolo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linha jsonb := to_jsonb(new);
  dia date := coalesce(
    (linha ->> 'workout_date')::date,
    (linha ->> 'taken_on')::date,
    (linha ->> 'measured_on')::date
  );
begin
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
