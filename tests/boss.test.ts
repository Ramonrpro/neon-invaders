import { describe, expect, it } from 'vitest';
import { BOSS, BOSS_ENRAGE, BOSSES, getBoss } from '@game/config/bosses';
import {
  attackPhase,
  crossedEnrageThreshold,
  damageFor,
  entranceProgress,
  fireIntervalFor,
  hpFraction,
  laserIntervalFor,
  shouldFire,
  spreadAngles,
  spreadShotsFor,
  stageFor,
  summonCountFor,
  summonIntervalFor,
  sweepSpeedFor,
  sweepStep,
} from '@game/core/boss';

const F1 = getBoss(1);

describe('tabela de chefoes', () => {
  it('tem uma nave-mae para cada uma das 5 fases', () => {
    expect(BOSSES).toHaveLength(5);
    for (let level = 1; level <= 5; level++) {
      expect(getBoss(level).level).toBe(level);
    }
  });

  it('lanca em fase inexistente em vez de devolver undefined', () => {
    expect(() => getBoss(0)).toThrow(RangeError);
    expect(() => getBoss(6)).toThrow(RangeError);
  });

  it('escala monotonicamente: cada fase e mais dura que a anterior', () => {
    for (let i = 1; i < BOSSES.length; i++) {
      const previous = BOSSES[i - 1]!;
      const current = BOSSES[i]!;
      expect(current.hp).toBeGreaterThan(previous.hp);
      expect(current.sweepSpeed).toBeGreaterThan(previous.sweepSpeed);
      expect(current.bulletSpeed).toBeGreaterThan(previous.bulletSpeed);
      expect(current.fireIntervalMs).toBeLessThan(previous.fireIntervalMs);
      expect(current.points).toBeGreaterThan(previous.points);
    }
  });
});

describe('padroes por fase', () => {
  it('cada fase acrescenta uma coisa nova, nunca duas', () => {
    // E' o que impede a fase 5 de ser a fase 1 com numeros maiores — o risco
    // declarado quando os cinco chefoes viraram uma nave-mae escalada.
    const perfil = BOSSES.map((b) => ({
      leque: b.spreadShots,
      minions: b.minions !== null,
      laser: b.laser !== null,
    }));
    expect(perfil).toEqual([
      { leque: 3, minions: false, laser: false },
      { leque: 3, minions: true, laser: false },
      { leque: 5, minions: false, laser: false },
      { leque: 5, minions: false, laser: true },
      { leque: 5, minions: true, laser: true },
    ]);
  });

  it('a fase final acumula tudo que apareceu antes', () => {
    const ultima = getBoss(5);
    expect(ultima.minions).not.toBeNull();
    expect(ultima.laser).not.toBeNull();
    expect(ultima.spreadShots).toBe(5);
  });
});

describe('laser', () => {
  it('so existe nas fases que o declaram', () => {
    expect(laserIntervalFor(getBoss(1), 1)).toBeNull();
    expect(laserIntervalFor(getBoss(4), 1)).toBe(getBoss(4).laser!.intervalMs);
  });

  it('encurta ao enfurecer, mas nunca abaixo do telegraph', () => {
    const f4 = getBoss(4);
    expect(laserIntervalFor(f4, 2)!).toBeLessThan(laserIntervalFor(f4, 1)!);
    for (const config of BOSSES) {
      const interval = laserIntervalFor(config, 2);
      if (interval !== null) expect(interval).toBeGreaterThanOrEqual(BOSS.telegraphMs);
    }
  });

  it('nunca dispara sem aviso: o intervalo cabe o telegraph inteiro', () => {
    // Um laser que mirasse no instante do tiro seria dano garantido.
    const f5 = getBoss(5);
    expect(laserIntervalFor(f5, 2)!).toBeGreaterThan(BOSS.telegraphMs);
  });
});

