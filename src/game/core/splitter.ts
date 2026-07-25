/**
 * Regras dos splitters. Logica pura.
 *
 * Um alien do tipo B pode se partir em dois bichos menores e mais rapidos ao
 * morrer (25% na fase 3, 40% na 4, 50% na 5). Os mesmos bichos servem de
 * minions invocados pela nave-mae — sao a unica ameaca do jogo que se move
 * livre, fora da grade da formacao.
 */

import type { AlienType } from '@game/core/scoring';

/** Quantos filhos um alien que se parte gera. */
export const SPLIT_CHILDREN = 2;

/**
 * Este alien se parte ao morrer?
 *
 * So' o tipo B se parte — e' a homenagem aos splitters do arcade, e restringir
 * a um tipo mantem o jogador capaz de prever quais mortes viram ameaca.
 *
 * @param roll   sorteio 0..1
 * @param chance chance da fase (`config/levels.ts`)
 */
export function shouldSplit(type: AlienType, roll: number, chance: number): boolean {
  if (type !== 'B') return false;
  return roll < chance;
}

/**
 * Sentido horizontal de cada filho, na ordem em que sao criados.
 *
 * Saem em sentidos opostos de proposito: dois filhos descendo juntos seriam um
 * alvo so'. Abrindo em V, forcam o jogador a escolher qual perseguir.
 */
export function childDirection(index: number): -1 | 1 {
  return index % 2 === 0 ? -1 : 1;
}

/**
 * Verdadeiro quando o splitter saiu por baixo da tela.
 *
 * Sair pelos lados nao conta: eles quicam nas paredes (ver `core/motion.ts`).
 * A unica fuga e' pela base, e ela e' de graca para o jogador — um splitter que
 * escapa nao custa vida, so' os pontos que ele valia.
 */
export function hasEscaped(y: number, halfHeight: number, screenHeight: number): boolean {
  return y - halfHeight > screenHeight;
}
