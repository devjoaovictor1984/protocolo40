-- =============================================================================
-- P20X · 0029 — seis treinos novos e a faxina da biblioteca
--
-- Três problemas, um arquivo.
--
-- 1. **Burpee e mountain climber pareciam não existir.** Estavam em "Cardio 20"
--    e "Corpo inteiro avançado", com `sort_order 100` — no fim da lista e sem a
--    marca do método. Ninguém achava.
--
-- 2. **"Tom Holland" continuou ao lado do "P20X 5•10•15".** O segundo foi criado
--    para substituir o primeiro e o primeiro nunca saiu: dois treinos idênticos
--    na mesma tela.
--
-- 3. **Trinta dos 68 exercícios não estavam em treino nenhum.** Superman, dead
--    bug, prancha lateral, bear crawl, escalador, oblíquo — catálogo que existia
--    só para quem montasse o próprio circuito.
--
-- Os seis treinos daqui atacam os três: trazem burpee e mountain climber para a
-- frente, com nome do método, e puxam dez exercícios que estavam parados.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: monta um treino a partir de slugs, sem repetir vinte inserts
-- -----------------------------------------------------------------------------
create or replace function pg_temp.montar_treino(
  p_title text,
  p_subtitle text,
  p_description text,
  p_level public.workout_level,
  p_place public.workout_place,
  p_tags text[],
  p_sort smallint,
  -- cada item: slug, repetições, segundos
  p_itens jsonb
)
returns void
language plpgsql
as $$
declare
  novo_id uuid;
  item jsonb;
  indice int := 0;
begin
  insert into public.workout_templates
    (owner_id, title, subtitle, description, level, place, tags, method, estimated_seconds, sort_order, is_active)
  values
    (null, p_title, p_subtitle, p_description, p_level, p_place, p_tags, 'amrap', 1200, p_sort, true)
  returning id into novo_id;

  for item in select * from jsonb_array_elements(p_itens) loop
    insert into public.workout_template_exercises
      (template_id, exercise_id, sets, repetitions, duration_seconds, order_index)
    select
      novo_id,
      e.id,
      1,
      nullif((item ->> 1), '')::int,
      nullif((item ->> 2), '')::int,
      indice
    from public.exercises e
    where e.slug = (item ->> 0) and e.owner_id is null;

    indice := indice + 1;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Iniciante
-- -----------------------------------------------------------------------------
select pg_temp.montar_treino(
  'P20X Ritmo',
  'O cardio que cabe na sala',
  'Sem corrida e sem equipamento. Se o fôlego apertar, ande no lugar até voltar — parar de vez é o que não vale.',
  'iniciante', 'casa', array['cardio', 'corpo_inteiro', 'sem_equipamento'], 6::smallint,
  '[["polichinelo", 20, null], ["marcha-estacionaria", 30, null], ["mountain-climber", 10, null], ["prancha", null, 20]]'::jsonb
);

select pg_temp.montar_treino(
  'P20X Postura',
  'Para as costas que passam o dia sentadas',
  'Nenhum exercício aqui é difícil. O que é difícil é fazer devagar e sentir o músculo certo trabalhando — tente.',
  'iniciante', 'casa', array['core', 'sem_equipamento', 'recuperacao_ativa'], 7::smallint,
  '[["superman", 10, null], ["ponte-gluteo", 12, null], ["dead-bug", 10, null], ["prancha-lateral", null, 20]]'::jsonb
);

-- -----------------------------------------------------------------------------
-- Intermediário
-- -----------------------------------------------------------------------------
select pg_temp.montar_treino(
  'P20X Burpee 10',
  'Dez burpees por round. Sem enfeite.',
  'O burpee é o exercício que mais entrega em menos tempo, e o mais fácil de fazer mal. Desça controlado e suba explodindo.',
  'intermediario', 'casa', array['cardio', 'corpo_inteiro', 'sem_equipamento'], 6::smallint,
  '[["burpee", 10, null], ["mountain-climber", 20, null], ["agachamento-sumo", 15, null]]'::jsonb
);

select pg_temp.montar_treino(
  'P20X Oblíquo',
  'O core que gira, não só o que dobra',
  'Abdominal reto é metade do trabalho. O que segura a coluna no dia a dia é a parte que resiste à rotação.',
  'intermediario', 'casa', array['core', 'sem_equipamento'], 7::smallint,
  '[["abdominal-obliquo", 10, null], ["russian-twist", 20, null], ["prancha-lateral", null, 30], ["dead-bug", 12, null]]'::jsonb
);

-- -----------------------------------------------------------------------------
-- Avançado
-- -----------------------------------------------------------------------------
select pg_temp.montar_treino(
  'P20X Metcon',
  'Cardio e força no mesmo round',
  'Quatro exercícios sem pausa entre eles. A pausa é entre os rounds, e você vai querer que ela exista.',
  'avancado', 'casa', array['cardio', 'corpo_inteiro', 'sem_equipamento'], 6::smallint,
  '[["burpee", 10, null], ["mountain-climber", 30, null], ["flexao-diamante", 10, null], ["agachamento-sumo", 20, null]]'::jsonb
);

select pg_temp.montar_treino(
  'P20X Bear',
  'O chão é o aparelho',
  'Tudo aqui é feito no chão, e é mais difícil do que parece escrito. O bear crawl é em passos — vinte de cada lado.',
  'avancado', 'casa', array['corpo_inteiro', 'core', 'sem_equipamento'], 7::smallint,
  '[["bear-crawl", 20, null], ["burpee", 8, null], ["hollow-hold", null, 30], ["escalador", 20, null]]'::jsonb
);

-- -----------------------------------------------------------------------------
-- O duplicado que sobrou
--
-- "Tom Holland" foi substituído por "P20X 5•10•15" e continuou publicado. Sai da
-- lista em vez de ser apagado: quem já treinou com ele mantém o histórico, e o
-- registro continua ligado ao treino que o originou.
-- -----------------------------------------------------------------------------
update public.workout_templates
   set is_active = false
 where owner_id is null
   and title = 'Tom Holland';
