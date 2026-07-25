# PLANO — NEON INVADERS

Milestones da seção 12 da especificação. **Parar e pedir confirmação ao fim de
cada um.** Ao encerrar um milestone: rodar `npm run test`, `npm run lint` e
`npm run build`, atualizar `CLAUDE.md` e marcar os checkboxes aqui.

---

## Milestone 1 — Setup `[orquestrador]` ✅

- [x] Vite + TypeScript `strict` + Phaser 3.90
- [x] ESLint 9 (flat config) + Prettier
- [x] Vitest configurado, ambiente `node`, apenas lógica pura
- [x] Aliases `@game`, `@services`, `@ui` (tsconfig + vite)
- [x] `index.html` com viewport de jogo e bloqueio de gestos
- [x] Resolução lógica 480×640, `Scale.FIT` + `CENTER_BOTH`, `pixelArt`
- [x] Paleta e faixas de cor por região de tela (`config/palette.ts`)
- [x] Bitmaps de sprite originais em código (`gfx/sprites.ts`)
- [x] Pipeline bitmap → `CanvasTexture` (`gfx/textureFactory.ts`)
- [x] Lógica pura de bitmap em `core/` + testes Vitest
- [x] `BootScene` renderizando os sprites gerados, aliens alternando frames
- [x] `CLAUDE.md` criado
- [x] Subagentes `game-frontend` e `game-backend` criados
- [x] Regras de fronteira codificadas no ESLint (core sem Phaser; game sem
      `fetch`/`localStorage`)

## Milestone 2 — Loop base `[frontend]` ✅

- [x] `GameScene` e ciclo de vida das scenes (Boot roteia para Game; `?sprites`
      abre a vitrine de arte)
- [x] Nave do jogador: movimento horizontal na base, com clamp nas paredes
- [x] Tiro base: cooldown 400 ms, máximo 2 projéteis na tela
- [x] Pool de projéteis com swap-remove (zero alocação por frame)
- [x] Formação 5×11 = 55 aliens, 3 tipos (A/B/C = 10/20/30 pts)
- [x] Marcha step-based: passo lateral por tick, desce e inverte na borda
- [x] Aceleração: `intervaloMs = intervaloBase * (aliensVivos / 55)`, piso 60 ms
- [x] Alternância dos 2 frames a cada passo
- [x] Colisão projétil × alien por AABB manual, morte de alien, score
- [x] Vida extra ao cruzar 5.000 pontos, uma única vez
- [x] Derrota instantânea se um alien alcançar a linha da nave
- [x] HUD de score, fase e naves de reserva
- [x] Tabela de balanceamento das 5 fases em `config/levels.ts`
- [x] Testes: pontuação, vida extra, curva do intervalo de marcha, passo da
      formação, geometria inicial

## Milestone 3 — Fidelidade clássica `[frontend]` ✅

- [x] 4 bunkers destrutíveis pixel a pixel (`RenderTexture` + `erase`)
- [x] Bunkers bloqueiam tiro do jogador e do inimigo; aliens os destroem ao passar
- [x] Bunkers restaurados a cada nova fase (não a cada vida)
- [x] Três tipos de tiro inimigo: reto, ondulado e rolling (mira na coluna)
- [x] Só o alien mais baixo de cada coluna atira
- [x] UFO cruzando o topo a cada 20–30 s, bônus 50/100/150/300
- [x] Áudio WebAudio: heartbeat de 4 notas acelerando com a formação, tiro,
      explosão, sirene do UFO
- [x] Áudio inicializado no primeiro gesto; mute persistido (tecla `M`)
- [x] 3 vidas, explosão, congelamento ~1 s, respawn com 1,5 s de invulnerabilidade
- [x] Vida extra em 5.000 pontos (uma única vez)
- [x] Tela de game over com score, fase e tempo total

Fora do checklist, decidido durante a execução:

- `src/services/settings.ts` + `LocalSettingsService` — o mute precisa
  sobreviver ao reload e `src/game/` não pode tocar `localStorage`. Contrato
  novo e isolado; **não** mexe em `ScoreService`/`AuthService`.
