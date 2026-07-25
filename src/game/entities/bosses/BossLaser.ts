import Phaser from 'phaser';
import { BOSS, BOSS_LASER } from '@game/config/bosses';
import { PALETTE } from '@game/config/palette';
import { LOGICAL_HEIGHT } from '@game/config/screen';

/**
 * O laser vertical da nave-mae (fases 4 e 5).
 *
 * Duas fases visuais: um feixe FINO piscando durante o telegraph, que so' mira,
 * e um feixe GROSSO que mata. A coluna e' travada quando o aviso comeca — ver o
 * comentario em `BOSS_LASER`. So' o feixe grosso colide.
 *
 * Desenhado com `Rectangle` porque e' literalmente um retangulo que muda de
 * largura; um `Graphics` redesenhado por frame seria trabalho a toa.
 */
export type LaserPhase = 'off' | 'warning' | 'firing';

export class BossLaser {
  private readonly beam: Phaser.GameObjects.Rectangle;
  private phaseValue: LaserPhase = 'off';
  private elapsedMs = 0;

  constructor(scene: Phaser.Scene) {
    this.beam = scene.add
      .rectangle(0, 0, BOSS_LASER.warningWidth, LOGICAL_HEIGHT, PALETTE.red)
      .setOrigin(0.5, 0)
      .setVisible(false);
  }

  get phase(): LaserPhase {
    return this.phaseValue;
  }

  /** So' o feixe grosso machuca. O aviso e' inofensivo de proposito. */
  get lethal(): boolean {
    return this.phaseValue === 'firing';
  }

  /**
   * Comeca o aviso, travando a coluna em `x`.
   *
   * @param topY onde o feixe nasce — a base do casco da nave-mae
   */
  startWarning(x: number, topY: number): void {
    this.phaseValue = 'warning';
    this.elapsedMs = 0;
    this.beam.setPosition(x, topY);
    this.beam.width = BOSS_LASER.warningWidth;
    this.beam.height = LOGICAL_HEIGHT - topY;
    this.beam.setFillStyle(PALETTE.amber);
    this.beam.setVisible(true);
  }

  /** Dispara na coluna ja' travada. Nunca move o feixe. */
  fire(): void {
    this.phaseValue = 'firing';
    this.elapsedMs = 0;
    this.beam.width = BOSS_LASER.beamWidth;
    this.beam.setFillStyle(PALETTE.red);
    this.beam.setAlpha(1);
    this.beam.setVisible(true);
  }

  deactivate(): void {
    this.phaseValue = 'off';
    this.beam.setVisible(false);
  }

  /**
   * Avanca a animacao.
   *
   * @returns `true` quando o disparo terminou e o feixe saiu de cena. O aviso
   *   nunca termina sozinho — quem manda nele e' o ciclo de ataque do chefao.
   */
  advance(deltaMs: number): boolean {
    if (this.phaseValue === 'off') return false;
    this.elapsedMs += deltaMs;

    if (this.phaseValue === 'warning') {
      const on = Math.floor(this.elapsedMs / BOSS_LASER.warningBlinkMs) % 2 === 0;
      this.beam.setAlpha(on ? 0.85 : 0.25);
      return false;
    }

    if (this.elapsedMs < BOSS_LASER.fireMs) {
      // O feixe desvanece enquanto dispara: o jogador ve que a janela fecha.
      this.beam.setAlpha(1 - (this.elapsedMs / BOSS_LASER.fireMs) * 0.4);
      return false;
    }

    this.deactivate();
    return true;
  }

  /** Acompanha a nave-mae na horizontal ENQUANTO desligado, para nascer certo. */
  parkAt(x: number, topY: number): void {
    if (this.phaseValue !== 'off') return;
    this.beam.setPosition(x, topY);
  }

  overlaps(left: number, top: number, right: number, bottom: number): boolean {
    if (!this.lethal) return false;
    const halfW = this.beam.width / 2;
    if (right < this.beam.x - halfW || left > this.beam.x + halfW) return false;
    if (bottom < this.beam.y || top > this.beam.y + this.beam.height) return false;
    return true;
  }

  /** Duracao do aviso. Casada com o telegraph do resto dos ataques do chefao. */
  static get warningMs(): number {
    return BOSS.telegraphMs;
  }
}
