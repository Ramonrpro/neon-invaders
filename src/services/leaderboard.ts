/**
 * Regras da tabela de ranking. Logica pura — sem storage, sem rede.
 *
 * Ordenar e recortar sao as duas operacoes que o adapter local e o servidor
 * futuro precisam concordar em fazer do mesmo jeito, senao a mesma partida
 * aparece em posicoes diferentes conforme quem respondeu. Ficam aqui, testadas.
 */

import type { LeaderboardScope, ScoreEntry } from '@services/types';

/** Uma linha como ela e' guardada: a entrada publica mais o dono. */
export interface StoredScore extends ScoreEntry {
  /** Quem fez a partida. Nunca sai para o ranking publico. */
  userId: string;
}

/** Quantas entradas o ranking guarda. Acima disso, a pior sai. */
export const LEADERBOARD_CAPACITY = 100;

/** Quantas linhas a tela mostra por padrao. */
export const LEADERBOARD_PAGE = 10;

/** Janela do recorte semanal. */
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Ordem do ranking: score desc; empate resolve por partida mais CURTA, e depois
 * pela mais antiga. Premiar o tempo menor no empate e' o que impede que ficar
 * parado numa fase facil suba na tabela.
 */
export function compareScores(a: ScoreEntry, b: ScoreEntry): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.durationMs !== b.durationMs) return a.durationMs - b.durationMs;
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

/** Copia ordenada. Nao mexe no array recebido. */
export function sortScores<T extends ScoreEntry>(entries: readonly T[]): T[] {
  return [...entries].sort(compareScores);
}

/**
 * Aplica o recorte pedido.
 *
 * @param nowMs referencia da janela semanal — parametro, e nao `Date.now()`,
 *              porque isto precisa ser testavel sem relogio falso.
 */
export function filterScope<T extends StoredScore>(
  entries: readonly T[],
  scope: LeaderboardScope,
  userId: string | null,
  nowMs: number,
): T[] {
  switch (scope) {
    case 'weekly':
      return entries.filter((entry) => nowMs - Date.parse(entry.createdAt) <= WEEK_MS);
    case 'me':
      // Sem sessao nao existe "meus": devolve vazio em vez de tudo.
      return userId === null ? [] : entries.filter((entry) => entry.userId === userId);
    case 'global':
      return [...entries];
  }
}

/**
 * Posicao (1-based) de uma entrada na tabela ordenada, ou `null` se ela nao
 * esta' entre as `capacity` melhores — e' o que decide se o jogador ve um rank
 * ou so' a pontuacao.
 */
export function rankOf(
  sorted: readonly ScoreEntry[],
  id: string,
  capacity = LEADERBOARD_CAPACITY,
): number | null {
  const index = sorted.findIndex((entry) => entry.id === id);
  if (index < 0 || index >= capacity) return null;
  return index + 1;
}

/** Insere e poda: a tabela nunca passa de `capacity` linhas. */
export function insertScore<T extends StoredScore>(
  entries: readonly T[],
  entry: T,
  capacity = LEADERBOARD_CAPACITY,
): T[] {
  return sortScores([...entries, entry]).slice(0, capacity);
}

/** Remove o `userId` — o que sai do servico publico nunca carrega o dono. */
export function toPublicEntry(entry: StoredScore): ScoreEntry {
  return {
    id: entry.id,
    playerName: entry.playerName,
    score: entry.score,
    levelReached: entry.levelReached,
    durationMs: entry.durationMs,
    completedGame: entry.completedGame,
    createdAt: entry.createdAt,
  };
}
