# NEON INVADERS — guia do repositório

Shoot'em up de tela fixa para navegador (desktop + mobile), 5 fases, cada uma
terminando em um chefão. Estética pixel art monocromática/CRT. Arte e áudio
100% originais, gerados em código — nenhum asset externo, nenhuma referência de
propriedade intelectual de terceiros.

A especificação completa do produto vive em `prompt-space-invaders-claude-code.md`.
Este arquivo é o resumo operacional: stack, fronteiras e decisões já fechadas.

---

## 1. Stack

| Camada    | Escolha                                                  |
| --------- | -------------------------------------------------------- |
| Engine    | Phaser 3.90 (`Phaser.AUTO`)                               |
| Linguagem | TypeScript `strict: true`                                 |
| Build     | Vite 7                                                    |
| Testes    | Vitest 3 (ambiente `node`, só lógica pura)                |
| Lint      | ESLint 9 (flat config) + Prettier                         |
| Backend   | Supabase (opcional) — sem env, cai no `localStorage`       |

Scripts: `npm run dev` · `npm run build` · `npm run test` · `npm run lint` ·
`npm run supabase:sync`

## 2. Decisões arquiteturais fechadas

- **Resolução lógica fixa 480×640**, `Scale.FIT` + `CENTER_BOTH`. Nenhum
  posicionamento em pixels de tela real — sempre coordenadas lógicas
  (`src/game/config/screen.ts`).
- **Render**: `pixelArt: true`, `roundPixels: true`, `antialias: false`.
- **Zero assets externos.** Sprites são bitmaps de strings em
  `src/game/gfx/sprites.ts`, convertidos em `CanvasTexture` no boot por
  `textureFactory.ts`. Áudio será sintetizado em WebAudio. Nenhum `.png`,
  `.mp3`, `.ttf` ou fonte web entra neste repositório.
- **Física**: a formação de aliens **não** usa Arcade Physics — ela marcha em
  passos discretos comandados por timer próprio. Arcade Physics fica restrito a
  projéteis e colisões simples.
- **Sem alocação por frame no game loop.** Projéteis, partículas e explosões
  saem de pools.
- **Números de balanceamento moram em `src/game/config/`**, nunca espalhados
  pelo código.

## 3. Estrutura de pastas

```
src/
├─ main.ts                  configuração do Phaser.Game
├─ game/                    ← território exclusivo do agente FRONTEND
│  ├─ scenes/               Boot, Title, Game, Pause, GameOver, Victory, Leaderboard,
│  │                        Settings, Crt (overlay permanente do efeito CRT)
│  ├─ entities/             Player, AlienGrid, Alien, Bullet, Ufo, Bunker, PowerUp,
│  │  │                     Splitter, Explosion, Particle
│  │  └─ bosses/            MotherShip, BossLaser
│  ├─ systems/              Input, Audio, PowerUp, Particle, Pool, RunReporter,
│  │                        settingsBus, device
│  ├─ config/               screen, palette, gameplay, levels, audio, bosses, juice
│  │  └─ powerups/          registry: index + um arquivo por tipo
│  ├─ gfx/                  bitmaps de sprite + gerador de texturas, fundo,
│  │                        campo de estrelas, textura do CRT
│  └─ core/                 lógica pura testável — PROIBIDO importar Phaser
├─ services/                ← território exclusivo do agente BACKEND
│  ├─ index.ts              getServices() — o único ponto de entrada do jogo
│  ├─ types.ts              ScoreService, AuthService, ScoreEntry, RunSubmission
│  ├─ settings.ts           SettingsService (mute, CRT) — preferências locais
│  ├─ names.ts              normalização de nome de ranking e de e-mail
│  ├─ leaderboard.ts        ordem, recortes e poda da tabela (lógica pura)
│  ├─ validation/           limits.ts (tetos) + plausibility.ts (validador)
│  ├─ local/                adapters sobre localStorage (+ storage.ts, o único
│  │                        arquivo do projeto que toca localStorage)
│  └─ remote/               adapters sobre o Supabase: config, client, session,
│                           authService, scoreService
└─ ui/                      HUD (Hud, BossBar) e overlays sobre o canvas
supabase/                   migrations, config.toml e as Edge Functions
scripts/                    ferramental de build (syncEdgeValidation.mjs)
tests/                      Vitest
docs/                       api-contract.md, anti-cheat.md, supabase-setup.md
```

