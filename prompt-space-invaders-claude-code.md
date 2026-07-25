# PROMPT PARA CLAUDE CODE — Jogo estilo Space Invaders com chefões

> Cole tudo abaixo desta linha na primeira mensagem do Claude Code, dentro de uma pasta vazia.

---

## 0. CONTEXTO E MODO DE TRABALHO

Você é o **orquestrador** deste projeto. Você **não escreve código de feature diretamente** — você planeja, cria os arquivos de configuração, define os contratos entre camadas e **delega** a implementação para dois subagentes especializados usando a ferramenta Task.

**Antes de qualquer código**, execute esta ordem:

1. Leia esta especificação inteira.
2. Crie o `CLAUDE.md` na raiz com: stack, arquitetura de pastas, convenções, contratos entre camadas e decisões arquiteturais já fechadas (seção 10 deste documento). Mantenha esse arquivo atualizado a cada milestone concluído.
3. Crie os dois subagentes em `.claude/agents/`:
   - `.claude/agents/game-frontend.md` — especialista em Phaser 3, game loop, física, input, render, áudio, UI/HUD, responsividade. Ferramentas: Read, Write, Edit, Bash, Glob, Grep.
   - `.claude/agents/game-backend.md` — especialista em contratos de API, camada de persistência, autenticação, ranking, anti-cheat, testes de lógica pura. Ferramentas: Read, Write, Edit, Bash, Glob, Grep.
   Cada arquivo de agente deve conter o escopo do agente, o que ele **não** pode tocar, e o contrato de interface da seção 9.
4. Crie um `PLANO.md` com os milestones da seção 12, com checkboxes.
5. Só então comece o Milestone 1.

**Regra de fronteira entre os agentes (crítica):**
- O agente de frontend **nunca** faz `fetch`, **nunca** toca em `localStorage` diretamente e **nunca** conhece endpoints. Ele consome apenas as interfaces `ScoreService` e `AuthService` (seção 9).
- O agente de backend **nunca** toca em nada dentro de `src/game/`.
- O único ponto de contato é `src/services/` (definido pelo backend, consumido pelo frontend). Se um dos dois precisar mudar esse contrato, ele para e reporta a você, o orquestrador, para renegociar.

Ao final de cada milestone: rode os testes, rode o build, e me mostre um resumo curto do que mudou antes de seguir para o próximo. **Pare e peça confirmação entre milestones.**

---

## 1. VISÃO GERAL DO JOGO

Shoot'em up de tela fixa inspirado no arcade clássico de 1978, rodando no navegador (desktop + mobile), com estética pixel art monocromática/CRT.

- 5 fases fixas. Cada fase = ondas de aliens em formação → ao limpar a formação, entra o **chefão da fase**. Derrotou o chefão, avança de fase.
- Derrotar o chefão da fase 5 = **final do jogo** (tela de vitória + placar final). O jogo tem fim, não é loop infinito.
- Power-ups caem durante o combate e **acumulam**. Ao perder uma vida o jogador **mantém todos os power-ups** — só perde a vida.
- Ranking global e contas de usuário estão no escopo do produto, mas **na v1 tudo roda local**. A arquitetura deve deixar a troca para servidor real ser uma questão de trocar um adapter (seção 9).

**Importante sobre propriedade intelectual:** não copie sprites, sons ou o nome do jogo original da Taito. Toda a arte deve ser **original**, criada como bitmaps definidos em código, apenas *inspirada* na linguagem visual do gênero. Nome de trabalho do projeto: `NEON INVADERS` (posso trocar depois).

---

## 2. STACK E RESTRIÇÕES TÉCNICAS

**Frontend**
- Phaser 3 (última versão estável) + TypeScript + Vite.
- Renderer: `Phaser.AUTO`, `pixelArt: true`, `roundPixels: true`, `antialias: false`.
- Resolução lógica fixa **480 × 640** (retrato 3:4, coerente com o arcade original), escalada com `Scale.FIT` + `autoCenter: CENTER_BOTH`. Todo posicionamento em coordenadas lógicas; nada de hardcode de pixels de tela.
- **Zero assets externos.** Sprites são bitmaps (arrays de 0/1) declarados em TS e convertidos em texturas via `Phaser.Textures.CanvasTexture` no boot. Áudio é sintetizado via WebAudio (osciladores square/noise) — nenhum `.png`, `.mp3` ou fonte externa. Fonte do HUD: pixel font desenhada como bitmap ou fonte de sistema monoespaçada estilizada.
- Física: **não use Arcade Physics para tudo.** A formação de aliens usa movimento em passos discretos (step-based, ver 3.2) controlado por timer próprio. Use Arcade Physics apenas para projéteis e colisões simples, ou colisão AABB manual se ficar mais previsível.
- Lógica de jogo (spawn de power-ups, balanceamento, cálculo de score, estado de fase) deve ficar em **módulos puros e testáveis**, separados das Scenes do Phaser.

