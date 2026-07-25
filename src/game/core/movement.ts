/**
 * Movimento horizontal da nave. Logica pura.
 *
 * Existe um unico calculo de posicao para as duas formas de jogar, e nao um
 * caminho "de teclado" e outro "de toque": as duas entradas sao somadas antes
 * do clamp. Isso importa porque num tablet com teclado as duas chegam no mesmo
 * frame, e resolver cada uma por sua conta faria a nave saltar.
 */

export interface PlayerMoveInput {
  /** X atual da nave. */
  currentX: number;
  /** Eixo do teclado: -1 esquerda, 0 parado, 1 direita. */
  axis: -1 | 0 | 1;
  /**
   * Deslocamento do arrasto acumulado neste frame, em px logicos.
   *
   * E' delta RELATIVO, nao posicao absoluta: o dedo empurra a nave pelo tanto
   * que andou, em qualquer ponto da tela. Posicao absoluta obrigaria o jogador
   * a manter o dedo em cima da nave — que e' justamente onde ele nao consegue
   * ver o que esta' acontecendo.
   */
  dragDeltaX: number;
  /** Velocidade do teclado, px/s. */
  speed: number;
  /** Delta do frame, em ms. */
  deltaMs: number;
  /** Limites ja' descontada a largura da nave. */
  minX: number;
  maxX: number;
}

/** Proximo X da nave, somando teclado e arrasto e travando nas paredes. */
export function nextPlayerX(input: PlayerMoveInput): number {
  const { currentX, axis, dragDeltaX, speed, deltaMs, minX, maxX } = input;

  const keyboardDx = (axis * speed * deltaMs) / 1000;
  const target = currentX + keyboardDx + dragDeltaX;

  return clamp(target, minX, maxX);
}

/**
 * Trava um valor no intervalo. Com `min > max` (tela mais estreita que a nave)
 * devolve o meio do intervalo em vez de um resultado arbitrario — a nave fica
 * centrada e visivel em vez de grudada numa borda.
 */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
