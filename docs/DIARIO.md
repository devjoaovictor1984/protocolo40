# P20X — Diário de mudanças

> Para quando algo quebrar e ninguém lembrar por quê.
> Complementa o `ARQUITETURA.md`, que descreve como o sistema é; aqui está **o que
> mudou, por que, e como desfazer**.

Cada entrada responde três perguntas: o que estava errado, o que passou a valer, e
onde olhar quando voltar a dar problema. Ordem cronológica inversa — o recente em cima.

---

## 26/08/2026 · Instalação no Android

**Relato:** duas opções aparecem no Chrome e "Instalar" não instala.

O manifest, os ícones e o service worker foram conferidos em produção e estão
todos corretos — não é falta de requisito básico:

| Requisito do Chrome | Estado |
|---|---|
| HTTPS | ✓ |
| Ícone 192 e 512 com `purpose: any` | ✓ (conferido: respondem e batem no tamanho) |
| `display: standalone` | ✓ |
| Service worker com handler de fetch | ✓ (`sw.js` responde 200) |
| Manifest ligado na página | ✓ |

**O que faltava e foi acrescentado:**

- **`screenshots`** com `form_factor`. Não é exigência, mas é o que troca a
  barra mínima do Chrome pela caixa de instalação rica — e a barra mínima é
  exatamente a que se confunde com "criar atalho". Duas capturas reais do app,
  geradas por Playwright.
- **`id: '/'`**. Sem ele o Chrome usa a `start_url` como identidade: no dia em
  que ela mudar, o aparelho instala um segundo ícone em vez de atualizar.
- **`display_override`** deixando o navegador como último recurso.

**Não reproduzido.** Sem o aparelho não dá para afirmar que isto resolve. Para
diagnosticar de verdade, o Chrome do Android diz o motivo em
`chrome://inspect` a partir do desktop, aba Application → Manifest.

O smoke agora confere os requisitos de instalação a partir do próprio manifest:
tamanhos de ícone, `display`, `id` e as capturas.

---

## 26/08/2026 · CRLF transformava o texto num parágrafo só

A migration do texto foi salva num editor do Windows e a string multilinha
levou os `

` do arquivo para dentro do banco. O componente separava
parágrafos em `

`, que **não casa** com `



` — a sequência é
`
 
 
 
` e não tem dois `
` seguidos. O texto inteiro virava um bloco.
Sem erro, sem aviso, só feio.

Não era caso isolado: **textarea de HTML envia CRLF por especificação**, então
todo desafio criado pelo painel teria o mesmo problema.

Corrigido nas três pontas: a ação normaliza na entrada, o componente aceita as
duas convenções na saída, e uma migration limpou o que já estava gravado.

---

## 26/08/2026 · Desafio de teste vazou para produção

Uma corrida da suíte foi interrompida por tempo limite e morreu antes do
`finally` que apaga o desafio criado. Ele ficou em produção — e não ficou
quieto: a janela dele (21/08 a 31/08) cobria hoje, então ele estava **em curso**,
e a regra de destaque prefere o que está rolando ao que vai começar. Resultado:
o desafio de teste ocupou a tela de Hoje de todo mundo e o Desafio de Setembro
sumiu dela.

**Duas frentes de correção:**

- `e2e/varredura.ts` passa a apagar também os desafios com prefixo `teste-`, na
  mesma rede de segurança que já pegava contas. Um desafio vazado é pior que uma
  conta vazada: aparece na tela inicial de quem usa o app.
- `/admin/desafios` ganhou **apagar**, separado de desligar. A confirmação diz
  quantas pessoas perdem a participação em vez de perguntar "tem certeza?" —
  "tem certeza" não informa nada.

**Desligar × apagar:** desligar tira das telas e mantém tudo; apagar leva junto a
participação de todo mundo pelo `on delete cascade`. A insígnia de quem concluiu
fica, porque mora em `user_badges` e não depende do desafio existir.

---

## 26/08/2026 · A inscrição de um inscrevia todos

**O que estava errado.** A policy de `challenge_participants` é `using (true)` —
tem que ser, porque é dela que o ranking sai. Mas as duas consultas do
repositório liam **todas** as inscrições sem filtrar por usuário:

```ts
supabase.from('challenge_participants').select('challenge_id')   // de todo mundo
```

Bastou uma pessoa entrar para o app achar que todos entraram. O botão nascia
dizendo "Sair do desafio" para quem nunca tinha entrado, e clicar não fazia
nada — o `delete` é corretamente limitado ao próprio usuário e apagava zero
linhas. Sem erro, sem sinal.

**Por que os testes não pegaram.** Cada teste tinha um usuário só, e com um
participante "todos" e "eu" dão o mesmo resultado. O teste novo usa dois: um
entra, o outro precisa continuar vendo o convite.

> **Regra geral:** `using (true)` numa policy não dispensa o `eq('user_id')` na
> consulta. A policy diz quem *pode* ler; a consulta diz o que se *quer* ler.
> Confundir as duas é fácil quando a tabela é de leitura aberta por desenho.

**Duas correções do mesmo caso:**

- O cartão da lista dizia "Entrar no desafio →" mas era texto dentro de um link:
  clicar levava para a tela, não inscrevia. Agora diz "Ver o desafio →".
