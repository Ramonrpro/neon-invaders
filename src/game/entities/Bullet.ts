import Phaser from 'phaser';

/**
 * Projetil. Sempre vem de um `Pool` — nunca instancie um durante o jogo.
 * Movimento integrado a mao (sem Arcade Physics) para manter a colisao AABB
 * previsivel.
 *
 * Tem componente horizontal desde o Milestone 5: o power-up MULTI abre o
 * disparo em leque de ate' 18 graus para cada lado.
 */
export class Bullet extends Phaser.GameObjects.Image {
  /** px/s. Negativo sobe. */
  velocityY = 0;
  /** px/s. Zero no tiro reto; so' o leque do MULTI usa. */
  velocityX = 0;

  constructor(scene: Phaser.Scene, texture: string) {
    super(scene, 0, 0, texture);
    this.setOrigin(0.5);
    this.setActive(false);
    this.setVisible(false);
    scene.add.existing(this);
  }

  fire(x: number, y: number, velocityY: number, velocityX = 0): void {
    this.setPosition(x, y);
    this.velocityY = velocityY;
    this.velocityX = velocityX;
    this.setActive(true);
    this.setVisible(true);
  }

  deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
  }

  /** @param deltaMs delta do frame, em ms. */
  advance(deltaMs: number): void {
    this.y += (this.velocityY * deltaMs) / 1000;
    this.x += (this.velocityX * deltaMs) / 1000;
  }
}
