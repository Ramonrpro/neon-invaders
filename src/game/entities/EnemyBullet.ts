import Phaser from 'phaser';
import { ENEMY_BULLET } from '@game/config/gameplay';
import {
  rollingStepX,
  waveOffsetX,
  type AnyEnemyBulletKind,
  type EnemyBulletKind,
} from '@game/core/enemyFire';
import { TEX } from '@game/gfx/sprites';

const TEXTURE_BY_KIND: Readonly<Record<AnyEnemyBulletKind, string>> = {
  straight: TEX.bulletStraight,
  wave: TEX.bulletWave,
  rolling: TEX.bulletRolling,
  // O leque do chefao usa a textura violeta dele, nao a dos aliens.
  spread: TEX.bulletBoss,
};

const BASE_SPEED_BY_KIND: Readonly<Record<EnemyBulletKind, number>> = {
  straight: ENEMY_BULLET.speedStraight,
  wave: ENEMY_BULLET.speedWave,
  rolling: ENEMY_BULLET.speedRolling,
};

/**
 * Projetil inimigo. Um unico pool serve todos os tipos — a textura e o
 * comportamento trocam no `fire`, o objeto nao.
 *
 * O ondulado guarda a coluna de origem (`anchorX`) e oscila em torno dela; o
 * rolling ignora a ancora e deriva na direcao do jogador, com teto de
 * velocidade lateral (ver `core/enemyFire.ts`); o `spread` do chefao e' o unico
 * com velocidade horizontal propria, constante.
 */
export class EnemyBullet extends Phaser.GameObjects.Image {
  kind: AnyEnemyBulletKind = 'straight';
  private speedY = 0;
  private speedX = 0;
  private anchorX = 0;
  private fallenPx = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, TEX.bulletStraight);
    this.setOrigin(0.5);
    this.setActive(false);
    this.setVisible(false);
    scene.add.existing(this);
  }

  /** Disparo da formacao. @param speedMultiplier multiplicador da fase (`config/levels.ts`) */
  fire(x: number, y: number, kind: EnemyBulletKind, speedMultiplier: number): void {
    this.reset(x, y, kind);
    this.speedY = BASE_SPEED_BY_KIND[kind] * speedMultiplier;
    this.speedX = 0;
  }

  /**
   * Disparo do chefao: reto, mas inclinado.
   *
   * @param angleDeg 0 aponta para baixo, positivo para a direita
   * @param speed magnitude em px/s, sempre positiva
   */
  fireSpread(x: number, y: number, angleDeg: number, speed: number): void {
    this.reset(x, y, 'spread');
    const rad = (angleDeg * Math.PI) / 180;
    this.speedY = Math.cos(rad) * speed;
    this.speedX = Math.sin(rad) * speed;
  }

  private reset(x: number, y: number, kind: AnyEnemyBulletKind): void {
    this.kind = kind;
    this.anchorX = x;
    this.fallenPx = 0;
    this.setTexture(TEXTURE_BY_KIND[kind]);
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
  }

  deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
  }

  /**
   * @param deltaMs delta do frame, em ms
   * @param targetX x da nave do jogador — so' o "rolling" usa
   */
  advance(deltaMs: number, targetX: number): void {
    const seconds = deltaMs / 1000;
    const fall = this.speedY * seconds;
    this.fallenPx += fall;
    this.y += fall;

    switch (this.kind) {
      case 'wave':
        this.x =
          this.anchorX +
          waveOffsetX(this.fallenPx, ENEMY_BULLET.waveAmplitude, ENEMY_BULLET.waveLengthPx);
        break;
      case 'rolling':
        this.x += rollingStepX(this.x, targetX, ENEMY_BULLET.rollingTrackSpeed * seconds);
        break;
      case 'spread':
        this.x += this.speedX * seconds;
        break;
      case 'straight':
        break;
    }
  }
}
