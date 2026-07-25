/**
 * Balanceamento do chefao de fim de fase.
 *
 * DECISAO DE ESCOPO: em vez dos cinco chefoes distintos da secao 6 da
 * especificacao, a v1 usa **uma unica nave-mae parametrizada por fase**. Ela
 * ganha HP, cadencia e abertura de leque a cada fase. Os quatro chefoes
 * restantes (Gemeos, Serpente, Fortaleza, Overlord) viram um milestone proprio
 * — a arquitetura ja' os acomoda como variacoes do mesmo framework.
 *
 * Como sempre: nenhum destes numeros pode aparecer solto dentro de uma Scene.
 */

import { LOGICAL_WIDTH } from '@game/config/screen';

export interface BossConfig {
  /** 1..5 — a fase em que esta nave-mae aparece. */
  readonly level: number;
  /** Pontos de vida. Um acerto no nucleo tira 1. */
  readonly hp: number;
  /** Velocidade da varredura horizontal, px/s. */
  readonly sweepSpeed: number;
  /** Intervalo entre salvas no estagio 1, em ms. */
  readonly fireIntervalMs: number;
  /** Projeteis por salva no estagio 1. */
  readonly spreadShots: number;
  /** Velocidade dos projeteis do chefao, px/s. */
  readonly bulletSpeed: number;
  /** Pontos por derrubar. */
  readonly points: number;
  /** Invocacao de minions, ou `null` se esta fase nao invoca. */
  readonly minions: MinionPattern | null;
  /** Laser vertical telegrafado, ou `null` se esta fase nao tem. */
  readonly laser: LaserPattern | null;
}

export interface MinionPattern {
  readonly intervalMs: number;
  readonly count: number;
}

export interface LaserPattern {
  readonly intervalMs: number;
}

/**
 * ESTAGIO 2 — abaixo de 50% de HP a nave-mae enfurece.
 *
 * Os multiplicadores sao comuns a todas as fases: e' a assinatura da luta, nao
 * um numero por fase. Dobrar a velocidade e alargar o leque e' o que faz a
 * segunda metade da barra doer mais que a primeira.
 */
export const BOSS_ENRAGE = {
  /** Abaixo desta fracao de HP, muda de padrao. Especificacao: 50%. */
  hpThreshold: 0.5,
  speedMultiplier: 2,
  /** Cadencia encurta: 0.65 do intervalo original. */
  fireIntervalMultiplier: 0.65,
  /** Projeteis somados ao leque. 3 vira 5. */
  extraShots: 2,
} as const;

/** Geometria e ritmo comuns a toda nave-mae. */
export const BOSS = {
  /** Linha em que ela varre, depois da entrada. Dentro da faixa ciano do topo. */
  sweepY: 132,
  /** Onde ela nasce, acima da tela, antes de descer. */
  entranceStartY: -60,
  /** Duracao da descida de entrada, em ms. */
  entranceMs: 1600,
  /** Folga das paredes na varredura. */
  marginX: 14,

  /**
   * TELEGRAPH — carga visual antes de cada salva, em ms.
   *
   * A especificacao pede 0,4–0,6 s em todo ataque de chefao. Sao 500 ms: o
   * nucleo pulsa e so' entao a salva sai. Nenhum dano do chefao pode ser
   * imprevisivel.
   */
  telegraphMs: 500,

  /** Abertura maxima do leque, em graus para cada lado. */
  spreadAngleDeg: 26,

  /**
   * Dano por acerto. O nucleo vale o dobro do casco — e' o que transforma a
   * luta em mira em vez de martelar qualquer pixel.
   */
  weakPointDamage: 1,
  bodyDamage: 0.5,

  /** Power-ups largados ao morrer. Especificacao: 2. */
  drops: 2,
  /** Afastamento lateral entre os dois drops, para nao cairem sobrepostos. */
  dropSpreadX: 40,

  /** Explosao em cadeia ao morrer: quantos estouros e o intervalo entre eles. */
  deathBursts: 7,
  deathBurstIntervalMs: 130,

  /** Pausa depois da morte do chefao, antes da fase seguinte. */
  defeatDelayMs: 2200,

  /** Piscada do nucleo fora do telegraph, em ms. */
  corePulseMs: 520,
  /**
   * Piso de alpha da respiracao. Alto de proposito: o nucleo e' o alvo da luta
   * inteira e nao pode virar um buraco escuro no meio do casco violeta.
   */
  corePulseFloor: 0.75,
  /** Piscada do nucleo durante o telegraph — bem mais rapida, e' o aviso. */
  coreTelegraphBlinkMs: 90,
  /** Piso de alpha no telegraph. Baixo: aqui o contraste alto E' o alarme. */
  coreTelegraphFloor: 0.2,
} as const;