- Botão de mute na HUD para toque fica no Milestone 4, junto do resto do mobile.

## Milestone 4 — Mobile `[frontend]` ✅

- [x] Arrasto em qualquer ponto da tela move a nave por delta relativo
- [x] Auto-fire contínuo, sem botão de tiro
- [x] Escala responsiva; retrato primário, letterbox em paisagem
- [x] Bloqueio de scroll, pull-to-refresh, zoom por duplo toque, seleção
- [x] Pausa automática em `visibilitychange`
- [x] Detecção toque vs. teclado adaptando as instruções da tela de título
- [ ] **Teste em viewport real de celular** — pendente. Não consegui redimensionar
      a janela do navegador neste ambiente (`resize_window` não teve efeito), então
      a proporção 3:4 foi conferida por medição do Scale Manager, não em 414×896
      de verdade. Falta abrir num celular.

Fora do checklist, decidido durante a execução:

- `TitleScene` criada agora (era do Milestone 8) — o checklist pede instruções
  adaptativas "da tela de título" e não havia tela de título. Ficou funcional e
  mínima; o Milestone 8 põe arte e modo atração.
- `PauseScene` como overlay, mesmo padrão da `GameOverScene`.
- Botão de mudo na HUD, com alvo de toque de 48×44 px logicos.

## Milestone 5 — Power-ups `[frontend]` ✅

- [x] Registry de power-ups (novo tipo = 1 arquivo + 1 entrada)
- [x] Drop pela tabela de fases + drop garantido do UFO
- [x] Cooldown global mínimo de 10 s entre drops
- [x] Queda lenta, coleta por contato, perda se sair da tela
- [x] RAPID — 5 níveis: 400→320→250→190→140→100 ms, +1 projétil em tela por nível
- [x] MULTI — 4 níveis: 1→2→3→4→5 projéteis, leque máximo de 18°
- [x] Nível máximo + nova coleta = 500 pontos
- [x] Persistência através das mortes e das fases; zera só em novo jogo
- [x] Ícone, cor e som distintos por tipo; HUD com nível atual
- [x] Testes: stacking, limites de nível, bônus no nível máximo

Fora do checklist, decidido durante a execução:

- **O teto de projéteis virou teto de _salvas_.** A especificação diz que o
  RAPID soma +1 ao limite de projéteis na tela, mas com o limite base de 2 um
  leque de 5 do MULTI estouraria sozinho o teto e travaria o gatilho — MULTI
  viraria punição. O MULTI passa a multiplicar o teto pelo tamanho da salva:
  máximo `(2 + 5) × 5 = 35`. `BULLET.poolSize` foi de 16 para 40.
- **Cápsula não gira o sprite do projétil.** O leque se lê pela trajetória; o
  traço é fino demais para que 18° de rotação valham o serrilhado.
- Verificado no navegador, além dos testes: coleta por contato, perda pela base,
  cooldown de 10 s valendo entre drop de alien e do UFO, e os níveis
  sobrevivendo a morte, respawn e troca de fase — zerando só no restart.

## Milestone 6 — Fases e chefões `[frontend]`

**DECISÃO DE ESCOPO (tomada com o usuário):** os cinco chefões distintos da
seção 6 da especificação foram substituídos por **uma única nave-mãe
parametrizada por fase** — HP, cadência, velocidade e leque escalam de F1 a F5.
Gêmeos, Serpente, Fortaleza e Overlord saem da v1 e viram um milestone próprio;
o framework já os acomoda como variações. Risco aceito e registrado: a fase 5 é
a fase 1 com números maiores.

### Parte A — framework + nave-mãe ✅

- [x] `config/levels.ts` com a tabela de balanceamento das 5 fases *(já saiu no M2)*
- [x] Padrão comum de chefão: entrada animada, barra de HP, ponto fraco,
      mudança de padrão a 50%, explosão em cadeia, 2 power-ups no drop
