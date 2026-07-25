/**
 * Testes dos adapters remotos, com `fetch` falso.
 *
 * O que da' para verificar sem um projeto Supabase no ar e' justamente o que
 * costuma quebrar em silencio: a FORMA das chamadas (cabecalho `apikey`, view
 * certa para cada recorte, ordem do ranking), o que acontece quando a rede cai e
 * a traducao dos codigos de erro do GoTrue para os do contrato.
 *
 * O que NAO da' para verificar aqui — que a RLS realmente barra um insert
 * direto, que a Edge Function recusa a run — mora no servidor e esta' descrito
 * em `docs/supabase-setup.md`, na lista de conferencia pos-deploy.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteAuthService } from '../src/services/remote/authService';
import { RemoteScoreService } from '../src/services/remote/scoreService';
import { ServiceError, type RunSubmission } from '../src/services/types';

const CONFIG = { url: 'https://projeto.supabase.co', anonKey: 'chave-anon' };

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Respostas enfileiradas na ordem em que as chamadas devem acontecer. */
type Reply = { status: number; body?: unknown } | { networkError: true };

let calls: Call[] = [];
let replies: Reply[] = [];

function fakeFetch(input: string, init: RequestInit): Promise<Response> {
  const headers = init.headers as Record<string, string>;
  calls.push({
    url: input,
    method: init.method ?? 'GET',
    headers,
    body: typeof init.body === 'string' ? JSON.parse(init.body) : null,
  });

  const reply = replies.shift();
  if (!reply) throw new Error(`chamada inesperada: ${init.method} ${input}`);
  if ('networkError' in reply) return Promise.reject(new TypeError('failed to fetch'));
  return Promise.resolve(
    new Response(reply.body === undefined ? '' : JSON.stringify(reply.body), {
      status: reply.status,
    }),
  );
}

/** Sessao do GoTrue, no formato que o adapter espera adotar. */
function goTrueSession(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    access_token: 'token-de-acesso',
    refresh_token: 'token-de-renovacao',
    expires_in: 3600,
    user: {
      id: 'user-1',
      created_at: '2026-07-24T12:00:00.000Z',
      is_anonymous: true,
      user_metadata: { display_name: 'RAM' },
    },
    ...overrides,
  };
}

function build(): { auth: RemoteAuthService; scores: RemoteScoreService } {
  const auth = new RemoteAuthService(CONFIG);
  return { auth, scores: new RemoteScoreService(CONFIG, auth.session) };
}

beforeEach(() => {
  calls = [];
  replies = [];
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.stubGlobal('fetch', fakeFetch as unknown as typeof fetch);
});

describe('RemoteAuthService — modo convidado', () => {
  it('abre uma conta anonima e publica o nome em profiles', async () => {
    replies = [
      { status: 200, body: goTrueSession() },
      { status: 201 },
    ];
    const { auth } = build();

    const session = await auth.signInAsGuest('RAM');

    expect(session).toEqual({
      userId: 'user-1',
      displayName: 'RAM',
      isGuest: true,
      createdAt: '2026-07-24T12:00:00.000Z',
    });

    const [signup, profile] = calls;
    expect(signup?.url).toBe('https://projeto.supabase.co/auth/v1/signup');
    // Sem e-mail nem senha: e' assim que o GoTrue emite um usuario anonimo.
    expect(signup?.body).toEqual({ data: { display_name: 'RAM' } });
    // O `apikey` identifica o projeto e vale para TODA rota — esquecer dele
    // devolve 401 sem explicacao nenhuma.
    expect(signup?.headers.apikey).toBe('chave-anon');

    expect(profile?.url).toBe('https://projeto.supabase.co/rest/v1/profiles');
    expect(profile?.headers.prefer).toContain('merge-duplicates');
    expect(profile?.body).toEqual([{ user_id: 'user-1', display_name: 'RAM' }]);
  });

  it('renomear o convidado NAO cria uma conta nova', async () => {
    replies = [{ status: 200, body: goTrueSession() }, { status: 201 }];
    const { auth } = build();
    await auth.signInAsGuest('RAM');
    calls = [];

    // A TitleScene chama isto toda vez que o jogador confirma o nome, mesmo so'
    // para corrigir uma letra. Uma conta anonima por confirmacao encheria
    // `auth.users` de lixo e bateria no rate limit do proprio GoTrue.
    replies = [{ status: 201 }];
    const renamed = await auth.signInAsGuest('ZED');

    expect(renamed.userId).toBe('user-1');
    expect(renamed.displayName).toBe('ZED');
    expect(calls.map((call) => call.url)).toEqual([
      'https://projeto.supabase.co/rest/v1/profiles',
    ]);
  });

  it('recusa nome fora de 3..12 sem tocar na rede', async () => {
    const { auth } = build();
    await expect(auth.signInAsGuest('RA')).rejects.toMatchObject({ code: 'INVALID_NAME' });
    expect(calls).toHaveLength(0);
  });
});