describe('minions', () => {
  it('so existem nas fases que os declaram', () => {
    expect(summonIntervalFor(getBoss(1), 1)).toBeNull();
    expect(summonCountFor(getBoss(1))).toBe(0);
    expect(summonIntervalFor(getBoss(2), 1)).toBe(getBoss(2).minions!.intervalMs);
    expect(summonCountFor(getBoss(2))).toBe(2);
  });

  it('vem mais rapido ao enfurecer', () => {
    const f2 = getBoss(2);
    expect(summonIntervalFor(f2, 2)!).toBeLessThan(summonIntervalFor(f2, 1)!);
  });

  it('a invocacao e mais lenta que a salva — minion nao pode virar chuva', () => {
    for (const config of BOSSES) {
      const summon = summonIntervalFor(config, 2);
      if (summon === null) continue;
      expect(summon).toBeGreaterThan(fireIntervalFor(config, 2));
    }
  });
});

describe('damageFor', () => {
  it('da dano cheio no nucleo e metade no casco', () => {
    expect(damageFor(true)).toBe(BOSS.weakPointDamage);
    expect(damageFor(false)).toBe(BOSS.bodyDamage);
    expect(damageFor(false)).toBeLessThan(damageFor(true));
  });
});

describe('stageFor / crossedEnrageThreshold', () => {
  it('enfurece exatamente em 50% de HP', () => {
    expect(stageFor(40, 40)).toBe(1);
    expect(stageFor(21, 40)).toBe(1);
    expect(stageFor(20, 40)).toBe(2);
    expect(stageFor(0, 40)).toBe(2);
  });

  it('dispara a mudanca de padrao uma unica vez, na travessia', () => {
    expect(crossedEnrageThreshold(21, 20, 40)).toBe(true);
    expect(crossedEnrageThreshold(20, 19, 40)).toBe(false);
    expect(crossedEnrageThreshold(40, 39, 40)).toBe(false);
  });
});

describe('escala do estagio 2', () => {
  it('dobra a velocidade de varredura', () => {
    expect(sweepSpeedFor(F1, 1)).toBe(F1.sweepSpeed);
    expect(sweepSpeedFor(F1, 2)).toBe(F1.sweepSpeed * BOSS_ENRAGE.speedMultiplier);
  });

  it('encurta o intervalo entre salvas', () => {
    expect(fireIntervalFor(F1, 1)).toBe(F1.fireIntervalMs);
    expect(fireIntervalFor(F1, 2)).toBeLessThan(fireIntervalFor(F1, 1));
  });

  it('nunca deixa o intervalo cair abaixo do telegraph', () => {
    // Uma salva mais curta que o aviso seria dano imprevisivel — a secao 6
    // da especificacao proibe.
    const impossivel = { ...F1, fireIntervalMs: 100 };
    expect(fireIntervalFor(impossivel, 2)).toBeGreaterThanOrEqual(BOSS.telegraphMs);
  });

  it('leva o leque de 3 para 5', () => {
    expect(spreadShotsFor(F1, 1)).toBe(3);
    expect(spreadShotsFor(F1, 2)).toBe(5);
  });
});

describe('spreadAngles', () => {
  it('abre um leque simetrico dentro do angulo maximo', () => {
    const out: number[] = [];
    expect(spreadAngles(3, 26, out)).toBe(3);
    expect(out.slice(0, 3)).toEqual([-26, 0, 26]);

    expect(spreadAngles(5, 26, out)).toBe(5);
    expect(out.slice(0, 5)).toEqual([-26, -13, 0, 13, 26]);
  });

  it('nunca passa do angulo maximo, em nenhuma contagem', () => {
    const out: number[] = [];
    for (let count = 1; count <= 9; count++) {
      const filled = spreadAngles(count, 26, out);
      for (let i = 0; i < filled; i++) {
        expect(Math.abs(out[i]!)).toBeLessThanOrEqual(26);
      }
    }
  });

  it('atira reto quando e um so projetil', () => {
    const out: number[] = [];
    expect(spreadAngles(1, 26, out)).toBe(1);
    expect(out[0]).toBe(0);
    // Contagem invalida nao pode gerar salva vazia.
    expect(spreadAngles(0, 26, out)).toBe(1);
  });

  it('reaproveita o array do chamador — salva nao aloca', () => {
    const out: number[] = [];
    spreadAngles(5, 26, out);
    const same = out;
    spreadAngles(3, 26, out);
    expect(out).toBe(same);
  });
});

