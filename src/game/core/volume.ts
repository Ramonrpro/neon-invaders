/**
 * Volume em degraus — a parte testavel do controle de audio da tela de ajustes.
 *
 * Cinco degraus em vez de um slider continuo: no dedo, um slider de 480 px de
 * largura logica pede precisao que polegar nao tem, e a diferenca entre 62% e
 * 68% de volume nao existe para ninguem. Degraus tambem sobrevivem ao teclado
 * sem nenhum codigo a mais.
 */

/** Tamanho do degrau. 0,2 = cinco degraus mais o silencio. */
export const VOLUME_STEP = 0.2;

const STEPS = Math.round(1 / VOLUME_STEP);

/**
 * Um degrau de 0,2 somado repetidamente em ponto flutuante produz
 * 0,30000000000000004 — que sobreviveria ate' o `localStorage` e voltaria de
 * la' para dentro da barra.
 */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Proximo volume ao acionar a linha, com volta ao silencio depois do maximo.
 *
 * A volta existe por causa do toque: la' nao ha' "seta para a esquerda", e uma
 * linha que so' sobe deixaria o jogador sem como baixar o volume.
 */
export function cycleVolume(volume: number): number {
  const next = round1(clamp01(volume) + VOLUME_STEP);
  return next > 1 ? 0 : next;
}

/** Um degrau para cima ou para baixo, com piso e teto (setas do teclado). */
export function stepVolume(volume: number, direction: -1 | 1): number {
  return clamp01(round1(clamp01(volume) + direction * VOLUME_STEP));
}

/** Barra do volume, do jeito que ela aparece na tela: `###..`. */
export function volumeBar(volume: number): string {
  const filled = Math.min(STEPS, Math.max(0, Math.round(clamp01(volume) / VOLUME_STEP)));
  return `${'#'.repeat(filled)}${'.'.repeat(STEPS - filled)}`;
}