Aliases de import configurados em `tsconfig.json` e `vite.config.ts`:
`@game/*`, `@services/*`, `@ui/*`.

## 4. Fronteira entre os agentes (crítica)

- O agente **frontend** nunca faz `fetch`, nunca toca `localStorage` e nunca
  conhece endpoints. Consome apenas as interfaces de `src/services/`
  (`ScoreService`, `AuthService`, `SettingsService`).
- O agente **backend** nunca toca em nada dentro de `src/game/`.
- O único ponto de contato é `src/services/` — definido pelo backend, consumido
  pelo frontend. Mudança de contrato exige parar e renegociar com o orquestrador.

Duas regras estão codificadas no ESLint e falham o lint se violadas:

- `src/game/core/**` não pode importar `phaser`;
- `src/game/**` não pode usar `fetch`, `localStorage` ou `sessionStorage`.

## 5. Contrato frontend ↔ backend

Definido em `src/services/types.ts` (dono: agente backend). Todos os métodos são
assíncronos **inclusive na versão local**, para que trocar o adapter local pelo
remoto não mude uma linha do frontend.

```ts
interface ScoreService {
  startRun(): Promise<{ runToken: string }>;
  submitRun(sub: RunSubmission): Promise<{ accepted: boolean; rank?: number; reason?: string }>;
  getLeaderboard(scope: 'global' | 'weekly' | 'me', limit?: number): Promise<ScoreEntry[]>;
  getPersonalBest(): Promise<ScoreEntry | null>;
}

interface AuthService {
  getSession(): Promise<Session | null>;
  signInAsGuest(displayName: string): Promise<Session>;
  signUp(email: string, password: string, displayName: string): Promise<Session>;
  signIn(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;
}
```

O jogo é 100% jogável sem conta (modo convidado). O frontend nunca instancia um
adapter pelo nome: chama `getServices()` (`src/services/index.ts`), instância
única porque `LocalScoreService` guarda os tokens de partida em memória e
`RemoteSession` renova o token de acesso — duas cópias renovariam duas vezes.

