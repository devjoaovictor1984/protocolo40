# P20X — Diário de mudanças

> Para quando algo quebrar e ninguém lembrar por quê.
> Complementa o `ARQUITETURA.md`, que descreve como o sistema é; aqui está **o que
> mudou, por que, e como desfazer**.

Cada entrada responde três perguntas: o que estava errado, o que passou a valer, e
onde olhar quando voltar a dar problema. Ordem cronológica inversa — o recente em cima.

---

## 28/08/2026 · Meta de peso, e os dados que vão embora com o dono

Duas entregas que respondem à mesma queixa: o app media, calculava e analisava,
e não apontava para lugar nenhum — nem para um destino, nem para fora dele.

### 1. Meta de peso (`services/goals.ts`, `weight_goals`)

A pessoa escolhe o alvo; **quem calcula o prazo é o app**. Não existe campo de
data, e isso é decisão de produto, não simplificação: deixar escolher "8 kg em 4
semanas" e derivar o déficit necessário é receitar dieta perigosa com outro
nome. A previsão sai de ~0,5% do peso por semana em perda e ~0,25% em ganho.

Quatro decisões que não devem ser desfeitas sem discussão:

- **O progresso olha a tendência, nunca a pesagem do dia.** Média móvel de 7
  dias, que abre para 14 e 21 quando não há registro recente. Peso oscila 1 a 2
  kg por água, sal e ciclo menstrual; um app que reage a isso dá notícia falsa
  toda semana e ensina a pessoa a ignorá-lo. Testado em `tests/goals.test.ts`.
- **Quando o ritmo real passa do seguro, a previsão usa o seguro.** Quem está
  perdendo 1,2 kg/semana não pode ler "você chega em seis semanas": essa data só
  se cumpre mantendo um ritmo que custa massa magra. Há teste exatamente para
  isso.
- **`start_kg` é congelado no dia em que a meta nasce.** Se fosse lido do
  histórico, registrar uma medida antiga depois (o app permite — `bm_day_key` é
  por dia, não por ordem de chegada) faria a barra de progresso andar sozinha.
- **O piso mora no banco.** O gatilho `weight_goals_piso` recusa alvo abaixo de
  IMC 17 ("magreza moderada", OMS), lendo a altura do perfil. Entre 17 e 18,5 é
  aviso, não recusa — barrar quem está com IMC 19 e quer 18,7 seria o app dando
  palpite sobre o corpo de alguém. Sem altura no perfil não há piso.

A meta **não** vira notificação, não aparece no perfil e não entra na
comunidade. Vale a regra de `services/notifications.ts`: a notificação nunca
fala de corpo, e "faltam 3 kg" na tela bloqueada quebraria isso duas vezes.

Fechar a meta como alcançada é **botão**, não gravação automática: a conta que
decide isso roda no navegador, e escrever no banco a partir de um cálculo do
cliente é confiar no lugar errado.

### 2. Exportar os dados (`/configuracoes/dados`, `/api/exportar`)

Portabilidade (LGPD, art. 18, V) e o que permite chegar num profissional de
saúde com o histórico na mão. CSV por assunto, JSON para o pacote completo.

- **CSV com `;`, decimal com vírgula e BOM.** É o que faz o Excel em português
  abrir as colunas separadas em vez de despejar tudo na coluna A. Com `,` como
  separador, o mesmo Excel quebraria cada número decimal em duas colunas.
- **Treinos saem em formato longo** — uma linha por exercício, colunas do treino
  repetidas. É o que serve para tabela dinâmica.
- **Síncrono, sem fila.** Milhares de linhas de uma pessoa, não um data
  warehouse. Fila com worker e e-mail transformaria "quero meus dados" em
  "espere um e-mail".
- O escape de campo tem teste próprio (`tests/export.test.ts`): observação de
  treino com `;` dentro desalinharia o arquivo a partir dali, e o erro só
  apareceria na planilha de quem baixou.

> ⚠ **`.select()` do Supabase precisa de string literal inteira.** Concatenar
> com `+` para caber na linha faz o cliente perder a forma da linha, e o
> `typecheck` acusa `Property 'x' does not exist on type 'GenericStringError'`.

> ⚠ **`Button` do projeto não tem `asChild`.** Para botão que navega, use
> `ButtonLink`.

---

## 27/08/2026 · O som que atravessa a navegação

Três relatos, um deles o mais grave da leva:

**1. O som morria ao trocar de tela.** "Está rolando o treino, vou ver algo no
descanso dentro do app, e ele não avisa. Quando volto ao treino o som sai."
Exatamente isso: quem tocava era um hook dentro da tela do cronômetro. Navegar
desmonta a tela, o efeito limpa, o `AudioContext` fecha. O treino nunca parou —
o tempo vem de `startedAt` no IndexedDB — mas o aviso parava, e voltando para a
tela ele ressuscitava, o que deixava o defeito ainda mais confuso de descrever.

Agora quem toca é **`features/timer/components/interval-bell.tsx`**, que não
desenha nada e mora nos dois layouts (`(app)` e `(focus)`), porque layout é o
único lugar que a navegação não desmonta. Ele lê a sessão do IndexedDB a cada
500 ms, calcula o segundo e dispara. `use-intervals.ts` ficou só com o que
depende de estar na tela: liberar o áudio dentro do gesto e calcular a fase para
o anel.

