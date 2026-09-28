# P20X — Diário de mudanças

> Para quando algo quebrar e ninguém lembrar por quê.
> Complementa o `ARQUITETURA.md`, que descreve como o sistema é; aqui está **o que
> mudou, por que, e como desfazer**.

Cada entrada responde três perguntas: o que estava errado, o que passou a valer, e
onde olhar quando voltar a dar problema. Ordem cronológica inversa — o recente em cima.

---

## 27/09/2026 · O mascote mostra como se faz o exercício

O pedido: no cartão do treino, ao lado de cada exercício, uma miniatura do
mascote fazendo o movimento em loop; tocando, uma janela maior. A arte chega aos
poucos, exercício por exercício, e o lugar dela já fica reservado.

- **Um WebP animado, não JavaScript trocando quadros.** O navegador toca sozinho
  e para de decodificar fora da tela. `sharp` (que já vem com o Next) monta o
  arquivo: nenhuma dependência nova.
- **Três arquivos por exercício**, em `public/exercises/<slug>/`: `thumb.webp`
  (224px, ~15 KB, a lista), `demo.webp` (720px, ~85 KB, só baixa ao abrir a
  janela) e `still.webp` (quadro parado, para quem ligou "reduzir movimento" —
  trocado por `<picture>`, sem JS). Um arquivo só obrigaria cada cartão a baixar
  os 85 KB da versão grande.
- **A chave é o slug**, registrado em `features/exercises/demos.ts`, e não uma
  coluna: o catálogo vive em cache no IndexedDB, e um caminho gravado ali
  envelheceria com ele. `exercises.illustration_path` (bucket, pelo admin)
  continua existindo e sem uso na tela.
- **Fora do precache.** O Serwist precacheia `public/**` inteiro; sem o
  `globIgnores`, instalar o app baixaria a arte de todos os exercícios. Assim,
  cada arquivo entra no `p20x-assets` quando aparece e funciona offline depois.
- **Lugar reservado** para todo exercício com slug (os do sistema), com ou sem
  arte: o cartão não muda de altura quando a arte chega. Exercício próprio não
  tem slug e fica compacto.
- `scripts/demo-exercicio.mjs` alinha os quadros pelos apoios no chão (pés e
  mãos) e reescala até 10%: a arte gerada por IA põe o mascote em lugar e
  tamanho diferentes a cada quadro, e sem isso ele "pula" e as mãos escorregam.
- `DialogContent` ganhou `overlayClassName` (a janela da demonstração escurece
  o fundo; as outras seguem iguais).

Onde aparece: cartão do treino (`template-list.tsx`) e a lista "o que vai ser
feito" antes de iniciar o cronômetro (`timer-screen.tsx`). A lista de marcar
durante o treino ficou de fora: cada linha é um botão, e botão dentro de botão
não é HTML válido.

Testes: `tests/exercise-demos.test.ts` (registro sem arquivo, precache) e
`e2e/demonstracao.spec.ts` (a grande só baixa ao tocar; fecha no X, fora e ESC;
foco volta à miniatura; reduzir movimento mostra o quadro parado).

---

## 27/09/2026 · A Trilha do Iniciante vira o programa de 30 dias do novato