- [x] Telegraph visual **e sonoro** de 500 ms em todo ataque
- [x] Nave-mãe escalando nas 5 fases (`config/bosses.ts`)
- [x] Testes: dano por ponto fraco, limiar de 50%, leque simétrico, varredura
      com quique, ciclo telegraph → salva, entrada, fração de HP

### Parte B ✅

- [x] Splitters: tipo B se divide ao morrer (25% F3, 40% F4, 50% F5)
- [x] Minions na fase 2 e laser vertical telegrafado na fase 4 (as duas na F5)
- [x] Transições entre fases: cartão `FASE N` na entrada, sem congelar o jogo
- [x] `VictoryScene` própria, com campo de estrelas cintilando
- [x] Testes: chance de partir por fase, filhos em V, quique lateral, padrões
      por fase, laser e invocação nunca sem telegraph
- [ ] **Tuning jogando de verdade** — segue pendente. A luta foi validada por
      automação, não no dedo

Fora do checklist, decidido durante a execução:

- **`EnemyBullet` ganhou o tipo `spread`**, com velocidade horizontal própria,
  para o leque do chefão. Ficou **fora** de `EnemyBulletKind` de propósito: o
  tipo do chefão nunca pode entrar no sorteio da formação, e tipos separados
  fazem o compilador garantir isso.
- `ENEMY_BULLET.poolSize` foi de 12 para 20 — o pior caso deixou de ser a fase 5
  e passou a ser a nave-mãe enfurecida (5 por salva a cada ~0,9 s).
- **O núcleo teve de crescer e clarear.** Na primeira versão ele lia como um
  buraco escuro no meio do casco em vez de um alvo. Bitmap de 8×8 para 10×10 e
  piso de alpha da respiração em 0,75.
- Cápsulas em queda **não** são recolhidas quando a formação é limpa: quem
  limpou com um power-up a caminho merece pegá-lo antes da luta.
- **Atalho `?boss` na URL** (só em dev, no espírito do `?sprites`): cai direto
  na luta, pulando formação e tela de título. `?boss=3` vai ao chefão da fase 3.
  Nasceu de um problema real — conferir o chefão exigia limpar 55 aliens antes,
  e o usuário confundiu o UFO com o chefão por nunca ter chegado lá.
- **Cada fase acrescenta UMA coisa nova**, nunca duas: leque de 3 → minions →
  leque de 5 → laser → tudo junto. É a resposta ao risco declarado quando os
  cinco chefões viraram uma nave-mãe escalada. Há teste travando a progressão.
- **Splitters e minions são o mesmo objeto**, num pool só. São a mesma ameaça
  com origens diferentes — a única do jogo que se move fora da grade.
- **`core/motion.ts` nasceu para não duplicar o quique lateral** entre chefão e
  splitters. `sweepStep` do chefão agora delega para `bounceStepX`.
- **BUG REAL encontrado na verificação: laser disparava sem telegraph.** O
  jogador morria durante o aviso, o respawn apagava o feixe, mas o relógio do
  chefão seguia e o tiro saía sem aviso nenhum. Corrigido com `cancelLaser()` +
  trava dura em `updateBoss` (só dispara se o aviso estiver na tela). Verificado
  em 60 s de luta: 6 disparos, zero sem aviso.
- **A nave-mãe para de varrer enquanto o laser está em cena.** Sem isso o feixe
  ficava órfão no meio da tela (a coluna trava no aviso, a nave não parava) e
  lia como defeito. De quebra, a nave imóvel virou a janela de revide de quem
  sobreviveu ao laser.

## Milestone 7 — Persistência `[backend]` ✅

