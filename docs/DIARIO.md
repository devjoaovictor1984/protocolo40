# P20X — Diário de mudanças

> Para quando algo quebrar e ninguém lembrar por quê.
> Complementa o `ARQUITETURA.md`, que descreve como o sistema é; aqui está **o que
> mudou, por que, e como desfazer**.

Cada entrada responde três perguntas: o que estava errado, o que passou a valer, e
onde olhar quando voltar a dar problema. Ordem cronológica inversa — o recente em cima.

---

## 25/08/2026 · Desafios, notificações, instalação e análise por objetivo

### Desafios

**O que é.** Um período com data marcada e uma meta de dias. O primeiro é o
**Desafio de Setembro** (1 a 30/09/2026, meta de 25 dias, insígnia `setembro`).

**Decisões que não são óbvias:**

- **O progresso não é gravado, é contado.** Não existe coluna "dias feitos" — o
  número sai de `workouts`. Apagar um treino corrige o desafio sozinho, e não há
  caminho para escrever um número que não aconteceu.
- **A meta é 25 de 30, e não 30 de 30.** Um desafio sem margem quebra na primeira
  gripe, e quem falha no dia 4 abandona o mês. Para mudar: coluna `goal`.
- **Entrar é deliberado e coloca no ranking.** A tela diz isso antes do clique.
- **O ranking mostra constância, nunca corpo.** Passa por
  `ranking_do_desafio()`, que é `SECURITY DEFINER` — é o lugar exato onde uma
  coluna a mais no `select` vazaria peso sem ninguém notar. Há teste e2e que cria
  alguém com peso 87,3 e falha se o número aparecer no HTML.

**Onde olhar se der problema:**

| Sintoma | Olhe |
|---|---|
| Barra mostra dias do desafio errado | `meus_dias_nos_desafios()` e `app/(app)/hoje/page.tsx` |
| Desafio errado em destaque | `desafioEmDestaque()` em `services/challenges.ts` — regra pura, com testes |
| Ranking vazio | policy `participacao leitura`, e se o desafio está `is_active` |
| Insígnia não caiu | `concluir_desafio()`; roda ao abrir a tela, não por botão |

**Como desligar um desafio:** `/admin/desafios` → Desligar. Não apaga nada: quem
participou mantém a participação e a insígnia.

### Notificações push

**O que é.** Lembrete diário no horário de cada pessoa, e campanhas disparadas
pelo admin em `/admin/notificacoes`.

**Decisões que não são óbvias:**

- **A regra é "a hora escolhida já passou hoje"**, e não "é exatamente ela".
  Às 19h de Brasília são 18h em Manaus; quem decide é `quem_lembrar()`, com
  `at time zone`. Chamando de hora em hora, o aviso sai na hora exata — a
  primeira rodada a partir da hora escolhida é ela mesma. Chamando uma vez por
  dia, sai mais tarde, mas sai. Ver a armadilha do cron da Vercel, abaixo.
- **Ninguém recebe se já treinou, descansou ou já foi lembrado hoje.** A trava é
  `user_settings.last_reminded_on`.
- **O texto é regra testada**, em `services/notifications.ts`. Nunca cobra, nunca
  fala de peso — uma notificação aparece na tela bloqueada, à vista de terceiros.
- **Inscrição morta é apagada.** 404 e 410 do serviço de push significam aparelho
  desinstalado; guardar a linha só faz a próxima campanha demorar.
- **No iPhone só funciona com o app instalado.** Safari não expõe `PushManager`
  fora do modo standalone. Por isso o convite de instalação veio junto.

**Variáveis de ambiente:**

| Variável | Tipo na Vercel | Observação |
|---|---|---|
| `NEXT_PUBLIC_VAPID_KEY` | **Config** | pública por definição; o navegador precisa dela |
| `VAPID_PRIVATE_KEY` | Secret | nunca sai do servidor |
| `VAPID_SUBJECT` | Config | `mailto:` de contato |
| `CRON_SECRET` | Secret | **string longa e aleatória** — ver aviso abaixo |

> ⚠ **`CRON_SECRET` não pode ser um valor adivinhável.** `dev-apenas-local` é o
> placeholder do `.env.local` e não serve em produção: quem descobrisse a rota
> `/api/notificacoes/lembretes` poderia disparar push para a base inteira.
> Gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

> ⚠ **Trocar o par VAPID invalida todas as inscrições.** Quem já autorizou
> precisaria autorizar de novo. Gere uma vez e guarde.

**Onde olhar se der problema:**

| Sintoma | Olhe |
|---|---|
| Aviso vermelho em `/admin/notificacoes` | as chaves VAPID não estão no ambiente |
| Chaves configuradas e ainda não funciona | `NEXT_PUBLIC_*` entra no bundle **no build** — precisa de redeploy sem cache |
| Ninguém recebe o lembrete | rode `select * from quem_lembrar(now())` e veja se volta linha |
| Cron responde 401 | `CRON_SECRET` diferente entre a Vercel e o ambiente |
| iPhone não oferece o botão | o app não está instalado na tela de início |

### Instalação do app (PWA)

Cartão na tela de Hoje, some sozinho quando já instalado, dispensável por 30 dias.
Android e desktop ganham o botão nativo (`beforeinstallprompt`); **iPhone não tem
API nenhuma**, então o app ensina o caminho manual pelo Safari.

### Análise por objetivo

`services/objective.ts` responde "o que eu faço esta semana", conforme o objetivo
do perfil. Quatro dias por semana bastam para força e são pouco para perder
gordura; esforço 9 é o alvo da força e é demais para manter a saúde. Cada faixa
tem referência citada no código.