O pedido: um programa para quem entra no app pela primeira vez. 30 dias, seis
treinos e um descanso por semana, em casa, leve ("10 polichinelos, descanso, 5
agachamentos, descanso, 3 flexões"), subindo aos poucos, oferecido a todo
novato e recusável, com uma medalha de Disciplina no fim.

Isso já existia pela metade: a Trilha do Iniciante (28 sessões de AMRAP de 20
minutos, sem descanso). Não fiz um segundo programa ao lado, porque dois
programas de iniciante recriariam o problema que a trilha resolveu. A trilha
virou o que foi pedido.

### O treino guiado (`method = 'guiado'`)

- `workout_templates` ganhou `rounds`, `rest_seconds` e `round_rest_seconds`.
- `services/guided.ts`: a sequência (exercício → descanso → próximo, pelas
  voltas) e o tempo, **calculado a partir dos segundos decorridos do treino**. A
  pausa congela o descanso sem código a mais, e o telefone no bolso volta no
  ponto certo.
- `GuidedPlayer`: um passo por tela, número grande, botão grande. O descanso
  acaba sozinho e chama o próximo com o som do sino (liberado no toque de
  "Começar"). Prancha e corrida parada contam sozinhas depois de "Começar";
  repetição espera "Feito". Também tem "+15 s", "Pular descanso" e "Voltar um
  passo". O passo mora em `ActiveSession.guia`, no IndexedDB, e sobrevive a
  fechar o app.
- Guiado concluído até o fim salva sem a pergunta "rodou só X segundos?": ali o
  treino curto é o treino, não o engano.
- Guiado sem exercícios cai no cronômetro comum. Um e2e mostrou o player
  declarando "Treino completo" no segundo zero com um template vazio.

### O programa (migrations `20260927140000` a `…140200`)

- 30 dias, com descanso nos dias 7, 14, 21 e 28. Três padrões se alternam:
  Força (polichinelo, agachamento, flexão, prancha), Abdômen (corrida parada,
  supra, infra, elevação de pernas) e Corpo todo (os cinco misturados).
- Começa em 10 · 5 · 3 · 15 s com 3 voltas (~10 min) e sobe por semana e na
  segunda metade de cada semana. Nunca passa de ~19 min: o Corpo todo fica em
  3 voltas porque, com 4, passava de 20. A flexão fica com joelho apoiado;
  a prancha sai do joelho na semana 3.
- **Formatura (dia 30) é o treino do dia 1 com cinco voltas.** A diferença de
  fôlego é a medida honesta do mês.
- A progressão foi gerada por script e está escrita por extenso na migration.
- **O descanso registrado conta como dia da trilha** (`meus_dias_na_trilha`,
  `concluir_trilha`). O `AGENTS.md` foi atualizado.
- Medalha **Disciplina** (prata; emblema `disciplina`, um calendário com seis
  dias marcados). A antiga "Via Ápia", que ninguém tinha, foi removida.
- **Ordem de publicação:** a estrutura (`…140100`) vai antes do deploy, porque é
  compatível com o código velho. O programa (`…140200`) vai depois, porque o
  código velho não sabe o que é sessão de descanso nem treino guiado.

### O convite do novato

- `ConviteDoNovato`, no topo do Hoje, para quem não está em trilha, não recusou
  e tem menos de 3 treinos. "Agora não" grava `profiles.track_offer_declined_at`
  e vale em qualquer aparelho. Quem recusou volta a ver a faixa discreta de
  sempre, e a trilha segue em /trilha.
- A última tela do cadastro oferece a trilha primeiro, o treino livre em
  segundo e "conhecer o app" em terceiro.
- No Hoje, o dia de descanso da trilha tem cartão próprio, com "REGISTRAR MEU
  DESCANSO" como botão principal e "prefiro treinar — também conta".

**Onde olhar:** `services/guided.ts`, `features/timer/components/guided-player.tsx`,
`features/tracks/components/novato-offer.tsx`, `e2e/trilha-novato.spec.ts`.

## 27/09/2026 · Outubro sumiu do Hoje: o açúcar tinha virado treino

Relato: "o de açúcar apareceu no Hoje, o de outubro não". No banco, o
"21 dias sem açúcar" estava como `kind = 'treino'` e sem medalha, salvo pelo
painel às 21:22 (a meta 21 foi mudança de propósito; o resto não). Como "treino"
de data pessoal começando em 28/09, ele ganhava de outubro (01/10) a única vaga
de convite de treino.

A causa foi o `salvarDesafio`: `kind` tinha `.default('treino')`, e `tagline`,
`badge_slug` e `image_path` viravam `null` quando ausentes. Um formulário que
não mandasse o campo, como uma tela desatualizada, gravava "treino" e "sem
medalha" por cima do banco.

- Campo **ausente** agora não mexe no que está gravado; campo **vazio** (a
  opção "Nenhuma") continua limpando.
- Trocar o tipo de um desafio que já tem participantes é recusado, com a
  explicação na tela: isso mudaria a contagem de todo mundo, então vira desafio
  novo.
- O banco foi corrigido à mão: `alimentacao` e `sem-acucar`, com a meta 21 que o
  admin escolheu.

## 27/09/2026 · "0 de 21", e a medalha do açúcar ganha desenho próprio

"Por que aparece 1 de 18? Seria 0 de 21." O placar dividia pela **meta** (18,
com três dias de folga), e quem entra nos "21 dias sem açúcar" lê o número de
baixo como o tamanho do desafio.

- `placarDoDesafio` (`services/challenges.ts`): com `duration_days`, o placar e a
  barra contam da duração ("0 de 21"). A meta da medalha é dita à parte ("A
  medalha sai com 18 dias vencidos — 3 podem escapar"), e o recado de comida
  diz "faltam X **para a medalha**". O desafio do mês segue contando pela meta.
- A página do desafio mostra **a medalha de quem vencer**: cinza até ser
  conquistada, dourada depois, com quantos dias ela pede.
- Emblema novo, `sem-acucar`: um cubo de açúcar riscado. O risco leva antes um
  contorno da cor do fundo, para cortar o cubo em vez de passar por cima dele.
  Migration `20260927130000_medalha_sem_acucar.sql`: troca o emblema e tira o
  "dezoito em vinte e um" da descrição, porque a meta é editável no painel e o
  número escrito ali ficaria mentindo.

**Ordem de publicação:** esta migration vai **depois** do deploy. Aplicada
antes, a produção não conhece o emblema `sem-acucar` e mostra o genérico.

## 27/09/2026 · Editar um desafio dava "Esta página não existe"

A lista do admin não tinha edição. O nome do desafio levava para a página
pública, e ela só abre desafio ligado. O "21 dias sem açúcar", desligado
esperando revisão, dava 404. O `ChallengeForm` já sabia editar, mas nenhuma tela
o abria com um desafio existente.

Agora existe `/admin/desafios/[id]`: lida pelo id, porque o slug é editável, e
permitida pela policy de admin mesmo com o desafio desligado. O nome na lista e
o botão "Editar" levam para lá. O `salvarDesafio` revalida com `'layout'` para
levar a tela de edição junto. Salvar não liga o desafio: o checkbox parte do
estado atual.

## 27/09/2026 · O PWA velho não conseguia entrar no desafio

Relato: "não consigo me inscrever no desafio de outubro". No banco a inscrição
funcionava, e no e2e contra produção também. O que falhava era **o app aberto
no celular**.

Cada deploy gera identificadores novos para as Server Actions. O PWA fica dias
na memória com o JavaScript do build anterior, e o botão "ENTRAR NO DESAFIO"
chamava uma ação que o servidor já não conhecia. O servidor respondia
`404 Server action not found` (header `x-nextjs-action-not-found: 1`), e na tela
não acontecia nada. Houve dois deploys no mesmo dia, e ninguém conseguiu entrar
em outubro.

- `lib/versao.ts` + `/api/versao`: a versão do deploy (`VERCEL_DEPLOYMENT_ID`,
  com o commit como reserva) é embutida no build pelo `next.config.ts`, no
  servidor e no cliente. `AtualizarVersao` confere ao voltar para o app e a cada
  10 minutos; se a versão mudou, recarrega. **Nunca em `/treinar`**, e nunca sem
  rede.
- `app/error.tsx`: se mesmo assim um botão velho for tocado
  (`unstable_isUnrecognizedActionError`), recarrega uma vez em vez de falhar calado.

**Por que não o `deploymentId` do Next:** ele põe `?dpl=` em todo JS. O
precache do service worker guarda os arquivos sem isso, e o treino offline
passaria a procurar no cache um endereço que não está lá. A *Skew Protection*
da Vercel também resolve, mas depende de configuração no painel e de plano.

### A barra de baixo "soltava" no PWA

`overscroll-behavior-y: none` em `html, body`: o elástico do fim da rolagem no
iPhone puxava a página inteira, inclusive a barra fixa. A barra também ganhou
`translateZ(0)`, porque no WebKit elemento fixo com `backdrop-blur` atrasa na
rolagem com inércia. O menu do "+" abre num portal, então o transform não o
afeta.

## 27/09/2026 · No desafio de açúcar, cada um escolhe quando começa

O desafio do mês é um evento, com a mesma data para todo mundo. O de açúcar é
uma decisão, e quem decide parar numa quinta não deveria esperar o dia 3 do mês
seguinte.

Migration `20260927110000_desafio_de_data_pessoal.sql`:

- **`challenges.duration_days`.** Nulo, o desafio tem janela única, como
  sempre. Preenchido, cada participante tem a própria janela, de `started_on`
  até `started_on + duration_days - 1`. Nesse caso as datas do desafio passam a
  dizer **quando dá para começar** (o de açúcar vai de 27/09/2026 a 2099).
- **`challenge_participants.started_on`** é conferido pelo trigger
  `conferir_inicio_no_desafio`: hoje até 30 dias à frente, no fuso da pessoa, e
  dentro do período do desafio. Nos desafios de janela única o trigger zera o
  campo.
- **`janela_no_desafio(desafio, usuário)`** é a fonte única da janela.
  `dias_cumpridos` e `marcar_dia_no_desafio` perguntam a ela.
- **Só conta marcação feita depois de entrar** (`created_at >= joined_at`). Sair
  e voltar é recomeçar.

No app, `janelaDoDesafio` e `datasParaComecar` (`services/challenges.ts`) são as
mesmas regras em TypeScript. O botão vira "COMEÇAR MEUS 21 DIAS", com a data já
em hoje. No Hoje, quem não começou vê o convite "Comece quando quiser"; quem
começou vê o próprio "Dia X de 21".

O ranking continua ordenado por dias vencidos, com pessoas em pontos diferentes
dos seus 21 dias. É aceitável enquanto a lista for pequena; se crescer, vale
mostrar o "dia X" de cada um.

## 27/09/2026 · Desafio de alimentação, e o próximo desafio aparece antes de começar

### Outubro estava criado e ninguém via

O `outubro-2026` já existia e estava ligado, mas a tela de Hoje mostrava **um**
desafio: o em curso ganhava do que ia começar. Então outubro só aparecia no dia
1º, justamente quando a pessoa já deveria estar dentro.

Agora `desafiosDoHoje` (`services/challenges.ts`) devolve, **por tipo**, o desafio
em curso e o próximo a começar, marcado como convite. O convite diz
"Começa 01/10" e "Ver o desafio e garantir a vaga". Quem já entrou num desafio
que ainda não começou lê "Você já está dentro". Antes, lia "Entre agora", que
era o recado de quem não tinha entrado.

### Desafio de alimentação: a pessoa marca o dia

Migration `20260927100000_desafio_de_alimentacao.sql`:

- `challenges.kind` (`treino` | `alimentacao`) diz de onde sai o dia cumprido.
  Janela, meta, folga, ranking e insígnia são os mesmos.
- `challenge_checkins` guarda só o dia **vencido**. Não existe "falhei": quem
  escorrega não marca e segue, e nada zera.
- `marcar_dia_no_desafio(slug, dia, feito)` é o único caminho de escrita (a
  tabela só tem SELECT do dono). Aceita **só hoje ou ontem**, no fuso da pessoa,
  e devolve um código; `erroDaMarcacao` transforma o código em frase.
- `dias_cumpridos(desafio, usuário)` virou a fonte única da contagem. Ranking,
  meus dias e conclusão perguntam a ela. Antes a mesma consulta de treino estava
  copiada em quatro funções.
- `meus_dias_no_desafio` e `meus_dias_nos_desafios` passaram a ser DEFINER
  (chamam `dias_cumpridos`) e usam `auth.uid()` por dentro. Os `revoke ... from
  public, anon, authenticated` foram refeitos no mesmo arquivo.
- Seed: **21 dias sem açúcar**, 03 a 23/11, meta 18 de 21, insígnia `sem-acucar`
  (ouro, `muralha`). O desafio nasce **desligado**, e quem publica é o admin.

A marcação não entra na fila offline, pelo mesmo motivo do descanso: é uma linha
por dia, e o "ontem" cobre quem ficou sem rede. Na tela, o toque aparece na hora
(`useOptimistic`). Se o banco recusar, o estado volta e aparece a frase.

O recado de comida nunca diz "hoje não pode faltar". Pressão sobre comida vira
culpa, e culpa derruba desafio.

### O cartão deixou de ser um link por fora

Botão dentro de `<a>` é HTML inválido, e o toque em "Venci hoje" navegava junto.
Agora o cartão é um `<article aria-label={título}>` e o link é o título, esticado
sobre o cartão (`after:inset-0`). O botão fica por cima com `z-10`. Os e2e passaram
a achar o cartão por `getByRole('article', { name })`.

**Onde olhar:** `features/challenges/components/marcacao.tsx` (botões e linha do
tempo), `tests/challenges.test.ts` (regras) e o e2e "no desafio de alimentação,
a pessoa marca o dia vencido".

---

## 07/09/2026 · O smoke conferia um app que não existe mais

Rodado contra o deploy de produção depois da trilha: 19 de 22. Nenhuma das três
falhas era regressão — eram expectativas que envelheceram e ninguém releu.

- **"dashboard mostra a navegação"** exigia o rótulo `Histórico`. A tela foi
  dobrada no calendário há semanas; o rótulo não existe. Agora exige
  `Calendário` e `Evolução`.
- **`/historico` respondia 308**, e o script pedia 200. O 308 é de propósito
  (`permanentRedirect` para `/calendario`, por causa de favorito e atalho de
  PWA). Virou verificação do redirect, com destino conferido — o endereço
  antigo continua tendo que levar a algum lugar.
- **"perfil privado dá 404 para estranhos" era uma frase, não um teste.** Ele
  media o perfil recém-criado, e o perfil nasce **público** desde 26/08. Ou
  seja: passou verde por dez dias sem nunca ter aberto um perfil privado, e
  continuaria verde se a policy caísse. Agora o script fecha o perfil, confere o
  404, reabre e confere o 200 — que é a configuração que precisa de prova.

Teste que afirma o padrão em vez da exceção não segura nada: ele falha quando o
padrão muda e cala quando a regra quebra, que é exatamente ao contrário.

`/trilha` e `/desafios` entraram na lista de telas verificadas. 24/24 contra
produção.

---

## 07/09/2026 · A meta dizia que faltava menos do que falta

Relato real: partida 95,9 kg, alvo 85, tendência de hoje em 96,3 — e o cartão
dizia **"Faltam 10,9 kg"**. De 96,3 para 85 são 11,3. O número que a pessoa via
era o do plano na largada (`total - percorrido`), não a distância entre onde ela
está e onde quer chegar.

O erro tem uma direção só, e é a pior possível: ele mente **para menos**
exatamente para quem subiu de peso desde que criou a meta. Quem andou para trás
abre o app e recebe a notícia de que está mais perto — e quando a balança
insistir, a conta terá que se corrigir sozinha, que é como um app perde a
confiança de quem o consulta.

Agora `restanteKg` é `|tendência − alvo|` em `services/goals.ts`: sai de onde a
pessoa está hoje, sempre. O caso está em `tests/goals.test.ts` com os números do
relato.

### "0,0 kg percorridos" era duas frases diferentes

`percorridoKg` nunca é negativo — andar para o lado errado deixa a barra em zero,
e isso continua certo, porque barra que anda para trás não significa nada. Mas o
texto ao lado dela usava o mesmo número, então **quem não saiu do lugar e quem
subiu 400 g liam a mesma coisa**, e a segunda pessoa via um cartão que parecia
quebrado.

Entrou `movimentoKg`, que é o mesmo deslocamento **com sinal**: positivo é na
direção do alvo, negativo é contra. A barra continua com `percorridoKg`; só o
texto usa o sinal, em `desdeAPartida()`:

- `0,4 kg percorridos` — andou;
- `no mesmo ponto` — não andou;
- `0,4 kg acima da partida` — andou para trás (`abaixo`, quando a meta é ganhar).

Sem adjetivo e sem juízo: subir de peso numa semana é água e sal, e o app não
comenta corpo. E quando o alvo é alcançado, o lado direito passa a dizer
`alvo alcançado` em vez de "Faltam 0,0 kg", que é a frase que faz a pessoa achar
que o app não percebeu.

Tudo continua saindo da média móvel de 7 dias — a balança do dia nunca aparece
nessas contas.

---

## 06/09/2026 · A Trilha do Iniciante em Casa

O app tinha quinze treinos e nenhuma ordem entre eles. Quem chega sem nunca ter
treinado abre `/treinos`, vê quinze cartões igualmente plausíveis e faz o que
todo mundo faz diante de quinze opções: escolhe o primeiro, repete até enjoar,
ou fecha o app. A biblioteca responde "o que eu faço hoje?"; ela não respondia
"o que eu faço nas próximas quatro semanas?".

A trilha é essa segunda resposta: **28 sessões numeradas, quatro semanas, sem
equipamento**, cada uma com a frase que explica por que ela está ali. Migrations
`20260906090000_metrica_trilha` e `20260906100000_trilha_do_iniciante`.

### A decisão que define tudo: a trilha anda com dias treinados

Não com o calendário. Quem entra na segunda e treina na sexta está na **sessão
2** na sexta, não na sessão 5. Um programa que anda sozinho enquanto a pessoa
não treina só serve para informar a ela o tamanho do atraso, e essa informação
nunca fez ninguém voltar — e quem falta na terça da semana 1 é exatamente a
pessoa para quem a trilha foi feita.

A conta é `progressoNaTrilha` em `services/tracks.ts`: pura, testada, e o "hoje"
é sempre argumento. `feitas = dias distintos com treino entre a matrícula e
hoje`, limitado ao total de sessões.

### O progresso é contado, não gravado

Como nos desafios. Não existe coluna "sessões feitas": o número sai de
`workouts`, pela função `meus_dias_na_trilha(slug)`. Apagar um treino corrige a
trilha sozinho, e não há caminho para escrever um progresso que não aconteceu.

Isso também é o que faz a contagem funcionar offline sem caminho de escrita
novo: `features/tracks/use-meus-dias.ts` soma o que ainda não subiu, com a mesma
regra do desafio (`diasComOAparelho`, em `services/challenges`) — importada de
lá de propósito, porque duplicá-la criaria uma segunda fonte de verdade para "o
que o aparelho corrige", que é justamente o defeito que ela conserta.

### Qualquer treino conta

Se a sessão do dia é "Ritmo 2" e a pessoa fez um treino livre, a trilha avança.
A ordem é sugestão de quem entende de treino, não portaria: o que a trilha cobra
é o dia, e o dia foi cumprido. É também o que impede a trilha de discordar da
sequência e do painel na mesma tela.

Consequência aceita: quem treinar 28 dias sem seguir a ordem fecha a trilha e
ganha a insígnia. Tudo bem — a promessa dela é "28 dias e você não é mais
iniciante", e quem treinou 28 dias não é.

### A trilha é privada

`track_enrollments` só é visível para o dono, sem exceção. Desafio tem ranking
porque é competição declarada; trilha é aula particular — e "em que sessão você
está" é, na prática, "há quanto tempo você treina", que é dado de corpo por
outro nome. Coberto em `tests/integration/rls.test.ts`.

### Sair apaga o ponto de partida, e isso é de propósito

`started_on` é o que separa "treino que conta" de "treino que já tinha
acontecido". Guardar a matrícula antiga faria alguém voltar direto para a sessão
20 sem ter feito as dezenove. Os treinos ficam todos no histórico; só a
contagem recomeça. A tela diz isso **antes** do clique.

### `program_only`: circuito de programa não aparece na biblioteca

A trilha trouxe onze circuitos novos. Jogados em `/treinos`, dobrariam a lista
com coisas que só fazem sentido dentro de uma sequência — "Fundação A+", sem o
"A" antes, não é um treino, é um pedaço.

A coluna nova é `workout_templates.program_only`. O catálogo offline continua
trazendo **todos** (o cronômetro precisa abrir a sessão pela trilha, inclusive
sem rede); quem filtra é `TemplateList`. Se um dia a sessão da trilha abrir em
branco offline, é aqui que o filtro escapou para o lugar errado.

### O conteúdo, e por que ele é assim

- **Quatro exercícios novos** — flexão na parede, agachamento na cadeira,
  prancha nos joelhos e bom dia. A biblioteca começava na flexão de joelhos, que
  para quem nunca treinou já é o segundo degrau; sem o primeiro, a sessão 1 vira
  "faça o que você ainda não consegue", e o dia 1 é o dia em que ninguém volta
  depois de falhar.
- **Semanas 1 e 2 usam circuitos de trilha; 3 e 4 usam a biblioteca do app.** A
  trilha não termina num beco: ela desemboca onde a pessoa vai treinar depois.
  No dia 15 ela descobre que o "P20X Start" que a assustava virou treino normal.
- **O mesmo circuito de referência nos dias 6, 13, 20 e 28.** É a única medida
  honesta de progresso que quatro semanas oferecem: mesmo treino, mesmo tempo,
  número de rounds diferente. Peso não serve (oscila com água e sal, e a trilha
  não fala de corpo) e "sensação" não se compara.
- **Nenhum dia em branco.** O método é "todos os dias"; o que varia é a
  intensidade — daí um dia de mobilidade e um de recuperação ativa por semana,
  em vez de dois dias parados. Quem para dois dias por semana no primeiro mês
  costuma parar de vez.

### Insígnia

`via-apia` — Via Ápia, métrica `trilha`, emblema `caminho` (novo desenho em
`emblem.tsx`: a estrada de pedra que se estreita ao longe, não um troféu — o que
a trilha constrói é o caminho, não a chegada). Cai sozinha ao abrir a tela, por
`concluir_trilha()`, que é idempotente.

A métrica precisou de migration própria: valor novo de enum não pode ser usado
na mesma transação em que é criado.

### Onde isso aparece

- `/trilha` — Server Component; só a barra e o mapa são ilha de cliente, porque
  só eles dependem do treino que ainda não subiu. Quem abre pela primeira vez
  está decidindo se começa, e essa decisão não precisa de JavaScript.
- `/hoje` — para quem está na trilha, o cartão do dia deixa de ser "COMEÇAR
  TREINO" e passa a ser "INICIAR SESSÃO 6", com o motivo dela. Depois do treino
  vira uma faixa fina com o que vem a seguir. Quem não está vê o convite
  enquanto tiver menos de dez treinos.
- Barra lateral e menu do `+`. **Não** na barra de baixo: seis é o limite dela, e
  um sétimo destino obrigaria a tirar um dos que estão lá.

---

## 01/09/2026 · Dois defeitos no primeiro dia do Desafio de Setembro

Varredura do caminho inteiro antes de alguém treinar, contra o banco real: a
inscrição, a contagem dos dias, o ranking, a conclusão e a insígnia. Dois
defeitos — um que dizia à pessoa que ela não estava inscrita, e outro que dizia
que o treino dela não contou.

### Entrar duas vezes voltava erro de RLS

`entrarNoDesafio` gravava com `upsert(..., { onConflict })`, com o comentário de
que "entrar duas vezes não é erro: a chave primária resolve". Não resolvia. O
`upsert` do PostgREST é `insert ... on conflict do update`, e o Postgres, no
caminho do conflito, passa a exigir a **policy de UPDATE** da tabela. A de
`challenge_participants` é `conclusao admin`, que existe justamente para que
ninguém marque a própria conclusão — então o segundo toque voltava:

```
42501  new row violates row-level security policy (USING expression)
       for table "challenge_participants"
```

E a tela dizia "Não conseguimos te inscrever agora" para quem já estava
inscrito. Acontecia com toque duplo, com aba antiga aberta e com quem entrou
por outro aparelho.

Agora é `ignoreDuplicates: true` — `on conflict do nothing`, que só consulta a
policy de INSERT e deixa `joined_at` e `completed_at` de quem já entrou
intactos. Nenhuma policy mudou: abrir UPDATE para o dono da linha seria
devolver a ele a chave de `completed_at`.

Segurado em dois níveis: `tests/integration/rls.test.ts` → "entrar duas vezes no
desafio não é erro", que roda contra o banco de verdade porque o defeito só
existe lá, e `e2e/desafios.spec.ts` → "entrar de novo não acusa erro para quem
já está inscrito", com duas abas abertas, que é o que reproduz toque duplo, aba
velha e inscrição feita em outro aparelho.

### O que foi conferido e está de pé

Contra o projeto real, com usuário novo e treino gravado pelo caminho do app:

- treino de hoje entra em `meus_dias_no_desafio`, em `meus_dias_nos_desafios` e
  no `ranking_do_desafio` na mesma hora — não há número guardado para ficar
  errado;
- `concluir_desafio` devolve `false` com 1 de 25 e não entrega insígnia adiantada;
- `conceder_conquistas` **não** concede as de métrica `desafio`: o `case` não tem
  `when 'desafio'` nem `else`, então o `where` recebe `null` e a linha fica de
  fora. O mesmo vale para o `delete`. É por isso que o `threshold = 0` das doze
  insígnias de mês é inofensivo;
- `finished_at` é gravado nos três caminhos que criam treino (cronômetro,
  formulário e "registrar dias"), e as funções do desafio exigem ele;
- o dia é `todayIn(profile.timezone)`, com queda para `America/Sao_Paulo` quando
  o fuso do perfil é inválido.

### O treino que ainda não subiu não contava no desafio

Mesma tela, duas respostas para a mesma pergunta. O painel de Hoje lê o
IndexedDB e dizia "Dia 1 está feito"; o cartão do desafio é renderizado no
servidor, a contagem sai dos treinos que já subiram, e ele dizia "hoje ainda
está em aberto" logo abaixo. Online o intervalo é de segundos. Sem rede, dura o
que durar — e o desafio é justamente o que a pessoa abre para conferir se o dia
contou.

O servidor continua sendo a base — a contagem sai dos treinos, e não de uma
coluna que pode ficar errada. O aparelho entra como **correção**:

- o que existe aqui e ainda não subiu **entra**;
- o que foi apagado aqui e a exclusão ainda não subiu **sai** — só se nenhum
  outro treino sustentar o dia, porque dois treinos num dia contam como um.

A ordem importa, e é a parte fácil de errar: soma antes, subtrai depois.
Invertida, um dia apagado e treinado de novo sumiria da tela.

A regra é pura, mora em `services/challenges.ts` → `diasComOAparelho`, e está
testada com os cinco casos, inclusive o dos dois treinos no mesmo dia.

**O que mudou de lugar.** O cálculo de "quantos dias EU cumpri" virou ilha de
cliente em `features/challenges/components/meu-progresso.tsx`
(`ProgressoResumido` no cartão, `ProgressoDetalhado` na tela do desafio, com a
grade do mês e a `Barra`). O `useMeusDias` lê o IndexedDB por
`localWorkoutDays`, que exige `finished_at` pelo mesmo motivo que as funções do
banco exigem: treino em andamento não é dia cumprido nem aqui nem lá.

O resto continua RSC. `ChallengeCard` e `ChallengeDetail` seguem no servidor e
só calculam o que depende do calendário — a fase e o "Dia 3 de 30", que são
iguais para todo mundo. Ranking, história e arte nunca dependeram deste
aparelho.

> O primeiro render devolve exatamente o que veio do servidor: a consulta local
> ainda não respondeu. É de propósito — é o que o HTML do servidor tem, e é o
> que a hidratação espera encontrar.

Segurado por `e2e/desafios.spec.ts` → "o treino que a fila não subiu já conta no
desafio", que corta a escrita de `/rest/v1/workouts` no navegador, faz um treino
de verdade pelo cronômetro, confere que o servidor está mesmo com zero e exige
que o desafio conte o dia assim mesmo. Verificado que ele falha sem a correção,
com "0 de 3 dias" — teste que passa dos dois jeitos não segura nada.

---

## 29/08/2026 · Não dava para subir a arte do desafio, e só existia uma insígnia

Dois relatos da administração, e o primeiro é o pior tipo de defeito: o que faz
a pessoa achar que a funcionalidade não existe.

### 1. A arte só aceitava o nome do arquivo

O formulário do desafio tinha um campo `image_path` de **texto**. Para pôr arte,
era preciso subir o arquivo pelo painel do Supabase e voltar para digitar o nome
sem errar uma letra. Quem não sabia disso simplesmente não conseguia — e o
bucket `challenge-art` já tinha quatro arquivos subidos à mão, o que mostra o
tamanho do contorno que estava sendo feito.

Agora é `features/challenges/components/art-upload.tsx`: escolhe o arquivo,
sobe, mostra a prévia em 16:9. O envio vai **direto do navegador para o
bucket**, não por Server Action — imagem de fundo tem megabytes e o limite de
corpo de uma action é bem menor. A policy de escrita do bucket já exigia
`eh_admin()`, então a autorização não mudou de lugar.

O nome do arquivo é um carimbo de tempo (`169…​.webp`): o bucket é público e
servido com cache, e reaproveitar o nome deixaria a arte nova escondida atrás
da antiga.

> O caminho fica num input escondido e quem grava a coluna continua sendo o
> `salvarDesafio`. Enviar a imagem e desistir do desafio não deixa linha meio
> preenchida no banco — só um arquivo órfão no bucket, que é barato.

### 2. Insígnia só de setembro

Existia uma: `setembro`, criada junto com o primeiro desafio. Ou seja, criar o
desafio de outubro exigia uma migration — e um deploy — só para existir a
insígnia que ele entrega. Decisão de comunicação virando tarefa de programador,
exatamente o que a coluna `image_path` tinha sido criada para evitar.

Os doze meses entraram no catálogo (`0044`). Três decisões:

- **O slug não leva o ano.** A insígnia de Março é a mesma em 2026 e 2027, e
  `user_badges` tem chave `(user_id, badge_slug)` justamente para que repetir o
  mês no ano seguinte não dê insígnia nova.
- **Todas douradas.** Ouro é o que é difícil e datado, e um mês fechado é as
  duas coisas. Graduar por tier inventaria uma hierarquia entre janeiro e julho
  que não existe.
- **O emblema é o numeral romano do mês**, dentro do louro
  (`MESES_DESENHADOS` em `emblem.tsx`). Reaproveitar doze desenhos que já
  significam outra coisa embaralharia o catálogo: a pessoa veria a tocha e não
  saberia se é a de sequência ou a de março.

`setembro` foi realinhada para `mes-9` **com uma guarda**: o `update` só roda
se ninguém tiver a insígnia ainda. Depois que a primeira pessoa ganha, mudar o
desenho é mexer no que já é dela.

> ⚠ **`badges.threshold` é decorativo nas de métrica `desafio`.** Quem decide se
> a insígnia cai é `concluir_desafio()`, comparando os dias treinados com
> `challenges.goal`. O `threshold` de 25 que estava em `setembro` nunca foi lido.

### 3. Escolher o mês em vez de digitar seis campos

`esbocoDoMes(ano, mes)` em `services/challenges.ts` devolve nome, endereço, as
duas datas, a meta e a insígnia. A meta é o mês inteiro **menos cinco dias** — a
mesma margem do Desafio de Setembro, pela mesma razão: desafio sem folga quebra
na primeira gripe e a pessoa abandona o mês.

O formulário virou controlado para isso — o seletor precisa escrever em seis
campos de uma vez, e `defaultValue` obrigaria a mexer no DOM por `ref`.

> ⚠ **Março não pode virar `março`.** `challenge_slug_forma` só aceita
> `[a-z0-9-]`, então o slug do mês é `marco`. Há teste passando os doze meses
> pela mesma expressão da constraint.

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

### 3. A meta aparece no `/hoje`, e o "Treinar de novo" saiu

`GoalStrip` é a versão curta do card: uma linha, uma barra fina, sem
diagnóstico e sem previsão. Fica **depois da faixa da semana** — já saímos do
"o que eu faço agora" e entramos no "como eu venho indo". Antes do treino ela
seria cobrança, e `/hoje` é a tela que a pessoa abre todo dia: transformar o
corpo dela em pendência diária é o oposto do que o app se propõe.

Quem ainda não tem meta recebe um convite de borda tracejada, no mesmo tom do
"Já treinava antes de chegar aqui?" — oferta, não tarefa. E quem ainda não
treinou nenhuma vez **não** recebe nem isso: a tela dele já tem um começo para
oferecer.

O botão "Treinar de novo" saiu do `DoneCard`. Quem terminou o dia e quer
treinar de novo tem o `+` e o botão de começar; repetir a oferta dentro do
cartão de "está feito" empurra para mais quando o app acabou de dizer que
estava bom.

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

### Tabela nova pede três lugares, não um

`tests/integration/schema.test.ts` lê o schema real do Supabase e falha se
houver deriva. Uma tabela nova precisa de:

1. o tipo em `types/database.ts` (`XRow` + a entrada em `TableDef`);
2. `TABLE_TO_TYPE` no teste — senão "todas as tabelas do schema estão mapeadas"
   falha;
3. `INHERITED` no teste, quando o tipo usa `Timestamps &` — senão o teste de
   colunas acusa `faltam no tipo — created_at, updated_at`, porque o parser lê
   só o corpo literal do tipo.

O teste só acusa **depois** de a migration ser aplicada no banco: antes disso a
tabela não existe no OpenAPI e o teste passa. Ou seja, `npm test` verde antes de
aplicar não significa nada aqui.

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
