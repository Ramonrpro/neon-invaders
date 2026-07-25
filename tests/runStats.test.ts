import { describe, expect, it } from 'vitest';
import { createRunStats, resetRunStats, totalKills } from '../src/game/core/runStats';

describe('contadores da partida', () => {
  it('nascem zerados', () => {
    const stats = createRunStats();
    expect(totalKills(stats)).toBe(0);
    expect(stats.shotsFired).toBe(0);
    expect(stats.powerUpsCollected).toBe(0);
  });

  it('somam abates de todas as origens', () => {
    const stats = createRunStats();
    stats.alienKills.A = 3;
    stats.alienKills.B = 2;
    stats.alienKills.C = 1;
    stats.splitterKills = 4;
    stats.ufoKills = 1;
    stats.bossKills = 1;
    expect(totalKills(stats)).toBe(12);
  });

  it('reset zera no lugar, sem trocar o objeto', () => {
    const stats = createRunStats();
    const alienKills = stats.alienKills;
    stats.alienKills.B = 9;
    stats.shotsFired = 120;
    stats.powerUpsCollected = 3;

    resetRunStats(stats);

    // Mesma referencia: a `GameScene` guarda o objeto num campo readonly e
    // trocar a instancia aqui deixaria a Scene contando no objeto antigo.
    expect(stats.alienKills).toBe(alienKills);
    expect(totalKills(stats)).toBe(0);
    expect(stats.shotsFired).toBe(0);
    expect(stats.powerUpsCollected).toBe(0);
  });
});
