import Phaser from 'phaser';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '@game/config/screen';
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
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
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

const game = new Phaser.Game(config);

// Ponte de depuracao, apenas em `npm run dev`: permite inspecionar e dirigir o
// jogo pelo console do navegador. Some do bundle de producao.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
