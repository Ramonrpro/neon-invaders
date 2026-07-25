/**
 * Tela de ajustes.
 *
 * Menu de arcade, nao formulario: uma coluna de linhas, uma selecionada, e a
 * linha selecionada muda de valor. E' o unico desenho que funciona igual nas
 * duas formas de jogar — no teclado as setas navegam e o Enter altera; no dedo,
 * tocar numa linha ja' seleciona E altera, que e' o gesto que o polegar espera.
 *
 * Nao ha' botao de "salvar". Toda alteracao grava na hora pelo `SettingsService`
 * e vai para o barramento (`settingsBus`), entao o efeito aparece antes de o
 * jogador soltar o dedo — inclusive com a partida pausada atras da tela.
 */

import Phaser from 'phaser';
import { InputSystem } from '@game/systems/InputSystem';
import { guessInputMode, type InputMode } from '@game/systems/device';
import { emitSettings } from '@game/systems/settingsBus';
import { PALETTE, toCss } from '@game/config/palette';
import {
  CANVAS_CENTER_Y,
  CANVAS_HEIGHT,
  CENTER_X,
  HUD_FONT_FAMILY,
  LOGICAL_WIDTH,
} from '@game/config/screen';
import { nextCrtPreference, resolveCrtEnabled } from '@game/core/crt';
import { resolveInstallOption } from '@game/core/install';
import { cycleVolume, stepVolume, volumeBar } from '@game/core/volume';
import { installAvailability, onInstallChange, promptInstall } from '@pwa/index';
import { DEFAULT_SETTINGS, type GameSettings } from '@services/settings';
import { getServices } from '@services/index';

export interface SettingsData {
  /** Scene para onde o VOLTAR devolve o jogador. */
  returnTo: string;
}

/** Primeira linha e espacamento vertical do menu. */
const FIRST_ROW_Y = CANVAS_CENTER_Y - 96;
const ROW_HEIGHT = 46;
/** Alvo de toque de uma linha. Generoso: errar aqui e' trocar a opcao errada. */
const ROW_HIT_HEIGHT = 42;

/** Uma linha do menu. O valor e' sempre DERIVADO das preferencias atuais. */
interface Row {
  readonly label: string;
  /** Texto do valor, do jeito que o jogador le'. */
  readonly value: (settings: GameSettings) => string;
  /** Alteracao ao acionar a linha. Devolve o patch a salvar. */
  readonly activate?: (settings: GameSettings) => Partial<GameSettings>;
  /** Passo explicito de esquerda/direita. Sem isto, seta = acionar. */
  readonly step?: (settings: GameSettings, direction: -1 | 1) => Partial<GameSettings>;
  /**
   * Efeito que NAO e' preferencia. Existe para a linha de instalar o app: o valor
   * dela vem do navegador, nao de `GameSettings`, e nao ha' patch para gravar.
   */
  readonly action?: () => void;
  /** Rodape enquanto esta linha estiver selecionada. */
  readonly hint?: string;
  readonly text: Phaser.GameObjects.Text;
  readonly valueText: Phaser.GameObjects.Text;
}

const HINTS: Readonly<Record<InputMode, string>> = {
  touch: 'TOQUE NUMA LINHA PARA ALTERAR',
  keyboard: 'SETAS NAVEGAM  ·  ENTER ALTERA  ·  ESC VOLTA',
};

/** O iOS instala pela folha de compartilhamento; nao ha' dialogo a abrir. */
const IOS_INSTALL_HINT = 'NO SAFARI: COMPARTILHAR -> ADICIONAR A TELA DE INICIO';

export class SettingsScene extends Phaser.Scene {
  private controls!: InputSystem;
  private rows: Row[] = [];
  private selected = 0;
  private settings: GameSettings = { ...DEFAULT_SETTINGS };
  private hint!: Phaser.GameObjects.Text;
  private shownHint: string | null = null;
  private returnTo = 'Title';
  /** Um toque numa linha nao pode valer tambem como o toque de "voltar". */
  private tapHandledByButton = false;

  constructor() {
    super('Settings');
  }

  init(data: Partial<SettingsData>): void {
    this.returnTo = data.returnTo ?? 'Title';
  }

