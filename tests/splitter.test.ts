import { describe, expect, it } from 'vitest';
import { SPLIT_CHILDREN, childDirection, hasEscaped, shouldSplit } from '@game/core/splitter';
import { bounceStepX } from '@game/core/motion';
import { LEVELS } from '@game/config/levels';

describe('shouldSplit', () => {
  it('so o tipo B se parte, por mais alta que seja a chance', () => {
    expect(shouldSplit('B', 0, 0.5)).toBe(true);
    expect(shouldSplit('A', 0, 1)).toBe(false);
    expect(shouldSplit('C', 0, 1)).toBe(false);
  });

  it('respeita a chance da fase', () => {
    expect(shouldSplit('B', 0.24, 0.25)).toBe(true);
    expect(shouldSplit('B', 0.25, 0.25)).toBe(false);
    expect(shouldSplit('B', 0.9, 0.25)).toBe(false);
  });

  it('nunca se parte nas fases 1 e 2, sempre pode a partir da 3', () => {
    // A tabela de `config/levels.ts` e' quem manda; o teste trava a intencao.
    expect(LEVELS[0]!.splitChance).toBe(0);
    expect(LEVELS[1]!.splitChance).toBe(0);
    expect(shouldSplit('B', 0, LEVELS[0]!.splitChance)).toBe(false);
    expect(shouldSplit('B', 0, LEVELS[1]!.splitChance)).toBe(false);

    expect(LEVELS[2]!.splitChance).toBe(0.25);
    expect(LEVELS[3]!.splitChance).toBe(0.4);
    expect(LEVELS[4]!.splitChance).toBe(0.5);
  });

  it('a chance so cresce com a fase', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i]!.splitChance).toBeGreaterThanOrEqual(LEVELS[i - 1]!.splitChance);
    }
  });
});

describe('childDirection', () => {
  it('abre os dois filhos em V, nunca para o mesmo lado', () => {
    expect(childDirection(0)).toBe(-1);
    expect(childDirection(1)).toBe(1);
    expect(childDirection(0)).not.toBe(childDirection(1));
  });

  it('continua alternando alem do par, para os minions do chefao', () => {
    const dirs = [0, 1, 2, 3].map(childDirection);
    expect(dirs).toEqual([-1, 1, -1, 1]);
  });

  it('gera exatamente dois filhos por alien partido', () => {
    expect(SPLIT_CHILDREN).toBe(2);
  });
});

describe('hasEscaped', () => {
  it('so escapa quando o sprite inteiro passa da base', () => {
    expect(hasEscaped(630, 6, 640)).toBe(false);
    expect(hasEscaped(646, 6, 640)).toBe(false);
    expect(hasEscaped(647, 6, 640)).toBe(true);
  });
});

describe('bounceStepX', () => {
  const base = { speed: 100, deltaMs: 1000, halfWidth: 8, minX: 8, maxX: 472 };

  it('anda no sentido atual sem tocar as paredes', () => {
    const step = bounceStepX({ ...base, x: 240, direction: 1 });
    expect(step).toEqual({ x: 340, direction: 1 });
  });

  it('quica nas duas paredes sem atravessar', () => {
    const direita = bounceStepX({ ...base, x: 460, direction: 1 });
    expect(direita.x).toBe(base.maxX - base.halfWidth);
    expect(direita.direction).toBe(-1);

    const esquerda = bounceStepX({ ...base, x: 20, direction: -1 });
    expect(esquerda.x).toBe(base.minX + base.halfWidth);
    expect(esquerda.direction).toBe(1);
  });

  it('nao treme na borda quando um frame chega muito longo', () => {
    // Aba voltando do segundo plano: delta enorme nao pode jogar o sprite para
    // fora do corredor e faze-lo quicar de novo no frame seguinte.
    let x = 240;
    let direction: -1 | 1 = 1;
    for (let i = 0; i < 50; i++) {
      const step = bounceStepX({ ...base, deltaMs: 5000, x, direction });
      x = step.x;
      direction = step.direction;
      expect(x).toBeGreaterThanOrEqual(base.minX + base.halfWidth);
      expect(x).toBeLessThanOrEqual(base.maxX - base.halfWidth);
    }
  });
});
