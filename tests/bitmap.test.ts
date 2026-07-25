import { describe, expect, it } from 'vitest';
import { litPixelCount, parseBitmap, pixelAt, tightBounds } from '../src/game/core/bitmap';
import { ALIEN_A, ALIEN_B, ALIEN_C, PLAYER, UFO } from '../src/game/gfx/sprites';

describe('parseBitmap', () => {
  it('converte `#` em aceso e `.` em transparente', () => {
    const bmp = parseBitmap(['#.#', '.#.']);
    expect(bmp.width).toBe(3);
    expect(bmp.height).toBe(2);
    expect(Array.from(bmp.pixels)).toEqual([1, 0, 1, 0, 1, 0]);
  });

  it('rejeita bitmap vazio', () => {
    expect(() => parseBitmap([])).toThrow(/vazio/);
  });

  it('rejeita linhas de larguras diferentes', () => {
    expect(() => parseBitmap(['###', '##'])).toThrow(/largura/);
  });
});

describe('pixelAt', () => {
  it('trata fora dos limites como transparente', () => {
    const bmp = parseBitmap(['##', '##']);
    expect(pixelAt(bmp, 0, 0)).toBe(1);
    expect(pixelAt(bmp, -1, 0)).toBe(0);
    expect(pixelAt(bmp, 2, 0)).toBe(0);
    expect(pixelAt(bmp, 0, 2)).toBe(0);
  });
});

describe('tightBounds', () => {
  it('acha a caixa dos pixels acesos', () => {
    const bmp = parseBitmap(['....', '.##.', '.##.', '....']);
    expect(tightBounds(bmp)).toEqual({ x: 1, y: 1, width: 2, height: 2 });
  });

  it('retorna null para bitmap totalmente vazio', () => {
    expect(tightBounds(parseBitmap(['..', '..']))).toBeNull();
  });
});

describe('sprites do jogo', () => {
  const all = [
    ['ALIEN_A frame 0', ALIEN_A[0]],
    ['ALIEN_A frame 1', ALIEN_A[1]],
    ['ALIEN_B frame 0', ALIEN_B[0]],
    ['ALIEN_B frame 1', ALIEN_B[1]],
    ['ALIEN_C frame 0', ALIEN_C[0]],
    ['ALIEN_C frame 1', ALIEN_C[1]],
    ['PLAYER', PLAYER],
    ['UFO', UFO],
  ] as const;

  it.each(all)('%s tem geometria valida e pixels acesos', (_name, source) => {
    const bmp = parseBitmap(source);
    expect(bmp.width).toBeGreaterThan(0);
    expect(bmp.height).toBeGreaterThan(0);
    expect(litPixelCount(bmp)).toBeGreaterThan(0);
  });

  it('os dois frames de cada alien tem o mesmo tamanho', () => {
    for (const pair of [ALIEN_A, ALIEN_B, ALIEN_C]) {
      const a = parseBitmap(pair[0]);
      const b = parseBitmap(pair[1]);
      expect([a.width, a.height]).toEqual([b.width, b.height]);
    }
  });

  it('os frames de cada alien sao visualmente diferentes (a marcha)', () => {
    for (const pair of [ALIEN_A, ALIEN_B, ALIEN_C]) {
      expect(pair[0].join('\n')).not.toBe(pair[1].join('\n'));
    }
  });
});