describe('RemoteAuthService — sessao', () => {
  it('devolve a sessao guardada sem tocar na rede', async () => {
    replies = [{ status: 200, body: goTrueSession() }, { status: 201 }];
    const { auth } = build();
    await auth.signInAsGuest('RAM');
    calls = [];

    expect(await auth.getSession()).toMatchObject({ userId: 'user-1', displayName: 'RAM' });
    expect(calls).toHaveLength(0);
  });

  it('renova o token quando ele esta perto de vencer', async () => {
    // 30 s de validade: ja' entra na margem de renovacao de 60 s.
    replies = [{ status: 200, body: goTrueSession({ expires_in: 30 }) }, { status: 201 }];
    const { auth } = build();
    await auth.signInAsGuest('RAM');
    calls = [];

    replies = [
      { status: 200, body: goTrueSession({ access_token: 'token-novo', expires_in: 3600 }) },
    ];
    const session = await auth.getSession();

    expect(session?.userId).toBe('user-1');
    expect(calls[0]?.url).toBe(
      'https://projeto.supabase.co/auth/v1/token?grant_type=refresh_token',
    );
    expect(calls[0]?.body).toEqual({ refresh_token: 'token-de-renovacao' });
  });

  it('refresh token recusado apaga a sessao', async () => {
    replies = [{ status: 200, body: goTrueSession({ expires_in: 30 }) }, { status: 201 }];
    const { auth } = build();
    await auth.signInAsGuest('RAM');

    replies = [{ status: 401, body: { error_code: 'session_not_found', msg: 'nao existe' } }];
    expect(await auth.getSession()).toBeNull();
  });

  it('falha de REDE na renovacao mantem a sessao', async () => {
    replies = [{ status: 200, body: goTrueSession({ expires_in: 30 }) }, { status: 201 }];
    const { auth } = build();
    await auth.signInAsGuest('RAM');

    // Perder a sessao por causa de um tunel de metro seria absurdo: o nome
    // continua na tela e o que fica indisponivel e' o ranking.
    replies = [{ networkError: true }];
    expect(await auth.getSession()).toMatchObject({ userId: 'user-1' });
  });

  it('nao lanca quando o servidor esta fora do ar', async () => {
    replies = [{ status: 200, body: goTrueSession({ expires_in: 30 }) }, { status: 201 }];
    const { auth } = build();
    await auth.signInAsGuest('RAM');

    replies = [{ networkError: true }];
    await expect(auth.getSession()).resolves.not.toBeUndefined();
  });
});

describe('RemoteAuthService — erros do GoTrue', () => {
  it('traduz credencial invalida', async () => {
    replies = [{ status: 400, body: { error_code: 'invalid_credentials', msg: 'errado' } }];
    const { auth } = build();
    await expect(auth.signIn('a@b.com', 'senha123')).rejects.toMatchObject({
      code: 'BAD_CREDENTIALS',
    });
  });

  it('traduz e-mail ja cadastrado', async () => {
    replies = [{ status: 422, body: { error_code: 'user_already_exists', msg: 'existe' } }];
    const { auth } = build();
    await expect(auth.signUp('a@b.com', 'senha123', 'RAM')).rejects.toMatchObject({
      code: 'EMAIL_TAKEN',
    });
  });

  it('traduz o vocabulario antigo (invalid_grant) igual ao atual', async () => {
    replies = [
      { status: 400, body: { error: 'invalid_grant', error_description: 'credenciais' } },
    ];
    const { auth } = build();
    await expect(auth.signIn('a@b.com', 'senha123')).rejects.toMatchObject({
      code: 'BAD_CREDENTIALS',
    });
  });

  it('rede fora do ar vira UNAVAILABLE, nunca excecao crua', async () => {
    replies = [{ networkError: true }];
    const { auth } = build();
    const error = await auth.signIn('a@b.com', 'senha123').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceError);
    expect((error as ServiceError).code).toBe('UNAVAILABLE');
  });

  it('senha curta e recusada sem tocar na rede', async () => {
    const { auth } = build();
    await expect(auth.signUp('a@b.com', '123', 'RAM')).rejects.toMatchObject({
      code: 'WEAK_PASSWORD',
    });
    expect(calls).toHaveLength(0);
  });
});

