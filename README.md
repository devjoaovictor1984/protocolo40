# PROTOCOLO40

**20 minutos. Todos os dias.**

Plataforma de treino, consistência e evolução física. O produto responde a uma pergunta só:

> Você fez seus 20 minutos hoje?

Next.js 16 · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Supabase · PWA (Serwist)

---

## Estado atual

**Fase 1 — MVP.** O produto existe: dá para treinar, registrar, acompanhar e comparar.

| Entregue | O que é |
|---|---|
| Arquitetura | `docs/ARQUITETURA.md` — schema, RLS, offline, PWA, design system, roadmap |
| Banco | 16 tabelas, tipos, constraints, índices e triggers — **aplicadas em produção** |
| Segurança | RLS em todas as tabelas, **provada por 15 testes contra o banco real** |
| Seed | ~65 exercícios e 12 sugestões de treino de 20 minutos |
| Autenticação | E-mail e senha, Google, recuperação e troca de senha |
| PWA | Manifest, ícones, service worker com estratégia por rota, fallback offline |
| Design system | Tokens em OKLCH, tema claro/escuro/sistema, 18 componentes base |
| Regras puras | Streak, duração, recordes, calendário, progresso e sugestões em `services/`, com 70 testes |
| Qualidade | ESLint, `tsc --noEmit`, Vitest e Playwright configurados |
| Offline | IndexedDB, fila com backoff e idempotência por `client_id` |
| Cronômetro | Baseado em timestamp: sobrevive a segundo plano, tela bloqueada e fechar o app |
| Telas | Onboarding, Dia 1, dashboard, treino, histórico, calendário, evolução, fotos, comparação, medidas, recordes, perfil, privacidade |
| Gráficos | SVG próprio, paleta validada em claro e escuro, tabela equivalente em cada um |

Próximo: **Fase 2 — Evolução** (marcos, estatísticas mais finas, melhorias de cache e sync).

---

## Como rodar

### 1. Dependências

```bash
npm install
```

### 2. Projeto Supabase

Crie um projeto em [supabase.com](https://supabase.com) e copie as credenciais:

```bash
cp .env.example .env.local
```

Preencha `.env.local` com **Project Settings → API**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — só servidor, nunca commitada, nunca no navegador
- `SUPABASE_PROJECT_REF` — **Project Settings → General → Reference ID**

### 3. Banco

```bash
npm run db:push     # aplica as 7 migrations
npm run db:seed     # migrations + biblioteca de exercícios e sugestões
```

Os dois usam `scripts/db.mjs`, que monta a connection string a partir do
`.env.local` e chama o CLI com `--db-url`. Não precisa de `supabase login`, que é
interativo e não roda em CI.

`npm run db:types` regenera `types/generated.ts` a partir do schema real, mas
exige um access token (`supabase login`) ou Docker instalado. Enquanto isso,
`types/database.ts` é mantido à mão — e um teste confere que ele bate coluna a
coluna com o banco.

### 4. Login com Google

No painel do Supabase, em **Authentication → Providers → Google**, informe o Client ID e o
Secret do Google Cloud. Em **Authentication → URL Configuration**, adicione as URLs de
redirecionamento:

```
http://localhost:3000/auth/callback
https://SEU-DOMINIO/auth/callback
```

### 5. Desenvolvimento

```bash
npm run dev
```

O service worker fica desligado em desenvolvimento de propósito. Para testar o PWA:

```bash
npm run build && npm start
```

---

## Testes

```bash
npm test              # regras puras (streak, duração, recordes) + RLS
npm run test:e2e      # Playwright — rode `npx playwright install` na primeira vez
```

Os testes de RLS só rodam com `.env.local` apontando para um projeto real: eles criam dois
usuários descartáveis e verificam que um não enxerga nem altera nada do outro. Sem as
credenciais, o bloco se declara pulado em vez de falhar.

---

## Estrutura

```
app/           rotas (App Router), metadata, service worker, ícones
components/    design system + primitivos shadcn/ui
features/      um diretório por domínio: auth, workouts, timer, photos…
lib/           supabase, auth, storage, offline, validação, permissões
services/      regras de negócio puras — sem React, sem Supabase, testáveis
supabase/      migrations versionadas e seed
tests/         Vitest (unitário e integração)
e2e/           Playwright
docs/          arquitetura e decisões
```

Convenções e decisões que não mudam sem discussão estão em `AGENTS.md`.

---

## Deploy

Vercel, com as mesmas variáveis de ambiente. O build gera o service worker no passo
`build:sw`, logo após o `next build`.
