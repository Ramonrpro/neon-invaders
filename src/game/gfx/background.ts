import Phaser from 'phaser';
import { BANDS, PALETTE } from '@game/config/palette';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '@game/config/screen';

/**
 * Faixas de cor por regiao da tela — a versao em codigo das tiras de celofane
 * coladas nos monitores dos gabinetes originais. Sutis de proposito: elas
 * tingem o fundo, nao competem com os sprites.
 */
export function drawBackgroundBands(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  for (const band of Object.values(BANDS)) {
    g.fillStyle(band.color, 0.05);
    g.fillRect(0, band.y0, LOGICAL_WIDTH, band.y1 - band.y0);
  }
  g.lineStyle(1, PALETTE.phosphor, 0.25);
  g.strokeRect(0.5, 0.5, LOGICAL_WIDTH - 1, LOGICAL_HEIGHT - 1);
  return g;
}

/** Linha de chao sob a nave, referencia visual da base da tela. */
export function drawGroundLine(scene: Phaser.Scene, y: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.lineStyle(2, PALETTE.amber, 0.8);
  g.lineBetween(12, y, LOGICAL_WIDTH - 12, y);
  return g;
}
