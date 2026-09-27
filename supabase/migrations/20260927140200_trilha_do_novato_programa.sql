-- =============================================================================
-- P20X · 0053 — a Trilha do Iniciante vira o programa de 30 dias do novato
--
-- A primeira versão tinha 28 sessões de 20 minutos em AMRAP, sem dia de
-- descanso. Para quem nunca treinou, "repita o circuito por 20 minutos" é uma
-- lista, não uma aula — e 20 minutos no dia 1 é muito. Esta versão é o que o
-- dono do produto descreveu, e o que um treinador faria com um iniciante:
--
-- 1. **30 dias: seis de treino e um de descanso por semana.** Os dias 7, 14,
--    21 e 28 são descanso; 29 e 30 fecham a trilha.
-- 2. **Treino guiado, passo a passo.** "10 polichinelos, descanso, 5
--    agachamentos, descanso, 3 flexões." O app diz o que fazer, conta o
--    descanso e chama o próximo. Nada de circuito solto.
-- 3. **Começa leve e sobe um pouco por dia.** O dia 1 leva uns 10 minutos; a
--    semana 4 chega perto de 20, nunca passa. Três padrões se alternam — força,
--    abdômen, corpo todo — para variar sem virar outra coisa a cada dia.
-- 4. **A formatura é o dia 1 com cinco voltas.** O mesmo treino, e a diferença
--    de fôlego entre o dia 1 e o dia 30 é a medida honesta do mês.
-- 5. **Medalha Disciplina** para quem chega ao fim.
--
-- O que NÃO mudou, de propósito: a trilha anda com os dias cumpridos, nunca
-- com o calendário, e qualquer treino conta. O que muda é que **o descanso
-- registrado também conta como dia cumprido** — senão o dia 7 seria uma
-- parede. O limite de um descanso por semana (`registrar_descanso`) é o de
-- sempre, e é ele que impede alguém de "descansar" a trilha inteira.
--
-- Quem já estava na trilha continua com o mesmo número de dias: o progresso é
-- contado, então cai na sessão equivalente do programa novo.
--
-- A progressão foi gerada por script (ver o DIÁRIO) e está escrita por
-- extenso: migration não pode depender de código que muda depois.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Os 26 treinos
-- -----------------------------------------------------------------------------
insert into public.workout_templates
  (id, owner_id, title, subtitle, description, level, place, tags, estimated_seconds, method,
   program_only, sort_order, rounds, rest_seconds, round_rest_seconds) values
  ('c0000002-0000-4000-8000-000000000001', null, $t$Força$t$, $t$10 · 5 · 3 · 15s$t$, $t$3 voltas. Faça cada exercício, descanse 30 segundos e siga para o próximo; entre as voltas, 60 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 600, 'guiado', true, 101, 3, 30, 60),
  ('c0000002-0000-4000-8000-000000000002', null, $t$Abdômen$t$, $t$20s · 5 · 4 · 4$t$, $t$3 voltas. Faça cada exercício, descanse 30 segundos e siga para o próximo; entre as voltas, 60 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 660, 'guiado', true, 102, 3, 30, 60),
  ('c0000002-0000-4000-8000-000000000003', null, $t$Corpo todo$t$, $t$10 · 5 · 5 · 4 · 20s$t$, $t$3 voltas. Faça cada exercício, descanse 30 segundos e siga para o próximo; entre as voltas, 60 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 780, 'guiado', true, 103, 3, 30, 60),
  ('c0000002-0000-4000-8000-000000000004', null, $t$Força$t$, $t$12 · 6 · 4 · 20s$t$, $t$3 voltas. Faça cada exercício, descanse 30 segundos e siga para o próximo; entre as voltas, 60 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 660, 'guiado', true, 104, 3, 30, 60),
  ('c0000002-0000-4000-8000-000000000005', null, $t$Abdômen$t$, $t$25s · 6 · 5 · 5$t$, $t$3 voltas. Faça cada exercício, descanse 30 segundos e siga para o próximo; entre as voltas, 60 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 720, 'guiado', true, 105, 3, 30, 60),
  ('c0000002-0000-4000-8000-000000000006', null, $t$Corpo todo$t$, $t$12 · 6 · 6 · 5 · 25s$t$, $t$3 voltas. Faça cada exercício, descanse 30 segundos e siga para o próximo; entre as voltas, 60 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 840, 'guiado', true, 106, 3, 30, 60),
  ('c0000002-0000-4000-8000-000000000008', null, $t$Força$t$, $t$14 · 7 · 4 · 20s$t$, $t$3 voltas. Faça cada exercício, descanse 30 segundos e siga para o próximo; entre as voltas, 60 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 660, 'guiado', true, 108, 3, 30, 60),
  ('c0000002-0000-4000-8000-000000000009', null, $t$Abdômen$t$, $t$30s · 7 · 5 · 5$t$, $t$3 voltas. Faça cada exercício, descanse 30 segundos e siga para o próximo; entre as voltas, 60 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 720, 'guiado', true, 109, 3, 30, 60),
  ('c0000002-0000-4000-8000-00000000000a', null, $t$Corpo todo$t$, $t$14 · 7 · 7 · 5 · 30s$t$, $t$3 voltas. Faça cada exercício, descanse 30 segundos e siga para o próximo; entre as voltas, 60 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 900, 'guiado', true, 110, 3, 30, 60),
  ('c0000002-0000-4000-8000-00000000000b', null, $t$Força$t$, $t$17 · 9 · 5 · 25s$t$, $t$3 voltas. Faça cada exercício, descanse 30 segundos e siga para o próximo; entre as voltas, 60 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 720, 'guiado', true, 111, 3, 30, 60),
  ('c0000002-0000-4000-8000-00000000000c', null, $t$Abdômen$t$, $t$35s · 9 · 6 · 6$t$, $t$3 voltas. Faça cada exercício, descanse 30 segundos e siga para o próximo; entre as voltas, 60 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 780, 'guiado', true, 112, 3, 30, 60),
  ('c0000002-0000-4000-8000-00000000000d', null, $t$Corpo todo$t$, $t$17 · 9 · 9 · 6 · 35s$t$, $t$3 voltas. Faça cada exercício, descanse 30 segundos e siga para o próximo; entre as voltas, 60 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 960, 'guiado', true, 113, 3, 30, 60),
  ('c0000002-0000-4000-8000-00000000000f', null, $t$Força$t$, $t$18 · 9 · 6 · 15s$t$, $t$4 voltas. Faça cada exercício, descanse 25 segundos e siga para o próximo; entre as voltas, 60 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 900, 'guiado', true, 115, 4, 25, 60),
  ('c0000002-0000-4000-8000-000000000010', null, $t$Abdômen$t$, $t$40s · 9 · 7 · 7$t$, $t$4 voltas. Faça cada exercício, descanse 25 segundos e siga para o próximo; entre as voltas, 60 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 1020, 'guiado', true, 116, 4, 25, 60),
  ('c0000002-0000-4000-8000-000000000011', null, $t$Corpo todo$t$, $t$18 · 9 · 9 · 7 · 40s$t$, $t$3 voltas. Faça cada exercício, descanse 25 segundos e siga para o próximo; entre as voltas, 60 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 900, 'guiado', true, 117, 3, 25, 60),
  ('c0000002-0000-4000-8000-000000000012', null, $t$Força$t$, $t$21 · 11 · 7 · 20s$t$, $t$4 voltas. Faça cada exercício, descanse 25 segundos e siga para o próximo; entre as voltas, 60 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 960, 'guiado', true, 118, 4, 25, 60),
  ('c0000002-0000-4000-8000-000000000013', null, $t$Abdômen$t$, $t$45s · 11 · 9 · 9$t$, $t$4 voltas. Faça cada exercício, descanse 25 segundos e siga para o próximo; entre as voltas, 60 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 1140, 'guiado', true, 119, 4, 25, 60),
  ('c0000002-0000-4000-8000-000000000014', null, $t$Corpo todo$t$, $t$21 · 11 · 11 · 9 · 45s$t$, $t$3 voltas. Faça cada exercício, descanse 25 segundos e siga para o próximo; entre as voltas, 60 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 1020, 'guiado', true, 120, 3, 25, 60),
  ('c0000002-0000-4000-8000-000000000016', null, $t$Força$t$, $t$22 · 12 · 8 · 20s$t$, $t$4 voltas. Faça cada exercício, descanse 20 segundos e siga para o próximo; entre as voltas, 45 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 900, 'guiado', true, 122, 4, 20, 45),
  ('c0000002-0000-4000-8000-000000000017', null, $t$Abdômen$t$, $t$45s · 12 · 9 · 9$t$, $t$4 voltas. Faça cada exercício, descanse 20 segundos e siga para o próximo; entre as voltas, 45 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 1020, 'guiado', true, 123, 4, 20, 45),
  ('c0000002-0000-4000-8000-000000000018', null, $t$Corpo todo$t$, $t$22 · 12 · 12 · 9 · 45s$t$, $t$3 voltas. Faça cada exercício, descanse 20 segundos e siga para o próximo; entre as voltas, 45 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 960, 'guiado', true, 124, 3, 20, 45),
  ('c0000002-0000-4000-8000-000000000019', null, $t$Força$t$, $t$26 · 14 · 10 · 25s$t$, $t$4 voltas. Faça cada exercício, descanse 20 segundos e siga para o próximo; entre as voltas, 45 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 960, 'guiado', true, 125, 4, 20, 45),
  ('c0000002-0000-4000-8000-00000000001a', null, $t$Abdômen$t$, $t$50s · 14 · 11 · 11$t$, $t$4 voltas. Faça cada exercício, descanse 20 segundos e siga para o próximo; entre as voltas, 45 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 1140, 'guiado', true, 126, 4, 20, 45),
  ('c0000002-0000-4000-8000-00000000001b', null, $t$Corpo todo$t$, $t$26 · 14 · 14 · 11 · 50s$t$, $t$3 voltas. Faça cada exercício, descanse 20 segundos e siga para o próximo; entre as voltas, 45 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 1020, 'guiado', true, 127, 3, 20, 45),
  ('c0000002-0000-4000-8000-00000000001d', null, $t$Ensaio geral$t$, $t$26 · 14 · 14 · 11 · 50s$t$, $t$3 voltas. Faça cada exercício, descanse 20 segundos e siga para o próximo; entre as voltas, 45 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 1020, 'guiado', true, 129, 3, 20, 45),
  ('c0000002-0000-4000-8000-00000000001e', null, $t$Formatura$t$, $t$10 · 5 · 3 · 15s$t$, $t$5 voltas. Faça cada exercício, descanse 20 segundos e siga para o próximo; entre as voltas, 40 segundos. Conseguiu mais repetições? Melhor — mas não pule o descanso.$t$, 'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 840, 'guiado', true, 130, 5, 20, 40)
on conflict (id) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  description = excluded.description,
  level = excluded.level,
  place = excluded.place,
  tags = excluded.tags,
  estimated_seconds = excluded.estimated_seconds,
  method = excluded.method,
  program_only = excluded.program_only,
  sort_order = excluded.sort_order,
  rounds = excluded.rounds,
  rest_seconds = excluded.rest_seconds,
  round_rest_seconds = excluded.round_rest_seconds,
  is_active = true,
  deleted_at = null;

delete from public.workout_template_exercises
 where template_id in (
   select id from public.workout_templates
    where owner_id is null and id::text like 'c0000002-%'
 );

insert into public.workout_template_exercises
  (template_id, exercise_id, sets, repetitions, duration_seconds, distance_meters, order_index)
select v.tpl::uuid, e.id, 1, v.reps, v.dur, null, v.ord
  from (values
    ('c0000002-0000-4000-8000-000000000001', 'polichinelo', 10, null, 1),
    ('c0000002-0000-4000-8000-000000000001', 'agachamento', 5, null, 2),
    ('c0000002-0000-4000-8000-000000000001', 'flexao-apoiada', 3, null, 3),
    ('c0000002-0000-4000-8000-000000000001', 'prancha-joelhos', null, 15, 4),
    ('c0000002-0000-4000-8000-000000000002', 'corrida-estacionaria', null, 20, 1),
    ('c0000002-0000-4000-8000-000000000002', 'abdominal-supra', 5, null, 2),
    ('c0000002-0000-4000-8000-000000000002', 'abdominal-infra', 4, null, 3),
    ('c0000002-0000-4000-8000-000000000002', 'elevacao-pernas', 4, null, 4),
    ('c0000002-0000-4000-8000-000000000003', 'polichinelo', 10, null, 1),
    ('c0000002-0000-4000-8000-000000000003', 'abdominal-supra', 5, null, 2),
    ('c0000002-0000-4000-8000-000000000003', 'agachamento', 5, null, 3),
    ('c0000002-0000-4000-8000-000000000003', 'elevacao-pernas', 4, null, 4),
    ('c0000002-0000-4000-8000-000000000003', 'corrida-estacionaria', null, 20, 5),
    ('c0000002-0000-4000-8000-000000000004', 'polichinelo', 12, null, 1),
    ('c0000002-0000-4000-8000-000000000004', 'agachamento', 6, null, 2),
    ('c0000002-0000-4000-8000-000000000004', 'flexao-apoiada', 4, null, 3),
    ('c0000002-0000-4000-8000-000000000004', 'prancha-joelhos', null, 20, 4),
    ('c0000002-0000-4000-8000-000000000005', 'corrida-estacionaria', null, 25, 1),
    ('c0000002-0000-4000-8000-000000000005', 'abdominal-supra', 6, null, 2),
    ('c0000002-0000-4000-8000-000000000005', 'abdominal-infra', 5, null, 3),
    ('c0000002-0000-4000-8000-000000000005', 'elevacao-pernas', 5, null, 4),
    ('c0000002-0000-4000-8000-000000000006', 'polichinelo', 12, null, 1),
    ('c0000002-0000-4000-8000-000000000006', 'abdominal-supra', 6, null, 2),
    ('c0000002-0000-4000-8000-000000000006', 'agachamento', 6, null, 3),
    ('c0000002-0000-4000-8000-000000000006', 'elevacao-pernas', 5, null, 4),
    ('c0000002-0000-4000-8000-000000000006', 'corrida-estacionaria', null, 25, 5),
    ('c0000002-0000-4000-8000-000000000008', 'polichinelo', 14, null, 1),
    ('c0000002-0000-4000-8000-000000000008', 'agachamento', 7, null, 2),
    ('c0000002-0000-4000-8000-000000000008', 'flexao-apoiada', 4, null, 3),
    ('c0000002-0000-4000-8000-000000000008', 'prancha-joelhos', null, 20, 4),
    ('c0000002-0000-4000-8000-000000000009', 'corrida-estacionaria', null, 30, 1),
    ('c0000002-0000-4000-8000-000000000009', 'abdominal-supra', 7, null, 2),
    ('c0000002-0000-4000-8000-000000000009', 'abdominal-infra', 5, null, 3),
    ('c0000002-0000-4000-8000-000000000009', 'elevacao-pernas', 5, null, 4),
    ('c0000002-0000-4000-8000-00000000000a', 'polichinelo', 14, null, 1),
    ('c0000002-0000-4000-8000-00000000000a', 'abdominal-supra', 7, null, 2),
    ('c0000002-0000-4000-8000-00000000000a', 'agachamento', 7, null, 3),
    ('c0000002-0000-4000-8000-00000000000a', 'elevacao-pernas', 5, null, 4),
    ('c0000002-0000-4000-8000-00000000000a', 'corrida-estacionaria', null, 30, 5),
    ('c0000002-0000-4000-8000-00000000000b', 'polichinelo', 17, null, 1),
    ('c0000002-0000-4000-8000-00000000000b', 'agachamento', 9, null, 2),
    ('c0000002-0000-4000-8000-00000000000b', 'flexao-apoiada', 5, null, 3),
    ('c0000002-0000-4000-8000-00000000000b', 'prancha-joelhos', null, 25, 4),
    ('c0000002-0000-4000-8000-00000000000c', 'corrida-estacionaria', null, 35, 1),
    ('c0000002-0000-4000-8000-00000000000c', 'abdominal-supra', 9, null, 2),
    ('c0000002-0000-4000-8000-00000000000c', 'abdominal-infra', 6, null, 3),
    ('c0000002-0000-4000-8000-00000000000c', 'elevacao-pernas', 6, null, 4),
    ('c0000002-0000-4000-8000-00000000000d', 'polichinelo', 17, null, 1),
    ('c0000002-0000-4000-8000-00000000000d', 'abdominal-supra', 9, null, 2),
    ('c0000002-0000-4000-8000-00000000000d', 'agachamento', 9, null, 3),
    ('c0000002-0000-4000-8000-00000000000d', 'elevacao-pernas', 6, null, 4),
    ('c0000002-0000-4000-8000-00000000000d', 'corrida-estacionaria', null, 35, 5),
    ('c0000002-0000-4000-8000-00000000000f', 'polichinelo', 18, null, 1),
    ('c0000002-0000-4000-8000-00000000000f', 'agachamento', 9, null, 2),
    ('c0000002-0000-4000-8000-00000000000f', 'flexao-apoiada', 6, null, 3),
    ('c0000002-0000-4000-8000-00000000000f', 'prancha', null, 15, 4),
    ('c0000002-0000-4000-8000-000000000010', 'corrida-estacionaria', null, 40, 1),
    ('c0000002-0000-4000-8000-000000000010', 'abdominal-supra', 9, null, 2),
    ('c0000002-0000-4000-8000-000000000010', 'abdominal-infra', 7, null, 3),
    ('c0000002-0000-4000-8000-000000000010', 'elevacao-pernas', 7, null, 4),
    ('c0000002-0000-4000-8000-000000000011', 'polichinelo', 18, null, 1),
    ('c0000002-0000-4000-8000-000000000011', 'abdominal-supra', 9, null, 2),
    ('c0000002-0000-4000-8000-000000000011', 'agachamento', 9, null, 3),
    ('c0000002-0000-4000-8000-000000000011', 'elevacao-pernas', 7, null, 4),
    ('c0000002-0000-4000-8000-000000000011', 'corrida-estacionaria', null, 40, 5),
    ('c0000002-0000-4000-8000-000000000012', 'polichinelo', 21, null, 1),
    ('c0000002-0000-4000-8000-000000000012', 'agachamento', 11, null, 2),
    ('c0000002-0000-4000-8000-000000000012', 'flexao-apoiada', 7, null, 3),
    ('c0000002-0000-4000-8000-000000000012', 'prancha', null, 20, 4),
    ('c0000002-0000-4000-8000-000000000013', 'corrida-estacionaria', null, 45, 1),
    ('c0000002-0000-4000-8000-000000000013', 'abdominal-supra', 11, null, 2),
    ('c0000002-0000-4000-8000-000000000013', 'abdominal-infra', 9, null, 3),
    ('c0000002-0000-4000-8000-000000000013', 'elevacao-pernas', 9, null, 4),
    ('c0000002-0000-4000-8000-000000000014', 'polichinelo', 21, null, 1),
    ('c0000002-0000-4000-8000-000000000014', 'abdominal-supra', 11, null, 2),
    ('c0000002-0000-4000-8000-000000000014', 'agachamento', 11, null, 3),
    ('c0000002-0000-4000-8000-000000000014', 'elevacao-pernas', 9, null, 4),
    ('c0000002-0000-4000-8000-000000000014', 'corrida-estacionaria', null, 45, 5),
    ('c0000002-0000-4000-8000-000000000016', 'polichinelo', 22, null, 1),
    ('c0000002-0000-4000-8000-000000000016', 'agachamento', 12, null, 2),
    ('c0000002-0000-4000-8000-000000000016', 'flexao-apoiada', 8, null, 3),
    ('c0000002-0000-4000-8000-000000000016', 'prancha', null, 20, 4),
    ('c0000002-0000-4000-8000-000000000017', 'corrida-estacionaria', null, 45, 1),
    ('c0000002-0000-4000-8000-000000000017', 'abdominal-supra', 12, null, 2),
    ('c0000002-0000-4000-8000-000000000017', 'abdominal-infra', 9, null, 3),
    ('c0000002-0000-4000-8000-000000000017', 'elevacao-pernas', 9, null, 4),
    ('c0000002-0000-4000-8000-000000000018', 'polichinelo', 22, null, 1),
    ('c0000002-0000-4000-8000-000000000018', 'abdominal-supra', 12, null, 2),
    ('c0000002-0000-4000-8000-000000000018', 'agachamento', 12, null, 3),
    ('c0000002-0000-4000-8000-000000000018', 'elevacao-pernas', 9, null, 4),
    ('c0000002-0000-4000-8000-000000000018', 'corrida-estacionaria', null, 45, 5),
    ('c0000002-0000-4000-8000-000000000019', 'polichinelo', 26, null, 1),
    ('c0000002-0000-4000-8000-000000000019', 'agachamento', 14, null, 2),
    ('c0000002-0000-4000-8000-000000000019', 'flexao-apoiada', 10, null, 3),
    ('c0000002-0000-4000-8000-000000000019', 'prancha', null, 25, 4),
    ('c0000002-0000-4000-8000-00000000001a', 'corrida-estacionaria', null, 50, 1),
    ('c0000002-0000-4000-8000-00000000001a', 'abdominal-supra', 14, null, 2),
    ('c0000002-0000-4000-8000-00000000001a', 'abdominal-infra', 11, null, 3),
    ('c0000002-0000-4000-8000-00000000001a', 'elevacao-pernas', 11, null, 4),
    ('c0000002-0000-4000-8000-00000000001b', 'polichinelo', 26, null, 1),
    ('c0000002-0000-4000-8000-00000000001b', 'abdominal-supra', 14, null, 2),
    ('c0000002-0000-4000-8000-00000000001b', 'agachamento', 14, null, 3),
    ('c0000002-0000-4000-8000-00000000001b', 'elevacao-pernas', 11, null, 4),
    ('c0000002-0000-4000-8000-00000000001b', 'corrida-estacionaria', null, 50, 5),
    ('c0000002-0000-4000-8000-00000000001d', 'polichinelo', 26, null, 1),
    ('c0000002-0000-4000-8000-00000000001d', 'abdominal-supra', 14, null, 2),
    ('c0000002-0000-4000-8000-00000000001d', 'agachamento', 14, null, 3),
    ('c0000002-0000-4000-8000-00000000001d', 'elevacao-pernas', 11, null, 4),
    ('c0000002-0000-4000-8000-00000000001d', 'corrida-estacionaria', null, 50, 5),
    ('c0000002-0000-4000-8000-00000000001e', 'polichinelo', 10, null, 1),
    ('c0000002-0000-4000-8000-00000000001e', 'agachamento', 5, null, 2),
    ('c0000002-0000-4000-8000-00000000001e', 'flexao-apoiada', 3, null, 3),
    ('c0000002-0000-4000-8000-00000000001e', 'prancha-joelhos', null, 15, 4)
  ) as v (tpl, slug, reps, dur, ord)
  join public.exercises e on e.slug = v.slug and e.owner_id is null;

-- -----------------------------------------------------------------------------
-- A medalha
--
-- Prata, e não ouro: o dourado fica para o que é difícil e datado. Esta é de
-- quem começou do zero e não largou — conquista de constância, não de pico.
-- -----------------------------------------------------------------------------
insert into public.badges (slug, name, description, metric, threshold, tier, emblem, sort_order) values
  ('disciplina', 'Disciplina',
   'Os 30 dias da Trilha do Iniciante. Seis treinos e um descanso por semana, até o fim — o hábito que fica quando a vontade passa.',
   'trilha', 30, 'prata', 'disciplina', 240)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  threshold = excluded.threshold,
  tier = excluded.tier,
  emblem = excluded.emblem;

-- -----------------------------------------------------------------------------
-- A trilha
-- -----------------------------------------------------------------------------
update public.tracks
   set title       = 'Trilha do Iniciante em Casa',
       tagline     = '30 dias · 6 treinos leves e 1 descanso por semana',
       description = E'Para quem está começando agora e quer alguém dizendo o que fazer.\n\nSão 30 dias: seis de treino e um de descanso por semana. Cada treino é guiado passo a passo — o app diz o exercício e quantas repetições, conta o descanso e chama o próximo. Polichinelo, agachamento, flexão, prancha, corrida parada e abdominais, tudo em casa, sem equipamento.\n\nO dia 1 leva uns dez minutos: 10 polichinelos, 5 agachamentos, 3 flexões com os joelhos no chão. A cada dia sobe um pouco, e nunca passa de 20 minutos. Conseguiu mais repetições? Melhor. Mas siga a trilha: ela foi feita para o corpo acompanhar.\n\nA trilha anda com os seus dias, não com o calendário. Faltou um dia? O treino te espera no seguinte. No fim dos 30, a medalha Disciplina é sua — e a biblioteca inteira de treinos também.',
       weeks       = 5,
       week_titles = array['Primeiros passos', 'Ritmo', 'Constância', 'Força', 'Formatura'],
       badge_slug  = 'disciplina'
 where id = 'a0000001-0000-4000-8000-000000000001';

delete from public.track_sessions
 where track_id = 'a0000001-0000-4000-8000-000000000001';

insert into public.track_sessions (track_id, position, week, title, focus, note, template_id)
values
('a0000001-0000-4000-8000-000000000001', 1, 1, $t$Força$t$, 'forca', $n$O primeiro dia é para descobrir que dá. Dez polichinelos, cinco agachamentos, três flexões com os joelhos no chão — e descanso entre cada um. Se sobrar fôlego, ótimo; se não sobrar, fez do mesmo jeito.$n$, 'c0000002-0000-4000-8000-000000000001'),
  ('a0000001-0000-4000-8000-000000000001', 2, 1, $t$Abdômen$t$, 'core', $n$Hoje é o abdômen, deitado no chão. Lombar apoiada o tempo todo: se ela levantar, diminua o movimento em vez de forçar.$n$, 'c0000002-0000-4000-8000-000000000002'),
  ('a0000001-0000-4000-8000-000000000001', 3, 1, $t$Corpo todo$t$, 'cardio', $n$Tudo junto, em cinco exercícios curtos. É o treino que mostra que o corpo inteiro trabalha, e não só uma parte por vez.$n$, 'c0000002-0000-4000-8000-000000000003'),
  ('a0000001-0000-4000-8000-000000000001', 4, 1, $t$Força$t$, 'forca', $n$O mesmo treino do dia 1, com um pouco mais. Repetir é como o corpo aprende o movimento — e você vai sentir que ficou mais fácil.$n$, 'c0000002-0000-4000-8000-000000000004'),
  ('a0000001-0000-4000-8000-000000000001', 5, 1, $t$Abdômen$t$, 'core', $n$Abdômen de novo, com mais uma repetição aqui e ali. Devagar vale mais que rápido: o movimento controlado é o que conta.$n$, 'c0000002-0000-4000-8000-000000000005'),
  ('a0000001-0000-4000-8000-000000000001', 6, 1, $t$Corpo todo$t$, 'cardio', $n$Último treino da primeira semana. Amanhã é descanso de verdade — hoje pode ir até o fim.$n$, 'c0000002-0000-4000-8000-000000000006'),
  ('a0000001-0000-4000-8000-000000000001', 7, 1, 'Descanso', 'descanso', $n$Descanso. Não é folga do programa: é parte dele. É no dia parado que o corpo guarda o que você treinou nos outros seis.$n$, null),
  ('a0000001-0000-4000-8000-000000000001', 8, 2, $t$Força$t$, 'forca', $n$Semana 2: os números sobem um pouco. Se algum ficar pesado, faça o da semana passada e siga — a trilha é sua, não uma prova.$n$, 'c0000002-0000-4000-8000-000000000008'),
  ('a0000001-0000-4000-8000-000000000001', 9, 2, $t$Abdômen$t$, 'core', $n$Corrida parada mais longa hoje. Se a respiração fechar, troque por marcha no lugar até ela voltar; parar de vez é que não.$n$, 'c0000002-0000-4000-8000-000000000009'),
  ('a0000001-0000-4000-8000-000000000001', 10, 2, $t$Corpo todo$t$, 'cardio', $n$Corpo todo. Repare quanto tempo você precisou de descanso na semana 1 e quanto precisa hoje.$n$, 'c0000002-0000-4000-8000-00000000000a'),
  ('a0000001-0000-4000-8000-000000000001', 11, 2, $t$Força$t$, 'forca', $n$Força, com mais repetições. Flexão com os joelhos no chão ainda é flexão — o corpo inteiro reto, do joelho ao ombro.$n$, 'c0000002-0000-4000-8000-00000000000b'),
  ('a0000001-0000-4000-8000-000000000001', 12, 2, $t$Abdômen$t$, 'core', $n$Abdômen. Na elevação de pernas, desça devagar: é a descida que trabalha, e é ela que protege a lombar.$n$, 'c0000002-0000-4000-8000-00000000000c'),
  ('a0000001-0000-4000-8000-000000000001', 13, 2, $t$Corpo todo$t$, 'cardio', $n$Fecha a segunda semana. Duas semanas seguidas já são mais do que a maioria das pessoas faz no primeiro mês.$n$, 'c0000002-0000-4000-8000-00000000000d'),
  ('a0000001-0000-4000-8000-000000000001', 14, 2, 'Descanso', 'descanso', $n$Descanso. Caminhar, alongar, dormir bem — tudo isso conta. Treino de amanhã rende mais por causa de hoje.$n$, null),
  ('a0000001-0000-4000-8000-000000000001', 15, 3, $t$Força$t$, 'forca', $n$Semana 3: entram quatro voltas. O descanso encurtou para 25 segundos; se precisar de mais, tome — mas volte.$n$, 'c0000002-0000-4000-8000-00000000000f'),
  ('a0000001-0000-4000-8000-000000000001', 16, 3, $t$Abdômen$t$, 'core', $n$A prancha sai dos joelhos hoje. Quinze segundos com o quadril na linha valem mais que trinta com ele caído.$n$, 'c0000002-0000-4000-8000-000000000010'),
  ('a0000001-0000-4000-8000-000000000001', 17, 3, $t$Corpo todo$t$, 'cardio', $n$Abdômen com quatro voltas. Mesmo movimento, mais vezes: é assim que resistência se constrói.$n$, 'c0000002-0000-4000-8000-000000000011'),
  ('a0000001-0000-4000-8000-000000000001', 18, 3, $t$Força$t$, 'forca', $n$Corpo todo, quatro voltas. Se chegou até aqui, treinar já é rotina — o resto é continuar.$n$, 'c0000002-0000-4000-8000-000000000012'),
  ('a0000001-0000-4000-8000-000000000001', 19, 3, $t$Abdômen$t$, 'core', $n$Força, com mais repetições. Se as flexões saírem fáceis, faça uma a mais em cada volta. Sempre que der mais, melhor.$n$, 'c0000002-0000-4000-8000-000000000013'),
  ('a0000001-0000-4000-8000-000000000001', 20, 3, $t$Corpo todo$t$, 'cardio', $n$Abdômen. Terceira semana quase fechada: compare com o dia 2 e veja a distância.$n$, 'c0000002-0000-4000-8000-000000000014'),
  ('a0000001-0000-4000-8000-000000000001', 21, 3, 'Descanso', 'descanso', $n$Descanso. Três semanas feitas. Amanhã começa a última — a mais forte.$n$, null),
  ('a0000001-0000-4000-8000-000000000001', 22, 4, $t$Força$t$, 'forca', $n$Semana 4: os maiores números da trilha, descanso de 20 segundos. Você não é mais quem abriu o app no dia 1.$n$, 'c0000002-0000-4000-8000-000000000016'),
  ('a0000001-0000-4000-8000-000000000001', 23, 4, $t$Abdômen$t$, 'core', $n$Abdômen, na versão mais longa. Controle antes de velocidade, até a última repetição.$n$, 'c0000002-0000-4000-8000-000000000017'),
  ('a0000001-0000-4000-8000-000000000001', 24, 4, $t$Corpo todo$t$, 'cardio', $n$Corpo todo. Cinco exercícios, quatro voltas, pouco descanso: é o treino de quem já treina.$n$, 'c0000002-0000-4000-8000-000000000018'),
  ('a0000001-0000-4000-8000-000000000001', 25, 4, $t$Força$t$, 'forca', $n$Força. Oito flexões por volta — no dia 1 eram três.$n$, 'c0000002-0000-4000-8000-000000000019'),
  ('a0000001-0000-4000-8000-000000000001', 26, 4, $t$Abdômen$t$, 'core', $n$Abdômen, o último antes da reta final. Cada volta completa é uma que você não fazia um mês atrás.$n$, 'c0000002-0000-4000-8000-00000000001a'),
  ('a0000001-0000-4000-8000-000000000001', 27, 4, $t$Corpo todo$t$, 'cardio', $n$Corpo todo. Amanhã é descanso, e depois dele vêm os dois dias de formatura.$n$, 'c0000002-0000-4000-8000-00000000001b'),
  ('a0000001-0000-4000-8000-000000000001', 28, 4, 'Descanso', 'descanso', $n$Descanso. O último da trilha. Descanse bem: os dois dias que faltam são para terminar forte.$n$, null),
  ('a0000001-0000-4000-8000-000000000001', 29, 5, $t$Ensaio geral$t$, 'cardio', $n$Ensaio geral: o corpo todo com os números da semana 4. Faça cada repetição inteira — o fim está a um dia.$n$, 'c0000002-0000-4000-8000-00000000001d'),
  ('a0000001-0000-4000-8000-000000000001', 30, 5, $t$Formatura$t$, 'forca', $n$Formatura: o treino do dia 1, agora com cinco voltas e descanso curto. No dia 1 três voltas pediam fôlego; hoje, veja o que sobra. É assim que se mede um mês.$n$, 'c0000002-0000-4000-8000-00000000001e');

-- a medalha antiga saiu de cena. Ninguém a conquistou, então ela some sem
-- tirar nada de ninguém; se alguém tiver, ela fica.
delete from public.badges b
 where b.slug = 'via-apia'
   and not exists (select 1 from public.user_badges u where u.badge_slug = b.slug);

