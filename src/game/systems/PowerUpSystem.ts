/**
 * Estado e ciclo de vida dos power-ups.
 *
 * Guarda os niveis coletados, o perfil de disparo derivado deles e o pool de
 * capsulas em queda. Nao sabe nada sobre score, audio ou HUD: quando uma
 * capsula e' coletada, avisa por `onCollected` e quem chamou decide o resto.
 *
 * MECANICA-ASSINATURA: os niveis atravessam a morte e a troca de fase. So'
 * `reset()` — chamado em jogo novo — zera qualquer coisa aqui.
 */

import type Phaser from 'phaser';
import { PLAYER } from '@game/config/gameplay';
import {
  POWERUP_DROP,
  powerUpDefinition,
  type FireProfile,
  type PowerUpDefinition,
  type PowerUpId,
} from '@game/config/powerups';
import {
  buildFireProfile,
  collectOutcome,
  createFireProfile,
  emptyLevels,
  pickDropId,
  resetLevels,
  shouldDrop,
  type PowerUpLevels,
} from '@game/core/powerups';
import { PowerUp } from '@game/entities/PowerUp';
import { Pool } from '@game/systems/PoolSystem';

/** O que a Scene precisa saber quando uma capsula e' apanhada. */
export interface CollectedEvent {
  readonly definition: PowerUpDefinition;
  readonly level: number;
  readonly leveledUp: boolean;
  readonly bonusPoints: number;
}

const BASE_FIRE = { cooldownMs: PLAYER.fireCooldownMs, maxBullets: PLAYER.maxBullets };

export class PowerUpSystem {
  private readonly levels: PowerUpLevels = emptyLevels();
  private readonly profile: FireProfile = createFireProfile(BASE_FIRE);
  private readonly capsules: Pool<PowerUp>;

  /** `-Infinity` ate' o primeiro drop, para o cooldown nao bloquear o inicio. */
  private lastDropAtMs = Number.NEGATIVE_INFINITY;

  /** Ligado pela Scene. */
  onCollected: ((event: CollectedEvent) => void) | undefined;

  /**
   * @param initialTexture textura com que as capsulas do pool nascem. Nunca e'
   *   vista: `drop()` troca pela do tipo sorteado. Existe so' porque um
   *   `GameObjects.Image` precisa de alguma textura para ser construido.
   */
  constructor(scene: Phaser.Scene, initialTexture: string) {
    this.capsules = new Pool(POWERUP_DROP.poolSize, () => new PowerUp(scene, initialTexture));
  }

  get fireProfile(): Readonly<FireProfile> {
    return this.profile;
  }

  levelOf(id: PowerUpId): number {
    return this.levels[id];
  }

  /** Snapshot dos niveis para o HUD. Nao copia — leitura apenas. */
  get currentLevels(): Readonly<PowerUpLevels> {
    return this.levels;
  }

  // ------------------------------------------------------------------- drops

  /**
   * Sorteio de drop de um alien destruido. Respeita a taxa da fase e o
   * cooldown global.
   *
   * @returns `true` se largou capsula
   */
  tryDrop(x: number, y: number, dropRate: number, nowMs: number): boolean {
    if (!shouldDrop(Math.random(), dropRate, nowMs, this.lastDropAtMs, POWERUP_DROP.cooldownMs)) {
      return false;
    }
    return this.spawn(x, y, nowMs);
  }

  /**
   * Drop do UFO. MECANICA-ASSINATURA: o UFO **sempre** solta power-up — e' o
   * que justifica largar a formacao e ir atras dele. Por isso ignora a taxa da
   * fase; o cooldown global continua valendo, senao um UFO abatido logo depois
   * de um drop de formacao viraria chuva de upgrade.
   */
  dropGuaranteed(x: number, y: number, nowMs: number): boolean {
    if (nowMs - this.lastDropAtMs < POWERUP_DROP.cooldownMs) return false;
    return this.spawn(x, y, nowMs);
  }

  /**
   * Os power-ups largados por um chefao ao morrer.
   *
   * IGNORA o cooldown global de propósito: são a recompensa de uma luta longa,
   * não um drop de rotina, e chegam sempre em par. Também não mexem no
   * `lastDropAtMs` — a luta seguinte não deve começar com o drop bloqueado.
   *
   * @returns quantas capsulas realmente cairam (limitado pelo pool)
   */
  dropFromBoss(x: number, y: number, count: number, spreadX: number): number {
    let dropped = 0;
    for (let i = 0; i < count; i++) {
      const capsule = this.capsules.acquire();
      if (!capsule) break;
      // Espalha em torno do centro para as capsulas nao cairem sobrepostas.
      const offset = count > 1 ? (i / (count - 1) - 0.5) * spreadX * 2 : 0;
      capsule.drop(x + offset, y, powerUpDefinition(pickDropId(Math.random())));
      dropped++;
    }
    return dropped;
  }

  private spawn(x: number, y: number, nowMs: number): boolean {
    const capsule = this.capsules.acquire();
    if (!capsule) return false;
    capsule.drop(x, y, powerUpDefinition(pickDropId(Math.random())));
    this.lastDropAtMs = nowMs;
    return true;
  }

  // ------------------------------------------------------------------ update

  /**
   * Move as capsulas e resolve a coleta por contato.
   *
   * @param collectRect retangulo da nave, ou `null` quando ela nao pode coletar
   *   (morta, congelada, entre ondas). As capsulas continuam caindo nesse caso
   *   — perder uma por morrer na hora errada e' parte do jogo.
   */
  update(
    deltaMs: number,
    collectRect: { left: number; top: number; right: number; bottom: number } | null,
  ): void {
    const active = this.capsules.activeItems;
    // De tras para frente: `release` faz swap-remove.
    for (let i = active.length - 1; i >= 0; i--) {
      const capsule = active[i]!;
      const gone = capsule.advance(deltaMs);
      if (gone) {
        this.recycle(capsule);
        continue;
      }

      if (!collectRect) continue;
      if (!capsule.overlaps(collectRect.left, collectRect.top, collectRect.right, collectRect.bottom)) {
        continue;
      }

      this.collect(capsule.id);
      this.recycle(capsule);
    }
  }

  private collect(id: PowerUpId): void {
    const definition = powerUpDefinition(id);
    const outcome = collectOutcome(this.levels[id], definition.maxLevel);
    this.levels[id] = outcome.level;
    this.rebuildProfile();

    this.onCollected?.({
      definition,
      level: outcome.level,
      leveledUp: outcome.leveledUp,
      bonusPoints: outcome.bonusPoints,
    });
  }

  private recycle(capsule: PowerUp): void {
    capsule.deactivate();
    this.capsules.release(capsule);
  }

  private rebuildProfile(): void {
    buildFireProfile(this.levels, BASE_FIRE, this.profile);
  }

  // ------------------------------------------------------------------ estado

  /** Recolhe as capsulas em queda sem tocar nos niveis. Usado entre ondas. */
  releaseAllCapsules(): void {
    const active = this.capsules.activeItems;
    for (let i = active.length - 1; i >= 0; i--) {
      this.recycle(active[i]!);
    }
  }

  /** Jogo novo: zera niveis, perfil, capsulas e o cooldown de drop. */
  reset(): void {
    resetLevels(this.levels);
    this.rebuildProfile();
    this.releaseAllCapsules();
    this.lastDropAtMs = Number.NEGATIVE_INFINITY;
  }
}
