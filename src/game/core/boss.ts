/**
 * Regras do chefao. Logica pura — sem Phaser, sem estado global.
 *
 * Quatro decisoes vivem aqui: quanto dano cada acerto vale, quando a nave-mae
 * enfurece, para onde ela varre e quando a salva sai. A entidade so' aplica o
 * resultado — nenhuma dessas contas acontece dentro de um `update` da Scene.
 */

import { BOSS, BOSS_ENRAGE, type BossConfig } from '@game/config/bosses';
import { bounceStepX, type BounceInput, type HorizontalDirection } from '@game/core/motion';

/** 1 = padrao de entrada; 2 = enfurecido, abaixo do limiar de HP. */
export type BossStage = 1 | 2;

/**
 * Dano de um acerto.
 *
 * O casco vale metade do nucleo. A especificacao admite "metade ou zero";
 * metade e' o que mantem o tiro no casco util sem tirar o sentido de mirar —
 * zero puniria demais quem esta' jogando no dedo, sem mira fina.
 */
export function damageFor(hitWeakPoint: boolean): number {
  return hitWeakPoint ? BOSS.weakPointDamage : BOSS.bodyDamage;
}

/** Estagio correspondente a um HP. */
export function stageFor(hp: number, maxHp: number): BossStage {
  if (maxHp <= 0) return 2;
  return hp <= maxHp * BOSS_ENRAGE.hpThreshold ? 2 : 1;
}

/**
 * Verdadeiro so' no acerto que cruzou o limiar. Como o HP so' cai, testar a
 * travessia dispara a mudanca de padrao uma unica vez — mesmo padrao do
 * `crossedExtraLifeThreshold` da pontuacao.
 */
export function crossedEnrageThreshold(previousHp: number, newHp: number, maxHp: number): boolean {
  return stageFor(previousHp, maxHp) === 1 && stageFor(newHp, maxHp) === 2;
}

/** Velocidade de varredura no estagio informado. */
export function sweepSpeedFor(config: BossConfig, stage: BossStage): number {
  return stage === 2 ? config.sweepSpeed * BOSS_ENRAGE.speedMultiplier : config.sweepSpeed;
}

/** Intervalo entre salvas no estagio informado, em ms. */
export function fireIntervalFor(config: BossConfig, stage: BossStage): number {
  const interval =
    stage === 2 ? config.fireIntervalMs * BOSS_ENRAGE.fireIntervalMultiplier : config.fireIntervalMs;
  // Nunca abaixo do telegraph: uma salva sem aviso quebra a regra da secao 6.
  return Math.max(interval, BOSS.telegraphMs);
}

/** Projeteis por salva no estagio informado. */
export function spreadShotsFor(config: BossConfig, stage: BossStage): number {
  return stage === 2 ? config.spreadShots + BOSS_ENRAGE.extraShots : config.spreadShots;
}

/**
 * Intervalo entre lasers, ou `null` se a fase nao tem laser.
 *
 * Como o leque, encurta no estagio 2 mas nunca abaixo do telegraph — um laser
 * sem aviso completo seria dano impossivel de prever.
 */
export function laserIntervalFor(config: BossConfig, stage: BossStage): number | null {
  if (!config.laser) return null;
  const interval =
    stage === 2
      ? config.laser.intervalMs * BOSS_ENRAGE.fireIntervalMultiplier
      : config.laser.intervalMs;
  return Math.max(interval, BOSS.telegraphMs);
}

/** Intervalo entre invocacoes de minions, ou `null` se a fase nao invoca. */
export function summonIntervalFor(config: BossConfig, stage: BossStage): number | null {
  if (!config.minions) return null;
  return stage === 2
    ? config.minions.intervalMs * BOSS_ENRAGE.fireIntervalMultiplier
    : config.minions.intervalMs;
}

/** Quantos minions por invocacao, ou 0 se a fase nao invoca. */
export function summonCountFor(config: BossConfig): number {
  return config.minions?.count ?? 0;
}

export type SweepDirection = HorizontalDirection;
export type SweepInput = BounceInput;

/**
 * Um passo da varredura horizontal, com quique nas paredes.
 *
 * Diferente da formacao, aqui o movimento e' continuo (px por frame) e nao
 * step-based: o chefao desliza, a formacao marcha. Sao leituras visuais
 * deliberadamente opostas.
 *
 * A conta em si mora em `core/motion.ts`, compartilhada com os splitters.
 */
export function sweepStep(input: SweepInput): { x: number; direction: SweepDirection } {
  return bounceStepX(input);
}

/**
 * Angulos de um leque simetrico, em graus. 0 aponta para baixo (o chefao atira
 * para baixo), positivo para a direita.
 *
 * Escreve no `out` do chamador e devolve quantas posicoes preencheu — nada de
 * alocar array a cada salva.
 */
export function spreadAngles(count: number, maxAngleDeg: number, out: number[]): number {
  const shots = Math.max(1, Math.trunc(count));
  if (shots === 1) {
    out[0] = 0;
    return 1;
  }
  for (let i = 0; i < shots; i++) {
    out[i] = -maxAngleDeg + (2 * maxAngleDeg * i) / (shots - 1);
  }
  return shots;
}

/** `telegraph` = carregando a salva; `idle` = so' varrendo. */
export type BossAttackPhase = 'idle' | 'telegraph';

/**
 * Em que ponto do ciclo de ataque o chefao esta'.
 *
 * O telegraph e' o RABO do intervalo, nao o comeco: a carga termina exatamente
 * quando a salva sai. E' isso que torna o aviso util — o jogador ve o nucleo
 * pulsar e tem `telegraphMs` para sair da frente.
 */
export function attackPhase(
  sinceLastShotMs: number,
  intervalMs: number,
  telegraphMs: number,
): BossAttackPhase {
  return sinceLastShotMs >= intervalMs - telegraphMs ? 'telegraph' : 'idle';
}

/** A salva sai neste tick? */
export function shouldFire(sinceLastShotMs: number, intervalMs: number): boolean {
  return sinceLastShotMs >= intervalMs;
}

/**
 * Progresso da entrada, 0..1, com desaceleracao no fim.
 *
 * A nave-mae desce rapido e freia ao chegar na linha de varredura. Entrada
 * linear parece queda; com o freio, parece pouso — e da' ao jogador o tempo de
 * ler o tamanho da coisa antes da luta comecar.
 */
export function entranceProgress(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  const t = Math.min(Math.max(elapsedMs / durationMs, 0), 1);
  return 1 - (1 - t) * (1 - t);
}

/** Fracao de HP restante, 0..1 — a barra do HUD le daqui. */
export function hpFraction(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 0;
  return Math.min(Math.max(hp / maxHp, 0), 1);
}
