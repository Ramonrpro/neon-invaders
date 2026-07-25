/**
 * Registry de power-ups + os numeros da queda e do drop.
 *
 * Adicionar um tipo novo: criar o arquivo dele nesta pasta e acrescentar uma
 * linha em `POWERUP_REGISTRY`. Nada mais no projeto precisa saber que ele
 * existe — HUD, sorteio de drop e perfil de disparo iteram o registry.
 */

import { MULTI } from '@game/config/powerups/multi';
import { RAPID } from '@game/config/powerups/rapid';
import type { PowerUpDefinition, PowerUpId } from '@game/config/powerups/types';

export type { FireProfile, PowerUpDefinition, PowerUpId, ShotSpec } from '@game/config/powerups/types';
export { MULTI, MULTI_MAX_LEVEL, MULTI_MAX_SPREAD_DEG, MULTI_PATTERNS } from '@game/config/powerups/multi';
export { RAPID, RAPID_COOLDOWN_MS, RAPID_MAX_LEVEL } from '@game/config/powerups/rapid';

/**
 * ATENCAO: a ordem e' a ordem de aplicacao dos efeitos.
 *
 * RAPID **soma** slots ao teto de projeteis e MULTI **multiplica** esse teto
 * pelo tamanho da salva. Inverter as duas linhas mudaria o balanceamento do
 * jogo inteiro sem nenhum erro de compilacao.
 */
export const POWERUP_REGISTRY: readonly PowerUpDefinition[] = [RAPID, MULTI];

/** Todos os ids, na ordem do registry. Usado pelo HUD e pelo estado de niveis. */
export const POWERUP_IDS: readonly PowerUpId[] = POWERUP_REGISTRY.map((def) => def.id);

/** Definicao de um id. Lanca se o id nao estiver no registry. */
export function powerUpDefinition(id: PowerUpId): PowerUpDefinition {
  const found = POWERUP_REGISTRY.find((def) => def.id === id);
  if (!found) throw new RangeError(`powerUpDefinition: "${id}" nao esta' no registry`);
  return found;
}

/** Parametros da capsula que cai e das regras de drop. */
export const POWERUP_DROP = {
  /**
   * Velocidade de queda, px/s. Lenta de proposito: a capsula precisa ser um
   * convite a se expor, nao um item que cai no colo.
   */
  fallSpeed: 78,
  /**
   * Cooldown global minimo entre drops, em ms. Especificacao: 10 s.
   * Vale para o drop de alien E para o do UFO — sem isso, um UFO abatido logo
   * depois de um drop de formacao viraria chuva de upgrade.
   */
  cooldownMs: 10_000,
  /**
   * Pool de capsulas na tela. Com cooldown de 10 s e queda de ~7 s ate' o chao,
   * duas simultaneas ja' e' o pior caso; 4 e' folga.
   */
  poolSize: 4,
  /** Periodo do pisca da capsula, em ms. E' o que a distingue de um projetil. */
  blinkPeriodMs: 240,
} as const;
