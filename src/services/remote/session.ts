/**
 * A sessao do jogador do lado do navegador: guardar, renovar e esquecer.
 *
 * Fica separada do `RemoteAuthService` porque quem mais precisa dela e' o
 * `RemoteScoreService` — toda chamada de ranking pede um token fresco. Duas
 * copias dessa logica renovariam o token duas vezes e uma invalidaria a outra
 * (o Supabase roda com rotacao de refresh token ligada).
 *
 * A persistencia passa pelo `JsonStore`, o unico arquivo do projeto que fala com
 * `localStorage`. E' por isso que este adapter nao usa `@supabase/supabase-js`:
 * o SDK traria o proprio mecanismo de persistencia, por fora dessa regra.
 */

import { JsonStore } from '@services/local/storage';
import { supabaseFetch } from '@services/remote/client';
import type { SupabaseConfig } from '@services/remote/config';
import { ServiceError, type Session } from '@services/types';

const SESSION_KEY = 'supabase-session';

/** Nome usado quando a conta chega sem `display_name` nos metadados. */
export const FALLBACK_DISPLAY_NAME = 'PILOTO';

/**
 * Renova com esta antecedencia sobre o vencimento.
 *
 * Um token que vence no meio do voo da requisicao produz um 401 que a UI leria
 * como "ranking fora do ar". Sessenta segundos cobrem folgadamente a latencia de
 * uma rede ruim e o desvio de relogio do aparelho.
 */
const REFRESH_SKEW_MS = 60_000;

/** O que o GoTrue devolve em signup, login e refresh. */
export interface GoTrueSession {
  access_token: string;
  refresh_token: string;
  /** Segundos de validade do access token. */
  expires_in?: number;
  user?: {
    id: string;
    created_at?: string;
    is_anonymous?: boolean;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  };
}

interface StoredSession {
  session: Session;
  accessToken: string;
  refreshToken: string;
  /** Epoch em ms. */
  expiresAtMs: number;
}

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false;
  const stored = value as Partial<StoredSession>;
  return (
    typeof stored.accessToken === 'string' &&
    typeof stored.refreshToken === 'string' &&
    typeof stored.expiresAtMs === 'number' &&
    typeof stored.session === 'object' &&
    stored.session !== null &&
    typeof stored.session.userId === 'string' &&
    typeof stored.session.displayName === 'string'
  );
}

export class RemoteSession {
  private readonly store = new JsonStore();
  private cached: StoredSession | null = null;
  private loaded = false;
  /** Renovacao em andamento. Impede duas chamadas simultaneas de renovar duas vezes. */
  private refreshing: Promise<StoredSession | null> | null = null;

  constructor(private readonly config: SupabaseConfig) {}

  /** A sessao guardada, sem tocar na rede. */
  peek(): Session | null {
    return this.read()?.session ?? null;
  }

  /**
   * Token valido para a proxima chamada, renovando se estiver perto de vencer.
   *
   * @returns `null` quando nao ha' sessao ou quando o refresh token morreu.
   */
  async accessToken(): Promise<string | null> {
    const stored = this.read();
    if (!stored) return null;
    if (Date.now() < stored.expiresAtMs - REFRESH_SKEW_MS) return stored.accessToken;

    const renewed = await this.refresh();
    return renewed?.accessToken ?? null;
  }

  /** A sessao atual, renovando o token se preciso. Nunca lanca. */
  async current(): Promise<Session | null> {
    const stored = this.read();
    if (!stored) return null;
    if (Date.now() < stored.expiresAtMs - REFRESH_SKEW_MS) return stored.session;

    const renewed = await this.refresh();
    // Renovacao que falhou por REDE deixa a sessao de pe': o nome continua na
    // tela de titulo e o ranking e' que fica indisponivel. Refresh token MORTO
    // (o `refresh` ja' apagou tudo) devolve null e a tela pede o nome de novo.
    return renewed?.session ?? this.read()?.session ?? null;
  }

  /**
   * Adota a sessao que o GoTrue acabou de emitir.
   *
   * @param displayName nome escolhido pelo jogador, quando houver — os metadados
   *                    do usuario podem ainda nao te-lo na resposta do signup.
   */
  adopt(payload: GoTrueSession, displayName?: string): Session {
    const user = payload.user;
    const metadata = user?.user_metadata ?? null;
    const fromMetadata =
      typeof metadata?.display_name === 'string' ? metadata.display_name : null;

    const session: Session = {
      userId: user?.id ?? this.read()?.session.userId ?? '',
      displayName: displayName ?? fromMetadata ?? this.read()?.session.displayName ?? FALLBACK_DISPLAY_NAME,
      // Convidado e' o usuario anonimo do GoTrue. Quem tem e-mail, nao e'.
      isGuest: user?.is_anonymous === true || !user?.email,
      createdAt: user?.created_at ?? new Date().toISOString(),
    };

    this.write({
      session,
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAtMs: Date.now() + (payload.expires_in ?? 3600) * 1000,
    });
    return session;
  }

  /** Troca so' o nome, mantendo os tokens. Usado quando o convidado se renomeia. */
  rename(displayName: string): Session | null {
    const stored = this.read();
    if (!stored) return null;
    const session: Session = { ...stored.session, displayName };
    this.write({ ...stored, session });
    return session;
  }

  /**
   * Convidado que virou conta de verdade: mesmo `userId`, mesmos tokens.
   *
   * O ponto e' o `userId` continuar o mesmo — e' ele que amarra as partidas ja'
   * gravadas. Quem jogou a semana inteira como convidado e depois se cadastra
   * nao pode perder o proprio historico no caminho.
   */
  promote(displayName: string): Session | null {
    const stored = this.read();
    if (!stored) return null;
    const session: Session = { ...stored.session, displayName, isGuest: false };
    this.write({ ...stored, session });
    return session;
  }

  clear(): void {
    this.cached = null;
    this.loaded = true;
    this.store.remove(SESSION_KEY);
  }

  private read(): StoredSession | null {
    if (!this.loaded) {
      this.cached = this.store.read<StoredSession | null>(
        SESSION_KEY,
        (value): value is StoredSession | null => value === null || isStoredSession(value),
        null,
      );
      this.loaded = true;
    }
    return this.cached;
  }

  private write(value: StoredSession): void {
    this.cached = value;
    this.loaded = true;
    this.store.write(SESSION_KEY, value);
  }

  /**
   * Renova o par de tokens.
   *
   * A distincao que importa: refresh token RECUSADO (a conta sumiu, o token ja'
   * foi rotacionado por outra aba) apaga a sessao, porque insistir com ele so'
   * produz 401 para sempre. Falha de REDE nao apaga nada — a pessoa esta' no
   * metro, e perder a sessao por causa de um tunel seria absurdo.
   */
  private async refresh(): Promise<StoredSession | null> {
    if (this.refreshing) return this.refreshing;

    const stored = this.read();
    if (!stored) return null;

    this.refreshing = (async () => {
      try {
        const payload = await supabaseFetch<GoTrueSession>(
          this.config,
          '/auth/v1/token?grant_type=refresh_token',
          { method: 'POST', body: { refresh_token: stored.refreshToken } },
        );
        this.adopt(payload, stored.session.displayName);
        return this.read();
      } catch (error) {
        const code = error instanceof ServiceError ? error.code : 'UNAVAILABLE';
        if (code !== 'UNAVAILABLE') this.clear();
        return null;
      } finally {
        this.refreshing = null;
      }
    })();

    return this.refreshing;
  }
}