**Backend (v1 local)**
- Sem servidor rodando na v1. Implementação `LocalAdapter` sobre `localStorage`, atrás das interfaces da seção 9.
- Contrato REST já definido e documentado em `docs/api-contract.md`, pronto para um `RemoteAdapter` futuro. **Não escolha ainda** entre Supabase / Node+Postgres / Next.js API routes — isso será decidido no Milestone 7.

**Qualidade**
- TypeScript em `strict: true`.
- Vitest para a lógica pura (mínimo: cálculo de score, spawn/stacking de power-ups, progressão de dificuldade, validação de score do backend).
- ESLint + Prettier.
- Alvo de performance: **60 fps estáveis** em Chrome desktop e em um Android mediano. Sem alocação de objetos por frame no game loop (use pools para projéteis, partículas e explosões).

---

## 3. ESPECIFICAÇÃO DE GAMEPLAY

### 3.1 Nave do jogador
- Move só na horizontal, na base da tela.
- 3 vidas. Vida extra ao atingir **5.000 pontos** (uma única vez).
- Ao ser atingida: explosão, congela a ação por ~1s, respawn com 1,5s de invulnerabilidade piscando. **Power-ups são mantidos.**
- Tiro base: projétil vertical, cooldown 400ms, **máximo 2 projéteis do jogador na tela ao mesmo tempo** (o limite de 1 tiro do original é fiel demais e briga com o auto-fire do mobile — power-ups elevam os dois limites).

### 3.2 Formação de aliens
- Grade de **5 linhas × 11 colunas = 55 aliens**, 3 tipos visuais:
  - 2 linhas de baixo: tipo A — **10 pts**
  - 2 linhas do meio: tipo B — **20 pts**
  - linha de cima: tipo C — **30 pts**
- Cada tipo tem **2 frames de animação** que alternam a cada passo (isso cria a marcha característica).
- Movimento **step-based**: a formação inteira anda um passo lateral a cada tick. Ao encostar na borda lateral, ela **desce uma linha e inverte** a direção.
- **Aceleração (mecânica-assinatura):** o intervalo entre ticks é proporcional à quantidade de aliens vivos.
  `intervaloMs = intervaloBase * (aliensVivos / 55)`, com piso de ~60ms.
  Ou seja: quanto menos aliens sobram, mais rápido eles marcham. O último alien é frenético. **Isso não é bug, é o coração do jogo.**
- Cada passo dispara uma nota do "heartbeat" (4 notas graves descendentes em loop) que acelera junto — é o principal gerador de tensão.
- Derrota instantânea se qualquer alien alcançar a linha da nave.

### 3.3 Tiro dos aliens
- Só a coluna mais baixa de cada coluna viva pode atirar.
- Três tipos de projétil inimigo, com sprites e velocidades diferentes: reto, ondulado e "rolling" (este mira aproximadamente na coluna do jogador).
- Máximo de projéteis inimigos simultâneos e frequência de disparo aumentam por fase (tabela 4).

### 3.4 Escudos (bunkers)
- 4 bunkers destrutíveis acima da nave.
- Destruição **pixel a pixel**: implemente cada bunker como um `RenderTexture`; no impacto, apague uma máscara circular irregular (`erase`) e verifique colisão contra os pixels restantes. Nada de "bunker com 5 de HP".
- Bunkers bloqueiam tiro do jogador **e** do inimigo. Aliens que passam por cima de um bunker o destroem.
- Bunkers são restaurados a cada nova fase, não a cada vida.

### 3.5 UFO / nave misteriosa
- Cruza o topo da tela em intervalos semi-aleatórios (a cada 20–30s), com som próprio.
- Vale bônus variável: **50 / 100 / 150 / 300** pts.
- **O UFO sempre solta um power-up ao ser destruído.** É o principal incentivo para persegui-lo.

