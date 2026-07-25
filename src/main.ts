import Phaser from 'phaser';
import { CANVAS_HEIGHT, DECK_HEIGHT, LOGICAL_WIDTH } from '@game/config/screen';
import { PALETTE } from '@game/config/palette';
import { BootScene } from '@game/scenes/BootScene';
import { CrtScene } from '@game/scenes/CrtScene';
import { TitleScene } from '@game/scenes/TitleScene';
import { GameScene } from '@game/scenes/GameScene';
import { GameOverScene } from '@game/scenes/GameOverScene';
import { LeaderboardScene } from '@game/scenes/LeaderboardScene';
import { PauseScene } from '@game/scenes/PauseScene';
import { SettingsScene } from '@game/scenes/SettingsScene';
import { VictoryScene } from '@game/scenes/VictoryScene';
import { SpriteShowcaseScene } from '@game/scenes/SpriteShowcaseScene';
import { initPwa } from '@pwa/index';

/*
 * PRIMEIRA instrucao do arquivo, antes de o Phaser subir. O Chrome dispara
 * `beforeinstallprompt` logo depois de parsear o manifest — muito antes do
 * primeiro frame — e um listener instalado depois perde o evento para sempre
 * naquela visita, deixando a linha "INSTALAR APP" invisivel sem erro nenhum.
 */
initPwa();

/**
 * Sem Arcade Physics: a formacao anda em passos discretos e as colisoes de
 * projetil sao AABB manual. Menos indireção, resultado mais previsivel em
 * sprites de pixel art pequenos.
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: PALETTE.black,
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  // Menu de contexto no toque longo tira o dedo do jogo no meio de uma onda.
  disableContextMenu: true,
  scale: {
    /**
     * FIT preserva a proporcao 3:4 e encaixa no espaco disponivel. E' o que
     * entrega o retrato como formato primario sem precisar travar orientacao
     * (a web so' permite isso em tela cheia): em paisagem o mesmo FIT vira
     * letterbox, com barras pretas nas laterais e o jogo inteiro visivel.
     */
    mode: Phaser.Scale.FIT,
    /**
     * `NO_CENTER` de proposito: quem posiciona o canvas e' o CSS do `#app`,
     * sozinho. O `autoCenter` do Phaser trabalha escrevendo `marginLeft` e
     * `marginTop` no canvas (ver `ScaleManager.updateCenter`), e o canvas e'
     * flex item de um container com `align-items`/`justify-content: center` —
     * num container flex o centramento e' da MARGIN BOX, entao as duas
     * centralizacoes se somavam e a borda de cima caia em 75% da folga em vez
     * de 50%. Era por isso que a barra preta de cima era maior que a de baixo.
     */
    autoCenter: Phaser.Scale.NO_CENTER,
    width: LOGICAL_WIDTH,
    /**
     * A altura e' a do CANVAS, nao a da area de jogo: num celular retrato ela
     * inclui o deck de arrasto. Ver `config/screen.ts` e `core/viewport.ts`.
     */
    height: CANVAS_HEIGHT,
    /** Escala em pixels inteiros — meio pixel borra a arte. */
    autoRound: true,
  },
  scene: [
    BootScene,
    TitleScene,
    GameScene,
    GameOverScene,
    VictoryScene,
    PauseScene,
    LeaderboardScene,
    SettingsScene,
    SpriteShowcaseScene,
    /**
     * Ultima da lista de proposito: a ordem de render segue a ordem em que as
     * Scenes entram no gerenciador, e o vidro do monitor tem de ficar sobre
     * tudo o mais. Ela ainda chama `bringToTop` no proprio `create` — cinto e
     * suspensorio, porque uma Scene nova adicionada abaixo desta linha por
     * descuido apagaria o efeito sem erro nenhum.
     */
    CrtScene,
  ],
};

/*
 * Com deck, o canvas encosta no topo da tela — e' o que empurra a acao para
 * longe do polegar e deixa a faixa de arrasto embaixo. Sem deck (desktop e
 * tablet 4:3) ele continua centrado. Mexer no DOM daqui e' legitimo: `main.ts`
 * e a casca do app sao do mesmo dono, e `src/game/` nao sabe que isto existe.
 */
document.getElementById('app')?.classList.toggle('deck-top', DECK_HEIGHT > 0);

const game = new Phaser.Game(config);

// Ponte de depuracao, apenas em `npm run dev`: permite inspecionar e dirigir o
// jogo pelo console do navegador. Some do bundle de producao.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
