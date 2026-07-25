/**
 * Vitrine de sprites — ferramenta de desenvolvimento, acessivel em `?sprites`.
 *
 * Mostra toda a arte gerada em codigo, com os aliens alternando os dois frames.
 * Serve para conferir legibilidade e alinhamento sem precisar jogar.
 */

import Phaser from 'phaser';
import { PALETTE, toCss } from '@game/config/palette';
import { CANVAS_HEIGHT, CENTER_X, HUD_FONT_FAMILY } from '@game/config/screen';
import { TEX } from '@game/gfx/sprites';
import { drawBackgroundBands } from '@game/gfx/background';

const FRAME_INTERVAL_MS = 500;

interface ShowcaseRow {
  readonly frames: readonly [string, string];
  readonly label: string;
}

export class SpriteShowcaseScene extends Phaser.Scene {
  private animated: Phaser.GameObjects.Image[] = [];
  private rows: ShowcaseRow[] = [];
  private frameIndex: 0 | 1 = 0;

  constructor() {
    super('SpriteShowcase');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.black);
    drawBackgroundBands(this, CANVAS_HEIGHT);

    this.add
      .text(CENTER_X, 34, 'NEON INVADERS', {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '30px',
        color: toCss(PALETTE.phosphor),
      })
      .setOrigin(0.5);

    this.add
      .text(CENTER_X, 64, 'VITRINE DE SPRITES', {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '12px',
        color: toCss(PALETTE.cyan),
      })
      .setOrigin(0.5);

    this.rows = [
      { frames: [TEX.alienC0, TEX.alienC1], label: 'TIPO C   30 PTS' },
      { frames: [TEX.alienB0, TEX.alienB1], label: 'TIPO B   20 PTS' },
      { frames: [TEX.alienA0, TEX.alienA1], label: 'TIPO A   10 PTS' },
    ];

    this.rows.forEach((row, index) => {
      const y = 140 + index * 62;
      this.animated.push(this.add.image(150, y, row.frames[0]).setOrigin(0.5));
      this.label(y, row.label, PALETTE.phosphor);
    });

    this.showStatic(340, TEX.ufo, 'UFO   50-300 PTS', PALETTE.cyan);
    this.showStatic(400, TEX.iconRapid, 'POWER-UP RAPID', PALETTE.magenta);
    this.showStatic(450, TEX.iconMulti, 'POWER-UP MULTI', PALETTE.violet);
    this.showStatic(505, TEX.bulletPlayer, 'TIRO DO JOGADOR', PALETTE.white);
    this.showStatic(555, TEX.bulletStraight, 'TIRO INIMIGO', PALETTE.white);

    this.add.image(CENTER_X, 605, TEX.player).setOrigin(0.5);

    this.time.addEvent({
      delay: FRAME_INTERVAL_MS,
      loop: true,
      callback: () => this.stepFrames(),
    });
  }

  private label(y: number, text: string, color: number): void {
    this.add
      .text(210, y, text, {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '14px',
        color: toCss(color),
      })
      .setOrigin(0, 0.5);
  }

  private showStatic(y: number, key: string, text: string, color: number): void {
    this.add.image(150, y, key).setOrigin(0.5);
    this.label(y, text, color);
  }

  private stepFrames(): void {
    this.frameIndex = this.frameIndex === 0 ? 1 : 0;
    this.animated.forEach((image, index) => {
      const row = this.rows[index];
      if (row) image.setTexture(row.frames[this.frameIndex]);
    });
  }
}