  create(): void {
    this.controls = new InputSystem(this);
    // Instancia reaproveitada: `shownHint` de uma visita anterior faria
    // `refreshHint` achar que o texto ja' esta' escrito. Ver a nota igual na
    // `PauseScene`.
    this.shownHint = null;
    // Fundo opaco: quando esta tela sobe da pausa, a partida congelada fica
    // atras dela e nao pode competir pela atencao.
    this.add.rectangle(0, 0, LOGICAL_WIDTH, CANVAS_HEIGHT, PALETTE.black, 0.97).setOrigin(0, 0);

    this.add
      .text(CENTER_X, CANVAS_CENTER_Y - 160, 'AJUSTES', {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '30px',
        color: toCss(PALETTE.cyan),
      })
      .setOrigin(0.5);

    this.rows = [];
    this.selected = 0;
    this.buildRows();

    /*
     * Rodape derivado da ULTIMA linha, nao de um deslocamento fixo do centro: a
     * lista tem 4 ou 5 linhas dependendo de o navegador oferecer instalacao, e
     * com o valor fixo o "INSTALAR APP" batia no "VOLTAR".
     */
    const lastRowY = FIRST_ROW_Y + (this.rows.length - 1) * ROW_HEIGHT;
    const backY = lastRowY + 56;

    this.hint = this.add
      .text(CENTER_X, backY + 34, '', {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '11px',
        color: toCss(PALETTE.violet),
      })
      .setOrigin(0.5);

    this.add
      .text(CENTER_X, backY, 'VOLTAR', {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '18px',
        color: toCss(PALETTE.amber),
      })
      .setOrigin(0.5);
    this.add
      .zone(CENTER_X, backY, LOGICAL_WIDTH * 0.6, 44)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        this.tapHandledByButton = true;
        this.close();
      });
    this.input.keyboard?.on('keydown-ESC', () => this.close());

    this.installArrowKeys();
    /*
     * Instalar muda a lista de linhas, nao o valor de uma linha. Reconstruir a
     * quente exigiria mexer em `moveSelection` e nos alvos de toque por um evento
     * que acontece no maximo uma vez na vida do aparelho; `restart` passa pelo
     * `create`, que ja' e' idempotente. O `off` no SHUTDOWN nao e' opcional —
     * mesma regra do `onSettings` (ver `systems/settingsBus.ts`).
     */
    const unsubscribe = onInstallChange(() => {
      if (this.scene.isActive()) this.scene.restart({ returnTo: this.returnTo });
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);

    this.refreshHint();
    // O toque que abriu esta tela nao pode acionar a primeira linha.
    this.controls.clearPointerEdge();

    void this.loadSettings();
  }

  private async loadSettings(): Promise<void> {
    const stored = await getServices().settings.load();
    if (!this.scene.isActive()) return;
    this.settings = stored;
    this.refreshRows();
  }

  // ------------------------------------------------------------------ linhas

  private buildRows(): void {
    const touchDevice = guessInputMode() === 'touch';

    this.addRow({
      label: 'SOM',
      value: (s) => (s.muted ? 'MUDO' : 'LIGADO'),
      activate: (s) => ({ muted: !s.muted }),
    });

    this.addRow({
      label: 'VOLUME',
      value: (s) => volumeBar(s.volume),
      // Acionar sobe um degrau e da' a volta no topo: no dedo nao ha' "seta
      // para a esquerda", e uma linha que so' sobe seria um beco sem saida.
      activate: (s) => ({ volume: cycleVolume(s.volume) }),
      step: (s, direction) => ({ volume: stepVolume(s.volume, direction) }),
    });

    this.addRow({
      label: 'CRT',
      // Mostra o estado REAL, nunca a palavra "auto": para o jogador o efeito
      // esta' ligado ou desligado; `'auto'` e' assunto interno do jogo.
      value: (s) => (resolveCrtEnabled(s.crt, touchDevice) ? 'LIGADO' : 'DESLIGADO'),
      activate: (s) => ({ crt: nextCrtPreference(s.crt, touchDevice) }),
    });

    this.addRow({
      label: 'TIRO AUTO',
      value: (s) => (s.autoFire || touchDevice ? 'LIGADO' : 'DESLIGADO'),
      activate: (s) => ({ autoFire: !s.autoFire }),
    });

    /*
     * A linha de instalar existe apenas quando ha' o que fazer: instalado ou
     * navegador que nao instala, ela nao e' criada. Linha de menu que nao responde
     * e' ruido — e' por isso que a regra vive em `core/install.ts`, testada, em vez
     * de virar um `if` improvisado aqui.
     */
    const installOption = resolveInstallOption(installAvailability());
    if (installOption === 'prompt') {
      this.addRow({
        label: 'INSTALAR APP',
        value: () => 'DISPONIVEL',
        action: () => void promptInstall(),
      });
    } else if (installOption === 'manual') {
      // Sem `action`: no iOS nao ha' dialogo para abrir. Selecionar a linha ja'
      // mostra o caminho no rodape, que e' tudo o que o jogo pode fazer.
      this.addRow({
        label: 'INSTALAR APP',
        value: () => 'MANUAL',
        hint: IOS_INSTALL_HINT,
      });
    }
  }

  private addRow(spec: Omit<Row, 'text' | 'valueText'>): void {
    const y = FIRST_ROW_Y + this.rows.length * ROW_HEIGHT;
    const index = this.rows.length;

    const text = this.add
      .text(CENTER_X - 150, y, spec.label, {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '16px',
        color: toCss(PALETTE.white),
      })
      .setOrigin(0, 0.5);

    const valueText = this.add
      .text(CENTER_X + 150, y, '', {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '16px',
        color: toCss(PALETTE.phosphor),
      })
      .setOrigin(1, 0.5);

    // Zone separada, nunca `text.setInteractive()`: o valor troca de texto a
    // cada acionamento, e a hitArea padrao de um Text acompanha o tamanho do
    // conteudo — o alvo encolheria sozinho ao passar de 'DESLIGADO' para
    // 'LIGADO'. Mesma armadilha do botao de mudo na HUD.
    this.add
      .zone(CENTER_X, y, LOGICAL_WIDTH * 0.86, ROW_HIT_HEIGHT)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        this.tapHandledByButton = true;
        this.selected = index;
        this.activateSelected();
      });

    this.rows.push({ ...spec, text, valueText });
  }

  private refreshRows(): void {
    this.rows.forEach((row, index) => {
      const active = index === this.selected;
      row.text.setText(`${active ? '> ' : '  '}${row.label}`);
      row.text.setColor(toCss(active ? PALETTE.amber : PALETTE.white));
      row.valueText.setText(row.value(this.settings));
      row.valueText.setColor(toCss(active ? PALETTE.amber : PALETTE.phosphor));
    });
  }

  // ----------------------------------------------------------------- entrada

  update(): void {
    this.refreshHint();

    const confirmed = this.controls.justConfirmed;
    if (this.tapHandledByButton) {
      this.tapHandledByButton = false;
      return;
    }
    if (confirmed) this.activateSelected();
  }

  /**
   * As setas sao lidas por borda, no proprio handler de tecla, e nao no
   * `update`: o `InputSystem` nao expoe cima/baixo (a nave so' anda na
   * horizontal) e duplicar o estado do teclado aqui daria dois donos para a
   * mesma tecla.
   */
  private installArrowKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    keyboard.on('keydown-UP', () => this.moveSelection(-1));
    keyboard.on('keydown-DOWN', () => this.moveSelection(1));
    // W/S de proposito FORA daqui: `S` e' a tecla que abre esta tela, e o
    // teclado do Phaser e' processado por fila — o mesmo `S` que abriu o menu
    // pode chegar um frame depois, ja' com o menu no ar, e mexer na selecao
    // sozinho. Mesma armadilha do "R" de "RAM" no seletor de nome.
    keyboard.on('keydown-LEFT', () => this.stepSelected(-1));
    keyboard.on('keydown-RIGHT', () => this.stepSelected(1));
  }

  private moveSelection(direction: -1 | 1): void {
    const count = this.rows.length;
    this.selected = (this.selected + direction + count) % count;
    this.refreshRows();
  }

  private activateSelected(): void {
    const row = this.rows[this.selected];
    if (!row) return;
    if (row.action) {
      row.action();
      return;
    }
    if (row.activate) this.applyPatch(row.activate(this.settings));
  }

  /** Esquerda/direita. Linha sem `step` trata as duas como acionamento. */
  private stepSelected(direction: -1 | 1): void {
    const row = this.rows[this.selected];
    if (!row) return;
    if (row.step) {
      this.applyPatch(row.step(this.settings, direction));
      return;
    }
    this.activateSelected();
  }

  /**
   * Aplica, grava e anuncia — nesta ordem, e sempre as tres.
   *
   * A gravacao nao e' esperada: o `LocalSettingsService` resolve no microtask e
   * o remoto de amanha pode demorar. Segurar o efeito ate' o storage responder
   * daria a um toggle a latencia de uma rede.
   */
  private applyPatch(patch: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.refreshRows();
    void getServices().settings.save(patch);
    emitSettings(this.game, this.settings);
  }

  private close(): void {
    this.scene.start(this.returnTo);
  }

  /**
   * O rodape depende de DUAS coisas: o modo de entrada e a linha selecionada (a
   * de instalar no iOS traz a propria instrucao). Por isso a memoria e' o TEXTO
   * final, e nao mais o modo — memorizar so' o modo faria a dica travar na
   * primeira que aparecesse, porque o modo nao muda ao andar pelo menu.
   */
  private refreshHint(): void {
    const next = this.rows[this.selected]?.hint ?? HINTS[this.controls.inputMode];
    if (next === this.shownHint) return;
    this.shownHint = next;
    this.hint.setText(next);
  }
}
