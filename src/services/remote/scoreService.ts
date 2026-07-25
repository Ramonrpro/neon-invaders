/**
 * `ScoreService` sobre o Supabase.
 *
 * A diferenca de comportamento em relacao ao adapter local e' UMA, e e' a razao
 * de o contrato existir: aqui `submitRun` manda a proposta e o SERVIDOR decide.
 * O `accepted` que volta e' a palavra final; o cliente nao recalcula nada.
 *
 * As duas metades falam com peças diferentes do projeto, de proposito:
 *
 * - **Escrever** passa por Edge Function (`runs-start`, `runs-submit`), a unica
 *   coisa que tem service_role e consegue gravar em `scores`.
 * - **Ler** vai direto ao PostgREST. Ranking e' leitura publica, cacheavel e
 *   sem regra nenhuma para aplicar — passar isso por uma funcao so' somaria um
 *   salto de latencia entre o jogador e uma tabela que ele pode ler de qualquer
 *   jeito.
 */

import {
  LEADERBOARD_CAPACITY,
  LEADERBOARD_PAGE,
  WEEK_MS,
} from '@services/leaderboard';
import { supabaseFetch } from '@services/remote/client';
import type { SupabaseConfig } from '@services/remote/config';
import type { RemoteSession } from '@services/remote/session';
import {
  ServiceError,
  type LeaderboardScope,
  type RunAcceptance,
  type RunSubmission,
  type ScoreEntry,
  type ScoreService,
} from '@services/types';

/**
 * As colunas do ranking, com apelido em camelCase.
 *
 * O PostgREST renomeia no proprio `select`, entao a resposta ja' chega no
 * formato de `ScoreEntry` — sem uma camada de traducao snake_case → camelCase
 * que so' existiria para ser esquecida quando alguem acrescentar um campo.
 */
const ENTRY_COLUMNS = [
  'id',
  'playerName:player_name',
  'score',
  'levelReached:level_reached',
  'durationMs:duration_ms',
  'completedGame:completed_game',
  'createdAt:created_at',
].join(',');

/** A mesma ordem de `services/leaderboard.ts` e do indice de `scores`. */
const ENTRY_ORDER = 'score.desc,duration_ms.asc,created_at.asc';

export class RemoteScoreService implements ScoreService {
  constructor(
    private readonly config: SupabaseConfig,
    private readonly session: RemoteSession,
  ) {}

  async startRun(): Promise<{ runToken: string }> {
    return this.callFunction<{ runToken: string }>('runs-start');
  }

  async submitRun(sub: RunSubmission): Promise<RunAcceptance> {
    return this.callFunction<RunAcceptance>('runs-submit', sub);
  }

  async getLeaderboard(scope: LeaderboardScope, limit = LEADERBOARD_PAGE): Promise<ScoreEntry[]> {
    const rows = Math.min(Math.max(0, Math.trunc(limit)), LEADERBOARD_CAPACITY);
    if (rows === 0) return [];

    // `me` sai de uma view separada, filtrada por `auth.uid()` no proprio banco.
    // A view publica NAO expoe `user_id` (contrato §3): filtrar por dono do lado
    // do cliente exigiria publicar a coluna, e ai' qualquer um leria a tabela de
    // qualquer outro.
    const view = scope === 'me' ? 'leaderboard_mine' : 'leaderboard_public';
    const params = new URLSearchParams({
      select: ENTRY_COLUMNS,
      order: ENTRY_ORDER,
      limit: String(rows),
    });
    if (scope === 'weekly') {
      params.set('created_at', `gte.${new Date(Date.now() - WEEK_MS).toISOString()}`);
    }

    // Sem sessao, `me` e' vazio por definicao — e a consulta com a chave anon
    // devolveria vazio de qualquer forma, porque `auth.uid()` seria nulo.
    const token = await this.session.accessToken();
    if (scope === 'me' && !token) return [];

    const entries = await supabaseFetch<ScoreEntry[]>(
      this.config,
      `/rest/v1/${view}?${params.toString()}`,
      { method: 'GET', accessToken: token ?? undefined },
    );
    return Array.isArray(entries) ? entries : [];
  }

  async getPersonalBest(): Promise<ScoreEntry | null> {
    const best = await this.getLeaderboard('me', 1);
    return best[0] ?? null;
  }

  /**
   * Chamada de Edge Function com a sessao do jogador.
   *
   * Sem sessao e' erro, e nao uma resposta vazia: partida sem dono nao tem onde
   * ser gravada. O `RunReporter` trata isso como ranking indisponivel e a
   * partida acontece normalmente — o jogo nunca depende do servidor para rodar.
   */
  private async callFunction<T>(name: string, body?: unknown): Promise<T> {
    const token = await this.session.accessToken();
    if (!token) throw new ServiceError('NOT_AUTHENTICATED', 'sem sessao para registrar a partida');
    return supabaseFetch<T>(this.config, `/functions/v1/${name}`, {
      method: 'POST',
      accessToken: token,
      body: body ?? {},
    });
  }
}
