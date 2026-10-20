-- =============================================================================
-- P20X · descanso sem limite por semana
--
-- O pedido: "quero poder dar quantos descansos eu quiser". O teto de um por
-- semana engessava quem precisa de dois ou três dias de folga — o próprio
-- `services/objective.ts` recomenda até quatro para alguns objetivos, e o app
-- recusava o que ele mesmo sugeria.
--
-- O que continua: nunca num dia já treinado, nunca no futuro, nunca antes de
-- ontem. Só o `limite` saiu.
-- =============================================================================

create or replace function public.registrar_descanso(p_day date, p_note text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
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

  insert into public.rest_days (user_id, day, note)
  values (auth.uid(), p_day, nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (user_id, day) do nothing;

  return 'ok';
end;
$$;

comment on function public.registrar_descanso is
  'Registra um dia de descanso, hoje ou ontem. Sem limite por semana, e nunca num dia em que houve treino.';
