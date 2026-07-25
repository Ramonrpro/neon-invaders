import { describe, expect, it } from 'vitest';
import {
  ALIEN_POINTS,
  EXTRA_LIFE_SCORE,
  crossedExtraLifeThreshold,
  formatScore,
  pointsForAlien,
} from '../src/game/core/scoring';

describe('pontuacao por tipo de alien', () => {
  it('segue a tabela do arcade: A=10, B=20, C=30', () => {
    expect(pointsForAlien('A')).toBe(10);
    expect(pointsForAlien('B')).toBe(20);
    expect(pointsForAlien('C')).toBe(30);
  });

  it('vale mais quanto mais alto na formacao', () => {
    expect(ALIEN_POINTS.C).toBeGreaterThan(ALIEN_POINTS.B);
    expect(ALIEN_POINTS.B).toBeGreaterThan(ALIEN_POINTS.A);
  });

  it('formacao cheia vale 990 pontos', () => {
    const total = 22 * ALIEN_POINTS.A + 22 * ALIEN_POINTS.B + 11 * ALIEN_POINTS.C;
    expect(total).toBe(990);
  });
});

describe('vida extra', () => {
  it('concede ao cruzar 5.000 pontos', () => {
    expect(crossedExtraLifeThreshold(4990, 5010)).toBe(true);
    expect(crossedExtraLifeThreshold(4990, EXTRA_LIFE_SCORE)).toBe(true);
  });

  it('nao concede antes do limiar', () => {
    expect(crossedExtraLifeThreshold(0, 4999)).toBe(false);
  });

  it('nao concede duas vezes: uma vez cruzado, nao cruza de novo', () => {
    expect(crossedExtraLifeThreshold(5010, 5040)).toBe(false);
    expect(crossedExtraLifeThreshold(EXTRA_LIFE_SCORE, 9000)).toBe(false);
  });
});

describe('formatScore', () => {
  it('preenche com zeros ate 6 digitos', () => {
    expect(formatScore(0)).toBe('000000');
    expect(formatScore(1230)).toBe('001230');
    expect(formatScore(123456)).toBe('123456');
  });

  it('nao quebra com valores invalidos', () => {
    expect(formatScore(-50)).toBe('000000');
    expect(formatScore(10.9)).toBe('000010');
  });
});