Lê **descanso** de dois jeitos: a média e a maior emenda. Dez dias seguidos e
quatro parados dão a mesma média de uma semana equilibrada, e não são a mesma
coisa para o corpo.

### Peso nas fotos — correção

**O que estava errado.** O peso morava em dois lugares que não conversavam: a
medida do dia (`body_measurements`, escrita pelo cartão de Hoje e pela tela de
Medidas) e uma cópia gravada junto da foto, preenchida só quando o peso era
digitado ao finalizar o treino. Quem pesava de manhã e fotografava à noite via
"Sem peso registrado" embaixo da própria foto.

**O que passou a valer.** A medida do dia é a fonte; a cópia da foto é reserva.
Corrigir o peso em Medidas corrige a foto junto. Em `services/progress.ts`.

---

## 25/08/2026 · Sessão que caía e cache que mentia

**A queixa.** "Tem que ficar logando toda hora."

**O que os dados diziam.** Nenhum usuário tinha mais de 3 sessões, e havia sessões
vivas renovando 10 horas depois. **A sessão nunca caiu** — o app é que mostrava a
tela de login com a sessão intacta no cookie.

**Três causas:**

1. **Falha de rede era lida como logout.** `getClaims()` devolve o mesmo `null`
   para "não tem sessão" e para "não consegui perguntar". Num túnel, num elevador,
   ou quando o Supabase respondia **429**, quem estava logado ia para o login.
   A regra agora está em `falhaTemporaria()`, em `lib/supabase/guard.ts`: só conta
   como deslogado quando o servidor respondeu e recusou (401, 403, sessão
   inexistente). Rede caída, 429, 408 e 5xx viram "não deu para perguntar", e a
   rota segue — quem autoriza continua sendo a RLS.
2. **O service worker guardava página autenticada de tudo.** O `defaultCache` do
   Serwist cacheia todo HTML e todo payload RSC da origem. O despejo dos caches
   reais mostrou medidas corporais e treinos de um usuário, em texto, no disco do
   aparelho. Agora só as telas de treino ficam guardadas, e somem no logout.
3. **Os desvios do proxy jogavam fora a sessão recém-renovada.** A rotação do
   Supabase mata o token antigo no instante em que ele é usado.

**Onde olhar:** `lib/supabase/guard.ts`, `lib/supabase/proxy.ts`, `lib/auth/session.ts`,
`app/sw.ts`, `lib/offline/cache-policy.ts`.

---

## Armadilhas descobertas (valem para sempre)

### `revoke` de função não fecha nada sozinho

O Postgres concede `execute` a `public` no momento em que a função é criada.
`revoke ... from anon, authenticated` deixa essa concessão herdada de pé.

Foi assim que `aparelhos_inscritos()` — que devolve `endpoint`, `p256dh` e `auth`
de cada aparelho, o material necessário para **enviar notificação em nome do
P20X** — ficou chamável por qualquer visitante anônimo. Um teste de integração
pegou antes de ir para produção.

O certo é `revoke ... from public, anon, authenticated`, e **`create or replace`
restaura a concessão** — o revoke tem que vir junto no mesmo arquivo.

### `supabase db push` fica mudo sem terminal interativo

Sai com código 0, não imprime nada e não aplica migration nenhuma. Use
`node scripts/aplicar-migrations.mjs [--aplicar]`, que faz o mesmo trabalho de
forma verificável e registra em `supabase_migrations.schema_migrations`.

### Valor novo de enum não pode ser usado na mesma transação

Um `alter type ... add value` precisa de arquivo próprio, antes do seed que usa o
valor. Junto, falha com `unsafe use of new value of enum type`.

### `manifestTransforms` do Serwist roda antes dos transforms dele

Os transforms do usuário recebem o caminho do arquivo
(`.next/server/app/index.html`), não a rota (`/`). Para tirar algo do precache,
use `globIgnores`.

### O plano Hobby da Vercel reprova o deploy por causa do cron

Não é aviso, é erro fatal: `Hobby accounts are limited to daily Cron Jobs`. Um
`schedule` mais frequente que uma vez por dia derruba o build inteiro, e o
sintoma é "não aparece deploy nenhum" — o status vai para o commit no GitHub,
não para a tela que se costuma olhar.

Para ver de fora:

```bash
gh api repos/OWNER/REPO/commits/SHA/status --jq '.statuses[]'
```

O `vercel.json` está em `0 1 * * *` (01h UTC, 22h de Brasília) por causa disso.
Para ter precisão de hora sem pagar o Pro, aponte um disparador externo gratuito
para `/api/notificacoes/lembretes` de hora em hora, com o cabeçalho
`Authorization: Bearer $CRON_SECRET`. A rota não sabe de que frequência é
chamada, e a mesma regra serve nos dois casos.

### `NEXT_PUBLIC_*` entra no bundle no build

Não é lida em tempo de execução. Salvar a variável na Vercel **não basta** —
precisa de redeploy sem cache de build.

### Clique antes da hidratação se perde em silêncio

Botão de componente cliente clicado antes da hidratação não dispara nada, sem
erro nenhum. Nos testes, espere o botão ficar habilitado e a rede sossegar antes
de clicar.

---

## Como verificar que está tudo de pé

```bash
npm test             # regras puras + integração (RLS, schema, lembretes)
npm run test:e2e     # Playwright, três aparelhos

# service worker só existe em build de produção:
npm run build && npm start
P20X_SW=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test e2e/cache.spec.ts

node scripts/aplicar-migrations.mjs   # o que falta aplicar no banco
```

> A suíte e2e roda contra o **Supabase de produção**. É por isso que contas de
> teste aparecem no admin e que o projeto às vezes bate no limite de requisições
> (429). Um projeto Supabase separado para testes resolve os dois.
