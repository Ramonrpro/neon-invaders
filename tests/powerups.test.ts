import { describe, expect, it } from 'vitest';
import {
  MULTI_MAX_LEVEL,
  MULTI_MAX_SPREAD_DEG,
  MULTI_PATTERNS,
  POWERUP_IDS,
  POWERUP_REGISTRY,
  RAPID_COOLDOWN_MS,
  RAPID_MAX_LEVEL,
  powerUpDefinition,
  type FireProfile,
} from '@game/config/powerups';
import {
  buildFireProfile,
  collectOutcome,
  createFireProfile,
  emptyLevels,
  maxLevelOf,
  pickDropId,
  resetLevels,
  shotVelocity,
  shouldDrop,
} from '@game/core/powerups';
import { MAXED_POWERUP_POINTS } from '@game/core/scoring';

const BASE = { cooldownMs: 400, maxBullets: 2 };

function profileFor(rapid: number, multi: number): FireProfile {
  const levels = emptyLevels();
  levels.rapid = rapid;
  levels.multi = multi;
  return buildFireProfile(levels, BASE, createFireProfile(BASE));
}

describe('registry', () => {
  it('expoe os dois power-ups da v1 com os niveis da especificacao', () => {
    expect(POWERUP_IDS).toEqual(['rapid', 'multi']);
    expect(maxLevelOf('rapid')).toBe(5);
    expect(maxLevelOf('multi')).toBe(4);
  });

  it('lanca em id fora do registry, em vez de devolver undefined silencioso', () => {
    // @ts-expect-error — o ponto do teste e' o comportamento em runtime.
    expect(() => powerUpDefinition('escudo')).toThrow(RangeError);
  });

  it('da a cada tipo cor, icone e arpejo proprios', () => {
    const colors = new Set(POWERUP_REGISTRY.map((d) => d.color));
    const textures = new Set(POWERUP_REGISTRY.map((d) => d.texture));
    const arpeggios = new Set(POWERUP_REGISTRY.map((d) => d.pickupNotes.join(',')));
    expect(colors.size).toBe(POWERUP_REGISTRY.length);
    expect(textures.size).toBe(POWERUP_REGISTRY.length);
    expect(arpeggios.size).toBe(POWERUP_REGISTRY.length);
  });
});

describe('emptyLevels / resetLevels', () => {
  it('comeca com todo tipo em zero', () => {
    expect(emptyLevels()).toEqual({ rapid: 0, multi: 0 });
  });

  it('zera no lugar, sem trocar o objeto', () => {
    const levels = emptyLevels();
    levels.rapid = 4;
    levels.multi = 2;
    resetLevels(levels);
    expect(levels).toEqual({ rapid: 0, multi: 0 });
  });
});

describe('collectOutcome', () => {
  it('sobe um nivel por coleta ate' + ' o maximo', () => {
    expect(collectOutcome(0, 5)).toEqual({ level: 1, leveledUp: true, bonusPoints: 0 });
    expect(collectOutcome(4, 5)).toEqual({ level: 5, leveledUp: true, bonusPoints: 0 });
  });

  it('no nivel maximo vale 500 pontos em vez de subir', () => {
    expect(collectOutcome(5, 5)).toEqual({
      level: 5,
      leveledUp: false,
      bonusPoints: MAXED_POWERUP_POINTS,
    });
  });

  it('nunca ultrapassa o maximo, mesmo partindo de um nivel corrompido', () => {
    expect(collectOutcome(99, 5).level).toBe(5);
    expect(collectOutcome(-3, 5)).toEqual({ level: 1, leveledUp: true, bonusPoints: 0 });
  });
});

describe('buildFireProfile — RAPID', () => {
  it('aplica a tabela de cooldown da especificacao, nivel a nivel', () => {
    for (let level = 0; level <= RAPID_MAX_LEVEL; level++) {
      expect(profileFor(level, 0).cooldownMs).toBe(RAPID_COOLDOWN_MS[level]);
    }
    expect(RAPID_COOLDOWN_MS).toEqual([400, 320, 250, 190, 140, 100]);
  });

  it('soma +1 slot de projetil por nivel', () => {
    expect(profileFor(0, 0).maxBullets).toBe(2);
    expect(profileFor(3, 0).maxBullets).toBe(5);
    expect(profileFor(RAPID_MAX_LEVEL, 0).maxBullets).toBe(7);
  });

  it('trunca nivel acima do maximo em vez de estourar a tabela', () => {
    expect(profileFor(99, 0).cooldownMs).toBe(100);
    expect(profileFor(99, 0).maxBullets).toBe(7);
  });
});

