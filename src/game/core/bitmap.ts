/**
 * Logica pura de bitmaps de sprite. Sem Phaser, sem canvas, sem DOM.
 *
 * Um sprite do jogo e' declarado como um array de strings onde `#` (ou qualquer
 * caractere diferente de `.` e espaco) e' pixel aceso e `.` e' transparente.
 * Isso mantem a arte legivel no proprio codigo-fonte e dispensa assets externos.
 */

export type BitmapSource = readonly string[];

export interface Bitmap {
  readonly width: number;
  readonly height: number;
  /** Linha-a-linha, 1 = aceso, 0 = transparente. Comprimento = width * height. */
  readonly pixels: Uint8Array;
}

const ON = 1;
const OFF = 0;

/**
 * Converte as linhas de texto em um bitmap normalizado.
 * Lanca se o desenho estiver vazio ou com linhas de larguras diferentes —
 * erro de arte deve estourar no boot, nunca virar sprite torto em producao.
 */
export function parseBitmap(source: BitmapSource): Bitmap {
  const height = source.length;
  if (height === 0) {
    throw new Error('parseBitmap: bitmap vazio');
  }

  const width = source[0]!.length;
  if (width === 0) {
    throw new Error('parseBitmap: primeira linha vazia');
  }

  const pixels = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    const row = source[y]!;
    if (row.length !== width) {
      throw new Error(
        `parseBitmap: linha ${y} tem largura ${row.length}, esperado ${width}`,
      );
    }
    for (let x = 0; x < width; x++) {
      const ch = row[x]!;
      pixels[y * width + x] = ch === '.' || ch === ' ' ? OFF : ON;
    }
  }

  return { width, height, pixels };
}

/** Le um pixel; fora dos limites conta como transparente. */
export function pixelAt(bitmap: Bitmap, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.height) return OFF;
  return bitmap.pixels[y * bitmap.width + x]!;
}

/** Quantidade de pixels acesos — util para testes e para custo de particulas. */
export function litPixelCount(bitmap: Bitmap): number {
  let count = 0;
  for (let i = 0; i < bitmap.pixels.length; i++) {
    count += bitmap.pixels[i]!;
  }
  return count;
}

/**
 * Caixa delimitadora dos pixels acesos, em coordenadas do bitmap.
 * Retorna `null` se o bitmap for totalmente transparente.
 */
export function tightBounds(
  bitmap: Bitmap,
): { x: number; y: number; width: number; height: number } | null {
  let minX = bitmap.width;
  let minY = bitmap.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      if (pixelAt(bitmap, x, y) === OFF) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
