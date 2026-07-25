/**
 * Regras de pontuacao. Logica pura — sem Phaser, sem estado global.
 */

export type AlienType = 'A' | 'B' | 'C';

/** Pontos por tipo de alien. Tipo A e' a base da formacao, C e' o topo. */
export const ALIEN_POINTS: Readonly<Record<AlienType, number>> = {
  A: 10,
  B: 20,
  C: 30,
};

/** Bonus possiveis do UFO. Sorteado no momento da destruicao. */
export const UFO_POINTS = [50, 100, 150, 300] as const;

/** Vida extra concedida uma unica vez, ao cruzar esta pontuacao. */
export const EXTRA_LIFE_SCORE = 5000;

/** Pontos por coletar um power-up que ja' esta' no nivel maximo. */
export const MAXED_POWERUP_POINTS = 500;

export function pointsForAlien(type: AlienType): number {
  return ALIEN_POINTS[type];
}

/**
 * Verdadeiro quando a pontuacao cruzou o limiar da vida extra neste ganho.
 * Como o score so' cresce, testar a travessia basta para conceder uma unica vez.
 */
export function crossedExtraLifeThreshold(previousScore: number, newScore: number): boolean {
  return previousScore < EXTRA_LIFE_SCORE && newScore >= EXTRA_LIFE_SCORE;
}

/** Formata a pontuacao no padrao do HUD arcade: 6 digitos com zeros a esquerda. */
export function formatScore(score: number): string {
  const clamped = Math.max(0, Math.trunc(score));
  return clamped.toString().padStart(6, '0');
}
