import { describe, expect, it } from 'vitest';
import type { RunSubmission } from '../src/services/types';
import { theoreticalMaxScore, validateRun } from '../src/services/validation/plausibility';

/**
 * Partida honesta de referencia: morreu na fase 3, tres minutos de jogo, dois
 * chefoes abatidos. Cada teste parte dela e estraga UMA coisa — assim o motivo
 * devolvido e' sempre atribuivel ao que foi mexido.
 */
function honestRun(overrides: Partial<RunSubmission> = {}): RunSubmission {
  return {
    runToken: 'token',
    score: 5000,
    levelReached: 3,
    durationMs: 180_000,
    completedGame: false,
    events: {
      // Fases 1 e 2 limpas + parte da formacao da fase 3.
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

describe('run plausivel', () => {
  it('aceita a partida de referencia', () => {
    const verdict = validateRun(honestRun());
    expect(verdict.plausible).toBe(true);
    expect(verdict.reason).toBeNull();
  });

  it('aceita uma vitoria completa', () => {
    const verdict = validateRun(
      honestRun({
        score: 20_000,
        levelReached: 5,
        durationMs: 600_000,
        completedGame: true,
        events: {
          alienKills: { A: 110, B: 110, C: 55 },
          splitterKills: 40,
          ufoKills: 8,
          bossKills: 5,
          powerUpsCollected: 20,
          shotsFired: 3000,
        },
      }),
    );
    expect(verdict.reason).toBeNull();
    expect(verdict.plausible).toBe(true);
  });

  it('aceita partida curta e ruim: morreu na fase 1 sem matar quase nada', () => {
    const verdict = validateRun(
      honestRun({
        score: 100,
        levelReached: 1,
        durationMs: 14_000,
        events: {
          alienKills: { A: 3, B: 2, C: 1 },
          splitterKills: 0,
          ufoKills: 0,
          bossKills: 0,
          powerUpsCollected: 0,
          shotsFired: 40,
        },
      }),
    );
    expect(verdict.plausible).toBe(true);
  });
});

describe('score', () => {
  it('recusa score acima do teto teorico da partida', () => {
    const verdict = validateRun(honestRun({ score: 999_999 }));
    expect(verdict.plausible).toBe(false);
    expect(verdict.reason).toBe('SCORE_ABOVE_CAP');
  });

  it('recusa score que nao fecha com os abates declarados', () => {
    const verdict = validateRun(
      honestRun({
        score: 5000,
        events: { ...honestRun().events, alienKills: { A: 0, B: 0, C: 0 }, bossKills: 0 },
      }),
    );
    expect(verdict.plausible).toBe(false);
    expect(verdict.reason).toBe('SCORE_MISMATCH');
  });

  it('recusa score baixo demais para os abates declarados', () => {
    // Abateu tudo aquilo e declarou 10 pontos: tao inconsistente quanto inflar.
    const verdict = validateRun(honestRun({ score: 10 }));
    expect(verdict.plausible).toBe(false);
    expect(verdict.reason).toBe('SCORE_MISMATCH');
  });

  it('o teto cresce com a fase alcancada e com a duracao', () => {
    expect(theoreticalMaxScore(5, 180_000)).toBeGreaterThan(theoreticalMaxScore(3, 180_000));
    expect(theoreticalMaxScore(3, 600_000)).toBeGreaterThan(theoreticalMaxScore(3, 180_000));
  });
});

describe('coerencia de fase', () => {
  it('recusa fase fora de 1..5', () => {
    expect(validateRun(honestRun({ levelReached: 0 })).reason).toBe('INVALID_LEVEL');
    expect(validateRun(honestRun({ levelReached: 6 })).reason).toBe('INVALID_LEVEL');
  });

  it('recusa mais chefoes do que fases ultrapassadas', () => {
    const verdict = validateRun(
      honestRun({ events: { ...honestRun().events, bossKills: 3 } }),
    );
    expect(verdict.reason).toBe('INVALID_LEVEL');
  });

  it('recusa vitoria sem as cinco naves-mae', () => {
    const verdict = validateRun(
      honestRun({
        completedGame: true,
        levelReached: 5,
        durationMs: 300_000,
        events: { ...honestRun().events, bossKills: 4 },
      }),
    );
    expect(verdict.reason).toBe('INVALID_LEVEL');
  });
});

describe('duracao', () => {
  it('recusa fases completas rapidas demais para as animacoes obrigatorias', () => {
    const verdict = validateRun(honestRun({ durationMs: 3000 }));
    expect(verdict.plausible).toBe(false);
    expect(verdict.reason).toBe('DURATION_TOO_SHORT');
  });

  it('aceita o limite exato: 6 s por fase completa', () => {
    const verdict = validateRun(
      honestRun({
        score: 4620 + 100,
        durationMs: 12_000,
        events: { ...honestRun().events, ufoKills: 1, powerUpsCollected: 2, shotsFired: 300 },
      }),
    );
    expect(verdict.reason).toBeNull();
  });
});

describe('abates impossiveis', () => {
  it('recusa mais aliens do que existem nas fases alcancadas', () => {
    const verdict = validateRun(
      honestRun({ events: { ...honestRun().events, alienKills: { A: 999, B: 44, C: 22 } } }),
    );
    expect(verdict.reason).toBe('IMPOSSIBLE_KILLS');
  });

  it('recusa mais UFOs do que cabem no tempo declarado', () => {
    const verdict = validateRun(
      honestRun({ durationMs: 30_000, events: { ...honestRun().events, ufoKills: 20 } }),
    );
    expect(verdict.reason).toBe('IMPOSSIBLE_KILLS');
  });

  it('recusa mais capsulas do que o cooldown global de 10 s permite', () => {
    const verdict = validateRun(
      honestRun({ durationMs: 60_000, events: { ...honestRun().events, powerUpsCollected: 50 } }),
    );
    expect(verdict.reason).toBe('IMPOSSIBLE_KILLS');
  });
});

describe('projeteis', () => {
  it('recusa abates sem tiros suficientes: um projetil mata no maximo um alvo', () => {
    const verdict = validateRun(honestRun({ events: { ...honestRun().events, shotsFired: 10 } }));
    expect(verdict.plausible).toBe(false);
    expect(verdict.reason).toBe('SHOTS_TOO_FEW');
  });

  it('conta o HP do chefao no custo minimo em tiros', () => {
    // 120 aliens + 5 splitters + 2 UFOs = 127 abates, mas os dois chefoes
    // custam 40 + 55 acertos a mais.
    const verdict = validateRun(honestRun({ events: { ...honestRun().events, shotsFired: 200 } }));
    expect(verdict.reason).toBe('SHOTS_TOO_FEW');
  });

  it('recusa cadencia acima do RAPID maximo com o MULTI maximo', () => {
    const verdict = validateRun(honestRun({ events: { ...honestRun().events, shotsFired: 99_999 } }));
    expect(verdict.reason).toBe('SHOTS_TOO_MANY');
  });
});

describe('formato', () => {
  it('recusa numeros fracionarios, negativos ou nao numericos', () => {
    expect(validateRun(honestRun({ score: 12.5 })).reason).toBe('MALFORMED');
    expect(validateRun(honestRun({ durationMs: -1 })).reason).toBe('MALFORMED');
    expect(
      validateRun(honestRun({ score: Number.NaN })).reason,
    ).toBe('MALFORMED');
  });

  it('recusa events sem os contadores', () => {
    const broken = honestRun();
    // Simula payload adulterado chegando do cliente.
    (broken.events as unknown as { alienKills: unknown }).alienKills = undefined;
    expect(validateRun(broken).reason).toBe('MALFORMED');
  });
});
