/**
 * Contadores da partida — a materia-prima que o anti-cheat confere.
 * Logica pura: sem Phaser, sem estado global.
 *
 * Sao contadores, nao telemetria: nada aqui identifica o jogador nem descreve o
 * que ele fez em que instante. E' so' o suficiente para o servidor perguntar
 * "estes abates fecham com este score?" (ver `docs/anti-cheat.md`).
 */

import type { AlienType } from '@game/core/scoring';

export interface RunStats {
  alienKills: Record<AlienType, number>;
  splitterKills: number;
  ufoKills: number;
  bossKills: number;
  powerUpsCollected: number;
  /** PROJETEIS disparados, nao salvas: um leque de 5 conta 5. */
  shotsFired: number;
}

export function createRunStats(): RunStats {
  return {
    alienKills: { A: 0, B: 0, C: 0 },
    splitterKills: 0,
    ufoKills: 0,
    bossKills: 0,
    powerUpsCollected: 0,
    shotsFired: 0,
  };
}

/**
 * Zera no lugar, sem alocar.
 *
 * Existe por causa do ciclo de vida da `GameScene`: a instancia e' reaproveitada
 * entre partidas, entao o `restart()` precisa zerar os contadores a mao — do
 * contrario a segunda partida submeteria os abates da primeira somados aos dela.
 */
export function resetRunStats(stats: RunStats): void {
  stats.alienKills.A = 0;
  stats.alienKills.B = 0;
  stats.alienKills.C = 0;
  stats.splitterKills = 0;
  stats.ufoKills = 0;
  stats.bossKills = 0;
  stats.powerUpsCollected = 0;
  stats.shotsFired = 0;
}

/** Total de abates. Usado so' em diagnostico e teste. */
export function totalKills(stats: RunStats): number {
  return (
    stats.alienKills.A +
    stats.alienKills.B +
    stats.alienKills.C +
    stats.splitterKills +
    stats.ufoKills +
    stats.bossKills
  );
}
