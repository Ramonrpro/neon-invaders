/**
 * Mascara de destruicao dos bunkers. Logica pura.
 *
 * DECISAO CENTRAL: o bunker existe em duas copias sincronizadas — um
 * `RenderTexture` (o que se ve) e esta mascara de bytes (o que colide). Ler os
 * pixels do RenderTexture a cada colisao custaria um `readPixels` por tiro, o
 * que e' inviavel a 60 fps; espelhar em um `Uint8Array` custa nada.
 *
 * As duas copias so' ficam identicas porque a escavacao usa o MESMO bitmap nos
 * dois lados: `carve` zera as celulas da brocha aqui, e a Scene chama
 * `RenderTexture.erase` com a textura gerada a partir do mesmo desenho. Trocar
 * um lado sem o outro produz buraco que nao deixa passar (ou parede invisivel).
 */

import { parseBitmap, type Bitmap, type BitmapSource } from '@game/core/bitmap';

export interface BunkerMask {
  readonly width: number;
  readonly height: number;
  /** 1 = pixel intacto, 0 = escavado. Linha a linha. */
  readonly cells: Uint8Array;
}

export interface CarveResult {
  /** Quantas celulas intactas foram removidas neste impacto. */
  removed: number;
}

/** Mascara cheia a partir do desenho do bunker. */
export function createMask(source: BitmapSource): BunkerMask {
  const bitmap = parseBitmap(source);
  return {
    width: bitmap.width,
    height: bitmap.height,
    cells: Uint8Array.from(bitmap.pixels),
  };
}

/** Repoe a mascara ao estado original — usado ao comecar uma fase nova. */
export function resetMask(mask: BunkerMask, source: Bitmap): void {
  mask.cells.set(source.pixels);
}

/** Celula intacta? Fora dos limites conta como vazio. */
export function isSolid(mask: BunkerMask, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return false;
  return mask.cells[y * mask.width + x] === 1;
}

export function remainingCells(mask: BunkerMask): number {
  let count = 0;
  for (let i = 0; i < mask.cells.length; i++) count += mask.cells[i]!;
  return count;
}

export function isDestroyed(mask: BunkerMask): boolean {
  return remainingCells(mask) === 0;
}

/**
 * Celula intacta dentro do retangulo (coordenadas da mascara).
 *
 * `scanFromBottom` escolhe qual borda do retangulo interessa: um projetil
 * subindo colide com o pixel mais BAIXO que encontrou, um descendo com o mais
 * ALTO. Varrer sempre no mesmo sentido faria a cratera abrir do lado errado —
 * ate' a espessura do projetil — e o buraco nunca alinharia com o tiro.
 * Retorna `null` se o retangulo esta' todo vazio.
 */
export function findSolidInRect(
  mask: BunkerMask,
  left: number,
  top: number,
  right: number,
  bottom: number,
  scanFromBottom = true,
): { x: number; y: number } | null {
  const x0 = Math.max(0, Math.floor(left));
  const x1 = Math.min(mask.width - 1, Math.ceil(right));
  const y0 = Math.max(0, Math.floor(top));
  const y1 = Math.min(mask.height - 1, Math.ceil(bottom));

  if (scanFromBottom) {
    for (let y = y1; y >= y0; y--) {
      for (let x = x0; x <= x1; x++) {
        if (mask.cells[y * mask.width + x] === 1) return { x, y };
      }
    }
    return null;
  }

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (mask.cells[y * mask.width + x] === 1) return { x, y };
    }
  }
  return null;
}

/**
 * Escava a brocha `brush` centrada em (cx, cy), em coordenadas da mascara.
 * O centro do bitmap da brocha cai sobre (cx, cy).
 */
export function carve(mask: BunkerMask, brush: Bitmap, cx: number, cy: number): CarveResult {
  const offsetX = Math.round(cx) - (brush.width >> 1);
  const offsetY = Math.round(cy) - (brush.height >> 1);
  let removed = 0;

  for (let by = 0; by < brush.height; by++) {
    const y = offsetY + by;
    if (y < 0 || y >= mask.height) continue;
    for (let bx = 0; bx < brush.width; bx++) {
      if (brush.pixels[by * brush.width + bx] === 0) continue;
      const x = offsetX + bx;
      if (x < 0 || x >= mask.width) continue;
      const index = y * mask.width + x;
      if (mask.cells[index] === 1) {
        mask.cells[index] = 0;
        removed++;
      }
    }
  }

  return { removed };
}

/**
 * Zera um retangulo inteiro. E' o que acontece quando a formacao desce por cima
 * de um bunker: ela nao "atira" nele, ela o apaga na passagem.
 */
export function clearRect(
  mask: BunkerMask,
  left: number,
  top: number,
  right: number,
  bottom: number,
): CarveResult {
  const x0 = Math.max(0, Math.floor(left));
  const x1 = Math.min(mask.width - 1, Math.ceil(right));
  const y0 = Math.max(0, Math.floor(top));
  const y1 = Math.min(mask.height - 1, Math.ceil(bottom));
  let removed = 0;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const index = y * mask.width + x;
      if (mask.cells[index] === 1) {
        mask.cells[index] = 0;
        removed++;
      }
    }
  }

  return { removed };
}

/**
 * X do centro do i-esimo bunker, distribuindo `count` bunkers uniformemente na
 * largura util. Cada bunker fica no meio da sua fatia — assim os vaos entre
 * eles e as folgas nas bordas ficam iguais.
 */
export function bunkerCenterX(index: number, count: number, screenWidth: number): number {
  if (count <= 0) throw new RangeError('bunkerCenterX: count precisa ser >= 1');
  const slice = screenWidth / count;
  return slice * (index + 0.5);
}