describe('RemoteScoreService — ranking', () => {
  async function withSession(): Promise<ReturnType<typeof build>> {
    replies = [{ status: 200, body: goTrueSession() }, { status: 201 }];
    const services = build();
    await services.auth.signInAsGuest('RAM');
    calls = [];
    return services;
  }

  it('le o global pela view publica, na ordem do contrato', async () => {
    const { scores } = await withSession();
    replies = [{ status: 200, body: [] }];

    await scores.getLeaderboard('global', 10);

    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/rest/v1/leaderboard_public');
    // A mesma ordem de `services/leaderboard.ts` e do indice de `scores`:
    // desempate pela partida mais CURTA, depois pela mais antiga.
    expect(url.searchParams.get('order')).toBe('score.desc,duration_ms.asc,created_at.asc');
    expect(url.searchParams.get('limit')).toBe('10');
    // Apelidos em camelCase no proprio select: a resposta ja' chega no formato
    // de `ScoreEntry`, sem camada de traducao para alguem esquecer.
    expect(url.searchParams.get('select')).toContain('playerName:player_name');
  });

  it('recorta a semana por created_at', async () => {
    const { scores } = await withSession();
    replies = [{ status: 200, body: [] }];

    await scores.getLeaderboard('weekly');

    const url = new URL(calls[0]!.url);
    const filter = url.searchParams.get('created_at') ?? '';
    expect(filter.startsWith('gte.')).toBe(true);
    const since = Date.parse(filter.slice(4));
    expect(Date.now() - since).toBeGreaterThan(6.9 * 24 * 60 * 60 * 1000);
    expect(Date.now() - since).toBeLessThan(7.1 * 24 * 60 * 60 * 1000);
  });

  it('usa a view separada para "meus" — a publica nao expoe o dono', async () => {
    const { scores } = await withSession();
    replies = [{ status: 200, body: [] }];

    await scores.getLeaderboard('me');

    expect(new URL(calls[0]!.url).pathname).toBe('/rest/v1/leaderboard_mine');
    expect(calls[0]?.headers.authorization).toBe('Bearer token-de-acesso');
  });

  it('"meus" sem sessao e vazio, sem chamada nenhuma', async () => {
    const { scores } = build();
    expect(await scores.getLeaderboard('me')).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('respeita o teto de 100 linhas da tabela', async () => {
    const { scores } = await withSession();
    replies = [{ status: 200, body: [] }];

    await scores.getLeaderboard('global', 5000);

    expect(new URL(calls[0]!.url).searchParams.get('limit')).toBe('100');
  });
});

describe('RemoteScoreService — partida', () => {
  const RUN: RunSubmission = {
    runToken: 'token-de-partida',
    score: 380,
    levelReached: 1,
    durationMs: 60_000,
    completedGame: false,
    events: {
      alienKills: { A: 10, B: 8, C: 4 },
      splitterKills: 0,
      ufoKills: 0,
      bossKills: 0,
      powerUpsCollected: 0,
      shotsFired: 40,
    },
  };

  async function withSession(): Promise<ReturnType<typeof build>> {
    replies = [{ status: 200, body: goTrueSession() }, { status: 201 }];
    const services = build();
    await services.auth.signInAsGuest('RAM');
    calls = [];
    return services;
  }

  it('abre a partida pela Edge Function, com a sessao do jogador', async () => {
    const { scores } = await withSession();
    replies = [{ status: 200, body: { runToken: 'abc', expiresAt: '2026-07-24T14:00:00.000Z' } }];

    expect(await scores.startRun()).toEqual({
      runToken: 'abc',
      expiresAt: '2026-07-24T14:00:00.000Z',
    });
    expect(calls[0]?.url).toBe('https://projeto.supabase.co/functions/v1/runs-start');
    expect(calls[0]?.headers.authorization).toBe('Bearer token-de-acesso');
  });

  it('sem sessao, abrir partida e erro — nao silencio', async () => {
    const { scores } = build();
    await expect(scores.startRun()).rejects.toMatchObject({ code: 'NOT_AUTHENTICATED' });
  });

  it('submete a proposta e devolve o veredito do SERVIDOR', async () => {
    const { scores } = await withSession();
    replies = [{ status: 200, body: { accepted: true, rank: 7 } }];

    expect(await scores.submitRun(RUN)).toEqual({ accepted: true, rank: 7 });
    expect(calls[0]?.url).toBe('https://projeto.supabase.co/functions/v1/runs-submit');
    expect(calls[0]?.body).toEqual(RUN);
  });

  it('nao recalcula nada: run plausivel recusada pelo servidor CONTINUA recusada', async () => {
    const { scores } = await withSession();
    // Esta run passaria no validador local sem esforco. A palavra final e' do
    // servidor — e' a unica diferenca de comportamento entre os dois adapters.
    replies = [{ status: 200, body: { accepted: false, reason: 'UNKNOWN_RUN_TOKEN' } }];

    expect(await scores.submitRun(RUN)).toEqual({
      accepted: false,
      reason: 'UNKNOWN_RUN_TOKEN',
    });
  });

  it('recusa nao vira excecao: a tela de fim de jogo continua normal', async () => {
    const { scores } = await withSession();
    replies = [{ status: 200, body: { accepted: false, reason: 'SCORE_ABOVE_CAP' } }];

    await expect(scores.submitRun(RUN)).resolves.toMatchObject({ accepted: false });
  });
});