- [x] `src/services/types.ts` com o contrato da seção 9
- [x] `LocalScoreService` e `LocalAuthService` sobre `localStorage`, API async
- [x] Modo convidado sem cadastro
- [x] Tela de ranking (global / semanal / meus)
- [x] `docs/api-contract.md` — endpoints, payloads, códigos de erro
- [x] `docs/anti-cheat.md` — teto de pontos por fase, coerências, rate limit
- [x] Validador de plausibilidade de run rodando local + testes Vitest
- [x] Decisão de stack de servidor: **Supabase** (decisão do usuário). Postgres,
      auth e RLS prontos; o único código próprio é uma Edge Function que valida e
      grava a run. Esquema e políticas em `docs/api-contract.md` §6.

Fora do checklist, decidido durante a execução:

- **Os tetos do anti-cheat são uma cópia deliberada de `game/config/`.** O
  validador tem de rodar no servidor, onde o bundle do jogo não existe, e a
  fronteira proíbe `src/services/` de importar `src/game/`. `tests/runLimits.test.ts`
  é o único arquivo que importa os dois lados e falha se divergirem.
- **`RunReporter` (`game/systems/`) nasceu de uma corrida real.** `scene.launch`
  só cria o overlay no passo seguinte do loop, enquanto a submissão local
  resolve no microtask — um evento emitido na hora não teria ouvinte. O reporter
  guarda o resultado e `onResolved` entrega na hora a quem chegar depois.
- **Nome do jogador entra na `TitleScene`, com seletor arcade de 3 letras.** Um
  `<input>` de DOM traria o teclado virtual do celular por cima do canvas,
  brigando com o bloqueio de gestos do `index.html`. O seletor funciona igual no
  dedo e no teclado.
- **`GameScene.resetRunState()`**: sair para o ranking e voltar ao título passou
  a ser possível, e isso faz o `create` rodar de novo numa instância
  reaproveitada — score, vidas, fase e o array de bunkers precisavam zerar à mão.
- **BUG REAL encontrado na verificação: digitar o nome disparava atalhos.** O "R"
  de "RAM" abria o ranking. O teclado do Phaser é processado por fila dentro do
  loop, então uma tecla do seletor podia ser lida um frame depois, já em modo
  `ready`. Corrigido com guarda de modo + carência de 300 ms (`shortcutsReady`).
- **`LeaderboardScene` não pode ter método `load`** — colide com o LoaderPlugin
  da Scene. Terceiro nome desta armadilha, depois de `input` e `data`.
- Verificado no navegador, além dos testes: contadores batendo com o score
  (10 A + 8 B + 4 C = 380 pontos exatos), submissão aceita com rank #1, a
  entrada aparecendo em GLOBAL e MEUS, o nome sobrevivendo ao reload, e
  `DURATION_MISMATCH` recusando uma partida com o relógio adiantado.

## Milestone 8 — Polimento `[frontend]`

- [x] Toggle de efeito CRT (scanlines, vinheta, glow) — desligado por padrão no mobile
- [x] Screen shake em explosões grandes e no dano de chefão
- [x] Partículas de explosão a partir do pool
- [x] Arte e modo atração na tela de título (o esqueleto funcional saiu no M4)
- [x] Tela de settings (áudio, CRT, auto-fire permanente)
- [ ] **Tuning de dificuldade jogando de verdade** — segue pendente, junto com o
      tuning da luta de chefão do M6. Continua sendo a única coisa que
      automação não faz.

Fora do checklist, decidido durante a execução:

- **Não há glow por shader.** Bloom de verdade exige WebGL garantido (o jogo
  roda em `Phaser.AUTO` e pode cair no renderer de canvas) e custa uma passada
  de tela cheia por frame no celular. O "glow" é uma camada aditiva de verde
  com alfa 0,05: não borra os sprites, mas levanta o preto para o
  cinza-esverdeado de um tubo ligado — que é o que o olho lê como CRT.
- **`GameSettings` mudou de contrato** (campo do backend, mudança combinada com
  o orquestrador): `volume` (0..1) e `autoFire` novos, e `crt` passou a
  `true | false | 'auto'`. O terceiro estado é o que permite ligar por padrão no
  desktop e desligar no toque sem `services/` saber o que é um celular.
