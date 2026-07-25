import Phaser from 'phaser';
import { BANDS, PALETTE } from '@game/config/palette';
import { LOGICAL_WIDTH, PLAY_HEIGHT } from '@game/config/screen';

/**
 * Faixas de cor por regiao da tela — a versao em codigo das tiras de celofane
 * coladas nos monitores dos gabinetes originais. Sutis de proposito: elas
 * tingem o fundo, nao competem com os sprites.
 *
 * A altura e' parametro porque as duas superficies do jogo sao diferentes: a
 * `GameScene` pinta so' a area de jogo, e a moldura em `PLAY_HEIGHT` e' o que
 * separa visualmente a acao do deck de arrasto; a `TitleScene` pinta a tela
 * inteira, onde um traco atravessado no meio pareceria defeito.
 */
export function drawBackgroundBands(
  scene: Phaser.Scene,
  height: number = PLAY_HEIGHT,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  for (const band of Object.values(BANDS)) {
    g.fillStyle(band.color, 0.05);
    g.fillRect(0, band.y0, LOGICAL_WIDTH, band.y1 - band.y0);
  }
  // A ultima banda para em `PLAY_HEIGHT`; se a superficie for mais alta que a
  // area de jogo, o resto continua na mesma tinta em vez de virar um degrau.
  if (height > BANDS.base.y1) {
    g.fillStyle(BANDS.base.color, 0.05);
    g.fillRect(0, BANDS.base.y1, LOGICAL_WIDTH, height - BANDS.base.y1);
  }
  g.lineStyle(1, PALETTE.phosphor, 0.25);
  g.strokeRect(0.5, 0.5, LOGICAL_WIDTH - 1, height - 1);
  return g;
}

/** Linha de chao sob a nave, referencia visual da base da tela. */
export function drawGroundLine(scene: Phaser.Scene, y: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.lineStyle(2, PALETTE.amber, 0.8);
  g.lineBetween(12, y, LOGICAL_WIDTH - 12, y);
  return g;
}
