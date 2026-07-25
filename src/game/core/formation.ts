/**
 * Geometria e movimento da formacao de aliens. Logica pura.
 *
 * A formacao NAO usa Arcade Physics: ela anda em passos discretos, comandados
 * por um timer proprio. Este modulo decide, a cada tick, para onde o bloco vai —
 * a Scene apenas aplica o deslocamento resultante.
 */

import type { AlienType } from '@game/core/scoring';

export const FORMATION_ROWS = 5;
export const FORMATION_COLS = 11;

/** Direcao lateral da marcha: -1 esquerda, 1 direita. */
export type MarchDirection = -1 | 1;

export interface MarchStepInput {
  /** Direcao atual da marcha. */
  direction: MarchDirection;
  /** Borda esquerda do bloco de aliens VIVOS, em coordenadas logicas. */
  liveLeft: number;
  /** Borda direita do bloco de aliens VIVOS. */
  liveRight: number;
  /** Limite esquerdo permitido na tela. */
  minX: number;
  /** Limite direito permitido na tela. */
  maxX: number;
  /** Deslocamento lateral por passo. */
  stepX: number;
  /** Descida aplicada quando a formacao encosta na borda. */
  stepY: number;
}

export interface MarchStepResult {
  dx: number;
  dy: number;
  direction: MarchDirection;
  /** Verdadeiro quando este passo foi uma descida em vez de um passo lateral. */
  descended: boolean;
}

/**
 * Decide o proximo passo da formacao.
 *
 * Comportamento classico: enquanto couber, anda de lado. Quando o proximo passo
 * lateral estouraria a borda, a formacao **desce uma linha e inverte** — nesse
 * tick ela nao anda de lado.
 */
export function planMarchStep(input: MarchStepInput): MarchStepResult {
  const { direction, liveLeft, liveRight, minX, maxX, stepX, stepY } = input;

  const nextLeft = liveLeft + direction * stepX;
  const nextRight = liveRight + direction * stepX;
  const hitsEdge = direction === 1 ? nextRight > maxX : nextLeft < minX;

  if (hitsEdge) {
    return { dx: 0, dy: stepY, direction: (direction * -1) as MarchDirection, descended: true };
  }

  return { dx: direction * stepX, dy: 0, direction, descended: false };
}

/**
 * Tipo do alien pela linha da formacao.
 * Linha 0 e' a de cima (tipo C, 30 pts); as duas de baixo sao tipo A (10 pts).
 */
export function alienTypeForRow(row: number): AlienType {
  if (!Number.isInteger(row) || row < 0 || row >= FORMATION_ROWS) {
    throw new RangeError(`alienTypeForRow: linha ${row} fora da formacao 0..${FORMATION_ROWS - 1}`);
  }
  if (row === 0) return 'C';
  if (row <= 2) return 'B';
  return 'A';
}

/**
 * Posicao do centro de uma celula da formacao, relativa ao canto superior
 * esquerdo do bloco. A Scene soma a origem e os deslocamentos acumulados.
 */
export function cellCenter(
  row: number,
  col: number,
  cellWidth: number,
  cellHeight: number,
): { x: number; y: number } {
  return {
    x: col * cellWidth + cellWidth / 2,
    y: row * cellHeight + cellHeight / 2,
  };
}