### 3.6 Condições de fim
- Game over: perdeu as 3 vidas, ou aliens chegaram na base.
- Vitória: chefão da fase 5 derrotado.
- Em ambos: tela de resultado com score, fase alcançada, tempo total, e envio do score para o ranking.

---

## 4. AS 5 FASES — TABELA DE BALANCEAMENTO

O agente de frontend deve implementar isso como um **arquivo de configuração de dados** (`src/game/config/levels.ts`), nunca como números espalhados pelo código. Estes valores são o ponto de partida para tuning.

| Fase | Linha inicial da formação | Intervalo base (ms) | Máx. tiros inimigos | Chance de tiro/tick | Vel. projétil inimigo | Power-up drop rate |
|------|---------------------------|---------------------|---------------------|---------------------|----------------------|--------------------|
| 1 | alta | 550 | 2 | 6% | 1.0× | 8% |
| 2 | +1 linha abaixo | 480 | 3 | 8% | 1.1× | 8% |
| 3 | +2 linhas abaixo | 420 | 4 | 10% | 1.2× | 7% |
| 4 | +3 linhas abaixo | 360 | 5 | 13% | 1.35× | 7% |
| 5 | +4 linhas abaixo | 300 | 6 | 16% | 1.5× | 6% |

A partir da fase 3, aliens do tipo B ganham chance de **se dividir em dois aliens menores e mais rápidos** ao morrer (homenagem aos "splitters" do arcade original) — 25% de chance na fase 3, 40% na 4, 50% na 5.

---

## 5. POWER-UPS

### Regras gerais
- Caem de aliens destruídos com a probabilidade da tabela acima, **e sempre do UFO**.
- Descem lentamente; o jogador precisa **encostar** para coletar (se cair fora da tela, perde).
- **Acumulam e persistem através das mortes e das fases.** Só zeram em novo jogo.
- Cooldown mínimo global de 10s entre drops, para não virar chuva de power-up.
- Ícone pixel art distinto + cor distinta + som distinto para cada tipo.
- HUD mostra o nível atual de cada power-up ativo.

### v1 — dois power-ups (além do disparo padrão)
1. **RAPID (cadência de tiro)** — 5 níveis.
   Cooldown de disparo: 400 → 320 → 250 → 190 → 140 → 100ms.
   Cada nível também soma +1 ao limite de projéteis do jogador na tela.
2. **MULTI (múltiplos tiros)** — 4 níveis.
   Projéteis por disparo: 1 → 2 (paralelos) → 3 (leque leve) → 4 (paralelos + leque) → 5 (leque completo).
   Ângulo máximo do leque: 18°.

Ao atingir o nível máximo de um power-up, coletar de novo vale **500 pontos** em vez de subir nível.

### Backlog (implementar só depois da v1 estar fechada, deixe a arquitetura preparada)
Escudo temporário, laser perfurante (atravessa vários aliens), tiro guiado, bomba de tela, vida extra, slow motion, drone auxiliar. A arquitetura de power-ups deve ser um **registry** onde adicionar um novo tipo custa um arquivo e uma entrada, sem tocar no resto.

---

## 6. OS 5 CHEFÕES

Padrão comum: entra por cima com animação; barra de HP no topo; **ponto fraco** que precisa ser acertado (dano em outras partes conta metade ou zero); a **50% de HP muda de padrão** e fica mais agressivo; ao morrer, explode em cadeia e solta 2 power-ups.

| # | Nome | HP | Ponto fraco | Padrão fase 1 | Padrão fase 2 (≤50% HP) |
|---|------|-----|-------------|---------------|--------------------------|
| 1 | **Sentinela** | 40 | núcleo central | Varre a tela horizontalmente, dispara leque de 3 a cada 2s | Dobra a velocidade, leque de 5 |
| 2 | **Gêmeos** | 30 + 30 | dois núcleos independentes | Dois corpos se movem em espelho, tiros alternados | Ao matar um, o sobrevivente entra em fúria e invoca 2 aliens a cada 8s |
| 3 | **Serpente** | 8 segmentos × 12 | só a cabeça | Corpo segmentado em movimento senoidal; segmentos atingidos se soltam e viram aliens hostis | Perde metade do corpo, ganha velocidade e dispara pela cauda |
| 4 | **Fortaleza** | 90 | núcleo, exposto só ao abrir | Escudo orbital rotativo que bloqueia tiros; abre por 2s para disparar um laser vertical telegrafado | Abre menos tempo, dois lasers, invoca minions |
| 5 | **Overlord** | 3 estágios × 60 | muda de ponto fraco a cada estágio | Estágio 1: chuva de mísseis. Estágio 2: laser de varredura + escudo. Estágio 3: combina todos os padrões anteriores | — (o estágio 3 já é o clímax) |

