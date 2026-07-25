/**
 * Paleta base do NEON INVADERS.
 *
 * Monocromatica verde fosforo sobre preto, com faixas de cor por regiao da tela
 * (analogo as tiras de celofane coladas nos monitores dos arcades). Chefoes e
 * power-ups quebram a regra de proposito, para se destacarem do fundo.
 *
 * Cores em numero (0xRRGGBB) para consumo direto pelo Phaser e em string CSS
 * para o gerador de texturas via canvas 2D.
 */

export const PALETTE = {
  black: 0x000000,
  phosphor: 0x00ff41,
  cyan: 0x2ee6ff,
  amber: 0xffd23f,
  white: 0xe8fff0,
  magenta: 0xff3ea5,
  violet: 0x9d5cff,
  red: 0xff2e3c,
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** Faixas horizontais da tela, em coordenadas logicas (480x640). */
export const BANDS = {
  /** Topo: HUD, UFO e barra de HP de chefao. */
  top: { y0: 0, y1: 96, color: PALETTE.cyan },
  /** Miolo: formacao de aliens e combate. */
  mid: { y0: 96, y1: 460, color: PALETTE.phosphor },
  /** Faixa dos bunkers. */
  bunker: { y0: 460, y1: 545, color: PALETTE.phosphor },
  /** Base: nave do jogador. */
  base: { y0: 545, y1: 640, color: PALETTE.amber },
} as const;

/** Cor da faixa em que uma coordenada Y logica cai. */
export function bandColorAt(y: number): number {
  if (y < BANDS.top.y1) return BANDS.top.color;
  if (y < BANDS.mid.y1) return BANDS.mid.color;
  if (y < BANDS.bunker.y1) return BANDS.bunker.color;
  return BANDS.base.color;
}

/** Converte 0xRRGGBB em string CSS `#rrggbb`. */
export function toCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