describe('sweepStep', () => {
  const base = { speed: 100, deltaMs: 1000, halfWidth: 60, minX: 14, maxX: 466 };

  it('desliza na direcao atual', () => {
    const step = sweepStep({ ...base, x: 240, direction: 1 });
    expect(step.x).toBe(340);
    expect(step.direction).toBe(1);
  });

  it('quica na parede direita sem atravessar', () => {
    const step = sweepStep({ ...base, x: 400, direction: 1 });
    expect(step.x).toBe(base.maxX - base.halfWidth);
    expect(step.direction).toBe(-1);
  });

  it('quica na parede esquerda sem atravessar', () => {
    const step = sweepStep({ ...base, x: 100, direction: -1 });
    expect(step.x).toBe(base.minX + base.halfWidth);
    expect(step.direction).toBe(1);
  });

  it('nunca sai do corredor, por mais rapido que va', () => {
    let x = 240;
    let direction: -1 | 1 = 1;
    for (let i = 0; i < 200; i++) {
      const step = sweepStep({ ...base, speed: 900, x, direction });
      x = step.x;
      direction = step.direction;
      expect(x).toBeGreaterThanOrEqual(base.minX + base.halfWidth);
      expect(x).toBeLessThanOrEqual(base.maxX - base.halfWidth);
    }
  });

  it('centraliza quando a nave e mais larga que o corredor', () => {
    const step = sweepStep({ ...base, x: 100, direction: 1, halfWidth: 400 });
    expect(step.x).toBe((base.minX + base.maxX) / 2);
  });
});

describe('ciclo de ataque', () => {
  it('avisa antes de atirar, pelo tempo do telegraph', () => {
    expect(attackPhase(0, 2000, 500)).toBe('idle');
    expect(attackPhase(1499, 2000, 500)).toBe('idle');
    expect(attackPhase(1500, 2000, 500)).toBe('telegraph');
    expect(attackPhase(1999, 2000, 500)).toBe('telegraph');
  });

  it('a salva sai no fim do telegraph, nunca antes', () => {
    expect(shouldFire(1999, 2000)).toBe(false);
    expect(shouldFire(2000, 2000)).toBe(true);
  });

  it('todo ataque tem aviso de 0,4 a 0,6 s, como manda a especificacao', () => {
    expect(BOSS.telegraphMs).toBeGreaterThanOrEqual(400);
    expect(BOSS.telegraphMs).toBeLessThanOrEqual(600);
  });

  it('nenhuma fase, nem enfurecida, atira sem telegraph completo', () => {
    for (const config of BOSSES) {
      expect(fireIntervalFor(config, 2)).toBeGreaterThanOrEqual(BOSS.telegraphMs);
    }
  });
});

describe('entranceProgress', () => {
  it('vai de 0 a 1 e trava nos limites', () => {
    expect(entranceProgress(0, 1600)).toBe(0);
    expect(entranceProgress(1600, 1600)).toBe(1);
    expect(entranceProgress(9999, 1600)).toBe(1);
    expect(entranceProgress(-50, 1600)).toBe(0);
  });

  it('freia no fim: passa da metade do caminho antes da metade do tempo', () => {
    expect(entranceProgress(800, 1600)).toBeGreaterThan(0.5);
  });

  it('nao divide por zero com duracao zero', () => {
    expect(entranceProgress(0, 0)).toBe(1);
  });
});

describe('hpFraction', () => {
  it('mapeia o HP em 0..1 para a barra', () => {
    expect(hpFraction(40, 40)).toBe(1);
    expect(hpFraction(20, 40)).toBe(0.5);
    expect(hpFraction(0, 40)).toBe(0);
  });

  it('trunca valores fora da faixa em vez de desenhar barra invalida', () => {
    expect(hpFraction(-5, 40)).toBe(0);
    expect(hpFraction(99, 40)).toBe(1);
    expect(hpFraction(10, 0)).toBe(0);
  });
});
