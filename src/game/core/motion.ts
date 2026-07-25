/**
 * Movimento compartilhado. Logica pura.
 *
 * Existe para que chefao e splitters nao mantenham duas copias da mesma conta
 * de quique — duplicar logica de colisao e' exatamente o tipo de coisa que
 * diverge em silencio depois de um ajuste de balanceamento.
 */

/** -1 = indo para a esquerda, 1 = para a direita. */
export type HorizontalDirection = -1 | 1;

export interface BounceInput {
  readonly x: number;
  readonly direction: HorizontalDirection;
  /** Magnitude em px/s, sempre positiva. */
  readonly speed: number;
  readonly deltaMs: number;
  /** Meia largura do sprite — o quique acontece na borda dele, nao no centro. */
  readonly halfWidth: number;
  readonly minX: number;
  readonly maxX: number;
}

/**
 * Um passo horizontal com quique nas paredes.
 *
 * A posicao e' grampeada na parede antes de inverter o sentido: sem isso, um
 * frame longo (aba voltando do segundo plano, GC) empurraria o sprite para
 * fora do corredor e ele quicaria de novo no frame seguinte, tremendo na borda.
 */
export function bounceStepX(input: BounceInput): { x: number; direction: HorizontalDirection } {
  const { speed, deltaMs, halfWidth, minX, maxX } = input;
  const left = minX + halfWidth;
  const right = maxX - halfWidth;

  // Corredor menor que o sprite: trava no centro em vez de oscilar sem sentido.
  if (right <= left) return { x: (minX + maxX) / 2, direction: input.direction };

  let x = input.x + input.direction * speed * (deltaMs / 1000);
  let direction = input.direction;

  if (x <= left) {
    x = left;
    direction = 1;
  } else if (x >= right) {
    x = right;
    direction = -1;
  }
  return { x, direction };
}
