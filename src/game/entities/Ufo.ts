import Phaser from 'phaser';
import { UFO } from '@game/config/gameplay';
import { LOGICAL_WIDTH } from '@game/config/screen';
import { TEX } from '@game/gfx/sprites';

/**
 * A nave misteriosa. Cruza o topo em linha reta, a cada 20–30 s, e vale bonus
 * variavel. A partir do Milestone 5 ela **sempre** solta um power-up — e' o que
 * justifica largar a formacao e ir atras dela.
 *
 * Existe uma unica instancia, reciclada; nunca e' recriada.
 */
export class Ufo extends Phaser.GameObjects.Image {
  private velocityX = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, UFO.y, TEX.ufo);
    this.setOrigin(0.5);
    this.setActive(false);
    this.setVisible(false);
    scene.add.existing(this);
  }

  /** @param fromLeft entra pela esquerda? Sorteado a cada aparicao. */
  launch(fromLeft: boolean): void {
    const margin = UFO.offscreenMarginX;
    this.setPosition(fromLeft ? -margin : LOGICAL_WIDTH + margin, UFO.y);
    this.velocityX = fromLeft ? UFO.speed : -UFO.speed;
    this.setActive(true);
    this.setVisible(true);
  }

  deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
  }

  /** Avanca e devolve `true` quando saiu da tela pelo outro lado. */
  advance(deltaMs: number): boolean {
    this.x += (this.velocityX * deltaMs) / 1000;
    const margin = UFO.offscreenMarginX;
    return this.x < -margin || this.x > LOGICAL_WIDTH + margin;
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