- `entrarNoDesafio` devolvia `void` e falhava em silêncio absoluto. Agora
  devolve estado e a tela mostra o que aconteceu.

**Também:** o texto do desafio ficou em cinco frases; a lista antes do começo se
chama "Já entraram" e não mostra posição nem contador (classificar gente com
zero dias inventa uma competição que ainda não existe); e o favicon passou a ser
a arte real.

> ⚠ Arquivo `'use server'` só exporta função assíncrona. Uma constante ali
> derruba o build com *"can only export async functions, found object"* — o
> estado inicial de `useActionState` mora no componente.

---

## 26/08/2026 · Marca, ícone e arte do desafio

**Cores oficiais**, extraídas dos arquivos entregues: vermelho `#DA332D`, preto
`#090A0E`, cinza `#606062`, claro `#E6E7E8`.

O `--primary` do app já era `oklch(58% 0.19 28)` = `#d33c33`, e o vermelho da
logo é `oklch(58.3% 0.204 27.8)`. **A diferença é imperceptível**, então os
tokens ficaram como estavam — trocar seria churn sem ganho.

**Ícones** deixaram de ser desenhados por código e viraram arquivos em
`public/icons` (192, 512, maskable) mais `app/apple-icon.png`. O maskable ganha
20% de margem porque o sistema recorta em círculo. A rota `/icons/[variant]`
sobrou só para o `badge` da notificação, que precisa ser silhueta monocromática
em fundo transparente — arte com fundo escuro viraria um quadrado sólido na
barra de status do Android.

**A marca** no app usa duas artes, uma por tema, trocadas por CSS (`dark:`) e
não por JavaScript: decidir no cliente faria a logo piscar na cor errada no
primeiro quadro, que é onde ela mais é olhada.

**Arte do desafio** em `challenge-art` (bucket público — é divulgação e precisa
aparecer para quem não tem conta). Quatro variações subidas; a de blocos entrou
como padrão porque tem exatamente 30 blocos para os 30 dias de setembro. Trocar
é pelo campo "Arte de fundo" em `/admin/desafios`, sem deploy.

> A arte é **fundo, não cartaz**. O nome e a frase são desenhados pelo app em
> cima dela. Texto embutido vira mancha em 360px, não acompanha o tema e não é
> lido por leitor de tela.

**Teste corrigido junto:** o smoke conferia `/icons/512` fixo e deixou passar a
mudança de rota. Agora ele lê o manifest e confere **todos** os ícones
declarados — pega tanto o caminho que mudou quanto o ícone prometido e ausente.

---

## 25/08/2026 · Privacidade que mentia, orçamento de campanhas e o perfil

### A configuração de privacidade não valia para treino nem foto

**O que estava errado.** Existiam dois lugares guardando "quem pode ver", e eles
nunca conversaram: `user_settings.workouts_visibility` (o que a tela escreve) e
`workouts.visibility` (coluna por linha, que nasce privada e era o que a policy
lia). Dava para marcar tudo como público, salvar, e continuar invisível para
todo mundo — sem erro e sem aviso.

É a pior forma de bug de privacidade: **a que mente na direção de quem confiou
na interface.** Alguém achava que tinha compartilhado o progresso com um amigo
e não tinha.

**O que passou a valer.** A policy consulta a configuração **ou** a linha
compartilhada. O `or` preserva a vitrine do perfil, que marca duas fotos como
públicas enquanto o álbum segue privado.

Nada passou a ser exposto por causa disso — só passou a ser exposto o que alguém
tinha pedido para expor. Coberto por `tests/integration/privacidade.test.ts`,
que testa os dois sentidos.

**Textos corrigidos junto:** a dica das fotos dizia *"vale para as fotos novas;
as antigas ficam como estão"*, que era a descrição do bug. E "Todos" agora diz
que alcança quem não tem conta — porque alcança mesmo, e o perfil em
`/u/usuario` é página aberta.

> ⚠ **Lacuna conhecida:** `weight_visibility` continua sem policy própria. A RLS
> é por linha e não separa colunas, então medidas públicas expõem o peso na
> tabela crua. O antes-e-depois do perfil respeita a configuração certa, via
> `peso_da_vitrine()`. Resolver o caso geral pede separar peso de medida em
> tabelas, ou permissão por coluna.

### Orçamento de campanhas

Não existe cota de navegador ou de serviço de push que valha mostrar — as do
Firebase e da Apple são altas demais para alguém alcançar mandando campanha à
mão. O teto em `services/campaign-budget.ts` (1 por dia, 8 por mês) é nosso, e
protege o único erro irreversível aqui: cansar as pessoas até desligarem os
avisos. **Desligar é definitivo — o navegador não pergunta de novo.**

Conferido no servidor, não só desenhado na tela. O botão de teste continua
liberado quando o orçamento acaba: ele vai só para o próprio aparelho.

Campanhas podem ser apagadas do histórico. Some o registro, não a notificação —
o que já chegou ao aparelho de alguém não volta atrás.

### Perfil público

Antes e depois com tabela comparativa (data e peso nas duas pontas, com a
variação), e ícone em cada número. O peso só aparece quando `weight_visibility`
permite, via função dedicada que devolve **apenas** os dois dias da vitrine —
nunca a série.

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
