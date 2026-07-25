/**
 * RAPID — cadencia de tiro. 5 niveis.
 *
 * Tudo sobre este power-up mora aqui; a unica outra mencao a ele no projeto e'
 * a linha que o lista em `index.ts`.
 */

import { PALETTE } from '@game/config/palette';
import type { FireProfile, PowerUpDefinition } from '@game/config/powerups/types';
import { TEX } from '@game/gfx/sprites';

/**
 * Cooldown de disparo por nivel, em ms. Indice = nivel (0 = sem power-up).
 * Valores da secao 5 da especificacao.
 */
export const RAPID_COOLDOWN_MS = [400, 320, 250, 190, 140, 100] as const;

export const RAPID_MAX_LEVEL = RAPID_COOLDOWN_MS.length - 1;

/**
 * Cada nivel tambem soma +1 ao teto de disparos simultaneos. Sem isso o
 * cooldown de 100 ms nao apareceria: a nave recarregaria mais rapido do que os
 * projeteis limpam a tela e o gatilho ficaria travado.
 */
export const RAPID_BULLET_SLOTS_PER_LEVEL = 1;

export const RAPID: PowerUpDefinition = {
  id: 'rapid',
  label: 'RAPID',
  maxLevel: RAPID_MAX_LEVEL,
  color: PALETTE.magenta,
  texture: TEX.iconRapid,
  /** Arpejo curto e agudo — combina com "mais rapido". */
  pickupNotes: [587.33, 783.99, 1174.66],
  dropWeight: 1,

  applyToFire(profile: FireProfile, level: number): void {
    const clamped = Math.min(Math.max(Math.trunc(level), 0), RAPID_MAX_LEVEL);
    profile.cooldownMs = RAPID_COOLDOWN_MS[clamped]!;
    profile.maxBullets += clamped * RAPID_BULLET_SLOTS_PER_LEVEL;
  },
};
