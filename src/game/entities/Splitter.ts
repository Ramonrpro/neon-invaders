import Phaser from 'phaser';
import { SPLITTER, SPLITTER_MAX_X, SPLITTER_MIN_X } from '@game/config/gameplay';
import { PLAY_HEIGHT } from '@game/config/screen';
import { bounceStepX, type HorizontalDirection } from '@game/core/motion';
import { hasEscaped } from '@game/core/splitter';
import { TEX } from '@game/gfx/sprites';

/**
 * O bicho menor que sai de um alien tipo B partido — e o mesmo objeto que a
 * nave-mae invoca como minion.
 *
 * E' a UNICA ameaca do jogo que se move livre, fora da grade da formacao: desce
 * continuamente enquanto deriva para um lado, quicando nas paredes. Sempre vem
 * de um `Pool`.
 */
export class Splitter extends Phaser.GameObjects.Image {
  private direction: HorizontalDirection = 1;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, TEX.splitter);
    this.setOrigin(0.5);
    this.setActive(false);
    this.setVisible(false);
    scene.add.existing(this);
  }

  /** @param direction para que lado ele deriva. Ver `childDirection`. */
  spawn(x: number, y: number, direction: HorizontalDirection): void {
    this.direction = direction;
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
  }

  deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
  }

  /** Avanca e devolve `true` quando escapou pela base da tela. */
  advance(deltaMs: number): boolean {
    this.y += (SPLITTER.fallSpeed * deltaMs) / 1000;

    const step = bounceStepX({
      x: this.x,
      direction: this.direction,
      speed: SPLITTER.driftSpeed,
      deltaMs,
      halfWidth: this.displayWidth / 2,
      minX: SPLITTER_MIN_X,
      maxX: SPLITTER_MAX_X,
    });
    this.x = step.x;
    this.direction = step.direction;

    return hasEscaped(this.y, this.displayHeight / 2, PLAY_HEIGHT);
  }

  /** AABB contra um retangulo qualquer — projetil do jogador ou a nave. */
  overlaps(left: number, top: number, right: number, bottom: number): boolean {
    const halfW = this.displayWidth / 2;
    const halfH = this.displayHeight / 2;
    if (right < this.x - halfW || left > this.x + halfW) return false;
    if (bottom < this.y - halfH || top > this.y + halfH) return false;
    return true;
  }
}
