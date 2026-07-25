import Phaser from 'phaser';
import { guessInputMode, type InputMode } from '@game/systems/device';

/**
 * Entrada do jogador, isolada da Scene.
 *
 * A Scene nao pergunta "e' celular?". Ela pergunta `moveAxis`,
 * `consumeDragDeltaX()` e `isFiring` — as duas formas de jogar entram pelo
 * mesmo funil e podem valer ao mesmo tempo (tablet com teclado).
 *
 * Duas decisoes de mobile moram aqui:
 *
 * - **Arrasto por delta relativo, em qualquer ponto da tela.** O dedo empurra
 *   a nave pelo tanto que andou. Posicao absoluta obrigaria o jogador a manter
 *   o dedo em cima da nave, tapando exatamente a regiao onde ele precisa
 *   enxergar os tiros que descem.
 * - **Auto-fire continuo, sem botao de tiro.** No toque a nave atira sozinha o
 *   tempo todo; o jogador so' pilota. Um botao de tiro custaria o segundo
 *   polegar e metade da tela.
 */
export class InputSystem {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private readonly keyA: Phaser.Input.Keyboard.Key | null = null;
  private readonly keyD: Phaser.Input.Keyboard.Key | null = null;
  private readonly keySpace: Phaser.Input.Keyboard.Key | null = null;
  private readonly keyEnter: Phaser.Input.Keyboard.Key | null = null;
  private readonly keyMute: Phaser.Input.Keyboard.Key | null = null;

  private dragAccumulatorX = 0;
  private lastPointerX = 0;
  private dragging = false;
  private pointerJustDown = false;
  private mode: InputMode = guessInputMode();
  /** Preferencia da tela de ajustes. Ver `isFiring`. */
  private autoFire = false;

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    // Teclado ausente e' normal em celular — nao e' erro, so' significa que
    // este aparelho joga no dedo.
    if (keyboard) {
      this.cursors = keyboard.createCursorKeys();
      this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      this.keySpace = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.keyEnter = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
      this.keyMute = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
      keyboard.on('keydown', () => {
        this.mode = 'keyboard';
      });
    }

    // Um ponteiro extra: o polegar que pilota nao pode cancelar o toque no
    // botao de mudo, e vice-versa.
    scene.input.addPointer(1);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
  }

  /** Como o jogador esta' jogando agora. Guia as instrucoes na tela. */
  get inputMode(): InputMode {
    return this.mode;
  }

  // ------------------------------------------------------------- ponteiro

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.wasTouch) this.mode = 'touch';
    this.pointerJustDown = true;
    this.dragging = true;
    this.lastPointerX = pointer.x;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging || !pointer.isDown) return;
    this.dragAccumulatorX += pointer.x - this.lastPointerX;
    this.lastPointerX = pointer.x;
  }

  private onPointerUp(): void {
    this.dragging = false;
  }

  /**
   * Deslocamento do arrasto desde a ultima chamada, em px logicos. Zera na
   * leitura — chamar duas vezes no mesmo frame move a nave uma vez so'.
   */
  consumeDragDeltaX(): number {
    const delta = this.dragAccumulatorX;
    this.dragAccumulatorX = 0;
    return delta;
  }

  /**
   * Descarta arrasto pendente. Obrigatorio ao voltar de uma pausa: o dedo que
   * saiu da tela durante o overlay deixou delta acumulado, e sem isso a nave
   * salta no primeiro frame depois de despausar.
   */
  resetDrag(): void {
    this.dragAccumulatorX = 0;
    this.dragging = false;
  }

  // -------------------------------------------------------------- consulta

  /** -1 esquerda, 0 parado, 1 direita. Setas ou A/D. */
  get moveAxis(): -1 | 0 | 1 {
    if (!this.cursors) return 0;
    const left = this.cursors.left.isDown || this.keyA?.isDown === true;
    const right = this.cursors.right.isDown || this.keyD?.isDown === true;
    if (left === right) return 0;
    return left ? -1 : 1;
  }

  /**
   * Tiro automatico permanente no teclado (tela de ajustes).
   *
   * No toque ele ja' vale sempre e este ajuste nao muda nada — mas a
   * preferencia continua sendo aplicada aos dois, porque o mesmo jogador pode
   * trocar de maos no meio da partida num tablet com teclado.
   */
  setAutoFire(enabled: boolean): void {
    this.autoFire = enabled;
  }

  /**
   * No toque a nave atira sozinha, sempre. No teclado, Espaco segurado —
   * ja' e' auto-fire, limitado pelo cooldown — ou o tempo todo, se o jogador
   * ligou o tiro automatico nos ajustes.
   */
  get isFiring(): boolean {
    if (this.mode === 'touch' || this.autoFire) return true;
    return this.keySpace?.isDown === true;
  }

  /**
   * Confirmacao de menu, por borda.
   * Precisa ser por borda: com `isDown`, o Espaco segurado durante a morte
   * reiniciaria o jogo no mesmo frame do game over. No toque, vale o primeiro
   * frame de qualquer toque novo.
   */
  get justConfirmed(): boolean {
    if (this.consumePointerJustDown()) return true;
    if (!this.keyEnter || !this.keySpace) return false;
    return (
      Phaser.Input.Keyboard.JustDown(this.keyEnter) || Phaser.Input.Keyboard.JustDown(this.keySpace)
    );
  }

  /** Tecla M, por borda. No toque, o botao vive na HUD. */
  get justToggledMute(): boolean {
    return this.keyMute ? Phaser.Input.Keyboard.JustDown(this.keyMute) : false;
  }

  private consumePointerJustDown(): boolean {
    if (!this.pointerJustDown) return false;
    this.pointerJustDown = false;
    return true;
  }

  /** Esquece toque pendente — usado ao trocar de tela. */
  clearPointerEdge(): void {
    this.pointerJustDown = false;
  }
}