- **O CRT virou Scene, não overlay de DOM nem camada por Scene.** Em DOM ele
  teria de perseguir o retângulo do Scale Manager a cada resize (e errar em todo
  letterbox); por Scene seriam sete cópias, todas a reordenar junto com o
  `bringToTop` do HUD. De quebra, o vidro do monitor não treme com o screen
  shake — que é o comportamento certo.
- **A textura do CRT nasce na primeira vez que o efeito liga**, não no boot.
  São ~1,2 MB de textura de tela cheia; quem joga no celular com o efeito
  desligado nunca paga por ela.
- **Screen shake NÃO existe em morte de alien.** Sessenta aliens por fase, cada
  um sacudindo a tela, e o jogo vira gelatina. Só a morte do jogador, a cadeia
  do chefão, o acerto no núcleo e o enfurecimento tremem — e o casco do chefão
  continua sem tremer, porque é isso que separa o ponto fraco da decoração.
- **Volume em cinco degraus, não slider.** No dedo, um slider de 480 px lógicos
  pede precisão que polegar não tem, e a diferença entre 62% e 68% não existe
  para ninguém. Acionar dá a volta ao silêncio depois do máximo (no toque não há
  "seta para a esquerda"); as setas do teclado param no piso e no teto.
- **Preferência aplicada por barramento** (`systems/settingsBus.ts`, em
  `game.events`): a tela de ajustes muda um valor e a `CrtScene` e a `GameScene`
  reagem no mesmo frame, inclusive com a partida pausada atrás. Sem isso, mexer
  no volume durante a pausa só valeria na partida seguinte.
- **A tecla `S` abre os ajustes e por isso W/S ficaram FORA da navegação do
  menu.** O teclado do Phaser é processado por fila: o mesmo `S` que abriu a
  tela chega um frame depois, já com o menu no ar. Terceira aparição da
  armadilha, depois do "R" de "RAM" e do próprio ranking.
- **BUG REAL encontrado na verificação: a pausa perdia o "ENTER PARA
  CONTINUAR".** Voltar dos ajustes recria os objetos de texto vazios, mas o
  `shownMode` da instância reaproveitada fazia o `refreshPrompt` concluir que
  não havia nada a escrever. Corrigido nas três telas que memorizam o modo de
  entrada. Mesma família do `resetRunState()` do M7.
- Verificado no navegador, além dos testes: partículas saindo em leque e caindo
  com gravidade, estilhaços âmbar na morte da nave com o shake rodando, CRT
  ligando e desligando ao vivo e sobrevivendo ao reload, ciclo pausa → ajustes →
  pausa, os três painéis da atração e o `autoFire` chegando ao `InputSystem`
  pelo barramento (`isFiring` de `false` para `true` sem tecla nenhuma).

## Milestone 9 — Servidor real `[backend]`

Stack decidida no M7: **Supabase**. O esquema, as políticas de RLS e o mapa
rota → recurso estão em `docs/api-contract.md` §6; o validador que a Edge
Function precisa rodar já existe e está testado (`services/validation/`).

- [x] Migration com `profiles` / `run_tokens` / `scores` / `submissions` e as
      views `leaderboard_public` e `leaderboard_mine`
- [x] RLS: leitura pública, escrita só pela service_role (sem isso o ranking é
      lixo em uma semana)
- [x] Edge Functions `runs-start` e `runs-submit` rodando **o mesmo** validador
      do cliente, sincronizado por `npm run supabase:sync`
- [x] Ligar `RemoteScoreService` / `RemoteAuthService` em `services/index.ts`,
      por variável de ambiente
- [x] Rate limit por conta e por IP (§5 do contrato)
- [x] `docs/supabase-setup.md` — provisionamento e conferência pós-deploy
- [ ] **Provisionar o projeto de verdade** — pendente, e só o usuário faz: exige
      conta na Supabase. Todo o código está pronto e testado com `fetch` falso;
      falta rodar os cinco passos de `docs/supabase-setup.md` e a conferência da
      seção 5 (que é o que confirma a RLS de pé, e nenhum teste alcança).

