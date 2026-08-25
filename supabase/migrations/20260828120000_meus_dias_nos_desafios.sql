-- =============================================================================
-- P20X · 0036 — meus dias em todos os desafios de uma vez
--
-- `meus_dias_no_desafio(slug)` resolve uma tela só: a do desafio aberto. As
-- outras duas ficaram mal servidas por ela, e de jeitos diferentes:
--
-- - a tela de Hoje pedia os dias com o slug escrito à mão (`setembro-2026`).
--   Funcionava por acaso, porque só existe um desafio. No dia em que houvesse
--   um de outubro em destaque, a barra mostraria os dias de setembro — e no
--   virar do mês ela ficaria errada para todo mundo ao mesmo tempo.
--
-- - a lista de `/desafios` não pedia nada e desenhava a barra vazia. Quem já
--   estava participando abria a lista e via zero.
--
-- Uma consulta por desafio resolveria as duas, e seria uma ida ao banco por
-- linha da lista. Esta devolve tudo de uma vez, e quem separa é o cliente.
--
-- `security invoker`: o `auth.uid()` é quem manda, e a RLS de `workouts` já faz
-- o trabalho. Não há motivo para DEFINER aqui — os dias são os de quem pergunta.
-- =============================================================================

create or replace function public.meus_dias_nos_desafios()
returns table (challenge_id uuid, dia date)
language sql
security invoker
set search_path = public
stable
as $fn$
  select distinct c.id, w.workout_date
    from public.challenges c
    join public.workouts w
      on w.user_id = auth.uid()
     and w.deleted_at is null
     and w.finished_at is not null
     and w.workout_date between c.starts_on and c.ends_on
   where c.is_active
   order by 1, 2;
$fn$;

comment on function public.meus_dias_nos_desafios is
  'Os dias que eu cumpri em cada desafio ativo. Uma ida ao banco para a lista inteira.';

grant execute on function public.meus_dias_nos_desafios() to authenticated;
