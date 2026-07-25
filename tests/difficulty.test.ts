import { describe, expect, it } from 'vitest';
import { FORMATION_TOTAL, MARCH_FLOOR_MS, marchIntervalMs } from '../src/game/core/difficulty';
import { LEVELS } from '../src/game/config/levels';

const BASE = 550;

describe('aceleracao da formacao', () => {
  it('com a formacao cheia, usa o intervalo base da fase', () => {
    expect(marchIntervalMs(BASE, FORMATION_TOTAL)).toBe(BASE);
  });

  it('encolhe proporcionalmente aos aliens vivos', () => {
    expect(marchIntervalMs(BASE, 55)).toBe(550);
    expect(marchIntervalMs(BASE, 44)).toBeCloseTo(440);
    expect(marchIntervalMs(BASE, 11)).toBeCloseTo(110);
  });

  it('e monotonicamente decrescente conforme os aliens morrem', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let alive = FORMATION_TOTAL; alive >= 1; alive--) {
      const interval = marchIntervalMs(BASE, alive);
      expect(interval).toBeLessThanOrEqual(previous);
      previous = interval;
    }
  });

  it('o ultimo alien e frenetico: cai no piso', () => {
    expect(marchIntervalMs(BASE, 1)).toBe(MARCH_FLOOR_MS);
  });

  it('nunca desce abaixo do piso, mesmo com base muito baixa', () => {
    expect(marchIntervalMs(100, 1)).toBe(MARCH_FLOOR_MS);
    expect(marchIntervalMs(0, 55)).toBe(MARCH_FLOOR_MS);
  });

  it('trata contagens fora do intervalo sem explodir', () => {
    expect(marchIntervalMs(BASE, -5)).toBe(MARCH_FLOOR_MS);
    expect(marchIntervalMs(BASE, 999)).toBe(BASE);
    expect(marchIntervalMs(BASE, 10, 0)).toBe(MARCH_FLOOR_MS);
  });
});

describe('tabela de fases', () => {
  it('tem as 5 fases numeradas em ordem', () => {
    expect(LEVELS).toHaveLength(5);
    LEVELS.forEach((level, index) => expect(level.level).toBe(index + 1));
  });

  it('fica progressivamente mais dificil a cada fase', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const previous = LEVELS[i - 1]!;
      const current = LEVELS[i]!;
      expect(current.marchBaseIntervalMs).toBeLessThan(previous.marchBaseIntervalMs);
      expect(current.maxEnemyBullets).toBeGreaterThan(previous.maxEnemyBullets);
      expect(current.enemyFireChance).toBeGreaterThan(previous.enemyFireChance);
      expect(current.formationRowOffset).toBeGreaterThan(previous.formationRowOffset);
    }
  });

  it('splitters so aparecem a partir da fase 3', () => {
    expect(LEVELS[0]!.splitChance).toBe(0);
    expect(LEVELS[1]!.splitChance).toBe(0);
    expect(LEVELS[2]!.splitChance).toBeGreaterThan(0);
  });
});
