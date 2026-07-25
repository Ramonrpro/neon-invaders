/**
 * Tabela de balanceamento das 5 fases (secao 4 da especificacao).
 *
 * Estes numeros sao o ponto de partida para tuning. NUNCA replique nenhum deles
 * dentro de uma Scene ou entity — importe daqui.
 */

export interface LevelConfig {
  /** 1..5 */
  readonly level: number;
  /** Quantas linhas abaixo da posicao mais alta a formacao comeca. */
  readonly formationRowOffset: number;
  /** Intervalo entre passos com a formacao cheia, em ms. */
  readonly marchBaseIntervalMs: number;
  /** Maximo de projeteis inimigos simultaneos. */
  readonly maxEnemyBullets: number;
  /** Chance de disparo inimigo por tick de marcha (0..1). */
  readonly enemyFireChance: number;
  /** Multiplicador de velocidade do projetil inimigo. */
  readonly enemyBulletSpeedMultiplier: number;
  /** Chance de um alien destruido soltar power-up (0..1). */
  readonly powerUpDropRate: number;
  /** Chance de um alien tipo B se dividir em dois menores ao morrer (0..1). */
  readonly splitChance: number;
}

export const LEVELS: readonly LevelConfig[] = [
  {
    level: 1,
    formationRowOffset: 0,
    marchBaseIntervalMs: 550,
    maxEnemyBullets: 2,
    enemyFireChance: 0.06,
    enemyBulletSpeedMultiplier: 1.0,
    powerUpDropRate: 0.08,
    splitChance: 0,
  },
  {
    level: 2,
    formationRowOffset: 1,
    marchBaseIntervalMs: 480,
    maxEnemyBullets: 3,
    enemyFireChance: 0.08,
    enemyBulletSpeedMultiplier: 1.1,
    powerUpDropRate: 0.08,
    splitChance: 0,
  },
  {
    level: 3,
    formationRowOffset: 2,
    marchBaseIntervalMs: 420,
    maxEnemyBullets: 4,
    enemyFireChance: 0.1,
    enemyBulletSpeedMultiplier: 1.2,
    powerUpDropRate: 0.07,
    splitChance: 0.25,
  },
  {
    level: 4,
    formationRowOffset: 3,
    marchBaseIntervalMs: 360,
    maxEnemyBullets: 5,
    enemyFireChance: 0.13,
    enemyBulletSpeedMultiplier: 1.35,
    powerUpDropRate: 0.07,
    splitChance: 0.4,
  },
  {
    level: 5,
    formationRowOffset: 4,
    marchBaseIntervalMs: 300,
    maxEnemyBullets: 6,
    enemyFireChance: 0.16,
    enemyBulletSpeedMultiplier: 1.5,
    powerUpDropRate: 0.06,
    splitChance: 0.5,
  },
];

export const LAST_LEVEL = LEVELS.length;

/** Configuracao da fase `level` (1..5). Lanca fora do intervalo. */
export function getLevel(level: number): LevelConfig {
  const config = LEVELS[level - 1];
  if (!config) {
    throw new RangeError(`getLevel: fase ${level} nao existe (1..${LAST_LEVEL})`);
  }
  return config;
}
