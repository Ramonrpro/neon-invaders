import Phaser from 'phaser';
import { TEX } from '@game/gfx/sprites';

/**
 * Flash de explosao. Sai de um pool, como todo objeto de vida curta.
 *
 * Milestone 3 usa um sprite unico que aparece e some — legivel e barato. As
 * particulas de verdade (tambem em pool) entram no Milestone 8; o consumidor
 * nao muda, so' o que acontece dentro de `advance`.
 */
export class Explosion extends Phaser.GameObjects.Image {
  private remainingMs = 0;
  private totalMs = 1;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, TEX.explosionAlien);
    this.setOrigin(0.5);
    this.setActive(false);
    this.setVisible(false);
    scene.add.existing(this);
  }

  burst(x: number, y: number, texture: string, durationMs: number, tint: number): void {
    this.setTexture(texture);
    this.setPosition(x, y);
    this.setTint(tint);
    this.setAlpha(1);
    this.remainingMs = durationMs;
    this.totalMs = durationMs;
    this.setActive(true);
    this.setVisible(true);
  }

  /** Retorna `true` quando o flash acabou e o objeto pode voltar ao pool. */
  advance(deltaMs: number): boolean {
    this.remainingMs -= deltaMs;
    if (this.remainingMs <= 0) return true;
    this.setAlpha(this.remainingMs / this.totalMs);
    return false;
  }

  deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
    this.clearTint();
  }
}
