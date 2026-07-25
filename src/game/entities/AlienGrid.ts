import Phaser from 'phaser';
import { Alien } from '@game/entities/Alien';
import {
  FORMATION,
  FORMATION_MAX_X,
  FORMATION_MIN_X,
  FORMATION_START_X,
} from '@game/config/gameplay';
import type { LevelConfig } from '@game/config/levels';
import { marchIntervalMs } from '@game/core/difficulty';
import {
  alienTypeForRow,
  cellCenter,
  planMarchStep,
  type MarchDirection,
} from '@game/core/formation';

export interface MarchStepOutcome {
  /** Este passo foi uma descida (encostou na borda e inverteu). */
  descended: boolean;
}

/**
 * A formacao 5x11.
 *
 * Os 55 aliens sao criados uma unica vez e reciclados a cada onda — o grid
 * nunca aloca durante o jogo. O movimento e' step-based, comandado por um
 * acumulador proprio; o intervalo entre passos encolhe conforme os aliens
 * morrem (ver `core/difficulty.ts`).
 */
export class AlienGrid {
  private readonly aliens: Alien[] = [];
  private direction: MarchDirection = 1;
  private frameIndex: 0 | 1 = 0;
  private originX = 0;
  private originY = 0;
  private accumulatorMs = 0;
  private baseIntervalMs = 550;
  private aliveCount = 0;

  constructor(scene: Phaser.Scene) {
    for (let row = 0; row < FORMATION.rows; row++) {
      const type = alienTypeForRow(row);
      for (let col = 0; col < FORMATION.cols; col++) {
        this.aliens.push(new Alien(scene, type, row, col));
      }
    }
  }

  get alive(): number {
    return this.aliveCount;
  }

  get isCleared(): boolean {
    return this.aliveCount === 0;
  }

  get all(): readonly Alien[] {
    return this.aliens;
  }

  get columns(): number {
    return FORMATION.cols;
  }

  /** Intervalo atual entre passos — o HUD de debug e o heartbeat usam isso. */
  get currentIntervalMs(): number {
    return marchIntervalMs(this.baseIntervalMs, this.aliveCount);
  }

  /** (Re)monta a formacao cheia para a fase informada. */
  build(level: LevelConfig): void {
    this.direction = 1;
    this.frameIndex = 0;
    this.accumulatorMs = 0;
    this.baseIntervalMs = level.marchBaseIntervalMs;
    this.originX = FORMATION_START_X;
    this.originY = FORMATION.topY + level.formationRowOffset * FORMATION.cellHeight;
    this.aliveCount = this.aliens.length;

    for (const alien of this.aliens) {
      const center = cellCenter(alien.row, alien.col, FORMATION.cellWidth, FORMATION.cellHeight);
      alien.revive(this.originX + center.x, this.originY + center.y);
    }
  }

  /**
   * Avanca o timer da marcha. Retorna o resultado do passo quando um tick
   * ocorreu neste frame, ou `null` quando ainda nao deu a hora.
   */
  update(deltaMs: number): MarchStepOutcome | null {
    if (this.aliveCount === 0) return null;

    this.accumulatorMs += deltaMs;
    const interval = this.currentIntervalMs;
    if (this.accumulatorMs < interval) return null;

    this.accumulatorMs -= interval;
    // Um unico passo por frame: se o jogo engasgar, a formacao nao teleporta.
    if (this.accumulatorMs > interval) this.accumulatorMs = 0;

    return this.step();
  }

  private step(): MarchStepOutcome {
    const plan = planMarchStep({
      direction: this.direction,
      liveLeft: this.liveLeft(),
      liveRight: this.liveRight(),
      minX: FORMATION_MIN_X,
      maxX: FORMATION_MAX_X,
      stepX: FORMATION.stepX,
      stepY: FORMATION.stepY,
    });

    this.direction = plan.direction;
    this.originX += plan.dx;
    this.originY += plan.dy;
    this.frameIndex = this.frameIndex === 0 ? 1 : 0;

    for (const alien of this.aliens) {
      if (!alien.active) continue;
      const center = cellCenter(alien.row, alien.col, FORMATION.cellWidth, FORMATION.cellHeight);
      alien.setPosition(this.originX + center.x, this.originY + center.y);
      alien.setFrameIndex(this.frameIndex);
    }

    return { descended: plan.descended };
  }

  /** Borda esquerda do bloco de aliens vivos. */
  liveLeft(): number {
    let min = Number.POSITIVE_INFINITY;
    for (const alien of this.aliens) {
      if (alien.active && alien.left < min) min = alien.left;
    }
    return Number.isFinite(min) ? min : FORMATION_MIN_X;
  }

  /** Borda direita do bloco de aliens vivos. */
  liveRight(): number {
    let max = Number.NEGATIVE_INFINITY;
    for (const alien of this.aliens) {
      if (alien.active && alien.right > max) max = alien.right;
    }
    return Number.isFinite(max) ? max : FORMATION_MAX_X;
  }

  /** Base do alien vivo mais baixo — usado para a derrota por invasao. */
  liveBottom(): number {
    let max = Number.NEGATIVE_INFINITY;
    for (const alien of this.aliens) {
      if (alien.active && alien.bottom > max) max = alien.bottom;
    }
    return Number.isFinite(max) ? max : Number.NEGATIVE_INFINITY;
  }

  /**
   * Base do alien vivo mais baixo cuja caixa cruza a faixa horizontal dada.
   *
   * Existe por causa dos bunkers: usar `liveBottom()` global esmagaria os
   * quatro de uma vez quando a formacao passasse por cima de um so'.
   * Retorna `-Infinity` se nao ha' alien vivo sobre a faixa.
   */
  liveBottomInRange(left: number, right: number): number {
    let max = Number.NEGATIVE_INFINITY;
    for (const alien of this.aliens) {
      if (!alien.active) continue;
      if (alien.right < left || alien.left > right) continue;
      if (alien.bottom > max) max = alien.bottom;
    }
    return max;
  }

  /**
   * Primeiro alien vivo cuja caixa intersecta o retangulo informado.
   * AABB manual: mais previsivel que Arcade Physics para sprites de pixel art.
   */
  hitTest(left: number, top: number, right: number, bottom: number): Alien | null {
    for (const alien of this.aliens) {
      if (!alien.active) continue;
      if (right < alien.left || left > alien.right) continue;
      if (bottom < alien.top || top > alien.bottom) continue;
      return alien;
    }
    return null;
  }

  kill(alien: Alien): void {
    if (!alien.active) return;
    alien.kill();
    this.aliveCount--;
  }
}
