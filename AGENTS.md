<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# P20X

**20 minutos. Todos os dias.** Plataforma de treino, consistência e evolução física.
A arquitetura completa está em `docs/ARQUITETURA.md` — leia antes de mudanças estruturais.
O que mudou, por quê e como consertar está em `docs/DIARIO.md` — **atualize a cada entrega**.

## Regra de dependência

```
app/       rotas, layouts, metadata, Server Actions finas   → conhece features
features/  UI por domínio + hooks de cliente                → conhece services, lib
services/  REGRAS DE NEGÓCIO PURAS (sem React, sem Supabase)→ não conhece nada
lib/       infraestrutura (supabase, storage, offline, zod) → não conhece features
```

Camada de baixo nunca importa camada de cima. Componente de design system
(`components/`) não importa de `features/` nem de `services/`.

## Decisões que não se negociam sem discussão

- **RSC por padrão.** `"use client"` só em ilhas: timer, câmera, gráficos, fila offline.
- **Autorização é RLS.** `if (user.id === x)` no frontend é conveniência de UI, nunca segurança.
- **Service role só no servidor.** `lib/supabase/admin.ts` é `server-only`. Nunca no navegador.
- **Foto nasce privada.** Garantido por policy de INSERT, não por código de aplicação.
- **Recorde é gravado por trigger.** O cliente não insere em `personal_records`.
- **Falha de rede não é logout.** O `getClaims()` devolve `null` tanto para "não tem
  sessão" quanto para "não deu para perguntar". Havendo cookie de sessão e erro de
  rede, a rota segue e quem decide é a RLS — mandar para o login quem está logado é
  o pior erro que o app pode cometer.
- **O service worker nunca guarda página autenticada.** Só as telas de treino, e elas
  somem no logout. Nada de `defaultCache`: ele guarda todo HTML e todo RSC da origem.
- **`revoke` de função não fecha nada sozinho.** O Postgres concede `execute` a
  `public` ao criar a função, e `revoke ... from anon, authenticated` deixa isso
  de pé. O certo é `from public, anon, authenticated`, e `create or replace`
  restaura a concessão — o revoke tem que vir junto no mesmo arquivo.
- **Cronômetro por timestamp.** Nunca contador de `setInterval` — ele para em segundo plano.
- **Escrita offline é local-first.** Treino, medida e foto vão para o IndexedDB e sobem pela
  fila com `client_id` (UUID do cliente), que garante idempotência via `unique(user_id, client_id)`.
- **Dia do treino é `workout_date`**, calculado no fuso do usuário. Streak nunca olha `timestamptz`.
- **Notificação nunca cobra e nunca fala de corpo.** Ela aparece na tela
  bloqueada, à vista de terceiros, e sem ser chamada. O texto é regra testada em
  `services/notifications.ts`, não string solta no envio.
- **Um lembrete por dia, no fuso da pessoa.** O cron roda de hora em hora e quem
  decide é `quem_lembrar()`, no banco. Ninguém recebe se já treinou ou descansou.
- **Peso é tendência, nunca a balança do dia.** Progresso, meta e previsão saem da
  média móvel de 7 dias. O número cru oscila 1 a 2 kg por água e sal, e um app que
  reage a isso ensina a pessoa a não confiar nele.
- **A meta de peso não escolhe prazo.** A pessoa dá o alvo; a data sai do ritmo que
  se sustenta (~0,5%/semana para perder, ~0,25% para ganhar). Quando o ritmo real
  passa disso, a previsão continua usando o seguro. Meta nenhuma vira notificação.
- **20 minutos é referência, não regra.** Nada bloqueia um treino de 10 ou de 60 minutos.
- **Migrations versionadas.** Nada de alterar o banco pelo painel; tudo em `supabase/migrations`.
- **Exercícios vêm do seed**, nunca hardcoded em componente.

## Comandos

```bash
npm run dev          # desenvolvimento (Turbopack; service worker desligado)
npm run build        # build de produção + build do service worker
npm run typecheck    # tsc --noEmit
npm run lint
npm test             # Vitest: regras puras + integração de RLS
npm run test:e2e     # Playwright (rode `npx playwright install` uma vez)
P20X_SW=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test e2e/cache.spec.ts
                     # service worker: só contra `npm run build && npm start`

npm run db:push      # aplica as migrations no projeto linkado
node scripts/aplicar-migrations.mjs [--aplicar]   # quando o CLI fica mudo (sem TTY)
npm run db:seed      # migrations + seed
npm run db:types     # regenera types/database.ts a partir do schema real
```

## Escrita

Interface e comentários em pt-BR. Erros explicam o que aconteceu e o que fazer.
Nada de stack trace na tela. Estado nunca é comunicado só por cor.