Todo ataque de chefão precisa de **telegraph visual** (flash/carga de 0,4–0,6s antes de disparar). Nada de dano impossível de prever.

---

## 7. CONTROLES

**Mobile (prioridade de design)**
- **Arrastar o dedo em qualquer lugar da tela** move a nave (movimento relativo ao delta do dedo, com um pequeno multiplicador — não teleporte a nave para o dedo, e não force o jogador a cobrir a nave com o polegar).
- **Tiro automático e contínuo**, sempre ativo. Sem botão de tiro.
- Suportar retrato como orientação primária; em paisagem, aplicar letterbox mantendo a área lógica.
- Prevenir scroll, pull-to-refresh, zoom por duplo toque e seleção de texto.
- Pausar automaticamente ao perder foco / minimizar (`visibilitychange`).

**Desktop**
- Setas ou A/D para mover; Espaço para atirar; auto-fire ao segurar.
- Opção de auto-fire permanente nas configurações (paridade com mobile).
- P ou Esc pausa. Enter confirma nos menus.

**Ambos**
- Detectar entrada por toque vs. teclado e adaptar as instruções da tela de título automaticamente.

---

## 8. VISUAL E ÁUDIO

- Paleta base **monocromática verde fósforo** (`#00ff41` sobre preto), com faixas de cor por região da tela (como as tiras de celofane coladas nos monitores dos arcades originais): topo em ciano, faixa dos bunkers em verde, base em amarelo. Chefões e power-ups quebram a regra com cor própria — assim se destacam.
- Efeito CRT opcional e desligável: scanlines sutis, leve vinheta, glow nos sprites. **Desligado por padrão no mobile** (custo de fillrate).
- Screen shake curto em explosões grandes e no dano do chefão. Partículas de explosão a partir do pool.
- Áudio 100% sintetizado em WebAudio: heartbeat de 4 notas que acelera com a formação, tiro (square curto), explosão (noise com envelope), UFO (sirene modulada), coleta de power-up (arpejo ascendente), alerta de chefão.
- Áudio precisa ser inicializado no **primeiro gesto do usuário** (política de autoplay dos navegadores) e ter mute persistido.

---

## 9. CONTRATO ENTRE FRONTEND E BACKEND

O agente de backend cria e é dono destes arquivos. O agente de frontend só os importa.

```ts
// src/services/types.ts

export interface ScoreEntry {
  id: string;
  playerName: string;
  score: number;
  levelReached: number;      // 1..5
  durationMs: number;
  completedGame: boolean;
  createdAt: string;         // ISO
}

export interface RunSubmission {
  runToken: string;          // emitido em startRun()
  score: number;
  levelReached: number;
  durationMs: number;
  completedGame: boolean;
  events: RunEventSummary;   // base do anti-cheat: kills por tipo, powerups coletados, tiros disparados
}

export interface ScoreService {
  startRun(): Promise<{ runToken: string }>;
  submitRun(sub: RunSubmission): Promise<{ accepted: boolean; rank?: number; reason?: string }>;
  getLeaderboard(scope: 'global' | 'weekly' | 'me', limit?: number): Promise<ScoreEntry[]>;
  getPersonalBest(): Promise<ScoreEntry | null>;
}

export interface AuthService {
  getSession(): Promise<Session | null>;
  signInAsGuest(displayName: string): Promise<Session>;
  signUp(email: string, password: string, displayName: string): Promise<Session>;
  signIn(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;
}
```

**Na v1**, implemente `LocalScoreService` e `LocalAuthService` sobre `localStorage`, com a **mesma assinatura assíncrona** da versão remota (todos os métodos retornam Promise — assim trocar o adapter não muda uma linha do frontend). Modo convidado funciona sem cadastro; o jogo é 100% jogável sem conta.

