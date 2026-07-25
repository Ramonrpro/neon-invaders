/**
 * Overlay de pausa.
 *
 * Sobe quando a aba perde a visibilidade. O Phaser ja' para o loop sozinho
 * nessa hora, mas parar o loop nao basta: sem este overlay o jogo voltaria
 * a rodar no instante em que a aba reaparece, com a nave exatamente onde o
 * jogador a largou e os projeteis a meio caminho dela. A pausa explicita
 * devolve o controle so' quando o jogador pede.
 *
 * Mesmo padrao de `GameOverScene`: a `GameScene` pausa e continua viva atras,
 * e a retomada passa por um unico evento.
 */

import Phaser from 'phaser';
import { InputSystem } from '@game/systems/InputSystem';
import type { InputMode } from '@game/systems/device';
import { PALETTE, toCss } from '@game/config/palette';
import { CENTER_X, CENTER_Y, HUD_FONT_FAMILY, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '@game/config/screen';

/** Emitido na `GameScene` quando o jogador retoma a partida. */
export const RESUME_EVENT = 'neon:resume';

const PROMPT: Readonly<Record<InputMode, string>> = {
  touch: 'TOQUE PARA CONTINUAR',
  keyboard: 'ENTER PARA CONTINUAR',
};

export class PauseScene extends Phaser.Scene {
  private controls!: InputSystem;
  private prompt!: Phaser.GameObjects.Text;
  private shownMode: InputMode | null = null;
  /** Um toque no botao de ajustes nao pode valer tambem como "continuar". */
  private tapHandledByButton = false;

  constructor() {
    super('Pause');
  }

  create(): void {
    this.controls = new InputSystem(this);
    /*
     * O Phaser reaproveita a instancia da Scene, e `shownMode` decide se o
     * prompt precisa ser reescrito. Sem zerar aqui, voltar dos ajustes recria o
     * objeto de texto VAZIO e `refreshPrompt` conclui que nao ha' nada a
     * fazer — a tela de pausa fica sem a linha que diz como sair dela.
     * Encontrado na verificacao do Milestone 8.
     */
    this.shownMode = null;
    this.add.rectangle(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, PALETTE.black, 0.86).setOrigin(0, 0);

    this.add
      .text(CENTER_X, CENTER_Y - 20, 'PAUSADO', {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '30px',
        color: toCss(PALETTE.cyan),
      })
      .setOrigin(0.5);

    this.prompt = this.add
      .text(CENTER_X, CENTER_Y + 30, '', {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '14px',
        color: toCss(PALETTE.amber),
      })
      .setOrigin(0.5);

    /*
     * Ajustes com a partida no ar.
     *
     * E' o unico lugar de onde da' para conferir o efeito de uma preferencia
     * contra o jogo de verdade — volume no meio de uma onda, CRT com a
     * formacao na tela. A `GameScene` continua pausada atras: esta Scene sai,
     * a de ajustes entra, e o VOLTAR traz a pausa de novo.
     */
    const settingsY = CENTER_Y + 80;
    this.add
      .text(CENTER_X, settingsY, 'AJUSTES', {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '14px',
        color: toCss(PALETTE.violet),
      })
      .setOrigin(0.5);
    this.add
      .zone(CENTER_X, settingsY, LOGICAL_WIDTH * 0.5, 40)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        this.tapHandledByButton = true;
        this.openSettings();
      });
    this.input.keyboard?.on('keydown-S', () => this.openSettings());

    this.refreshPrompt();
    // O toque/tecla que trouxe a aba de volta nao pode despausar no mesmo frame.
    this.controls.clearPointerEdge();
  }

  private openSettings(): void {
    this.tapHandledByButton = true;
    this.scene.start('Settings', { returnTo: 'Pause' });
  }

  update(): void {
    this.refreshPrompt();

    // Le sempre, para nao deixar um toque pendente valendo no frame seguinte.
    const confirmed = this.controls.justConfirmed;
    // O toque no botao de ajustes chega ANTES do ponteiro global — sem esta
    // guarda ele tambem despausaria a partida.
    if (this.tapHandledByButton) {
      this.tapHandledByButton = false;
      return;
    }
    if (!confirmed) return;

    const game = this.scene.get('Game');
    this.scene.stop();
    this.scene.resume('Game');
    game.events.emit(RESUME_EVENT);
  }

  private refreshPrompt(): void {
    const mode = this.controls.inputMode;
    if (mode === this.shownMode) return;
    this.shownMode = mode;
    this.prompt.setText(PROMPT[mode]);
  }
}