Fora do checklist, decidido durante a execução:

- **O servidor é opcional, não um requisito de boot.** Sem
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, `getServices()` devolve os
  adapters locais e o jogo é exatamente o do M8 — ranking no aparelho, zero
  rede. Quem clona o repositório tem um jogo completo sem criar conta em lugar
  nenhum, e o interruptor é apagar um arquivo `.env.local`.
- **Sem `@supabase/supabase-js` no cliente.** O que o jogo usa do servidor cabe
  em cinco rotas do GoTrue, duas consultas ao PostgREST e duas Edge Functions —
  `fetch` com dois cabeçalhos. O SDK traria um bundle inteiro, um modelo de erro
  diferente do contrato e um **segundo** mecanismo de persistência de sessão,
  escrevendo em `localStorage` por fora do `JsonStore` (o único arquivo do
  projeto autorizado a isso). Nas Edge Functions ele é usado normalmente: lá o
  bundle não custa nada e a `service_role` já está no ambiente.
- **A duplicação do validador virou gerada.** `npm run supabase:sync` copia
  `types`/`limits`/`plausibility` para `supabase/functions/_shared/validation/`
  reescrevendo só os specifiers de import — o Deno não resolve alias do Vite e
  exige `.ts`. `tests/edgeShared.test.ts` roda o mesmo gerador em memória e
  falha se a cópia divergir. Foi o jeito de manter a promessa do `anti-cheat.md`
  ("o mesmo código nos dois lados") sem depender de o bundler da CLI conseguir
  importar de fora de `supabase/`.
- **`leaderboard_mine` é uma view separada.** O recorte "meus" precisa filtrar
  por dono, e a entrada pública não pode carregar `user_id` (contrato §3):
  publicar a coluna para o cliente filtrar deixaria qualquer um ler a tabela de
  qualquer outro. A view filtra por `auth.uid()` dentro do banco.
- **`score_rank` é função SQL, não consulta do PostgREST.** O desempate do
  ranking usa `created_at`, e um timestamp com fuso na query string tem o `+`
  decodificado como espaço — a posição sairia errada em silêncio.
- **Renomear convidado não cria conta nova.** A `TitleScene` chama
  `signInAsGuest` toda vez que o jogador confirma o nome, mesmo para corrigir
  uma letra. Uma conta anônima por confirmação encheria `auth.users` de lixo e
  bateria no rate limit do próprio GoTrue; com sessão anônima aberta, só o nome
  muda. E cadastrar-se depois **promove** a conta anônima (`PUT /auth/v1/user`)
  em vez de abrir outra: o `userId` continua o mesmo e o histórico sobrevive.
- **Falha de rede não apaga sessão; refresh token recusado apaga.** Perder o
  login por causa de um túnel de metrô seria absurdo — nesse caso o nome
  continua na tela e só o ranking fica indisponível. Já um refresh token morto
  só produziria 401 para sempre.
- **Recusa por rate limit não entra na auditoria.** A contagem sai da mesma
  tabela: registrar o bloqueio faria cada tentativa barrada empurrar a janela
  para a frente, e quem esbarrasse no teto uma vez ficaria preso enquanto
  insistisse. O teto pune o excesso, não a teimosia.
- **O limite por IP é o triplo do limite por conta.** IP não identifica pessoa:
  hotspot, NAT de escola e dois irmãos no mesmo Wi-Fi compartilham endereço. O
  que segura abuso é o teto por conta. Desvio do §5 do contrato, registrado lá.
- `normalizeDisplayName`/`normalizeEmail` saíram de `local/authService` para
  `services/names.ts`: os dois adapters precisam aceitar exatamente o mesmo
  nome, senão trocar de backend muda o que o seletor de três letras produz.

---

## Backlog de power-ups (pós-v1)

Escudo temporário · laser perfurante · tiro guiado · bomba de tela · vida extra ·
slow motion · drone auxiliar. A arquitetura de registry já deve suportar cada um
com um arquivo e uma entrada.
