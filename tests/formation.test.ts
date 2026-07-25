import { describe, expect, it } from 'vitest';
import {
  FORMATION_COLS,
  FORMATION_ROWS,
  alienTypeForRow,
  cellCenter,
  planMarchStep,
  type MarchStepInput,
} from '../src/game/core/formation';
import {
  FORMATION,
  FORMATION_MAX_X,
  FORMATION_MIN_X,
  FORMATION_START_X,
  FORMATION_WIDTH,
} from '../src/game/config/gameplay';

function input(overrides: Partial<MarchStepInput> = {}): MarchStepInput {
  return {
    direction: 1,
    liveLeft: 100,
    liveRight: 300,
    minX: 64,
    maxX: 416,
    stepX: 6,
    stepY: 16,
    ...overrides,
  };
}

describe('planMarchStep', () => {
  it('anda de lado enquanto couber', () => {
    expect(planMarchStep(input())).toEqual({
      dx: 6,
      dy: 0,
      direction: 1,
      descended: false,
    });
  });

  it('desce e inverte ao encostar na borda direita', () => {
    const result = planMarchStep(input({ liveRight: 414 }));
    expect(result).toEqual({ dx: 0, dy: 16, direction: -1, descended: true });
  });

  it('desce e inverte ao encostar na borda esquerda', () => {
    const result = planMarchStep(input({ direction: -1, liveLeft: 66 }));
    expect(result).toEqual({ dx: 0, dy: 16, direction: 1, descended: true });
  });

  it('no passo da descida nao anda de lado', () => {
    const result = planMarchStep(input({ liveRight: 416 }));
    expect(result.dx).toBe(0);
  });

  it('encostar exatamente na borda ainda e um passo lateral valido', () => {
    const result = planMarchStep(input({ liveRight: 410 }));
    expect(result.descended).toBe(false);
    expect(result.dx).toBe(6);
  });

  it('atravessa a tela ida e volta sem sair dos limites', () => {
    let direction: -1 | 1 = 1;
    let left = 64;
    let right = 416 - 100;

    for (let i = 0; i < 200; i++) {
      const step = planMarchStep(input({ direction, liveLeft: left, liveRight: right }));
      direction = step.direction;
      left += step.dx;
      right += step.dx;
      expect(left).toBeGreaterThanOrEqual(64);
      expect(right).toBeLessThanOrEqual(416);
    }
  });
});

describe('alienTypeForRow', () => {
  it('linha de cima e tipo C, meio e B, duas de baixo sao A', () => {
    expect(alienTypeForRow(0)).toBe('C');
    expect(alienTypeForRow(1)).toBe('B');
    expect(alienTypeForRow(2)).toBe('B');
    expect(alienTypeForRow(3)).toBe('A');
    expect(alienTypeForRow(4)).toBe('A');
  });

  it('rejeita linha fora da formacao', () => {
    expect(() => alienTypeForRow(-1)).toThrow(RangeError);
    expect(() => alienTypeForRow(FORMATION_ROWS)).toThrow(RangeError);
    expect(() => alienTypeForRow(1.5)).toThrow(RangeError);
  });
});

describe('geometria da formacao', () => {
  it('a grade e 5x11 = 55 aliens', () => {
    expect(FORMATION_ROWS * FORMATION_COLS).toBe(55);
  });

  it('centraliza cada alien na sua celula', () => {
    expect(cellCenter(0, 0, 32, 32)).toEqual({ x: 16, y: 16 });
    expect(cellCenter(4, 10, 32, 32)).toEqual({ x: 336, y: 144 });
  });

  it('a formacao nasce com folga para marchar dos dois lados', () => {
    // Se o bloco nascer colado no limite, ele desce a cada tick em vez de
    // marchar — a marcha lateral some e o jogo desanda em segundos.
    expect(FORMATION_START_X).toBeGreaterThan(FORMATION_MIN_X);
    expect(FORMATION_START_X + FORMATION_WIDTH).toBeLessThan(FORMATION_MAX_X);
  });

  it('o primeiro passo da fase e lateral, nunca uma descida', () => {
    const first = planMarchStep({
      direction: 1,
      liveLeft: FORMATION_START_X,
      liveRight: FORMATION_START_X + FORMATION_WIDTH,
      minX: FORMATION_MIN_X,
      maxX: FORMATION_MAX_X,
      stepX: FORMATION.stepX,
      stepY: FORMATION.stepY,
    });
    expect(first.descended).toBe(false);
    expect(first.dx).toBe(FORMATION.stepX);
  });
});
