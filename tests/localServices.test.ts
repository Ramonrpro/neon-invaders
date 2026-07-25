/**
 * Testes dos adapters locais.
 *
 * O ambiente do Vitest e' `node`, sem `localStorage` — o storage falso abaixo
 * entra no lugar dele. Isso tambem exercita o caminho de leitura/escrita real do
 * `JsonStore`, que e' onde moram os bugs de serializacao.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { LocalAuthService } from '../src/services/local/authService';
import { LocalScoreService } from '../src/services/local/scoreService';
import type { RunSubmission } from '../src/services/types';

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

/** Relogio controlado: o rate limit e a checagem de duracao dependem dele. */
let clock = Date.parse('2026-07-24T12:00:00.000Z');
const now = (): number => clock;

let auth: LocalAuthService;
let scores: LocalScoreService;

beforeEach(() => {
  clock = Date.parse('2026-07-24T12:00:00.000Z');
  (globalThis as { localStorage?: Storage }).localStorage = new MemoryStorage();
  auth = new LocalAuthService();
  scores = new LocalScoreService(auth, now);
});

function honestRun(runToken: string, overrides: Partial<RunSubmission> = {}): RunSubmission {
  return {
    runToken,
    score: 5000,
    levelReached: 3,
    durationMs: 180_000,
    completedGame: false,
    events: {
      alienKills: { A: 54, B: 44, C: 22 },
      splitterKills: 5,
      ufoKills: 2,
      bossKills: 2,
      powerUpsCollected: 6,
      shotsFired: 900,
    },
    ...overrides,
  };
}

/** Avanca o relogio o bastante para a partida caber e o rate limit liberar. */
async function playAndSubmit(overrides: Partial<RunSubmission> = {}) {
  const { runToken } = await scores.startRun();
  clock += 200_000;
  return scores.submitRun(honestRun(runToken, overrides));
}

describe('autenticacao local', () => {
  it('modo convidado nao pede nada alem do nome', async () => {
    const session = await auth.signInAsGuest('  ram  ');
    expect(session.isGuest).toBe(true);
    expect(session.displayName).toBe('ram');
    expect(await auth.getSession()).toEqual(session);
  });

  it('recusa nome curto ou longo demais', async () => {
    await expect(auth.signInAsGuest('AB')).rejects.toMatchObject({ code: 'INVALID_NAME' });
    await expect(auth.signInAsGuest('A'.repeat(20))).rejects.toMatchObject({
      code: 'INVALID_NAME',
    });
  });

  it('cadastra, sai e volta com a mesma conta', async () => {
    const criada = await auth.signUp('Piloto@Exemplo.com', 'senha-boa', 'PILOTO');
    expect(criada.isGuest).toBe(false);

    await auth.signOut();
    expect(await auth.getSession()).toBeNull();

    const devolta = await auth.signIn('piloto@exemplo.com', 'senha-boa');
    expect(devolta.userId).toBe(criada.userId);
  });

  it('recusa e-mail repetido, senha fraca e credencial errada', async () => {
    await auth.signUp('piloto@exemplo.com', 'senha-boa', 'PILOTO');
    await expect(auth.signUp('piloto@exemplo.com', 'outra-senha', 'OUTRO')).rejects.toMatchObject({
      code: 'EMAIL_TAKEN',
    });
    await expect(auth.signUp('novo@exemplo.com', '123', 'NOVO')).rejects.toMatchObject({
      code: 'WEAK_PASSWORD',
    });
    await expect(auth.signIn('piloto@exemplo.com', 'errada')).rejects.toMatchObject({
      code: 'BAD_CREDENTIALS',
    });
    // E-mail inexistente devolve o MESMO codigo — nao entrega quem tem conta.
    await expect(auth.signIn('ninguem@exemplo.com', 'senha-boa')).rejects.toMatchObject({
      code: 'BAD_CREDENTIALS',
    });
  });

  it('recusa e-mail malformado', async () => {
    await expect(auth.signUp('nao-e-email', 'senha-boa', 'PILOTO')).rejects.toMatchObject({
      code: 'INVALID_EMAIL',
    });
  });
});

describe('submissao de run', () => {
  it('aceita partida honesta e devolve posicao', async () => {
    await auth.signInAsGuest('RAM');
    const result = await playAndSubmit();
    expect(result.accepted).toBe(true);
    expect(result.rank).toBe(1);
  });

  it('grava o nome do jogador da sessao na tabela', async () => {
    await auth.signInAsGuest('RAM');
    await playAndSubmit();
    const table = await scores.getLeaderboard('global');
    expect(table[0]?.playerName).toBe('RAM');
    expect(table[0]).not.toHaveProperty('userId');
  });

  it('recusa submissao sem partida aberta', async () => {
    const result = await scores.submitRun(honestRun('token-inventado'));
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('UNKNOWN_RUN_TOKEN');
  });

  it('um token so vale uma vez', async () => {
    const { runToken } = await scores.startRun();
    clock += 200_000;
    await scores.submitRun(honestRun(runToken));
    clock += 10_000;
    const segunda = await scores.submitRun(honestRun(runToken));
    expect(segunda.reason).toBe('UNKNOWN_RUN_TOKEN');
  });

  it('recusa duracao maior do que o tempo decorrido desde o startRun', async () => {
    const { runToken } = await scores.startRun();
    clock += 10_000;
    const result = await scores.submitRun(honestRun(runToken, { durationMs: 180_000 }));
    expect(result.reason).toBe('DURATION_MISMATCH');
  });

  it('recusa run implausivel com o motivo do validador', async () => {
    const result = await playAndSubmit({ score: 999_999 });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('SCORE_ABOVE_CAP');
  });

  it('aplica rate limit entre submissoes seguidas', async () => {
    await playAndSubmit();
    const segunda = await scores.startRun();
    // Sem avancar o relogio: a segunda submissao chega colada na primeira.
    const result = await scores.submitRun(honestRun(segunda.runToken, { durationMs: 0 }));
    expect(result.reason).toBe('RATE_LIMITED');
  });
});

describe('leitura do ranking', () => {
  it('recorte "me" e melhor pessoal seguem a sessao', async () => {
    await auth.signInAsGuest('RAM');
    await playAndSubmit();

    expect(await scores.getLeaderboard('me')).toHaveLength(1);
    const best = await scores.getPersonalBest();
    expect(best?.score).toBe(5000);

    // Outro jogador no mesmo aparelho nao herda o historico.
    await auth.signInAsGuest('OUTRO');
    expect(await scores.getLeaderboard('me')).toEqual([]);
    expect(await scores.getPersonalBest()).toBeNull();
    // ...mas o global continua mostrando a partida anterior.
    expect(await scores.getLeaderboard('global')).toHaveLength(1);
  });

  it('sem nenhuma partida, devolve tabela vazia e melhor pessoal nulo', async () => {
    expect(await scores.getLeaderboard('global')).toEqual([]);
    expect(await scores.getPersonalBest()).toBeNull();
  });
});
