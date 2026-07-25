/**
 * Regras de power-up. Logica pura — sem Phaser, sem estado global.
 *
 * Tres decisoes vivem aqui: o que acontece ao coletar (subir de nivel ou ganhar
 * pontos), qual perfil de disparo os niveis atuais produzem, e quando uma morte
 * pode largar uma capsula. A Scene so' aplica o resultado.
 */

import {
  POWERUP_IDS,
  POWERUP_REGISTRY,
  powerUpDefinition,
  type FireProfile,
  type PowerUpId,
} from '@game/config/powerups';
import { MAXED_POWERUP_POINTS } from '@game/core/scoring';

/** Nivel atual de cada power-up. 0 = nao coletado. */
export type PowerUpLevels = Record<PowerUpId, number>;

/** Estado de quem acabou de comecar um jogo novo. */
export function emptyLevels(): PowerUpLevels {
  const levels = {} as PowerUpLevels;
  for (const id of POWERUP_IDS) levels[id] = 0;
  return levels;
}

/** Zera o objeto no lugar, sem alocar um novo. */
export function resetLevels(levels: PowerUpLevels): void {
  for (const id of POWERUP_IDS) levels[id] = 0;
}

export interface CollectOutcome {
  /** Nivel depois da coleta. */
  readonly level: number;
  /** `false` quando ja' estava no maximo. */
  readonly leveledUp: boolean;
  /** Pontos concedidos no lugar do nivel. Zero quando subiu. */
  readonly bonusPoints: number;
}

/**
 * Coletar um power-up que ja' esta' no nivel maximo vale 500 pontos em vez de
 * subir nivel — a capsula nunca e' desperdicio, mesmo com o canhao no talo.
 */
export function collectOutcome(currentLevel: number, maxLevel: number): CollectOutcome {
  const level = Math.min(Math.max(Math.trunc(currentLevel), 0), maxLevel);
  if (level >= maxLevel) {
    return { level: maxLevel, leveledUp: false, bonusPoints: MAXED_POWERUP_POINTS };
  }
  return { level: level + 1, leveledUp: true, bonusPoints: 0 };
}

/**
 * Recalcula o perfil de disparo do zero a partir dos niveis atuais.
 *
 * Do zero, e nao incremental: o perfil e' sempre derivavel do estado, entao nao
 * ha' como ele dessincronizar depois de uma morte, de uma fase nova ou de um
 * restart. Escreve no `out` fornecido pelo chamador — isto e' chamado na coleta,
 * nao por frame, mas o objeto e' de vida longa e nao ha' motivo para trocar.
 *
 * @param base perfil da nave sem nenhum power-up (vem de `config/gameplay`)
 */
export function buildFireProfile(
  levels: PowerUpLevels,
  base: { cooldownMs: number; maxBullets: number },
  out: FireProfile,
): FireProfile {
  out.cooldownMs = base.cooldownMs;
  out.maxBullets = base.maxBullets;
  out.shots = SINGLE_SHOT;

  // A ordem do registry importa: ver o comentario em `config/powerups/index.ts`.
  for (const definition of POWERUP_REGISTRY) {
    definition.applyToFire(out, levels[definition.id]);
  }
  return out;
}

/** Salva de um tiro reto — o padrao antes de qualquer power-up. */
const SINGLE_SHOT = [{ angleDeg: 0, offsetX: 0 }] as const;

/** Perfil recem-criado, ainda sem power-up nenhum. */
export function createFireProfile(base: { cooldownMs: number; maxBullets: number }): FireProfile {
  return { cooldownMs: base.cooldownMs, maxBullets: base.maxBullets, shots: SINGLE_SHOT };
}

/**
 * Componentes de velocidade de um projetil inclinado.
 *
 * @param angleDeg 0 e' vertical, positivo aponta para a direita
 * @param speed magnitude em px/s, sempre positiva
 */
export function shotVelocity(angleDeg: number, speed: number): { vx: number; vy: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { vx: Math.sin(rad) * speed, vy: -Math.cos(rad) * speed };
}

/**
 * Um alien destruido larga capsula?
 *
 * O cooldown global vem antes do sorteio de proposito: sem ele, uma fase de
 * taxa alta com muitos aliens morrendo junto viraria chuva de upgrade e o jogo
 * inteiro perderia a curva.
 *
 * @param roll             sorteio 0..1
 * @param dropRate         taxa da fase (`config/levels.ts`)
 * @param nowMs            relogio da Scene
 * @param lastDropAtMs     instante do ultimo drop; `-Infinity` se nunca houve
 * @param cooldownMs       intervalo minimo entre drops
 */
export function shouldDrop(
  roll: number,
  dropRate: number,
  nowMs: number,
  lastDropAtMs: number,
  cooldownMs: number,
): boolean {
  if (nowMs - lastDropAtMs < cooldownMs) return false;
  return roll < dropRate;
}

/**
 * Qual tipo cai, pelos pesos do registry.
 * @param roll sorteio 0..1
 */
export function pickDropId(roll: number): PowerUpId {
  const total = POWERUP_REGISTRY.reduce((sum, def) => sum + def.dropWeight, 0);
  if (total <= 0) return POWERUP_IDS[0]!;

  let target = Math.min(Math.max(roll, 0), 0.999999) * total;
  for (const definition of POWERUP_REGISTRY) {
    target -= definition.dropWeight;
    if (target < 0) return definition.id;
  }
  return POWERUP_REGISTRY[POWERUP_REGISTRY.length - 1]!.id;
}

/** Nivel maximo de um id, atalho para quem so' tem o id em mao. */
export function maxLevelOf(id: PowerUpId): number {
  return powerUpDefinition(id).maxLevel;
}