> ⚠ **Trocar de grupo de rotas remonta o layout.** Ir de `/treinar` (`focus`)
> para `/hoje` (`app`) desmonta um layout e monta o outro — logo, remonta o
> sino. Por isso a sessão nasce `undefined` e não `null`: com `null`, o efeito
> "sem treino, fecha o áudio" fecharia o contexto no primeiro quadro depois de
> **cada** navegação, recriando o defeito que ele existe para consertar. A
> diferença entre "ainda não sei" e "não há treino" é o conserto inteiro.

**2. O balão não se movia.** Ele fica por cima do conteúdo, e o canto certo
depende da tela. Agora arrasta, com a posição guardada em `p20x_balao`. Duas
sutilezas: abaixo de 6 px ainda é toque (senão tocar para voltar ao treino
viraria um arrasto de dois pixels), e a posição é presa dentro da janela, senão
girar o aparelho some com ele.

> ⚠ Ler `localStorage` num efeito que chama `setState` é erro de lint aqui
> (`cascading renders`) — e com razão: este componente vive no layout, então
> seria uma renderização extra em toda tela do app. O padrão da casa é
> `useSyncExternalStore`, como em `use-interval-prefs.ts` e `use-install.ts`.

**3. No silencioso não toca, e ninguém avisava.** Não existe API para saber se a
chavinha do iPhone está ligada: o navegador simplesmente não toca, sem erro
nenhum. Quem descobre isso no meio do treino conclui que o recurso está
quebrado. O aviso agora fica à vista na faixa da fase, não escondido na gaveta.

### Sintoma → onde olhar

| Sintoma | Olhar em |
|---|---|
| Som para ao navegar | `features/timer/components/interval-bell.tsx` — está montado nos **dois** layouts? |
| Áudio fecha sozinho depois de navegar | a sessão precisa nascer `undefined`; `encerrar()` só em `sessao === null` |
| Balão volta para o canto | `p20x_balao` no `localStorage`, e `dentroDaTela()` |
| Toque no balão vira arrasto | a folga de 6 px em `aoMover` |
| Sino toca duas vezes | alguém voltou a tocar de dentro de `use-intervals.ts` |

---

## 27/08/2026 · O sino se escolhe antes, e dá para sair do cronômetro

Três relatos de uso, todos certos:

**1. O relógio começava antes de escolher o som.** A escolha ficava dentro do
treino, então entrava no meio de um ciclo já em curso e o primeiro sinal soava
fora de hora. Agora o seletor está na tela de preparo, e **o mesmo toque que
começa o treino libera o áudio** — que é a única janela em que o navegador
aceita liberar.

**2. A escolha não persistia.** Ela era guardada, mas voltava desligada por uma
decisão minha de não fazer barulho sem ninguém pedir. Na prática, quem sempre
treina com 40/20 reescolhia todo dia. Agora volta ligada.

> ⚠ E não funcionava nem guardada: `useState(() => preferencias.ultimo)` captura
> o valor da **primeira** renderização, que no servidor ainda não tem
> `localStorage`. O intervalo chegava sempre nulo. A correção é derivar em vez
> de copiar — o estado guarda "ainda não mexi nisso" (`null`) ou uma escolha
> explícita, e `{ config: null }` é diferente de não ter mexido.

**3. Não dava para sair do cronômetro.** A tela é `(focus)`, sem barra de
navegação — de propósito, porque ali existe uma coisa só a fazer. Mas o único
botão do canto **descartava o treino**, e um "X" no topo à esquerda é lido como
"voltar", não como "apagar o que eu fiz". Agora aquele canto minimiza: volta ao
app com o cronômetro correndo e o balão flutuante à mostra. Descartar foi para o
rodapé, longe do polegar de quem só queria sair.

E a gaveta de escolha passou a fechar sozinha ao escolher — antes ficava aberta
em cima da decisão que a pessoa acabara de tomar.

---

## 27/08/2026 · Água sumindo, e o sino do intervalo

### O painel guardado mostrava números de outro dia

**Relato:** "entrei e a água estava em 1,5 L hoje, mas daí foi para zero."

`/hoje` estava no cache do service worker por **sete dias**. O app podia servir
um painel renderizado dias antes — com a água, a sequência e o dia do protocolo
daquele momento — e depois corrigir quando a página real chegava.

Um painel desatualizado é pior que um aviso de "sem conexão", porque **não avisa
que está errado**. `/hoje` saiu da lista de telas offline; ficaram `/treinar`,
`/treinos` e `/treino/…`, que são conteúdo estável. Sem rede, `/hoje` cai na
tela de offline, que tem botão para o cronômetro — e esse abre do cache.

### O sino do intervalo

**O pedido foi "um sino a cada minuto". O exemplo dado junto era outra coisa** —
corrida estacionária um minuto, descanso um minuto, apita para começar e para
parar. Isso é treino intervalado, e vale muito mais: um sino periódico avisa que
o tempo passou; o intervalado **conduz**. O sino simples continua existindo como
o caso em que o descanso vale zero.

