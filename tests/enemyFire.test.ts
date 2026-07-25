import { describe, expect, it } from 'vitest';
import {
  KIND_WEIGHTS,
  nearestShooterIndex,
  pickKind,
  pickShooters,
  rollingStepX,
  waveOffsetX,
  type ShooterCandidate,
} from '@game/core/enemyFire';

interface FakeAlien extends ShooterCandidate {
  alive: boolean;
}

function alien(col: number, x: number, y: number, alive = true): FakeAlien {
  return { col, x, y, alive };
}

const isAlive = (a: FakeAlien): boolean => a.alive;

describe('pickShooters', () => {
  it('elege o alien mais baixo de cada coluna', () => {
    const aliens = [
      alien(0, 10, 100),
      alien(0, 10, 200),
      alien(0, 10, 150),
      alien(1, 40, 120),
      alien(1, 40, 90),
    ];
    const out: (FakeAlien | null)[] = new Array<FakeAlien | null>(2).fill(null);

    expect(pickShooters(aliens, isAlive, out)).toBe(2);
    expect(out[0]?.y).toBe(200);
    expect(out[1]?.y).toBe(120);
  });

  it('ignora aliens mortos', () => {
    const aliens = [alien(0, 10, 200, false), alien(0, 10, 100, true)];
    const out: (FakeAlien | null)[] = new Array<FakeAlien | null>(1).fill(null);

    expect(pickShooters(aliens, isAlive, out)).toBe(1);
    expect(out[0]?.y).toBe(100);
  });

  it('limpa o buffer entre chamadas — coluna que morreu nao continua atirando', () => {
    const out: (FakeAlien | null)[] = new Array<FakeAlien | null>(2).fill(null);
    pickShooters([alien(0, 10, 100), alien(1, 40, 100)], isAlive, out);
    expect(pickShooters([alien(0, 10, 100)], isAlive, out)).toBe(1);
    expect(out[1]).toBeNull();
  });

  it('devolve zero com a formacao vazia', () => {
    const out: (FakeAlien | null)[] = new Array<FakeAlien | null>(3).fill(null);
    expect(pickShooters([], isAlive, out)).toBe(0);
  });
});

describe('nearestShooterIndex', () => {
  it('escolhe a coluna alinhada com o jogador', () => {
    const shooters = [alien(0, 50, 300), null, alien(2, 250, 300), alien(3, 400, 300)];
    expect(nearestShooterIndex(shooters, 260)).toBe(2);
    expect(nearestShooterIndex(shooters, 0)).toBe(0);
    expect(nearestShooterIndex(shooters, 480)).toBe(3);
  });

  it('devolve -1 quando nao ha atirador', () => {
    expect(nearestShooterIndex([null, null], 100)).toBe(-1);
  });
});

describe('pickKind', () => {
  it('cobre os tres tipos e nada mais', () => {
    expect(pickKind(0)).toBe('straight');
    expect(pickKind(0.49)).toBe('straight');
    expect(pickKind(0.5)).toBe('wave');
    expect(pickKind(0.79)).toBe('wave');
    expect(pickKind(0.8)).toBe('rolling');
    expect(pickKind(0.999)).toBe('rolling');
  });

  it('tem pesos que somam 1 — nenhuma faixa de sorteio fica orfa', () => {
    const total = Object.values(KIND_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe('waveOffsetX', () => {
  it('sai da coluna de origem e volta a ela a cada ciclo', () => {
    expect(waveOffsetX(0, 10, 40)).toBeCloseTo(0, 6);
    expect(waveOffsetX(10, 10, 40)).toBeCloseTo(10, 6);
    expect(waveOffsetX(20, 10, 40)).toBeCloseTo(0, 6);
    expect(waveOffsetX(30, 10, 40)).toBeCloseTo(-10, 6);
    expect(waveOffsetX(40, 10, 40)).toBeCloseTo(0, 6);
  });

  it('nunca ultrapassa a amplitude', () => {
    for (let fallen = 0; fallen < 200; fallen += 3) {
      expect(Math.abs(waveOffsetX(fallen, 11, 46))).toBeLessThanOrEqual(11.0001);
    }
  });

  it('degenera para reto se o comprimento de onda for invalido', () => {
    expect(waveOffsetX(50, 10, 0)).toBe(0);
  });
});

describe('rollingStepX', () => {
  it('respeita o teto de deriva — o tiro persegue, nao gruda', () => {
    expect(rollingStepX(100, 400, 5)).toBe(5);
    expect(rollingStepX(400, 100, 5)).toBe(-5);
  });

  it('encosta exatamente no alvo quando ja esta perto', () => {
    expect(rollingStepX(100, 102, 5)).toBe(2);
    expect(rollingStepX(100, 100, 5)).toBe(0);
  });
});
