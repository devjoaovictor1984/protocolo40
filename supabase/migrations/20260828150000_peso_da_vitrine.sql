-- =============================================================================
-- P20X · 0039 — o peso do antes e depois, quando o dono deixa
--
-- Duas fotos lado a lado sem número nenhum são duas fotos. O que transforma
-- isso em evidência é o intervalo e o peso das duas pontas — e é exatamente o
-- tipo de dado que não pode escapar por descuido.
--
-- **Por que uma função, e não um select:** `weight_visibility` existe na tela de
-- Privacidade desde o começo e **nenhuma policy a consultava**. A de
-- `body_measurements` olha `measurements_visibility`, e a RLS é por linha — não
-- dá para esconder uma coluna de uma linha visível. Então o peso ficava
-- governado por uma configuração que a pessoa não escolheu para ele.
--
-- Esta função fecha a lacuna no ponto exato onde o peso é mostrado: devolve os
-- dois números **somente** se `weight_visibility` permitir, e somente dos dois
-- dias da vitrine. Nada de série histórica, nada de medida, nada de outro dia.
--
-- Continua faltando o caso geral (medidas públicas com peso privado expõem o
-- peso na tabela crua). Está anotado no DIARIO; resolver de verdade pede
-- separar peso de medida em tabelas, ou permissão por coluna.
-- =============================================================================

create or replace function public.peso_da_vitrine(
  p_owner  uuid,
  p_antes  date,
  p_depois date
)
returns table (dia date, peso numeric)
language sql
security definer
set search_path = public
stable
as $fn$
  select m.measured_on, m.weight_kg
    from public.body_measurements m
   where m.user_id = p_owner
     and m.deleted_at is null
     and m.weight_kg is not null
     and m.measured_on in (p_antes, p_depois)
     -- a configuração que a pessoa escolheu para o peso, e não a das medidas
     and public.can_view_setting(p_owner, 'weight')
   order by m.measured_on;
$fn$;

comment on function public.peso_da_vitrine(uuid, date, date) is
  'Peso das duas pontas do antes e depois, só quando weight_visibility permite. Nunca a série inteira.';

revoke execute on function public.peso_da_vitrine(uuid, date, date) from public;
grant execute on function public.peso_da_vitrine(uuid, date, date) to anon, authenticated;
