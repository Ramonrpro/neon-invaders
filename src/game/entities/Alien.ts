import Phaser from 'phaser';
import type { AlienType } from '@game/core/scoring';
import { pointsForAlien } from '@game/core/scoring';
import { TEX } from '@game/gfx/sprites';

/** As duas texturas de cada tipo — alternadas a cada passo, criando a marcha. */
const FRAMES: Readonly<Record<AlienType, readonly [string, string]>> = {
  A: [TEX.alienA0, TEX.alienA1],
  B: [TEX.alienB0, TEX.alienB1],
  C: [TEX.alienC0, TEX.alienC1],
};

/**
 * Um alien da formacao. Nao tem corpo de fisica: posicao e' escrita pelo
 * `AlienGrid` a cada passo e a colisao e' AABB manual.
 */
export class Alien extends Phaser.GameObjects.Image {
  readonly alienType: AlienType;
  readonly row: number;
  readonly col: number;
  readonly points: number;

  constructor(scene: Phaser.Scene, type: AlienType, row: number, col: number) {
    super(scene, 0, 0, FRAMES[type][0]);
    this.alienType = type;
    this.row = row;
    this.col = col;
    this.points = pointsForAlien(type);
    this.setOrigin(0.5);
    scene.add.existing(this);
  }

  setFrameIndex(index: 0 | 1): void {
    this.setTexture(FRAMES[this.alienType][index]);
  }

  revive(x: number, y: number): void {
    this.setPosition(x, y);
    this.setFrameIndex(0);
    this.setActive(true);
    this.setVisible(true);
  }

  kill(): void {
    this.setActive(false);
    this.setVisible(false);
  }

  get left(): number {
    return this.x - this.displayWidth / 2;
  }

  get right(): number {
    return this.x + this.displayWidth / 2;
  }

  get top(): number {
    return this.y - this.displayHeight / 2;
  }

  get bottom(): number {
    return this.y + this.displayHeight / 2;
  }
}
