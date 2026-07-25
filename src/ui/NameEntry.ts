/**
 * Entrada de nome no estilo arcade: tres caracteres, um seletor por slot.
 *
 * POR QUE TRES LETRAS E NAO UM CAMPO DE TEXTO:
 * um `<input>` de DOM sobre o canvas traz o teclado virtual do celular, que
 * cobre metade da tela, rola a pagina inteira e briga com o bloqueio de gestos
 * do `index.html`. O seletor de caractere funciona identico no dedo e no
 * teclado, sem sair do canvas — e e' exatamente o que o genero faz desde 1978.
 *
 * O contrato pede nome de 3 a 12 caracteres (`DISPLAY_NAME`); tres e' o minimo
 * e cabe na tela sem encolher a fonte.
 */

import Phaser from 'phaser';
import { PALETTE, toCss } from '@game/config/palette';
import { HUD_FONT_FAMILY } from '@game/config/screen';

/** Alfabeto do seletor. Sem acento: a fonte do HUD e' ASCII. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const SLOTS = 3;
/** Distancia entre os centros dos slots, em px logicos. */
const SLOT_GAP = 46;
/** Alvo de toque de cada seta. Generoso: e' polegar, nao cursor. */
const ARROW_HIT = 44;
const ARROW_OFFSET_Y = 40;

interface Slot {
  letter: Phaser.GameObjects.Text;
  up: Phaser.GameObjects.Text;
  down: Phaser.GameObjects.Text;
}

export class NameEntry {
  private readonly slots: Slot[] = [];
  private readonly indices = [0, 0, 0];
  private cursor = 0;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  /** Disparado quando o jogador confirma. */
  onConfirm: ((name: string) => void) | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    centerX: number,
    centerY: number,
    initial: string,
  ) {
    this.setName(initial);

    const firstX = centerX - ((SLOTS - 1) * SLOT_GAP) / 2;
    for (let i = 0; i < SLOTS; i++) {
      const x = firstX + i * SLOT_GAP;
      const letter = this.text(x, centerY, '', 34, PALETTE.phosphor);
      const up = this.text(x, centerY - ARROW_OFFSET_Y, '^', 22, PALETTE.cyan);
      const down = this.text(x, centerY + ARROW_OFFSET_Y, 'v', 22, PALETTE.cyan);

      // Zonas separadas dos textos: trocar o conteudo de um Text interativo
      // redimensiona a hitArea padrao, e o alvo encolhe sozinho no primeiro uso
      // (foi o que ja' mordeu no botao de mudo do HUD).
      this.arrowZone(x, centerY - ARROW_OFFSET_Y, i, 1);
      this.arrowZone(x, centerY + ARROW_OFFSET_Y, i, -1);
      this.slotZone(x, centerY, i);

      this.slots.push({ letter, up, down });
    }

    this.installKeyboard();
    this.refresh();
  }

  /** Nome montado, sempre com `SLOTS` caracteres. */
  get value(): string {
    return this.indices.map((index) => ALPHABET[index] ?? 'A').join('');
  }

  /** Preenche a partir de um nome existente. Caractere fora do alfabeto vira A. */
  setName(name: string): void {
    const upper = name.toUpperCase();
    for (let i = 0; i < SLOTS; i++) {
      const found = ALPHABET.indexOf(upper[i] ?? 'A');
      this.indices[i] = found >= 0 ? found : 0;
    }
    if (this.slots.length > 0) this.refresh();
  }

  /** Remove tudo o que este componente pos na Scene, inclusive o listener. */
  destroy(): void {
    if (this.keyHandler) {
      this.scene.input.keyboard?.off('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    for (const object of this.objects) object.destroy();
    this.objects.length = 0;
    this.slots.length = 0;
  }

  // ------------------------------------------------------------------ input

  /**
   * Teclado: digitar a letra ja' preenche o slot e anda para o proximo, que e'
   * mais rapido que ficar rolando o seletor. As setas continuam valendo, para
   * quem estiver num controle ou num teclado sem as teclas de letra a mao.
   */
  private installKeyboard(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;

    const onKey = (event: KeyboardEvent): void => {
      const key = event.key.toUpperCase();
      if (key === 'ARROWLEFT') this.moveCursor(-1);
      else if (key === 'ARROWRIGHT') this.moveCursor(1);
      else if (key === 'ARROWUP') this.cycle(this.cursor, 1);
      else if (key === 'ARROWDOWN') this.cycle(this.cursor, -1);
      else if (key === 'BACKSPACE') this.moveCursor(-1);
      else if (key.length === 1 && ALPHABET.includes(key)) {
        this.indices[this.cursor] = ALPHABET.indexOf(key);
        this.refresh();
        // Confirmar no ultimo slot fica a cargo do Enter: avancar sozinho e'
        // conveniencia, comecar a partida sem o jogador mandar, nao.
        if (this.cursor < SLOTS - 1) this.moveCursor(1);
      } else if (key === 'ENTER') {
        this.onConfirm?.(this.value);
      }
    };

    this.keyHandler = onKey;
    keyboard.on('keydown', onKey);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  private arrowZone(x: number, y: number, slot: number, direction: 1 | -1): void {
    const zone = this.scene.add
      .zone(x, y, ARROW_HIT, ARROW_HIT)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.cursor = slot;
      this.cycle(slot, direction);
    });
    this.objects.push(zone);
  }

  /** Tocar no proprio caractere so' move o cursor para ele. */
  private slotZone(x: number, y: number, slot: number): void {
    const zone = this.scene.add
      .zone(x, y, SLOT_GAP, ARROW_HIT)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.cursor = slot;
      this.refresh();
    });
    this.objects.push(zone);
  }

  private moveCursor(delta: number): void {
    this.cursor = (this.cursor + delta + SLOTS) % SLOTS;
    this.refresh();
  }

  private cycle(slot: number, direction: number): void {
    const current = this.indices[slot] ?? 0;
    this.indices[slot] = (current + direction + ALPHABET.length) % ALPHABET.length;
    this.refresh();
  }

  /** Redesenha os tres slots. O selecionado e' o unico com as setas visiveis. */
  private refresh(): void {
    this.slots.forEach((slot, index) => {
      const selected = index === this.cursor;
      slot.letter.setText(ALPHABET[this.indices[index] ?? 0] ?? 'A');
      slot.letter.setColor(toCss(selected ? PALETTE.amber : PALETTE.phosphor));
      slot.up.setVisible(selected);
      slot.down.setVisible(selected);
    });
  }

  private text(
    x: number,
    y: number,
    content: string,
    size: number,
    color: number,
  ): Phaser.GameObjects.Text {
    const text = this.scene.add
      .text(x, y, content, {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: `${size}px`,
        color: toCss(color),
      })
      .setOrigin(0.5);
    this.objects.push(text);
    return text;
  }
}
