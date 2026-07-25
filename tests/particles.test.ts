import { describe, expect, it } from 'vitest';
import {
  burstVector,
  isParticleDead,
  particleFade,
  stepParticle,
  type ParticleState,
  type ParticleVector,
} from '@game/core/particles';
import { BURSTS, PARTICLES } from '@game/config/juice';

function vector(): ParticleVector {
  return { vx: 0, vy: 0 };
}

function particle(overrides: Partial<ParticleState> = {}): ParticleState {
  return { x: 0, y: 0, vx: 0, vy: 0, ageMs: 0, lifeMs: 500, ...overrides };
}

describe('burstVector', () => {
  it('distribui a salva em leque completo, uma particula por fatia', () => {
    const count = 8;
    const out = vector();
    const angles: number[] = [];

    for (let i = 0; i < count; i++) {
      // Centro da fatia: sem jitter, os angulos tem de ficar equiespacados.
      burstVector(i, count, 0.5, 1, 100, 100, out);
      angles.push(Math.atan2(out.vy, out.vx));
    }

    const step = (2 * Math.PI) / count;
    for (let i = 1; i < angles.length; i++) {
      const delta = angles[i]! - angles[i - 1]!;
      // atan2 devolve em (-pi, pi]: normaliza o salto da volta.
      const normalized = delta < 0 ? delta + 2 * Math.PI : delta;
      expect(normalized).toBeCloseTo(step, 6);
    }
  });

  it('sai equilibrada: a salva inteira nao empurra para lado nenhum', () => {
    const count = 12;
    const out = vector();
    let sumX = 0;
    let sumY = 0;

    for (let i = 0; i < count; i++) {
      burstVector(i, count, 0.5, 0.5, 40, 160, out);
      sumX += out.vx;
      sumY += out.vy;
    }

    expect(Math.abs(sumX)).toBeLessThan(1e-9);
    expect(Math.abs(sumY)).toBeLessThan(1e-9);
  });

  it('mantem o sorteio de velocidade dentro da faixa do perfil', () => {
    const out = vector();
    for (const roll of [0, 0.37, 1]) {
      burstVector(3, 10, 0.2, roll, 45, 120, out);
      const speed = Math.hypot(out.vx, out.vy);
      expect(speed).toBeGreaterThanOrEqual(45 - 1e-9);
      expect(speed).toBeLessThanOrEqual(120 + 1e-9);
    }
  });

  it('nunca sai do setor sorteado, por mais extremo que seja o jitter', () => {
    const count = 6;
    const slice = (2 * Math.PI) / count;
    const out = vector();

    for (let i = 0; i < count; i++) {
      for (const roll of [0, 0.999]) {
        burstVector(i, count, roll, 1, 100, 100, out);
        let angle = Math.atan2(out.vy, out.vx);
        if (angle < 0) angle += 2 * Math.PI;
        expect(angle).toBeGreaterThanOrEqual(i * slice - 1e-9);
        expect(angle).toBeLessThanOrEqual((i + 1) * slice + 1e-9);
      }
    }
  });
});

describe('stepParticle', () => {
  it('a gravidade puxa para baixo', () => {
    const p = particle({ vy: 0 });
    stepParticle(p, 1000, 200, 0);
    expect(p.vy).toBeCloseTo(200, 6);
    expect(p.y).toBeCloseTo(200, 6);
  });

  it('o arrasto freia, mas nunca inverte o sentido', () => {
    const p = particle({ vx: 100 });
    stepParticle(p, 100, 0, 1.6);
    expect(p.vx).toBeLessThan(100);
    expect(p.vx).toBeGreaterThan(0);
  });

  it('um frame absurdamente longo nao lanca a particula de volta', () => {
    // Aba voltando do segundo plano: `1 - drag*dt` fica negativo e, sem o piso,
    // o estilhaco inverteria e voltaria voando para dentro da tela.
    const p = particle({ vx: 100, vy: -100 });
    stepParticle(p, 10_000, PARTICLES.gravity, PARTICLES.drag);
    expect(p.vx).toBe(0);
    // A gravidade do proprio passo e' o unico resto de velocidade.
    expect(p.vy).toBe(0);
  });

  it('acumula idade em ms', () => {
    const p = particle();
    stepParticle(p, 16, 0, 0);
    stepParticle(p, 16, 0, 0);
    expect(p.ageMs).toBe(32);
  });
});

describe('particleFade', () => {
  it('vai de 1 a 0 ao longo da vida', () => {
    expect(particleFade(0, 400)).toBe(1);
    expect(particleFade(200, 400)).toBeCloseTo(0.5, 6);
    expect(particleFade(400, 400)).toBe(0);
  });

  it('nunca sai de [0, 1]', () => {
    expect(particleFade(900, 400)).toBe(0);
    expect(particleFade(-100, 400)).toBe(1);
    expect(particleFade(10, 0)).toBe(0);
  });
});

describe('isParticleDead', () => {
  it('morre exatamente ao completar a vida', () => {
    expect(isParticleDead(particle({ ageMs: 499, lifeMs: 500 }))).toBe(false);
    expect(isParticleDead(particle({ ageMs: 500, lifeMs: 500 }))).toBe(true);
  });
});

describe('perfis de salva', () => {
  it('a escala das salvas segue a importancia do alvo', () => {
    expect(BURSTS.spark.count).toBeLessThan(BURSTS.alien.count);
    expect(BURSTS.alien.count).toBeLessThan(BURSTS.ufo.count);
    expect(BURSTS.ufo.count).toBeLessThan(BURSTS.player.count);
  });

  it('o pool aguenta a cadeia de morte do chefao', () => {
    // Vida de 620 ms contra 140 ms entre estouros: ~4 salvas vivas ao mesmo
    // tempo. Se este teste falhar, particula some no meio da cena mais
    // importante do jogo.
    const simultaneousBursts = 4;
    expect(PARTICLES.poolSize).toBeGreaterThanOrEqual(BURSTS.boss.count * simultaneousBursts);
  });

  it('toda velocidade minima e menor que a maxima', () => {
    for (const profile of Object.values(BURSTS)) {
      expect(profile.minSpeed).toBeLessThan(profile.maxSpeed);
      expect(profile.lifeMs).toBeGreaterThan(0);
    }
  });
});
