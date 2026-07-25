import type Phaser from 'phaser';
import { PALETTE } from '@game/config/palette';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '@game/config/screen';

/**
 * Campo de estrelas cintilantes, usado nas telas fora da partida.
 *
 * A cintilacao e' DERIVADA do relogio, sem tween e sem estado: cada estrela tem
 * um periodo proprio tirado do indice dela, entao o campo inteiro nunca pisca
 * junto e nao ha' um so' objeto de animacao para o Phaser gerenciar.
 *
 * Nasceu na `VictoryScene` e virou este arquivo quando a tela de titulo pediu o
 * mesmo fundo — duas copias divergiriam na primeira vez que alguem mexesse no
 * brilho.
 */
export function createStarfield(
  scene: Phaser.Scene,
  count: number,
  color: number = PALETTE.phosphor,
): Phaser.GameObjects.Rectangle[] {
  const stars: Phaser.GameObjects.Rectangle[] = [];
  for (let i = 0; i < count; i++) {
    stars.push(
      scene.add
        .rectangle(Math.random() * LOGICAL_WIDTH, Math.random() * LOGICAL_HEIGHT, 2, 2, color)
        .setOrigin(0.5),
    );
  }
  return stars;
}

/** Chamar no `update` da Scene. */
export function twinkleStarfield(
  stars: readonly Phaser.GameObjects.Rectangle[],
  timeMs: number,
): void {
  for (let i = 0; i < stars.length; i++) {
    stars[i]!.setAlpha(0.25 + 0.75 * Math.abs(Math.sin(timeMs / (600 + i * 37))));
  }
}
