/**
 * MULTI — multiplos tiros por disparo. 4 niveis.
 *
 * Tudo sobre este power-up mora aqui; a unica outra mencao a ele no projeto e'
 * a linha que o lista em `index.ts`.
 */

import { PALETTE } from '@game/config/palette';
import type { FireProfile, PowerUpDefinition, ShotSpec } from '@game/config/powerups/types';
import { TEX } from '@game/gfx/sprites';

/** Teto do leque, em graus para cada lado. Especificacao: 18. */
export const MULTI_MAX_SPREAD_DEG = 18;

/** Meio leque — a abertura suave dos niveis intermediarios. */
const HALF_SPREAD_DEG = MULTI_MAX_SPREAD_DEG / 2;

/** Separacao lateral entre canos paralelos, em px logicos. */
const BARREL_GAP_PX = 5;

/**
 * O padrao de disparo de cada nivel. Indice = nivel (0 = sem power-up).
 *
 * A progressao da especificacao e' 1 → 2 paralelos → 3 em leque leve →
 * 4 (paralelos + leque) → 5 em leque completo. Os niveis pares alargam o
 * angulo, os impares engrossam o centro: assim cada coleta muda visivelmente a
 * forma do tiro, em vez de so' somar mais um risco na tela.
 */
export const MULTI_PATTERNS: readonly (readonly ShotSpec[])[] = [
  // 0 — tiro base.
  [{ angleDeg: 0, offsetX: 0 }],
  // 1 — dois paralelos: cobre o dobro de largura sem mudar o alcance.
  [
    { angleDeg: 0, offsetX: -BARREL_GAP_PX },
    { angleDeg: 0, offsetX: BARREL_GAP_PX },
  ],
  // 2 — leque leve de tres.
  [
    { angleDeg: -HALF_SPREAD_DEG, offsetX: 0 },
    { angleDeg: 0, offsetX: 0 },
    { angleDeg: HALF_SPREAD_DEG, offsetX: 0 },
  ],
  // 3 — o par paralelo do nivel 1 mais duas asas na abertura maxima.
  [
    { angleDeg: -MULTI_MAX_SPREAD_DEG, offsetX: -BARREL_GAP_PX },
    { angleDeg: 0, offsetX: -BARREL_GAP_PX },
    { angleDeg: 0, offsetX: BARREL_GAP_PX },
    { angleDeg: MULTI_MAX_SPREAD_DEG, offsetX: BARREL_GAP_PX },
  ],
  // 4 — leque completo de cinco, do -18 ao +18.
  [
    { angleDeg: -MULTI_MAX_SPREAD_DEG, offsetX: -BARREL_GAP_PX },
    { angleDeg: -HALF_SPREAD_DEG, offsetX: 0 },
    { angleDeg: 0, offsetX: 0 },
    { angleDeg: HALF_SPREAD_DEG, offsetX: 0 },
    { angleDeg: MULTI_MAX_SPREAD_DEG, offsetX: BARREL_GAP_PX },
  ],
];

export const MULTI_MAX_LEVEL = MULTI_PATTERNS.length - 1;

export const MULTI: PowerUpDefinition = {
  id: 'multi',
  label: 'MULTI',
  maxLevel: MULTI_MAX_LEVEL,
  color: PALETTE.violet,
  texture: TEX.iconMulti,
  /** Arpejo mais grave e aberto que o do RAPID — da' para distinguir de olhos fechados. */
  pickupNotes: [392, 493.88, 659.25],
  dropWeight: 1,

  /**
   * O teto de projeteis vira teto de **disparos**: cada salva ocupa tantos
   * slots quantos projeteis ela tem. Sem essa multiplicacao, um leque de cinco
   * estouraria sozinho o limite de dois e travaria o gatilho — MULTI viraria
   * uma punicao.
   */
  applyToFire(profile: FireProfile, level: number): void {
    const clamped = Math.min(Math.max(Math.trunc(level), 0), MULTI_MAX_LEVEL);
    const pattern = MULTI_PATTERNS[clamped]!;
    profile.shots = pattern;
    profile.maxBullets *= pattern.length;
  },
};
