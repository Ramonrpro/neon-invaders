import { describe, expect, it } from 'vitest';
import {
  UFO_INTERVAL_MAX_MS,
  UFO_INTERVAL_MIN_MS,
  bonusFor,
  nextSpawnDelayMs,
} from '@game/core/ufo';
import { UFO_POINTS } from '@game/core/scoring';

describe('nextSpawnDelayMs', () => {
  it('fica na janela de 20 a 30 segundos da especificacao', () => {
    expect(nextSpawnDelayMs(0)).toBe(UFO_INTERVAL_MIN_MS);
    expect(nextSpawnDelayMs(1)).toBe(UFO_INTERVAL_MAX_MS);
    expect(nextSpawnDelayMs(0.5)).toBe(25_000);
  });

  it('trunca sorteio fora de 0..1 em vez de agendar tempo absurdo', () => {
    expect(nextSpawnDelayMs(-3)).toBe(UFO_INTERVAL_MIN_MS);
    expect(nextSpawnDelayMs(9)).toBe(UFO_INTERVAL_MAX_MS);
  });
});

describe('bonusFor', () => {
  it('mapeia o sorteio nos quatro bonus do arcade', () => {
    expect(bonusFor(0)).toBe(50);
    expect(bonusFor(0.3)).toBe(100);
    expect(bonusFor(0.6)).toBe(150);
    expect(bonusFor(0.99)).toBe(300);
  });

  it('nunca devolve valor fora da tabela, nem no limite superior', () => {
    for (let roll = 0; roll <= 1; roll += 0.01) {
      expect(UFO_POINTS).toContain(bonusFor(roll));
    }
    expect(UFO_POINTS).toContain(bonusFor(1));
  });
});
