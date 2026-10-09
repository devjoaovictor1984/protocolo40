-- =============================================================================
-- P20X · descanso de ontem
--
-- Quem descansou ontem e esqueceu de marcar acordava com a sequência quebrada,
-- sem ter feito nada de errado. Agora o descanso pode ser registrado no dia
-- seguinte — e só até ele.
--
-- Por que só ontem: a sequência morre quando passa um dia inteiro sem elo, e
-- é ontem que decide isso. Liberar a semana inteira transformaria o descanso
-- em borracha de calendário; o limite de um por semana continua o mesmo.
--
-- E nada de futuro: antes a função aceitava qualquer data, e um descanso
-- marcado para sábado travava o limite da semana antes de a semana acontecer.
-- "Hoje" é o do fuso da pessoa, como em `get_user_stats`.
-- =============================================================================

create or replace function public.registrar_descanso(p_day date, p_note text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  usados int;
  tem_treino boolean;
  hoje date;
begin
  if auth.uid() is null then
    return 'sem_sessao';
  end if;

  select (now() at time zone coalesce(
            (select p.timezone from public.profiles p where p.id = auth.uid()),
            'America/Sao_Paulo'))::date
    into hoje;

  if p_day > hoje then
    return 'futuro';
  end if;

  if p_day < hoje - 1 then
    return 'antigo';
  end if;

  -- descansar num dia em que treinou não faz sentido e confundiria a contagem
  select exists (
    select 1 from public.workouts
     where user_id = auth.uid() and workout_date = p_day and deleted_at is null
  ) into tem_treino;

  if tem_treino then
    return 'ja_treinou';
  end if;

  -- um por semana, contando os sete dias de cada lado do dia escolhido
  select count(*) into usados
    from public.rest_days
   where user_id = auth.uid()
     and day between p_day - 6 and p_day + 6;

  if usados >= 1 then
    return 'limite';
  end if;

  insert into public.rest_days (user_id, day, note)
  values (auth.uid(), p_day, nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (user_id, day) do nothing;

  return 'ok';
end;
$$;

comment on function public.registrar_descanso is
  'Registra um dia de descanso, hoje ou ontem. Um por semana, e nunca num dia em que houve treino.';
