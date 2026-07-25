/**
 * Agenda e bonus do UFO. Logica pura.
 *
 * O UFO e' o unico alvo que sempre solta power-up (Milestone 5), entao o
 * intervalo entre aparicoes e' um botao de ritmo do jogo inteiro: curto demais
 * e o jogador vive cheio de upgrades, longo demais e ele nunca persegue.
 */

import { UFO_POINTS } from '@game/core/scoring';

/** Segundos entre aparicoes, conforme a especificacao. */
export const UFO_INTERVAL_MIN_MS = 20_000;
export const UFO_INTERVAL_MAX_MS = 30_000;

/** Sorteia o intervalo ate' a proxima aparicao. @param roll 0..1 */
export function nextSpawnDelayMs(
  roll: number,
  minMs: number = UFO_INTERVAL_MIN_MS,
  maxMs: number = UFO_INTERVAL_MAX_MS,
): number {
  const clamped = Math.min(Math.max(roll, 0), 1);
  return minMs + (maxMs - minMs) * clamped;
}

/** Bonus sorteado no momento da destruicao: 50 / 100 / 150 / 300. */
export function bonusFor(roll: number): number {
  const clamped = Math.min(Math.max(roll, 0), 0.999999);
  const index = Math.floor(clamped * UFO_POINTS.length);
  return UFO_POINTS[index]!;
}
