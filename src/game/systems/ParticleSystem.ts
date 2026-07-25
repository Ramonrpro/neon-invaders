import type Phaser from 'phaser';
import { PARTICLES, type BurstProfile } from '@game/config/juice';
import { burstVector, type ParticleVector } from '@game/core/particles';
import { Particle } from '@game/entities/Particle';
import { Pool } from '@game/systems/PoolSystem';

/**
 * Estilhacos de explosao.
 *
 * Existe como sistema, e nao como mais um pool na `GameScene`, porque cada
 * salva e' meia duzia de linhas de sorteio que nao tem nada a ver com as regras
 * da partida — e a `GameScene` ja' e' o arquivo mais longo do projeto.
 *
 * Salva que nao cabe no pool sai incompleta em vez de nao sair: uma explosao
 * com 11 estilhacos em vez de 18 e' indistinguivel no calor do jogo, mas uma
 * explosao sem nenhum se le' como bug.
 */
export class ParticleSystem {
  private readonly pool: Pool<Particle>;
  /** Destino reaproveitado de `burstVector` — zero alocacao por estilhaco. */
  private readonly vector: ParticleVector = { vx: 0, vy: 0 };

  constructor(scene: Phaser.Scene) {
    this.pool = new Pool(PARTICLES.poolSize, () => new Particle(scene));
  }

  burst(x: number, y: number, profile: BurstProfile, tint: number): void {
    for (let i = 0; i < profile.count; i++) {
      const particle = this.pool.acquire();
      if (!particle) return;

      burstVector(
        i,
        profile.count,
        Math.random(),
        Math.random(),
        profile.minSpeed,
        profile.maxSpeed,
        this.vector,
      );
      particle.spawn(x, y, this.vector.vx, this.vector.vy, profile.lifeMs, tint);
    }
  }

  update(deltaMs: number): void {
    const active = this.pool.activeItems;
    // De tras para frente: `release` faz swap-remove.
    for (let i = active.length - 1; i >= 0; i--) {
      const particle = active[i]!;
      if (!particle.advance(deltaMs)) continue;
      particle.deactivate();
      this.pool.release(particle);
    }
  }

  /** Limpa a tela de estilhacos — troca de fase, restart, morte do chefao. */
  releaseAll(): void {
    const active = this.pool.activeItems;
    for (let i = active.length - 1; i >= 0; i--) {
      const particle = active[i]!;
      particle.deactivate();
      this.pool.release(particle);
    }
  }
}
