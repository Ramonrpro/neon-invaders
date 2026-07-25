import Phaser from 'phaser';
import { PARTICLES } from '@game/config/juice';
import {
  isParticleDead,
  particleFade,
  stepParticle,
  type ParticleState,
} from '@game/core/particles';
import { TEX } from '@game/gfx/sprites';

/**
 * Um estilhaco de explosao. Sai de pool, como todo objeto de vida curta.
 *
 * O estado de voo mora num objeto proprio (`ParticleState`) em vez de nos
 * campos da Image porque e' ele que a logica pura de `core/particles.ts` sabe
 * integrar — e essa logica nao pode conhecer Phaser. O objeto e' criado uma vez
 * por particula, na construcao do pool, e reaproveitado para sempre.
 *
 * O campo chama `flight`, e nao `state`: `state` ja' existe em
 * `Phaser.GameObjects.GameObject` (e' um `string | number` para maquinas de
 * estado). Quarto nome desta armadilha, depois de `input`, `data` e `load`.
 */
export class Particle extends Phaser.GameObjects.Image {
  private readonly flight: ParticleState = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    ageMs: 0,
    lifeMs: 1,
  };

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, TEX.particle);
    this.setOrigin(0.5);
    this.setActive(false);
    this.setVisible(false);
    scene.add.existing(this);
  }

  spawn(x: number, y: number, vx: number, vy: number, lifeMs: number, tint: number): void {
    const state = this.flight;
    state.x = x;
    state.y = y;
    state.vx = vx;
    state.vy = vy;
    state.ageMs = 0;
    state.lifeMs = lifeMs;

    this.setPosition(x, y);
    this.setTint(tint);
    this.setAlpha(1);
    this.setActive(true);
    this.setVisible(true);
  }

  /** @returns `true` quando morreu e pode voltar ao pool. */
  advance(deltaMs: number): boolean {
    const state = this.flight;
    stepParticle(state, deltaMs, PARTICLES.gravity, PARTICLES.drag);
    if (isParticleDead(state)) return true;

    this.setPosition(state.x, state.y);
    // Alfa e nada mais: encolher o estilhaco em pixel art de 2 px so' produz
    // meio pixel piscando. O que vende o esfriamento e' ele apagar.
    this.setAlpha(particleFade(state.ageMs, state.lifeMs));
    return false;
  }

  deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
    this.clearTint();
  }
}
