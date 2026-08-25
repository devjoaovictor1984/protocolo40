-- =============================================================================
-- P20X · 0037 — o lembrete vale a partir da hora escolhida, não só nela
--
-- A versão anterior comparava `hora_local = hora_escolhida`. Isso exige que o
-- cron rode de hora em hora, e o plano Hobby da Vercel **recusa** qualquer cron
-- mais frequente que uma vez por dia — o deploy inteiro é reprovado, não só o
-- cron. Com uma execução diária e a comparação por igualdade, só seria lembrado
-- quem tivesse escolhido exatamente a hora do disparo. Todo o resto nunca
-- receberia nada, sem nenhum sinal de que algo estava errado.
--
-- Trocar `=` por `>=` resolve os dois cenários com a mesma regra:
--
-- - **De hora em hora** (Pro, ou um disparador externo): a primeira rodada a
--   partir da hora escolhida ganha, e é exatamente a hora escolhida. Nada muda.
-- - **Uma vez por dia** (Hobby): quem já passou da própria hora é lembrado na
--   rodada do fim do dia. Chega mais tarde do que o combinado, mas chega.
--
-- O que impede o excesso nos dois casos é a trava que já existia:
-- `last_reminded_on` garante um por dia, e as rodadas seguintes não acham mais
-- ninguém. Sem ela, `>=` mandaria um aviso por hora até a meia-noite.
-- =============================================================================

drop function if exists public.quem_lembrar(timestamptz);

create or replace function public.quem_lembrar(p_agora timestamptz default now())
returns table (
  user_id       uuid,
  endpoint      text,
  p256dh        text,
  auth          text,
  dia           date,
  primeiro_nome text,
  sequencia     integer,
  agua_ml       integer
)
language sql
security definer
set search_path = public
stable
as $fn$
  with alvo as (
    select
      p.id,
      split_part(coalesce(nullif(btrim(p.full_name), ''), p.username), ' ', 1) as primeiro_nome,
      (p_agora at time zone p.timezone)::date as dia_local,
      extract(hour from (p_agora at time zone p.timezone))::int as hora_local,
      extract(hour from s.reminder_time)::int as hora_escolhida
    from public.profiles p
    join public.user_settings s on s.user_id = p.id
    where p.deleted_at is null
      and s.push_enabled
      and s.reminder_time is not null
  ),
  candidatos as (
    select a.*
      from alvo a
      join public.user_settings s on s.user_id = a.id
     -- a hora escolhida já chegou hoje. A trava de um por dia impede que isto
     -- vire um aviso por hora até a meia-noite.
     where a.hora_local >= a.hora_escolhida
       and (s.last_reminded_on is null or s.last_reminded_on < a.dia_local)
       -- quem já treinou não precisa ser lembrado de treinar
       and not exists (
         select 1 from public.workouts w
          where w.user_id = a.id
            and w.workout_date = a.dia_local
            and w.deleted_at is null
            and w.finished_at is not null
       )
       -- nem quem escolheu descansar hoje
       and not exists (
         select 1 from public.rest_days r
          where r.user_id = a.id and r.day = a.dia_local
       )
  )
  select
    c.id,
    ps.endpoint,
    ps.p256dh,
    ps.auth,
    c.dia_local,
    c.primeiro_nome,
    coalesce(seq.dias, 0)::integer,
    coalesce(agua.ml, 0)::integer
  from candidatos c
  join public.push_subscriptions ps on ps.user_id = c.id
  /*
   * A sequência até ONTEM — hoje ainda está em aberto, e é justamente disso
   * que o lembrete fala.
   *
   * Ilhas e buracos: subtrair o número da linha da data faz todo bloco de dias
   * consecutivos compartilhar o mesmo valor. O bloco que interessa é o do dia
   * mais recente, e ele só conta como sequência viva se terminou ontem.
   */
  left join lateral (
    with dias as (
      select distinct w.workout_date as d
        from public.workouts w
       where w.user_id = c.id
         and w.deleted_at is null
         and w.finished_at is not null
         and w.workout_date < c.dia_local
         and w.workout_date >= c.dia_local - 400
    ),
    ilhas as (
      select d, d - (row_number() over (order by d))::int as grupo from dias
    )
    select count(*)::integer as dias
      from ilhas
     where grupo = (select grupo from ilhas order by d desc limit 1)
       and (select max(d) from dias) = c.dia_local - 1
  ) seq on true
  left join lateral (
    select wl.ml
      from public.water_logs wl
     where wl.user_id = c.id and wl.day = c.dia_local
  ) agua on true;
$fn$;

comment on function public.quem_lembrar(timestamptz) is
  'Aparelhos a lembrar agora: a hora escolhida já passou hoje e o dia segue em aberto. Nunca peso nem medida.';

-- `create or replace` restaura a concessão a `public`; o revoke vem junto,
-- como manda o AGENTS.md
revoke execute on function public.quem_lembrar(timestamptz) from public, anon, authenticated;
grant execute on function public.quem_lembrar(timestamptz) to service_role;
