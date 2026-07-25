import Phaser from 'phaser';
import { POWERUP_DROP, type PowerUpDefinition, type PowerUpId } from '@game/config/powerups';
import { PLAY_HEIGHT } from '@game/config/screen';

/**
 * A capsula que cai. Sempre vem de um `Pool` — nunca instancie uma durante o
 * jogo.
 *
 * O icone ja' nasce colorido na textura (cada tipo tem a cor dele), entao a
 * capsula nao usa tint: trocar a textura basta. O pisca e' derivado do relogio,
 * sem tween — igual a invulnerabilidade da nave, o estado e' sempre recalculavel
 * e nao sobra animacao viva quando o objeto volta para o pool.
 */
export class PowerUp extends Phaser.GameObjects.Image {
  /** Qual power-up esta capsula concede. Valido so' enquanto ativa. */
  private powerUpId: PowerUpId | null = null;

  private elapsedMs = 0;

  constructor(scene: Phaser.Scene, texture: string) {
    super(scene, 0, 0, texture);
    this.setOrigin(0.5);
    this.setActive(false);
    this.setVisible(false);
    scene.add.existing(this);
  }

  get id(): PowerUpId {
    if (!this.powerUpId) throw new Error('PowerUp.id lido com a capsula inativa');
    return this.powerUpId;
  }

  drop(x: number, y: number, definition: PowerUpDefinition): void {
    this.powerUpId = definition.id;
    this.setTexture(definition.texture);
    this.setPosition(x, y);
    this.setAlpha(1);
    this.elapsedMs = 0;
    this.setActive(true);
    this.setVisible(true);
  }

  deactivate(): void {
    this.powerUpId = null;
    this.setActive(false);
    this.setVisible(false);
  }

  /** Avanca a queda e devolve `true` quando saiu pela base da tela. */
  advance(deltaMs: number): boolean {
    this.y += (POWERUP_DROP.fallSpeed * deltaMs) / 1000;

    this.elapsedMs += deltaMs;
    const phase = Math.floor(this.elapsedMs / POWERUP_DROP.blinkPeriodMs) % 2;
    this.setAlpha(phase === 0 ? 1 : 0.55);

    return this.y - this.displayHeight / 2 > PLAY_HEIGHT;
  }

  /** AABB contra um retangulo qualquer — na pratica, a nave. */
  overlaps(left: number, top: number, right: number, bottom: number): boolean {
    const halfW = this.displayWidth / 2;
    const halfH = this.displayHeight / 2;
    if (right < this.x - halfW || left > this.x + halfW) return false;
    if (bottom < this.y - halfH || top > this.y + halfH) return false;
    return true;
  }
}
