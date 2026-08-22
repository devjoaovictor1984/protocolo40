<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PROTOCOLO40

**20 minutos. Todos os dias.** Plataforma de treino, consistência e evolução física.
A arquitetura completa está em `docs/ARQUITETURA.md` — leia antes de mudanças estruturais.

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
- **Cronômetro por timestamp.** Nunca contador de `setInterval` — ele para em segundo plano.
- **Escrita offline é local-first.** Treino, medida e foto vão para o IndexedDB e sobem pela
  fila com `client_id` (UUID do cliente), que garante idempotência via `unique(user_id, client_id)`.
- **Dia do treino é `workout_date`**, calculado no fuso do usuário. Streak nunca olha `timestamptz`.
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

npm run db:push      # aplica as migrations no projeto linkado
npm run db:seed      # migrations + seed
npm run db:types     # regenera types/database.ts a partir do schema real
```

## Escrita

Interface e comentários em pt-BR. Erros explicam o que aconteceu e o que fazer.
Nada de stack trace na tela. Estado nunca é comunicado só por cor.
