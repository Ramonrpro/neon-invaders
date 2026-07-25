/**
 * Curva de dificuldade da formacao. Logica pura.
 *
 * MECANICA-ASSINATURA: o intervalo entre os passos da formacao e' proporcional
 * a quantidade de aliens vivos. Quanto menos sobram, mais rapido eles marcham —
 * o ultimo alien e' frenetico. Isso nao e' bug, e' o coracao do jogo.
 */

/** Formacao cheia: 5 linhas x 11 colunas. */
export const FORMATION_TOTAL = 55;

/** Piso do intervalo de marcha. Abaixo disso a marcha vira borrao ilegivel. */
export const MARCH_FLOOR_MS = 60;

/**
 * Intervalo entre passos da formacao, em milissegundos.
 *
 * @param baseIntervalMs intervalo com a formacao cheia (vem de `config/levels.ts`)
 * @param aliveCount     aliens vivos agora
 */
export function marchIntervalMs(
  baseIntervalMs: number,
  aliveCount: number,
  total: number = FORMATION_TOTAL,
  floorMs: number = MARCH_FLOOR_MS,
): number {
  if (total <= 0) return floorMs;
  const alive = Math.min(Math.max(aliveCount, 0), total);
  return Math.max(floorMs, baseIntervalMs * (alive / total));
}