**Som sintetizado, não gravado.** Um oscilador do Web Audio em vez de MP3: zero
bytes num app offline-first, funciona sem rede desde o primeiro segundo,
latência do relógio do áudio em vez do `setTimeout`, e três timbres distintos de
graça. Dois agudos = comece; um grave e longo = pare; três curtos = está
acabando. Distinguir sem olhar é o ponto de existir som.

**O que trava, e como:**

| Obstáculo | Solução |
|---|---|
| Áudio exige gesto do usuário | `liberar()` é chamado de dentro do toque que escolhe o preset |
| Tela apaga e o sistema suspende o app | Wake Lock enquanto o intervalo está ligado |
| Chavinha de silencioso do iPhone corta o áudio | Não há API; a tela e o vídeo avisam |
| App volta do segundo plano com minutos de atraso | Sinais atrasados **não** são reproduzidos — só valem no instante certo |

**Personalizável.** Cinco presets, mais esforço e descanso digitados (5 a 600 s),
três timbres, três volumes e vibração. A escolha fica no aparelho e o último
intervalo volta como atalho no rótulo do botão — mas **desligado**: retomar o som
sozinho seria o app fazendo barulho sem ninguém ter pedido naquele momento.

**A primeira versão do som não servia, e a razão é acústica.** Os bipes tinham
110 ms: abaixo de uns 150 ms o ouvido registra um clique, não um som
identificável — e quem está ofegante no meio de um burpee precisa reconhecer
sem pensar. Toda virada passou a durar mais de meio segundo.

**Campainha não é um oscilador.** Um sino tem parciais *inarmônicos* — as
frequências não são múltiplos inteiros da fundamental, e é isso que separa
"sino" de "bipe". Cada timbre soma vários osciladores nessas proporções, com
ataque de 4 ms e cauda exponencial; os parciais agudos morrem antes, como num
sino real. Um compressor na saída é o que permite "alto" ser alto sem distorcer.

**As marcas no anel.** A primeira tentativa foi uma barra separada abaixo do
relógio, e ela competia com o anel — dois elementos contando a mesma história. A
versão que ficou põe os riscos **no próprio anel**, como as marcas de hora de um
relógio: o mostrador que todo mundo já sabe ler. Traço forte no começo de cada
esforço, fino no começo do descanso, desenhados na cor do fundo para recortar o
anel em vez de somar tinta.

Quando as marcas não cabem, elas se reduzem sozinhas: passando de 60, só o
começo de cada esforço é marcado; passando disso, somem. Um anel cheio de risco
não informa nada.

**Recomeçar** zera o relógio e mantém o treino — exercícios marcados, rounds e
meta continuam. É para quem esqueceu o cronômetro rodando e voltou com um número
que não corresponde a esforço nenhum; apagar tudo e montar de novo seria caro
demais para um engano tão comum.

**O balão flutuante.** O cronômetro sempre sobreviveu a sair da tela — o tempo
vem de `startedAt` no IndexedDB, não de um contador. O que faltava era aparecer:
quem saía para ver o histórico não tinha sinal de que o relógio seguia, e o
caminho de volta era procurar o botão de treinar como se fosse começar de novo.
O balão lê direto do IndexedDB, sem montar o cronômetro inteiro em cada página, e
some na própria tela do treino.

Demonstração em `/admin/intervalos`: roda acelerado (até 8×), desenha a linha do
tempo com todos os sinais antes de eles tocarem, permite tocar cada som separado
e tem os mesmos ajustes de timbre e volume do app. Existe para gravar vídeo sem
esperar dois minutos de nada.

---

## 26/08/2026 · O descanso não segurava a sequência onde importa

**O que estava errado.** `get_user_stats`, no banco, sempre uniu treino e
descanso na corrente. O cálculo do cliente — `calculateStreak` — só olhava
treino. Resultado: a tela de Hoje e a de Evolução quebravam a sequência de quem
tinha registrado descanso, enquanto o perfil público a mostrava inteira. Duas
telas, dois números, e o errado era o que a pessoa mais olha.

Pior: era exatamente o oposto do que o recurso promete.

**O que passou a valer.** `calculateStreak(dias, hoje, descansos)` espelha o
banco: o descanso entra como elo da corrente e **não** conta como dia treinado.
`totalDays` responde "quanto você treinou"; a sequência responde "há quanto
tempo você não abandona isso", e um descanso deliberado não é abandono.

**As regras, em um lugar só:**

| | |
|---|---|
| Descanso quebra a sequência? | Não — conta como elo |
| Quantos posso ter? | Um por semana (7 dias em volta do dia escolhido) |
| Vale num dia em que treinei? | Não, e a função recusa: `ja_treinou` |
| Conta como dia treinado? | Não |
| **Conta no desafio?** | **Não** — desafio conta só treino concluído |

A última linha é a que mais surpreende: descansar mantém a sequência e a
insígnia de constância, mas o dia não entra na meta do Desafio de Setembro. Foi
por isso que a meta virou 25 de 30, e não 30 de 30.

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
