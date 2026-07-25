/**
 * A TRAVA DA DUPLICACAO.
 *
 * `src/services/validation/limits.ts` copia numeros de balanceamento que moram
 * em `src/game/config/` — de proposito, porque o validador precisa rodar no
 * servidor, longe do bundle do jogo (ver o cabecalho de `limits.ts`).
 *
 * Este arquivo e' o unico lugar do projeto que importa os dois lados. Ele existe
 * para que rebalancear uma fase e esquecer o validador seja um teste vermelho,
 * e nao um ranking que passa a recusar partida honesta em silencio.
 */

import { describe, expect, it } from 'vitest';
import { BOSS, BOSSES } from '../src/game/config/bosses';
import { LAST_LEVEL as GAME_LAST_LEVEL, LEVELS } from '../src/game/config/levels';
import { SPLITTER } from '../src/game/config/gameplay';
import { POWERUP_DROP } from '../src/game/config/powerups';
import { MULTI_PATTERNS } from '../src/game/config/powerups/multi';
import { RAPID_COOLDOWN_MS } from '../src/game/config/powerups/rapid';
import { FORMATION_COLS, FORMATION_ROWS, alienTypeForRow } from '../src/game/core/formation';
import {
  ALIEN_POINTS as GAME_ALIEN_POINTS,
  MAXED_POWERUP_POINTS as GAME_MAXED_POWERUP_POINTS,
  UFO_POINTS,
} from '../src/game/core/scoring';
import { UFO_INTERVAL_MIN_MS } from '../src/game/core/ufo';
import {
  ALIENS_PER_FORMATION,
  ALIEN_POINTS,
  BOSS_HP,
  BOSS_POINTS,
  FORMATION_SCORE,
  LAST_LEVEL,
  LEVEL_HAS_SPLITTERS,
  MAXED_POWERUP_POINTS,
  MAX_SHOTS_PER_SECOND,
  MINION_MAX_COUNT,
  MINION_MIN_INTERVAL_MS,
  POWERUPS_PER_BOSS,
  POWERUP_MIN_INTERVAL_MS,
  SPLITTER_POINTS,
  UFO_MAX_BONUS,
  UFO_MIN_BONUS,
  UFO_MIN_SPAWN_INTERVAL_MS,
} from '../src/services/validation/limits';

describe('formacao', () => {
  it('conta os mesmos aliens por tipo que a formacao do jogo', () => {
    const counted = { A: 0, B: 0, C: 0 };
    for (let row = 0; row < FORMATION_ROWS; row++) {
      counted[alienTypeForRow(row)] += FORMATION_COLS;
    }
    expect(counted).toEqual({ ...ALIENS_PER_FORMATION });
  });

  it('usa a mesma tabela de pontos', () => {
    expect({ ...ALIEN_POINTS }).toEqual({ ...GAME_ALIEN_POINTS });
  });

  it('o teto da formacao e a soma dos aliens dela', () => {
    const total =
      ALIENS_PER_FORMATION.A * GAME_ALIEN_POINTS.A +
      ALIENS_PER_FORMATION.B * GAME_ALIEN_POINTS.B +
      ALIENS_PER_FORMATION.C * GAME_ALIEN_POINTS.C;
    expect(FORMATION_SCORE).toBe(total);
  });
});

describe('fases', () => {
  it('tem o mesmo numero de fases', () => {
    expect(LAST_LEVEL).toBe(GAME_LAST_LEVEL);
  });

  it('sabe exatamente em quais fases um alien pode se partir', () => {
    expect(LEVEL_HAS_SPLITTERS).toEqual(LEVELS.map((level) => level.splitChance > 0));
  });

  it('usa os pontos de splitter do jogo', () => {
    expect(SPLITTER_POINTS).toBe(SPLITTER.points);
  });
});

describe('chefoes', () => {
  it('copia os pontos e o HP de cada nave-mae', () => {
    expect(BOSS_POINTS).toEqual(BOSSES.map((boss) => boss.points));
    expect(BOSS_HP).toEqual(BOSSES.map((boss) => boss.hp));
  });

  it('copia quantas capsulas o chefao larga', () => {
    expect(POWERUPS_PER_BOSS).toBe(BOSS.drops);
  });

  it('nao subestima a invocacao de minions de nenhuma fase', () => {
    for (const boss of BOSSES) {
      if (!boss.minions) continue;
      // O teto do validador precisa ser generoso nos DOIS sentidos: invocar mais
      // rapido ou em maior quantidade do que ele espera acusaria jogador honesto.
      expect(MINION_MIN_INTERVAL_MS).toBeLessThanOrEqual(boss.minions.intervalMs);
      expect(MINION_MAX_COUNT).toBeGreaterThanOrEqual(boss.minions.count);
    }
  });
});

describe('UFO e capsulas', () => {
  it('copia a faixa de bonus do UFO', () => {
    expect(UFO_MAX_BONUS).toBe(Math.max(...UFO_POINTS));
    expect(UFO_MIN_BONUS).toBe(Math.min(...UFO_POINTS));
  });

  it('nao supoe o UFO mais raro do que ele e', () => {
    expect(UFO_MIN_SPAWN_INTERVAL_MS).toBeLessThanOrEqual(UFO_INTERVAL_MIN_MS);
  });

  it('usa o cooldown global de drop do jogo', () => {
    expect(POWERUP_MIN_INTERVAL_MS).toBeLessThanOrEqual(POWERUP_DROP.cooldownMs);
    expect(MAXED_POWERUP_POINTS).toBe(GAME_MAXED_POWERUP_POINTS);
  });
});

describe('cadencia de tiro', () => {
  it('acompanha o RAPID maximo com o MULTI maximo', () => {
    const fastestCooldownMs = Math.min(...RAPID_COOLDOWN_MS);
    const biggestSalvo = Math.max(...MULTI_PATTERNS.map((pattern) => pattern.length));
    const shotsPerSecond = (1000 / fastestCooldownMs) * biggestSalvo;
    expect(MAX_SHOTS_PER_SECOND).toBeGreaterThanOrEqual(shotsPerSecond);
  });
});
