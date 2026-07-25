import Phaser from 'phaser';
import { PLAYER } from '@game/config/gameplay';
import { LOGICAL_WIDTH } from '@game/config/screen';
import { nextPlayerX } from '@game/core/movement';
import { TEX } from '@game/gfx/sprites';

/**
 * Nave do jogador. Move so' na horizontal, na base da tela.
 *
 * O cooldown de disparo vive aqui, mas quem manda no valor e' o `PowerUpSystem`
 * via `setFireCooldown` — a nave nao sabe que power-ups existem.
 */
export class Player extends Phaser.GameObjects.Image {
  private cooldownRemainingMs = 0;
  private fireCooldownMs: number = PLAYER.fireCooldownMs;

  constructor(scene: Phaser.Scene) {
    super(scene, LOGICAL_WIDTH / 2, PLAYER.y, TEX.player);
    this.setOrigin(0.5);
    scene.add.existing(this);
  }

  /** Limite esquerdo/direito considerando a largura da nave. */
  private get minX(): number {
    return PLAYER.marginX + this.displayWidth / 2;
  }

  private get maxX(): number {
    return LOGICAL_WIDTH - PLAYER.marginX - this.displayWidth / 2;
  }

  /**
   * @param deltaMs    delta do frame, em ms
   * @param axis       -1 esquerda, 0 parado, 1 direita (teclado)
   * @param dragDeltaX deslocamento do arrasto neste frame, em px logicos
   */
  move(deltaMs: number, axis: -1 | 0 | 1, dragDeltaX = 0): void {
    this.x = nextPlayerX({
      currentX: this.x,
      axis,
      dragDeltaX,
      speed: PLAYER.speed,
      deltaMs,
      minX: this.minX,
      maxX: this.maxX,
    });
  }

  tickCooldown(deltaMs: number): void {
    if (this.cooldownRemainingMs > 0) {
      this.cooldownRemainingMs -= deltaMs;
    }
  }

  get canFire(): boolean {
    return this.cooldownRemainingMs <= 0;
  }

  /** Marca o disparo como feito e reinicia o cooldown. */
  consumeShot(): void {
    this.cooldownRemainingMs = this.fireCooldownMs;
  }

  /** Ponto de saida do projetil: a ponta do canhao. */
  get muzzleY(): number {
    return this.y - this.displayHeight / 2;
  }

  /** Reescrito pelo power-up RAPID a cada coleta. */
  setFireCooldown(ms: number): void {
    this.fireCooldownMs = ms;
  }

  /**
   * Zera a recarga em andamento, nao o valor configurado por `setFireCooldown`.
   * E' o que faz o RAPID sobreviver a morte e a troca de fase sem nenhum
   * cuidado extra de quem chama.
   */
  resetToCenter(): void {
    this.setPosition(LOGICAL_WIDTH / 2, PLAYER.y);
    this.cooldownRemainingMs = 0;
  }
}