Além disso, o agente de backend deve produzir:
- `docs/api-contract.md` com os endpoints REST equivalentes (`POST /api/runs/start`, `POST /api/runs/submit`, `GET /api/leaderboard`, `POST /api/auth/*`), payloads e códigos de erro.
- `docs/anti-cheat.md`: como o servidor futuro vai validar uma run — score máximo teoricamente possível por fase, coerência entre duração e fase alcançada, coerência entre kills e score, rate limit por conta, e o fato de que **o score nunca pode ser confiado vindo do cliente**. Deixe isso escrito agora, porque ranking global sem isso vira lixo em uma semana.
- Testes Vitest do validador de plausibilidade de run (que já roda local, mesmo sem servidor).

---

## 10. ARQUITETURA DE PASTAS

```
/
├─ CLAUDE.md
├─ PLANO.md
├─ index.html
├─ src/
│  ├─ main.ts
│  ├─ game/                    ← território exclusivo do agente frontend
│  │  ├─ scenes/               (Boot, Preload, Title, Game, Boss, GameOver, Victory, Leaderboard, Settings)
│  │  ├─ entities/             (Player, AlienGrid, Alien, Bullet, Ufo, Bunker, PowerUp, bosses/)
│  │  ├─ systems/              (InputSystem, AudioSystem, PowerUpSystem, ScoreSystem, DifficultySystem, PoolSystem)
│  │  ├─ config/               (levels.ts, powerups.ts, bosses.ts, palette.ts)
│  │  ├─ gfx/                  (bitmaps de sprites + gerador de texturas)
│  │  └─ core/                 (lógica pura testável, sem import do Phaser)
│  ├─ services/                ← território exclusivo do agente backend
│  │  ├─ types.ts
│  │  ├─ local/
│  │  └─ remote/               (stub por enquanto)
│  └─ ui/                      (HUD, overlays, telas de menu em DOM sobre o canvas)
├─ tests/
└─ docs/
```

Regra dura: **nada dentro de `src/game/core/` pode importar Phaser.** Isso é o que torna o balanceamento testável.

---

## 11. DEFINITION OF DONE

Uma feature só está pronta quando:
- roda a 60fps no desktop e em mobile;
- funciona com toque e com teclado;
- não gera lixo de GC no loop (projéteis/partículas via pool);
- os números de balanceamento estão em `config/`, não espalhados;
- a lógica pura correspondente tem teste;
- `npm run build` e `npm run test` passam limpos.

---

## 12. MILESTONES (pare e me consulte ao fim de cada um)

1. **Setup** — Vite + TS + Phaser + ESLint + Vitest. Scene de boot renderizando o gerador de sprites bitmap na tela. `CLAUDE.md` e os dois subagentes criados.
2. **Loop base** *(frontend)* — nave, movimento, tiro, formação 5×11 com marcha step-based acelerando, colisões, morte de alien, HUD de score/vidas.
3. **Fidelidade clássica** *(frontend)* — bunkers destrutíveis pixel a pixel, três tipos de tiro inimigo, UFO com bônus, heartbeat de áudio acelerando, vidas/respawn/game over.
4. **Mobile** *(frontend)* — arrasto + auto-fire, escala responsiva, pausa por perda de foco, bloqueio de gestos do navegador, teste em viewport real de celular.
5. **Power-ups** *(frontend)* — registry, drop, coleta, stacking de RAPID e MULTI, persistência através da morte, HUD.
6. **Fases e chefões** *(frontend)* — as 5 fases com a tabela de balanceamento, os 5 chefões com dois padrões cada, telegraphs, transições, tela de vitória.
7. **Persistência** *(backend)* — interfaces, adapters locais, modo convidado, tela de ranking, doc de contrato REST, doc de anti-cheat, testes do validador.
8. **Polimento** — CRT toggle, screen shake, partículas, tela de título, tela de settings, tuning de dificuldade jogando de verdade.
9. **Servidor real** — *bloqueado, decisão de stack pendente. Não comece.*

---

## 13. COMECE AGORA POR

Milestone 1 apenas. Ao terminar, me mostre a estrutura de arquivos criada, o conteúdo do `CLAUDE.md`, os dois arquivos de agente, e a tela de boot rodando. Depois pare e aguarde minha confirmação.
