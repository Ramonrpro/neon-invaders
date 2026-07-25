/**
 * CONTRATO ENTRE FRONTEND E BACKEND.
 *
 * Este arquivo pertence ao agente de backend; `src/game/` apenas o importa.
 * Nenhuma implementacao mora aqui — so' as formas de dados e as interfaces.
 *
 * Duas regras que explicam o formato:
 *
 * 1. **Todo metodo e' assincrono, inclusive na versao local.** Trocar
 *    `LocalScoreService` por `RemoteScoreService` no dia do servidor nao pode
 *    mudar uma linha dentro de `src/game/`.
 * 2. **O score do cliente nunca e' verdade.** `submitRun` recebe uma proposta,
 *    nao um fato: quem decide se ela entra no ranking e' o validador (local
 *    hoje, servidor amanha). Ver `docs/anti-cheat.md`.
 */

// --------------------------------------------------------------------- sessao

export interface Session {
  /** Identificador estavel do jogador. Em modo convidado, gerado no aparelho. */
  userId: string;
  /** Nome exibido no ranking. 3 a 12 caracteres. */
  displayName: string;
  /** Convidado nao tem e-mail nem senha e nao sincroniza entre aparelhos. */
  isGuest: boolean;
  /** ISO 8601. */
  createdAt: string;
}

// ---------------------------------------------------------------- pontuacoes

export interface ScoreEntry {
  id: string;
  playerName: string;
  score: number;
  /** 1..5 */
  levelReached: number;
  durationMs: number;
  completedGame: boolean;
  /** ISO 8601. */
  createdAt: string;
}

/**
 * Resumo do que aconteceu na partida — a materia-prima do anti-cheat.
 *
 * Nao e' telemetria: sao contadores baratos que o cliente ja' tem na mao e que
 * o servidor consegue conferir contra os tetos teoricos de cada fase. Um score
 * que nao fecha com os kills declarados e' um score inventado.
 */
export interface RunEventSummary {
  /** Aliens abatidos por tipo de formacao. */
  alienKills: { A: number; B: number; C: number };
  /** Splitters e minions abatidos. */
  splitterKills: number;
  /** UFOs abatidos. */
  ufoKills: number;
  /** Naves-mae abatidas. No maximo uma por fase. */
  bossKills: number;
  /** Capsulas de power-up coletadas, incluindo as que so' viraram pontos. */
  powerUpsCollected: number;
  /** PROJETEIS disparados, nao salvas: um leque de 5 conta 5. */
  shotsFired: number;
}

export interface RunSubmission {
  /** Emitido em `startRun()`. Amarra a submissao a uma partida que comecou. */
  runToken: string;
  score: number;
  /** 1..5 */
  levelReached: number;
  durationMs: number;
  completedGame: boolean;
  events: RunEventSummary;
}

export interface RunAcceptance {
  accepted: boolean;
  /** Posicao no ranking global quando aceita e quando entrou na tabela. */
  rank?: number;
  /** Por que foi recusada. Codigo de `RejectionReason`, legivel para log. */
  reason?: string;
}

/** Recortes do ranking. `me` traz so' as partidas da sessao atual. */
export type LeaderboardScope = 'global' | 'weekly' | 'me';

export interface ScoreService {
  /**
   * Abre uma partida. O token devolvido e' o unico jeito de submeter um score —
   * uma submissao sem partida aberta e' recusada.
   */
  startRun(): Promise<{ runToken: string }>;
  submitRun(sub: RunSubmission): Promise<RunAcceptance>;
  getLeaderboard(scope: LeaderboardScope, limit?: number): Promise<ScoreEntry[]>;
  getPersonalBest(): Promise<ScoreEntry | null>;
}

export interface AuthService {
  getSession(): Promise<Session | null>;
  /** Modo convidado: sem cadastro, sem e-mail. O jogo e' 100% jogavel assim. */
  signInAsGuest(displayName: string): Promise<Session>;
  signUp(email: string, password: string, displayName: string): Promise<Session>;
  signIn(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;
}

/**
 * Erro de dominio dos servicos. Carrega um codigo estavel para que a UI possa
 * decidir o texto sem depender da mensagem.
 */
export class ServiceError extends Error {
  constructor(
    readonly code: ServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export type ServiceErrorCode =
  | 'INVALID_NAME'
  | 'INVALID_EMAIL'
  | 'WEAK_PASSWORD'
  | 'EMAIL_TAKEN'
  | 'BAD_CREDENTIALS'
  | 'NOT_AUTHENTICATED'
  | 'UNAVAILABLE';

/** Limites de `displayName`, compartilhados por auth local e futuro servidor. */
export const DISPLAY_NAME = {
  minLength: 3,
  maxLength: 12,
} as const;