**Local ou Supabase é decisão de ambiente, não de código.** Com
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` definidas, `getServices()` devolve
os adapters de `remote/`; sem elas, os de `local/`. Nada dentro de `src/game/`
muda nos dois casos — é para isso que o contrato inteiro é assíncrono desde a v1.
O servidor é um acréscimo opcional, nunca um requisito de boot. Provisionamento
em `docs/supabase-setup.md`.

**O score do cliente é uma proposta, nunca um fato.** `submitRun` passa pelo
validador de plausibilidade (`services/validation/`) antes de entrar na tabela.
No servidor, é o **mesmo** código: `npm run supabase:sync` copia os três módulos
para `supabase/functions/_shared/validation/` reescrevendo só os specifiers de
import, e `tests/edgeShared.test.ts` falha se a cópia divergir. Ver
`docs/anti-cheat.md`.

## 6. Mecânicas-assinatura (não "conserte" isso)

- **Aceleração da formação**: `intervaloMs = intervaloBase * (aliensVivos / 55)`,
  piso ~60 ms. Quanto menos aliens sobram, mais rápido eles marcham. O último
  alien é frenético — isso é o coração do jogo, não um bug.
- **Heartbeat de 4 notas** graves descendentes, sincronizado com o passo da
  formação. Acelera junto. É o principal gerador de tensão.
- **Bunkers destruídos pixel a pixel** via `RenderTexture` + `erase`. Nada de
  "bunker com 5 de HP".
- **Power-ups persistem através das mortes e das fases.** Perder uma vida custa
  a vida, nunca os power-ups. Só `restart()` zera. O perfil de disparo é sempre
  **derivado** dos níveis (`buildFireProfile` recalcula do zero), nunca
  incrementado — é o que impede o canhão de dessincronizar do HUD.
- **O UFO sempre solta um power-up.** É o incentivo para persegui-lo.
- **Todo ataque de chefão tem telegraph visual** de 0,4–0,6 s. O telegraph é o
  **rabo** do intervalo de ataque, não o começo: a carga termina exatamente
  quando a salva sai, e é isso que torna o aviso útil. `fireIntervalFor` nunca
  deixa o intervalo cair abaixo do telegraph — há teste travando isso para as
  cinco fases, inclusive enfurecidas.

## 7. Definition of Done

Uma feature só está pronta quando: roda a 60 fps no desktop e no mobile;
funciona com toque e com teclado; não gera lixo de GC no loop; os números de
balanceamento estão em `config/`; a lógica pura correspondente tem teste; e
`npm run build`, `npm run test` e `npm run lint` passam limpos.

## 8. Convenções que já mordem

- **Nomes de campo que colidem com Phaser.** Já custaram tempo quatro: `input`
  (o `InputSystem` vive em `this.controls`), `data` (o resultado da partida em
  `GameOverScene` vive em `this.result`), `load` (o LoaderPlugin — a
  `LeaderboardScene` usa `loadEntries`) e `state` (existe em
  `GameObjects.GameObject` como `string | number` — o voo da `Particle` vive em
  `this.flight`). Na dúvida, confira se o nome já existe na Scene ou no
  GameObject antes de declarar o campo ou o método.
- **Campo de instância que memoriza o que já está na tela quebra na segunda
  visita.** O Phaser reaproveita a instância da Scene, mas o `create` recria os
  objetos de texto — vazios. Um `shownMode` sobrevivente faz o `refresh*`
  concluir que não há nada a escrever, e a tela abre com as instruções em
  branco. Já mordeu na `PauseScene` (voltar dos ajustes tirava o "ENTER PARA
  CONTINUAR"); `TitleScene`, `PauseScene` e `SettingsScene` zeram isso no
  `create`. Mesma família do `resetRunState()` da `GameScene`.
- **Bunker = duas cópias sincronizadas.** `RenderTexture` para o que se vê,
  `Uint8Array` para o que colide (ler pixels do RT por tiro é inviável). Elas
  só continuam idênticas porque a escavação usa **o mesmo bitmap de brocha** nos
  dois lados. Mexer em um lado sem o outro produz buraco que não deixa passar
  ou parede invisível.
- **`RenderTexture.erase` não aceita retângulo**, só uma textura. Apagar uma
  faixa (formação esmagando bunker) usa um bloco-borracha do tamanho do bunker,
  posicionado de modo que o excedente saia fora dos limites do RT.
- **Desbloqueio de áudio escuta o DOM, não `this.input`.** Eventos do Phaser só
  são processados dentro de um passo do game loop, e o loop está parado
  justamente quando o primeiro gesto costuma acontecer (aba sem foco, tela de
  game over com a `GameScene` pausada).
- **`GameOverScene` e `PauseScene` são overlays, não substituições.** A
  `GameScene` guarda estado em campos de instância e o Phaser reaproveita a
  instância entre `start`s — trocar de Scene e voltar exigiria zerar tudo à mão.
  Elas pausam a `GameScene` e mandam `RESTART_EVENT` / `RESUME_EVENT`.
- **Botão em canvas usa `Zone` separada, não `image.setInteractive()`.**
  Trocar a textura de uma imagem interativa reinicia a hitArea padrão para o
  tamanho do novo frame — o alvo de toque encolhe sozinho no primeiro uso. Já
  mordeu no botão de mudo.
- **Toque e teclado somam, não se excluem.** `nextPlayerX` recebe o eixo do
  teclado e o delta do arrasto no mesmo cálculo, porque num tablet com teclado
  os dois chegam no mesmo frame. E o arrasto acumulado precisa ser **consumido
  ou descartado** ao sair de pausa/morte, senão a nave salta ao voltar.
- **Ao automatizar o navegador, o loop do Phaser congela** quando a aba perde
  foco — cliques e teclas enviados nesse estado são engolidos. Um `screenshot`
  destrava alguns frames. `game.loop.step()` sem argumento produz delta `NaN` e
  contamina posições; se precisar dirigir o loop à mão, passe
  `performance.now()`.
- **Origem da formação ≠ limite de marcha.** `FORMATION_START_X` centraliza o
  bloco; `FORMATION_MIN_X`/`MAX_X` são as paredes. Igualar os dois deixa a
  formação presa na borda, descendo a cada tick — há teste travando isso.
- **`window.game`** existe só em `npm run dev` (`import.meta.env.DEV`), para
  inspecionar o jogo pelo console. Some no build de produção.
- **Atalhos de URL, só em dev:** `?sprites` abre a vitrine de arte; `?boss` cai
  direto na luta contra a nave-mãe (`?boss=3` na da fase 3), pulando a formação
  e a tela de título. Conferir um chefão exigia limpar 55 aliens antes.
- **UFO ≠ chefão.** A nave que cruza o topo a cada 20–30 s é o UFO (Milestone 3)
  e continua existindo durante toda a fase. O chefão só entra depois que a
  formação é limpa. Já gerou confusão de identidade uma vez.
- **Apagar o feixe do laser não basta: o ciclo dele também precisa zerar.**
  `cancelBossLaser()` faz as duas coisas. Apagar só o feixe (o que o respawn
  fazia) deixava o relógio do chefão correndo, e o tiro seguinte saía **sem
  telegraph** — dano imprevisível, o oposto da regra da seção 6. Há uma trava
  dura em `updateBoss`: o feixe só dispara se o aviso estiver na tela.
- **A nave-mãe para de varrer com o laser em cena.** A coluna trava no aviso;
  se a nave continuasse deslizando, o feixe ficaria órfão no meio da tela.
- **O núcleo do chefão é testado antes do casco.** As duas caixas se
  sobrepõem; inverter a ordem transformaria o ponto fraco em decoração, porque
  todo acerto no núcleo cairia primeiro no casco e valeria metade.
- **`EnemyBulletKind` (formação) e `BossBulletKind` são tipos separados.** O
  `spread` do chefão não pode entrar no sorteio de `pickKind` nem na tabela de
  pesos; mantendo os tipos apartados, o compilador garante isso sem teste.
- **A ordem de `POWERUP_REGISTRY` é a ordem de aplicação dos efeitos.** RAPID
  **soma** slots ao teto de projéteis; MULTI **multiplica** esse teto pelo
  tamanho da salva. Trocar as duas linhas de lugar rebalanceia o jogo inteiro
  sem produzir um único erro de compilação.
- **O teto de projéteis é teto de _salvas_, não de tiros.** Cobrar projétil a
  projétil deixaria o leque sair pela metade; com o limite base de 2, um MULTI
  de 5 travaria o próprio gatilho. Por isso `fire()` verifica se cabe a salva
  inteira antes de disparar qualquer coisa.
- **`Player.resetToCenter` zera a recarga em andamento, não o cooldown
  configurado.** É o que faz o RAPID sobreviver à morte e à troca de fase de
  graça — e é justamente por isso que `restart()` precisa reaplicar o cooldown
  à mão, senão a partida nova começa com o canhão da anterior.
- **O teclado do Phaser é processado por FILA, dentro do game loop.** Uma tecla
  digitada numa tela pode ser lida um frame depois, quando a tela já mudou de
  modo — foi assim que o "R" de "RAM" no seletor de nome abriu o ranking. Toda
  tecla que vira atalho precisa de guarda de modo **e** de carência de alguns
  frames (`shortcutsReady` na `TitleScene`).
- **Um toque em botão também chega ao `InputSystem`.** Os eventos de GameObject
  vêm ANTES do `POINTER_DOWN` global, então limpar a borda dentro do handler do
  botão não adianta: o global a marcaria de novo. As telas usam
  `tapHandledByButton`, consumida no `update` — que roda depois dos dois.
- **`RunReporter` guarda o resultado da submissão em vez de emitir evento.**
  `scene.launch` só cria o overlay no passo seguinte do loop, e a submissão local
  resolve antes disso: um evento emitido na hora não teria ninguém escutando.
- **Sair da partida para o ranking encerra a `GameScene` (`stop`, não `pause`).**
  Pausada, ela continuaria desenhando congelada atrás da tela de ranking. Por
  isso `create` chama `resetRunState()` — voltar ao título e jogar de novo faz o
  `create` rodar numa instância reaproveitada, e score, vidas, fase e o array de
  bunkers não zeram sozinhos.
- **O efeito CRT é uma Scene, e é a última da lista em `main.ts`.** A ordem de
  render segue a ordem em que as Scenes entram no gerenciador; uma Scene nova
  declarada depois de `CrtScene` apagaria o efeito sem erro nenhum. Ela também
  chama `bringToTop` no próprio `create` e desliga o próprio input — está sobre
  tudo, então qualquer GameObject interativo dela roubaria o toque do que está
  embaixo.
- **O CRT não treme junto com o screen shake, de propósito.** A `GameScene`
  sacode a câmera dela; o vidro do monitor está em outra Scene e fica parado.
  Foi o que decidiu a arquitetura do efeito, além do letterbox (um overlay em
  DOM teria de perseguir o retângulo do Scale Manager a cada resize).
- **Preferência com três estados, não duas.** `GameSettings.crt` é
  `true | false | 'auto'`: `'auto'` significa "o jogador ainda não opinou" e é
  resolvido pelo aparelho (`core/crt.ts`) — ligado no desktop, desligado no
  toque. Sem o terceiro estado não há como distinguir "desligou" de "nunca
  mexeu", e o padrão por aparelho vira impossível sem `services/` saber o que é
  um celular.
- Phaser pausa o loop quando a aba perde foco. Ao automatizar o navegador, o
  jogo parece congelado — é comportamento correto, não bug. Vale para o teclado
  também: teclas enviadas com o loop parado se acumulam na fila ou se perdem.
- **A ausência de policy de RLS em `scores` É o mecanismo, não um esquecimento.**
  Com RLS ligada e sem policy de insert, só a `service_role` grava — e ela só
  existe dentro da Edge Function. Criar uma policy de insert "para facilitar um
  teste" desliga o anti-cheat inteiro sem produzir erro nenhum.
- **O cabeçalho `apikey` vale para TODA rota do Supabase**, inclusive as que já
  levam um token de sessão no `Authorization`. Esquecer dele devolve 401 sem
  explicação.
- **Timestamp não passa por filtro de query string do PostgREST.** O `+` do fuso
  é decodificado como espaço, e a comparação sai errada em silêncio. Foi por isso
  que a posição no ranking (`score_rank`) virou função SQL, e não uma contagem
  montada com `.or(...)`.
- **A view do ranking é um JOIN com `profiles`: sem perfil, a partida é gravada e
  nunca aparece.** Por isso o perfil é garantido no `runs-start`, no começo da
  partida — descobrir a falta dele só na submissão faria a partida sumir depois
  de jogada.
- **Renomear convidado não pode criar conta nova.** A `TitleScene` chama
  `signInAsGuest` a cada confirmação de nome, inclusive para corrigir uma letra;
  uma conta anônima por confirmação encheria `auth.users` e bateria no rate limit
  do GoTrue. Com sessão anônima aberta, só o nome muda.
- **Falha de rede não apaga a sessão; refresh token recusado apaga.** Perder o
  login por causa de um túnel de metrô seria absurdo — ali o nome fica na tela e
  só o ranking some. Refresh token morto só produziria 401 para sempre.

## 9. Estado atual

**Milestone 1 concluído** — Vite + TS + Phaser + ESLint + Vitest configurados;
pipeline de sprites bitmap → `CanvasTexture` funcionando.

**Milestone 2 concluído** — loop base jogável: nave, tiro com cooldown e limite
de projéteis via pool, formação 5×11 com marcha step-based acelerando, colisão
AABB manual, score com vida extra, HUD e derrota por invasão. Ao limpar a
formação a onda se repete — o Milestone 6 troca esse ponto pelo chefão da fase.

**Milestone 3 concluído** — fidelidade clássica: 4 bunkers destrutíveis pixel a
pixel, três tipos de tiro inimigo (reto / ondulado / rolling) saindo só do alien
mais baixo de cada coluna, UFO a cada 20–30 s com bônus, áudio sintetizado em
WebAudio com o heartbeat de 4 notas acelerando junto da marcha, ciclo de morte
→ congelamento → respawn invulnerável, e tela de game over com score, fase e
tempo. O mute é persistido via `SettingsService` (tecla `M`).

**Milestone 4 concluído** — mobile: arrasto por delta relativo em qualquer ponto
da tela, auto-fire contínuo no toque, `TitleScene` e `PauseScene`, pausa
automática em `visibilitychange`, botão de mudo tocável na HUD e detecção
contínua toque vs. teclado adaptando os textos. Pendente: abrir num celular de
verdade — o ambiente de automação não redimensiona a janela.

**Milestone 5 concluído** — power-ups: registry em `config/powerups/` (um
arquivo por tipo + uma linha em `POWERUP_REGISTRY`), RAPID de 5 níveis e MULTI
de 4, cápsulas caindo com drop pela taxa da fase e drop garantido do UFO sob
cooldown global de 10 s, coleta por contato, bônus de 500 pontos no nível
máximo, níveis atravessando mortes e fases, e chips de nível na HUD.

**Milestone 6 concluído** — framework de chefão + nave-mãe (entrada animada,
varredura com quique, barra de HP, núcleo como ponto fraco, mudança de padrão a
50%, telegraph de 500 ms visual e sonoro, explosão em cadeia, 2 power-ups no
drop), splitters, minions, laser vertical telegrafado, cartão de fase e
`VictoryScene`. Cada fase acrescenta uma coisa nova: leque de 3 → minions →
leque de 5 → laser → tudo junto.

**Milestone 7 concluído** — persistência: contrato completo em
`services/types.ts`, `LocalScoreService` e `LocalAuthService` sobre
`localStorage` com API assíncrona, modo convidado com seletor de nome arcade na
tela de título, `LeaderboardScene` (global / semanal / meus), validador de
plausibilidade de run rodando a cada submissão, stub do cliente remoto e os dois
documentos (`docs/api-contract.md`, `docs/anti-cheat.md`). Stack de servidor
escolhida: **Supabase**.

**Milestone 8 concluído** — polimento: partículas de explosão em pool com
lógica pura própria (`core/particles.ts`), screen shake em morte do jogador,
cadeia do chefão, acerto no núcleo e enfurecimento, efeito CRT (scanlines,
vinheta e banho de fósforo) como Scene sempre no topo, `SettingsScene` (som,
volume em cinco degraus, CRT, tiro automático) acessível do título e da pausa,
barramento de preferências (`systems/settingsBus.ts`) aplicando tudo ao vivo, e
tela de título com campo de estrelas, aliens marchando e modo atração de três
painéis. Pendente: tuning de dificuldade jogando de verdade.

**Milestone 9 concluído em código** — servidor real: migration com `profiles` /
`run_tokens` / `scores` / `submissions`, views `leaderboard_public` e
`leaderboard_mine` (`security_invoker`), RLS de leitura pública e escrita só pela
`service_role`, Edge Functions `runs-start` e `runs-submit` rodando o mesmo
validador do cliente, adapters remotos sobre `fetch` puro (sem SDK) com sessão
persistida e renovada, rate limit por conta e por IP, e `getServices()`
escolhendo local ou Supabase por variável de ambiente. Pendente: **provisionar o
projeto de verdade** — exige conta na Supabase e é passo do usuário
(`docs/supabase-setup.md`, incluindo a conferência que confirma a RLS de pé).

Próximo: tuning de dificuldade jogando de verdade (pendência aberta desde o M6)
e o milestone dos cinco chefões distintos. Ver `PLANO.md`.

**Escopo resolvido:** o chefão é **uma única nave-mãe parametrizada por fase**
(`config/bosses.ts`), não os cinco chefões distintos da especificação. Gêmeos,
Serpente, Fortaleza e Overlord ficam para um milestone próprio — o framework já
os acomoda como variações. Decisão do usuário, com o risco declarado de que a
fase 5 é a fase 1 com números maiores.
