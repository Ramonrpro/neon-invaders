import type Phaser from 'phaser';
import { PALETTE, toCss } from '@game/config/palette';
import {
  CANVAS_HEIGHT,
  CENTER_X,
  DECK_HEIGHT,
  HUD_FONT_FAMILY,
  LOGICAL_WIDTH,
  PLAY_HEIGHT,
} from '@game/config/screen';
import { guessInputMode } from '@game/systems/device';
import { dismissDeckHint, isDeckHintDismissed } from '@game/systems/deckHint';

/**
 * O deck: a faixa abaixo da area de jogo onde o polegar arrasta.
 *
 * Ela e' desenhada, mas nao e' interativa — e isso e' decisao, nao esquecimento.
 * O `InputSystem` escuta `POINTER_DOWN/MOVE/UP` no nivel da Scene, e o deck esta'
 * DENTRO do canvas, entao o arrasto ali ja' funciona sem uma linha nova. Uma
 * `Zone` sobre o deck reproduziria a armadilha do `tapHandledByButton` (evento de
 * GameObject chega antes do ponteiro global) e roubaria o toque do resto da tela.
 */

const HINT_TEXT = 'ARRASTE AQUI PARA MOVER';
const HINT_FADE_MS = 250;

/** Vazio quando nao ha' deck (desktop, tablet 4:3). */
export function drawDeckChrome(scene: Phaser.Scene): Phaser.GameObjects.Graphics | null {
  if (DECK_HEIGHT <= 0) return null;

  const g = scene.add.graphics();
  // Preto puro, sem tinta de banda: o deck e' hardware do gabinete, nao imagem.
  g.fillStyle(PALETTE.black, 1);
  g.fillRect(0, PLAY_HEIGHT, LOGICAL_WIDTH, CANVAS_HEIGHT - PLAY_HEIGHT);
  // Bezel: a linha que diz onde a tela acaba e o controle comeca.
  g.fillStyle(PALETTE.phosphor, 0.35);
  g.fillRect(0, PLAY_HEIGHT, LOGICAL_WIDTH, 2);
  return g;
}

export interface DeckHint {
  /** Idempotente: chamar a cada frame de arrasto nao reinicia o fade. */
  dismiss(): void;
}

/**
 * Aviso de "arraste aqui", que sai de cena no primeiro arrasto e nao volta na
 * mesma sessao (ver `systems/deckHint.ts`).
 */
export function createDeckHint(scene: Phaser.Scene): DeckHint {
  const idle: DeckHint = { dismiss: () => {} };
  if (DECK_HEIGHT <= 0) return idle;
  // Quem joga de teclado nunca vai arrastar; a instrucao seria ruido permanente.
  if (guessInputMode() !== 'touch') return idle;
  if (isDeckHintDismissed()) return idle;

  const label = scene.add
    .text(CENTER_X, PLAY_HEIGHT + DECK_HEIGHT / 2, HINT_TEXT, {
      fontFamily: HUD_FONT_FAMILY,
      fontSize: '12px',
      color: toCss(PALETTE.violet),
    })
    .setOrigin(0.5)
    .setAlpha(0.55);

  let fading = false;
  return {
    dismiss: (): void => {
      if (fading) return;
      fading = true;
      dismissDeckHint();
      scene.tweens.add({
        targets: label,
        alpha: 0,
        duration: HINT_FADE_MS,
        onComplete: () => label.setVisible(false),
      });
    },
  };
}