describe('buildFireProfile — MULTI', () => {
  it('segue a progressao 1 → 2 → 3 → 4 → 5 projeteis por disparo', () => {
    const counts = [];
    for (let level = 0; level <= MULTI_MAX_LEVEL; level++) {
      counts.push(profileFor(0, level).shots.length);
    }
    expect(counts).toEqual([1, 2, 3, 4, 5]);
  });

  it('nunca abre o leque alem de 18 graus para nenhum lado', () => {
    for (const pattern of MULTI_PATTERNS) {
      for (const shot of pattern) {
        expect(Math.abs(shot.angleDeg)).toBeLessThanOrEqual(MULTI_MAX_SPREAD_DEG);
      }
    }
  });

  it('mantem o leque simetrico — um tiro torto para um lado so encurralaria o jogador', () => {
    for (const pattern of MULTI_PATTERNS) {
      const sum = pattern.reduce((total, shot) => total + shot.angleDeg, 0);
      expect(sum).toBeCloseTo(0, 10);
    }
  });

  it('multiplica o teto de projeteis pelo tamanho da salva, para o gatilho nao travar', () => {
    // Sem isso, um leque de 5 estouraria sozinho o limite base de 2.
    expect(profileFor(0, MULTI_MAX_LEVEL).maxBullets).toBe(10);
    expect(profileFor(0, MULTI_MAX_LEVEL).shots.length).toBe(5);
  });
});

describe('buildFireProfile — stacking', () => {
  it('acumula os dois: RAPID soma slots e MULTI multiplica pela salva', () => {
    const maxed = profileFor(RAPID_MAX_LEVEL, MULTI_MAX_LEVEL);
    expect(maxed.cooldownMs).toBe(100);
    expect(maxed.shots.length).toBe(5);
    // (2 base + 5 do RAPID) x 5 projeteis por salva.
    expect(maxed.maxBullets).toBe(35);
  });

  it('e sempre derivavel do estado: recalcular do zero da o mesmo resultado', () => {
    const levels = emptyLevels();
    const profile = createFireProfile(BASE);

    levels.rapid = 2;
    levels.multi = 3;
    buildFireProfile(levels, BASE, profile);
    const first = { ...profile, shots: profile.shots };

    // Recalcular sem mudar nada nao pode acumular efeito duas vezes.
    buildFireProfile(levels, BASE, profile);
    expect(profile.cooldownMs).toBe(first.cooldownMs);
    expect(profile.maxBullets).toBe(first.maxBullets);
    expect(profile.shots).toEqual(first.shots);
  });

  it('volta ao tiro base quando os niveis zeram', () => {
    const levels = emptyLevels();
    const profile = createFireProfile(BASE);
    levels.rapid = 5;
    levels.multi = 4;
    buildFireProfile(levels, BASE, profile);
    resetLevels(levels);
    buildFireProfile(levels, BASE, profile);

    expect(profile.cooldownMs).toBe(BASE.cooldownMs);
    expect(profile.maxBullets).toBe(BASE.maxBullets);
    expect(profile.shots).toEqual([{ angleDeg: 0, offsetX: 0 }]);
  });
});

describe('shotVelocity', () => {
  it('manda o tiro reto direto para cima', () => {
    const { vx, vy } = shotVelocity(0, 520);
    expect(vx).toBeCloseTo(0, 10);
    expect(vy).toBeCloseTo(-520, 10);
  });

  it('preserva a magnitude ao inclinar — o leque nao pode ser mais lento', () => {
    for (const angle of [-18, -9, 9, 18]) {
      const { vx, vy } = shotVelocity(angle, 520);
      expect(Math.hypot(vx, vy)).toBeCloseTo(520, 6);
      expect(vy).toBeLessThan(0);
    }
  });

  it('angulo positivo aponta para a direita', () => {
    expect(shotVelocity(18, 520).vx).toBeGreaterThan(0);
    expect(shotVelocity(-18, 520).vx).toBeLessThan(0);
  });
});

describe('shouldDrop', () => {
  const COOLDOWN = 10_000;

  it('respeita o cooldown global de 10 s mesmo com sorteio favoravel', () => {
    expect(shouldDrop(0, 0.08, 5_000, 0, COOLDOWN)).toBe(false);
    expect(shouldDrop(0, 0.08, 9_999, 0, COOLDOWN)).toBe(false);
    expect(shouldDrop(0, 0.08, 10_000, 0, COOLDOWN)).toBe(true);
  });

  it('aplica a taxa da fase depois do cooldown', () => {
    expect(shouldDrop(0.079, 0.08, 20_000, 0, COOLDOWN)).toBe(true);
    expect(shouldDrop(0.08, 0.08, 20_000, 0, COOLDOWN)).toBe(false);
    expect(shouldDrop(0.5, 0.08, 20_000, 0, COOLDOWN)).toBe(false);
  });

  it('nao bloqueia o primeiro drop da partida', () => {
    expect(shouldDrop(0, 0.08, 0, Number.NEGATIVE_INFINITY, COOLDOWN)).toBe(true);
  });
});

describe('pickDropId', () => {
  it('cobre todos os tipos do registry', () => {
    const seen = new Set<string>();
    for (let roll = 0; roll < 1; roll += 0.01) {
      seen.add(pickDropId(roll));
    }
    expect([...seen].sort()).toEqual([...POWERUP_IDS].sort());
  });

  it('nunca devolve id fora do registry, nem nos limites do sorteio', () => {
    for (const roll of [0, 0.999999, 1, -1, 2]) {
      expect(POWERUP_IDS).toContain(pickDropId(roll));
    }
  });

  it('divide o sorteio pelos pesos — hoje os dois tipos sao equiprovaveis', () => {
    expect(pickDropId(0.25)).toBe('rapid');
    expect(pickDropId(0.75)).toBe('multi');
  });
});