/**
 * LASER vertical — o ataque das fases 4 e 5.
 *
 * A coluna e' travada no instante em que o aviso comeca, e nao no do disparo.
 * E' isso que torna o laser desviavel: o jogador ve onde ele vai cair e tem o
 * telegraph inteiro para sair. Um laser que mirasse no momento do tiro seria
 * dano garantido — exatamente o que a secao 6 da especificacao proibe.
 */
export const BOSS_LASER = {
  /** Largura do feixe de aviso, em px logicos. Fino: e' so' a mira. */
  warningWidth: 4,
  /** Largura do feixe que mata. */
  beamWidth: 22,
  /** Quanto tempo o feixe fica na tela depois de disparar, em ms. */
  fireMs: 340,
  /** Piscada do aviso, em ms. */
  warningBlinkMs: 80,
} as const;

/** Limites da varredura, ja' com a folga das paredes. */
export const BOSS_MIN_X = BOSS.marginX;
export const BOSS_MAX_X = LOGICAL_WIDTH - BOSS.marginX;

/**
 * A escala por fase.
 *
 * Cada fase acrescenta UMA coisa nova a anterior, nunca duas: leque de 3 →
 * minions → leque de 5 → laser → tudo junto. E' o que impede a fase 5 de ser
 * so' a fase 1 com numeros maiores, que era o risco declarado desta decisao.
 */
export const BOSSES: readonly BossConfig[] = [
  {
    level: 1,
    hp: 40,
    sweepSpeed: 70,
    fireIntervalMs: 2000,
    spreadShots: 3,
    bulletSpeed: 190,
    points: 1000,
    minions: null,
    laser: null,
  },
  {
    level: 2,
    hp: 55,
    sweepSpeed: 82,
    fireIntervalMs: 1850,
    spreadShots: 3,
    bulletSpeed: 205,
    points: 1500,
    minions: { intervalMs: 8000, count: 2 },
    laser: null,
  },
  {
    level: 3,
    hp: 70,
    sweepSpeed: 94,
    fireIntervalMs: 1700,
    spreadShots: 5,
    bulletSpeed: 220,
    points: 2000,
    minions: null,
    laser: null,
  },
  {
    level: 4,
    hp: 85,
    sweepSpeed: 106,
    fireIntervalMs: 1550,
    spreadShots: 5,
    bulletSpeed: 235,
    points: 2500,
    minions: null,
    laser: { intervalMs: 5200 },
  },
  {
    level: 5,
    hp: 100,
    sweepSpeed: 118,
    fireIntervalMs: 1400,
    spreadShots: 5,
    bulletSpeed: 250,
    points: 3000,
    minions: { intervalMs: 9000, count: 2 },
    laser: { intervalMs: 6000 },
  },
];

/** Configuracao do chefao da fase `level` (1..5). Lanca fora do intervalo. */
export function getBoss(level: number): BossConfig {
  const config = BOSSES[level - 1];
  if (!config) {
    throw new RangeError(`getBoss: fase ${level} nao tem chefao (1..${BOSSES.length})`);
  }
  return config;
}
