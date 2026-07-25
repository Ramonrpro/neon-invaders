import { describe, expect, it } from 'vitest';
import { clamp, nextPlayerX, type PlayerMoveInput } from '@game/core/movement';

/** Cenario base: nave no centro de uma tela util de 20..460, 260 px/s, 16 ms. */
function move(overrides: Partial<PlayerMoveInput> = {}): number {
  return nextPlayerX({
    currentX: 240,
    axis: 0,
    dragDeltaX: 0,
    speed: 260,
    deltaMs: 16,
    minX: 20,
    maxX: 460,
    ...overrides,
  });
}

describe('nextPlayerX — teclado', () => {
  it('fica parado com o eixo em zero', () => {
    expect(move()).toBe(240);
  });

  it('anda proporcional ao delta do frame, nao ao numero de frames', () => {
    const umFrameLongo = move({ axis: 1, deltaMs: 32 }) - 240;
    const doisCurtos = move({ axis: 1, deltaMs: 16 }) - 240;
    expect(umFrameLongo).toBeCloseTo(doisCurtos * 2, 10);
  });

  it('anda para os dois lados', () => {
    expect(move({ axis: 1 })).toBeGreaterThan(240);
    expect(move({ axis: -1 })).toBeLessThan(240);
  });
});

describe('nextPlayerX — arrasto', () => {
  it('aplica o delta relativo do dedo', () => {
    expect(move({ dragDeltaX: 40 })).toBe(280);
    expect(move({ dragDeltaX: -40 })).toBe(200);
  });

  it('soma teclado e arrasto no mesmo frame em vez de escolher um', () => {
    const soTeclado = move({ axis: 1 });
    const somado = move({ axis: 1, dragDeltaX: 30 });
    expect(somado).toBeCloseTo(soTeclado + 30, 10);
  });

  it('arrasto grande num frame so nao atravessa a parede', () => {
    expect(move({ dragDeltaX: 9999 })).toBe(460);
    expect(move({ dragDeltaX: -9999 })).toBe(20);
  });
});

describe('nextPlayerX — paredes', () => {
  it('trava nos limites', () => {
    expect(move({ currentX: 459, axis: 1, deltaMs: 1000 })).toBe(460);
    expect(move({ currentX: 21, axis: -1, deltaMs: 1000 })).toBe(20);
  });

  it('nao empurra para dentro quem ja esta na parede', () => {
    expect(move({ currentX: 460, axis: 0 })).toBe(460);
    expect(move({ currentX: 20, axis: 0 })).toBe(20);
  });

  it('devolve quem foi parar fora dos limites', () => {
    expect(move({ currentX: 700 })).toBe(460);
    expect(move({ currentX: -50 })).toBe(20);
  });
});

describe('clamp', () => {
  it('centra em vez de escolher uma borda quando o intervalo se inverte', () => {
    // Acontece se a nave for mais larga que a area util — a nave fica visivel
    // no meio, nao grudada numa parede.
    expect(clamp(0, 300, 100)).toBe(200);
    expect(clamp(999, 300, 100)).toBe(200);
  });

  it('passa direto o valor que ja esta no intervalo', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });
});
