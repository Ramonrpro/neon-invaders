import { describe, expect, it } from 'vitest';
import {
  LEADERBOARD_CAPACITY,
  WEEK_MS,
  compareScores,
  filterScope,
  insertScore,
  rankOf,
  sortScores,
  toPublicEntry,
  type StoredScore,
} from '../src/services/leaderboard';

const NOW = Date.parse('2026-07-24T12:00:00.000Z');

function entry(overrides: Partial<StoredScore> = {}): StoredScore {
  return {
    id: 'id-1',
    userId: 'user-1',
    playerName: 'RAM',
    score: 1000,
    levelReached: 2,
    durationMs: 60_000,
    completedGame: false,
    createdAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

describe('ordem do ranking', () => {
  it('maior score primeiro', () => {
    const table = sortScores([entry({ id: 'a', score: 10 }), entry({ id: 'b', score: 99 })]);
    expect(table.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('empate no score resolve pela partida mais curta', () => {
    const table = sortScores([
      entry({ id: 'lento', durationMs: 300_000 }),
      entry({ id: 'rapido', durationMs: 90_000 }),
    ]);
    expect(table.map((e) => e.id)).toEqual(['rapido', 'lento']);
  });

  it('empate total resolve pela mais antiga', () => {
    const older = new Date(NOW - 5000).toISOString();
    const table = sortScores([
      entry({ id: 'nova' }),
      entry({ id: 'velha', createdAt: older }),
    ]);
    expect(table.map((e) => e.id)).toEqual(['velha', 'nova']);
  });

  it('compareScores nao depende da ordem de entrada', () => {
    const a = entry({ score: 500 });
    const b = entry({ score: 900 });
    expect(compareScores(a, b)).toBeGreaterThan(0);
    expect(compareScores(b, a)).toBeLessThan(0);
  });
});

describe('recortes', () => {
  const dentroDaSemana = entry({ id: 'semana', createdAt: new Date(NOW - WEEK_MS + 1000).toISOString() });
  const foraDaSemana = entry({ id: 'antiga', createdAt: new Date(NOW - WEEK_MS - 1000).toISOString() });
  const deOutro = entry({ id: 'outro', userId: 'user-2' });
  const todas = [dentroDaSemana, foraDaSemana, deOutro];

  it('global traz tudo', () => {
    expect(filterScope(todas, 'global', 'user-1', NOW)).toHaveLength(3);
  });

  it('weekly corta o que passou de 7 dias', () => {
    const ids = filterScope(todas, 'weekly', 'user-1', NOW).map((e) => e.id);
    expect(ids).toContain('semana');
    expect(ids).not.toContain('antiga');
  });

  it('me traz so as do jogador da sessao', () => {
    const ids = filterScope(todas, 'me', 'user-1', NOW).map((e) => e.id);
    expect(ids).not.toContain('outro');
    expect(ids).toHaveLength(2);
  });

  it('me sem sessao devolve vazio, nao a tabela inteira', () => {
    expect(filterScope(todas, 'me', null, NOW)).toEqual([]);
  });
});

describe('insercao e posicao', () => {
  it('poda a tabela na capacidade, tirando a pior', () => {
    const cheia = Array.from({ length: LEADERBOARD_CAPACITY }, (_, i) =>
      entry({ id: `e${i}`, score: 1000 + i }),
    );
    const table = insertScore(cheia, entry({ id: 'nova', score: 5000 }));
    expect(table).toHaveLength(LEADERBOARD_CAPACITY);
    expect(table[0]?.id).toBe('nova');
    expect(table.some((e) => e.id === 'e0')).toBe(false);
  });

  it('devolve a posicao 1-based da entrada', () => {
    const table = sortScores([entry({ id: 'a', score: 10 }), entry({ id: 'b', score: 99 })]);
    expect(rankOf(table, 'b')).toBe(1);
    expect(rankOf(table, 'a')).toBe(2);
  });

  it('devolve null para quem ficou fora da tabela', () => {
    const table = sortScores([entry({ id: 'a', score: 10 })]);
    expect(rankOf(table, 'inexistente')).toBeNull();
  });
});

describe('entrada publica', () => {
  it('nao vaza o userId', () => {
    const publica = toPublicEntry(entry());
    expect(publica).not.toHaveProperty('userId');
    expect(publica.playerName).toBe('RAM');
  });
});
