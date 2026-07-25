/**
 * Ranking local, sobre `localStorage`.
 *
 * Ele finge ser um servidor de proposito: emite token de partida, valida a run
 * antes de aceitar, aplica rate limit e devolve posicao. Nada disso protege o
 * jogador do proprio console — protege o CODIGO, garantindo que o caminho
 * "abrir run → jogar → submeter → ser aceito ou recusado" ja' esteja exercitado
 * quando o adapter remoto entrar no lugar deste.
 *
 * A regra que vale nos dois mundos: **o score que chega do cliente e' uma
 * proposta, nunca um fato.** Ver `docs/anti-cheat.md`.
 */

import {
  LEADERBOARD_CAPACITY,
  LEADERBOARD_PAGE,
  filterScope,
  insertScore,
  rankOf,
  sortScores,
  toPublicEntry,
  type StoredScore,
} from '@services/leaderboard';
import { JsonStore, randomId } from '@services/local/storage';
import type {
  AuthService,
  LeaderboardScope,
  RunAcceptance,
  RunSubmission,
  ScoreEntry,
  ScoreService,
} from '@services/types';
import { validateRun } from '@services/validation/plausibility';

const SCORES_KEY = 'scores';

/**
 * Folga entre a duracao declarada e o relogio do servico.
 *
 * O tempo declarado vem do relogio do jogo, que PARA quando a aba perde o foco
 * (Phaser congela o loop) — ele e' sempre menor ou igual ao tempo de parede.
 * Por isso a checagem e' so' de teto: declarar mais tempo do que passou desde o
 * `startRun` e' impossivel; declarar menos e' rotina.
 */
const CLOCK_TOLERANCE_MS = 5000;

/** Intervalo minimo entre duas submissoes do mesmo aparelho. */
const MIN_SUBMIT_INTERVAL_MS = 3000;

interface OpenRun {
  startedAtMs: number;
}

function isStoredScoreArray(value: unknown): value is StoredScore[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as StoredScore).id === 'string' &&
        typeof (entry as StoredScore).userId === 'string' &&
        typeof (entry as StoredScore).score === 'number' &&
        typeof (entry as StoredScore).createdAt === 'string',
    )
  );
}

export class LocalScoreService implements ScoreService {
  private readonly store = new JsonStore();
  /**
   * Partidas abertas. Vive so' em memoria: recarregar a pagina no meio de uma
   * partida ja' perde a partida, entao persistir o token nao compraria nada —
   * e um token que sobrevive ao reload e' exatamente o que um script usaria.
   */
  private readonly openRuns = new Map<string, OpenRun>();
  private lastSubmitAtMs = 0;

  constructor(
    private readonly auth: AuthService,
    /** Injetavel para teste. Em producao, o relogio de parede. */
    private readonly now: () => number = () => Date.now(),
  ) {}

  async startRun(): Promise<{ runToken: string }> {
    const runToken = randomId();
    this.openRuns.set(runToken, { startedAtMs: this.now() });
    return { runToken };
  }

  async submitRun(sub: RunSubmission): Promise<RunAcceptance> {
    const open = this.openRuns.get(sub.runToken);
    // Sem partida aberta nao ha' o que submeter — e um token so' vale uma vez.
    if (!open) return { accepted: false, reason: 'UNKNOWN_RUN_TOKEN' };
    this.openRuns.delete(sub.runToken);

    const nowMs = this.now();
    if (nowMs - this.lastSubmitAtMs < MIN_SUBMIT_INTERVAL_MS) {
      return { accepted: false, reason: 'RATE_LIMITED' };
    }
    this.lastSubmitAtMs = nowMs;

    if (sub.durationMs > nowMs - open.startedAtMs + CLOCK_TOLERANCE_MS) {
      return { accepted: false, reason: 'DURATION_MISMATCH' };
    }

    const verdict = validateRun(sub);
    if (!verdict.plausible) {
      return { accepted: false, reason: verdict.reason ?? 'IMPLAUSIBLE' };
    }

    const session = await this.auth.getSession();
    const entry: StoredScore = {
      id: randomId(),
      userId: session?.userId ?? 'anonimo',
      playerName: session?.displayName ?? 'CONVIDADO',
      score: sub.score,
      levelReached: sub.levelReached,
      durationMs: sub.durationMs,
      completedGame: sub.completedGame,
      createdAt: new Date(nowMs).toISOString(),
    };

    const table = insertScore(this.readScores(), entry, LEADERBOARD_CAPACITY);
    this.store.write(SCORES_KEY, table);

    const rank = rankOf(table, entry.id);
    // `rank` ausente significa "aceita, mas fora da tabela" — a UI mostra so' a
    // pontuacao. Fora da tabela nao e' recusa.
    return rank === null ? { accepted: true } : { accepted: true, rank };
  }

  async getLeaderboard(scope: LeaderboardScope, limit = LEADERBOARD_PAGE): Promise<ScoreEntry[]> {
    const session = await this.auth.getSession();
    const scoped = filterScope(this.readScores(), scope, session?.userId ?? null, this.now());
    return sortScores(scoped).slice(0, Math.max(0, limit)).map(toPublicEntry);
  }

  async getPersonalBest(): Promise<ScoreEntry | null> {
    const best = await this.getLeaderboard('me', 1);
    return best[0] ?? null;
  }

  private readScores(): StoredScore[] {
    return this.store.read<StoredScore[]>(SCORES_KEY, isStoredScoreArray, []);
  }
}

export function createScoreService(auth: AuthService): ScoreService {
  return new LocalScoreService(auth);
}
