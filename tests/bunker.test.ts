import { describe, expect, it } from 'vitest';
import { parseBitmap } from '@game/core/bitmap';
import {
  bunkerCenterX,
  carve,
  clearRect,
  createMask,
  findSolidInRect,
  isDestroyed,
  isSolid,
  remainingCells,
  resetMask,
} from '@game/core/bunker';
import { BUNKER, BUNKER_CARVE } from '@game/gfx/sprites';

/** Bloco 5x4 cheio — mais facil de conferir a mao que o bunker de verdade. */
const SOLID_BLOCK = ['#####', '#####', '#####', '#####'];

describe('createMask', () => {
  it('nasce com todas as celulas do desenho intactas', () => {
    const mask = createMask(SOLID_BLOCK);
    expect(mask.width).toBe(5);
    expect(mask.height).toBe(4);
    expect(remainingCells(mask)).toBe(20);
    expect(isDestroyed(mask)).toBe(false);
  });

  it('respeita os vazios do desenho', () => {
    const mask = createMask(['#.#', '###']);
    expect(isSolid(mask, 0, 0)).toBe(true);
    expect(isSolid(mask, 1, 0)).toBe(false);
    expect(remainingCells(mask)).toBe(5);
  });

  it('trata fora dos limites como vazio', () => {
    const mask = createMask(SOLID_BLOCK);
    expect(isSolid(mask, -1, 0)).toBe(false);
    expect(isSolid(mask, 5, 0)).toBe(false);
    expect(isSolid(mask, 0, 4)).toBe(false);
  });
});

describe('carve', () => {
  it('remove exatamente as celulas acesas da brocha', () => {
    const mask = createMask(SOLID_BLOCK);
    const brush = parseBitmap(['###', '###', '###']);
    const result = carve(mask, brush, 2, 1);

    expect(result.removed).toBe(9);
    expect(remainingCells(mask)).toBe(11);
    expect(isSolid(mask, 2, 1)).toBe(false);
    expect(isSolid(mask, 0, 0)).toBe(true);
  });

  it('nao conta de novo celula ja escavada', () => {
    const mask = createMask(SOLID_BLOCK);
    const brush = parseBitmap(['###', '###', '###']);
    carve(mask, brush, 2, 1);
    const second = carve(mask, brush, 2, 1);

    expect(second.removed).toBe(0);
    expect(remainingCells(mask)).toBe(11);
  });

  it('recorta a brocha que estoura a borda em vez de vazar', () => {
    const mask = createMask(SOLID_BLOCK);
    const brush = parseBitmap(['###', '###', '###']);
    const result = carve(mask, brush, 0, 0);

    // So o quadrante inferior direito da brocha cai dentro da mascara.
    expect(result.removed).toBe(4);
    expect(isSolid(mask, 0, 0)).toBe(false);
    expect(isSolid(mask, 1, 1)).toBe(false);
    expect(isSolid(mask, 2, 0)).toBe(true);
  });

  it('as brochas de verdade abrem cratera dentro do bunker de verdade', () => {
    const mask = createMask(BUNKER);
    const cheio = remainingCells(mask);

    for (const source of BUNKER_CARVE) {
      const before = remainingCells(mask);
      carve(mask, parseBitmap(source), 15, 8);
      expect(remainingCells(mask)).toBeLessThanOrEqual(before);
    }
    expect(remainingCells(mask)).toBeLessThan(cheio);
  });
});

describe('findSolidInRect', () => {
  it('devolve a celula MAIS BAIXA para quem sobe', () => {
    const mask = createMask(SOLID_BLOCK);
    const hit = findSolidInRect(mask, 1, 0, 3, 3, true);
    expect(hit?.y).toBe(3);
  });

  it('devolve a celula MAIS ALTA para quem desce', () => {
    const mask = createMask(SOLID_BLOCK);
    const hit = findSolidInRect(mask, 1, 0, 3, 3, false);
    expect(hit?.y).toBe(0);
  });

  it('devolve null quando o retangulo ja esta todo escavado', () => {
    const mask = createMask(SOLID_BLOCK);
    clearRect(mask, 0, 0, 4, 3);
    expect(findSolidInRect(mask, 0, 0, 4, 3, true)).toBeNull();
    expect(isDestroyed(mask)).toBe(true);
  });

  it('encontra pixel pelo buraco quando o projetil passa raspando', () => {
    // Coluna do meio aberta: um tiro estreito nela nao acha nada, um largo acha.
    const mask = createMask(['#.#', '#.#', '#.#']);
    expect(findSolidInRect(mask, 1, 0, 1, 2, true)).toBeNull();
    expect(findSolidInRect(mask, 0, 0, 2, 2, true)).not.toBeNull();
  });
});

describe('clearRect', () => {
  it('apaga a faixa e devolve quantas celulas caiu', () => {
    const mask = createMask(SOLID_BLOCK);
    const result = clearRect(mask, 0, 0, 4, 1);

    expect(result.removed).toBe(10);
    expect(isSolid(mask, 0, 1)).toBe(false);
    expect(isSolid(mask, 0, 2)).toBe(true);
  });

  it('recorta nos limites da mascara', () => {
    const mask = createMask(SOLID_BLOCK);
    const result = clearRect(mask, -10, -10, 100, 100);
    expect(result.removed).toBe(20);
  });
});

describe('resetMask', () => {
  it('devolve o bunker ao estado de fabrica', () => {
    const source = parseBitmap(BUNKER);
    const mask = createMask(BUNKER);
    const cheio = remainingCells(mask);

    clearRect(mask, 0, 0, mask.width - 1, mask.height - 1);
    expect(isDestroyed(mask)).toBe(true);

    resetMask(mask, source);
    expect(remainingCells(mask)).toBe(cheio);
  });
});

describe('bunkerCenterX', () => {
  it('distribui os bunkers com vaos e folgas iguais', () => {
    const xs = [0, 1, 2, 3].map((i) => bunkerCenterX(i, 4, 480));
    expect(xs).toEqual([60, 180, 300, 420]);

    // Folga ate a parede esquerda igual a folga ate a direita.
    expect(xs[0]).toBe(480 - xs[3]!);
  });

  it('exige pelo menos um bunker', () => {
    expect(() => bunkerCenterX(0, 0, 480)).toThrow(RangeError);
  });
});

describe('desenho do bunker', () => {
  it('tem a resolucao que o resto do codigo assume', () => {
    const bitmap = parseBitmap(BUNKER);
    expect(bitmap.width).toBe(30);
    expect(bitmap.height).toBe(18);
  });

  it('tem a base vazada — o arco por onde o jogador atira', () => {
    const mask = createMask(BUNKER);
    const meioX = Math.floor(mask.width / 2);
    expect(isSolid(mask, meioX, mask.height - 1)).toBe(false);
    expect(isSolid(mask, 0, mask.height - 1)).toBe(true);
  });
});
