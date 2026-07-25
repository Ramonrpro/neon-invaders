/**
 * Tela de titulo.
 *
 * As instrucoes se adaptam a forma de jogar: quem esta' no dedo nunca le'
 * "SETAS PARA MOVER". A deteccao e' continua, nao uma checagem no `create` —
 * num tablet com teclado o jogador pode trocar de maos entre a leitura e o
 * comeco da partida, e o texto acompanha.
 *
 * Milestone 7: e' aqui que o jogador ganha nome. A primeira partida passa pelo
 * seletor de tres letras e cria uma sessao de CONVIDADO — sem cadastro, sem
 * e-mail, sem rede. E' o unico momento em que o jogo pede alguma coisa antes de
 * deixar jogar, e ele pede uma vez so': das proximas vezes o nome ja' esta' la'.
 *
 * Milestone 8: arte e modo atracao. O miolo da tela cicla entre tres paineis
 * enquanto ninguem toca em nada — o que o jogo vale, quem sao os melhores, e o
 * que o jogador precisa saber. Qualquer tecla devolve o painel principal, e o
 * ciclo so' roda com a tela em `ready`: durante a escolha do nome o espaco e'
 * do seletor.
 */

import Phaser from 'phaser';
import { InputSystem } from '@game/systems/InputSystem';
import type { InputMode } from '@game/systems/device';
import { ATTRACT } from '@game/config/juice';
import { PALETTE, toCss } from '@game/config/palette';
import {
  CANVAS_CENTER_Y,
  CANVAS_HEIGHT,
  CENTER_X,
  HUD_FONT_FAMILY,
  LOGICAL_WIDTH,
} from '@game/config/screen';
import { resolveInstallOption, type InstallOption } from '@game/core/install';
import { formatScore } from '@game/core/scoring';
import { installAvailability, onInstallChange } from '@pwa/index';
import { drawBackgroundBands } from '@game/gfx/background';
import { createStarfield, twinkleStarfield } from '@game/gfx/starfield';
import { TEX } from '@game/gfx/sprites';
import { NameEntry } from '@ui/NameEntry';
import { getServices } from '@services/index';
import type { ScoreEntry } from '@services/types';

const INSTRUCTIONS: Readonly<Record<InputMode, readonly [string, string]>> = {
  touch: ['ARRASTE EM QUALQUER LUGAR PARA PILOTAR', 'A NAVE ATIRA SOZINHA'],
  keyboard: ['SETAS OU A/D PARA MOVER', 'ESPACO PARA ATIRAR  ·  M PARA O SOM'],
};

/**
 * Painel "COMO JOGAR" do modo atracao.
 *
 * Nao repete os controles (isso ja' esta' logo abaixo, adaptado ao aparelho):
 * conta as tres coisas que mudam a forma de jogar e que ninguem descobre
 * sozinho a tempo — o UFO valer a pena, o chefao existir e os bunkers serem
 * consumiveis.
 */
const HOW_TO_PLAY: readonly string[] = [
  'O UFO SEMPRE SOLTA UM POWER-UP',
  'CADA FASE TERMINA EM UMA NAVE-MAE',
  'MIRE NO NUCLEO: VALE DANO DOBRADO',
  'OS BUNKERS NAO VOLTAM ATE A PROXIMA FASE',
];

/**
 * Aviso de instalacao no pe' da tela. Vazio quando nao ha' nada a dizer — jogo
 * ja' instalado ou navegador que nao instala.
 */
const INSTALL_NOTICES: Readonly<Record<InstallOption, string>> = {
  prompt: 'INSTALE O JOGO NOS AJUSTES',
  manual: 'COMPARTILHAR -> ADICIONAR A TELA DE INICIO',
  installed: '',
  none: '',
};

/** Quantos nomes o painel de recordes mostra. */
const TOP_ROWS = 5;

/** Nome sugerido a quem nunca jogou. */
const DEFAULT_NAME = 'AAA';

/**
 * `naming` = escolhendo o nome; `ready` = pronto para comecar.
 * Enquanto a sessao nao chega do storage, a tela fica em `loading` e nao aceita
 * confirmacao — comecar a partida antes disso submeteria a run sem nome.
 */
type TitleMode = 'loading' | 'naming' | 'ready';

/** Os tres paineis do miolo, na ordem em que o modo atracao os mostra. */
type Panel = 'showcase' | 'scores' | 'howto';
const PANEL_ORDER: readonly Panel[] = ['showcase', 'scores', 'howto'];

export class TitleScene extends Phaser.Scene {
  private controls!: InputSystem;
  private lineA!: Phaser.GameObjects.Text;
  private lineB!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private pilotLabel!: Phaser.GameObjects.Text;
  private nameHint!: Phaser.GameObjects.Text;
  private installLabel!: Phaser.GameObjects.Text;
  private nameEntry: NameEntry | null = null;

  /** Imagens e textos da vitrine de aliens, escondidos durante a escolha do nome. */
  private readonly showcase: (Phaser.GameObjects.Image | Phaser.GameObjects.Text)[] = [];
  /** Só as imagens da vitrine: sao elas que marcham e trocam de frame. */
  private readonly marchers: {
    image: Phaser.GameObjects.Image;
    frames: readonly [string, string];
  }[] = [];
  private readonly scorePanel: Phaser.GameObjects.Text[] = [];
  private readonly howToPanel: Phaser.GameObjects.Text[] = [];
  private stars: Phaser.GameObjects.Rectangle[] = [];

  private shownMode: InputMode | null = null;
  private mode: TitleMode = 'loading';
  private playerName = DEFAULT_NAME;

  /** Painel visivel e quando o proximo entra. Ver `tickAttract`. */
  private panel: Panel = 'showcase';
  private nextPanelAtMs = 0;

  /**
   * Um toque em botao NAO pode valer tambem como "comecar".
   *
   * O `InputSystem` escuta o ponteiro no nivel da Scene, e o Phaser entrega os
   * eventos de GameObject ANTES do evento global — entao limpar a borda dentro
   * do handler do botao nao adianta, o global chegaria depois e a marcaria de
   * novo. A flag e' consumida no `update`, que roda depois dos dois.
   */
  private tapHandledByButton = false;

  /**
   * Carencia dos atalhos de tecla depois de sair do seletor de nome.
   *
   * O Phaser processa o teclado por FILA, dentro do game loop: uma tecla
   * digitada no seletor pode ser processada no frame seguinte, quando a tela ja'
   * esta' em `ready` — e ai' um "R" do nome vira o atalho do ranking. Ja'
   * aconteceu na verificacao: digitar RAM e confirmar abria o ranking sozinho.
   */
  private shortcutsAtMs = 0;

  constructor() {
    super('Title');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.black);
    drawBackgroundBands(this, CANVAS_HEIGHT);
    this.stars = createStarfield(this, 34);
    this.controls = new InputSystem(this);
    this.mode = 'loading';
    this.nameEntry = null;
    // Instancia reaproveitada (o jogador volta do ranking ou dos ajustes): sem
    // zerar, `refreshInstructions` acharia que o texto ja' esta' na tela e
    // deixaria as linhas de instrucao vazias. Ver a nota igual na `PauseScene`.
    this.shownMode = null;
    // A instancia da Scene volta a ser usada quando o jogador retorna do
    // ranking: sem zerar, os arrays guardariam objetos ja' destruidos.
    this.showcase.length = 0;
    this.marchers.length = 0;
    this.scorePanel.length = 0;
    this.howToPanel.length = 0;
    this.panel = 'showcase';

    this.add
      .text(CENTER_X, CANVAS_CENTER_Y - 190, 'NEON', {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '56px',
        color: toCss(PALETTE.phosphor),
      })
      .setOrigin(0.5);
    this.add
      .text(CENTER_X, CANVAS_CENTER_Y - 138, 'INVADERS', {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '40px',
        color: toCss(PALETTE.cyan),
      })
      .setOrigin(0.5);

    this.buildShowcase();
    this.buildScorePanel();
    this.buildHowToPanel();

    this.pilotLabel = this.label(CANVAS_CENTER_Y + 30, 15, PALETTE.white);
    this.nameHint = this.label(CANVAS_CENTER_Y + 52, 11, PALETTE.violet);
    this.lineA = this.label(CANVAS_CENTER_Y + 128, 14, PALETTE.amber);
    this.lineB = this.label(CANVAS_CENTER_Y + 150, 12, PALETTE.amber);
    this.prompt = this.label(CANVAS_CENTER_Y + 190, 16, PALETTE.white);

    // Trocar de nome depois: toque no nome, ou tecla N.
    this.button(CENTER_X, CANVAS_CENTER_Y + 30, LOGICAL_WIDTH * 0.7, 34, () => {
      if (this.mode === 'ready') this.startNaming();
    });
    this.input.keyboard?.on('keydown-N', () => {
      if (this.shortcutsReady) this.startNaming();
    });

    this.buildMenu();

    // Qualquer tecla interrompe a atracao e devolve o painel principal — quem
    // chegou na frente do teclado nao quer ver propaganda.
    this.input.keyboard?.on('keydown', () => {
      if (this.mode === 'ready') this.resetAttract();
    });

    this.setPanel('showcase');
    this.refreshInstructions();
    // O toque que abriu esta tela nao pode contar como "comecar".
    this.controls.clearPointerEdge();

    void this.loadSession();
    void this.loadTopScores();
  }

  update(time: number): void {
    twinkleStarfield(this.stars, time);
    this.marchAliens(time);
    this.refreshInstructions();
    this.tickAttract(time);

    // Sempre consome a borda, mesmo quando ela vai ser ignorada: deixar um toque
    // pendente faria a tela reagir a ele no frame seguinte.
    const confirmed = this.controls.justConfirmed;
    if (this.tapHandledByButton) {
      this.tapHandledByButton = false;
      return;
    }
    if (!confirmed || this.mode !== 'ready') return;
    this.scene.start('Game');
  }

  // --------------------------------------------------------------- paineis

  private buildShowcase(): void {
    // Fileira de aliens: mostra os tres tipos e quanto cada um vale. Ela sai de
    // cena enquanto o jogador escolhe o nome — o seletor ocupa esse espaco.
    const showcase: readonly [readonly [string, string], number][] = [
      [[TEX.alienC0, TEX.alienC1], 30],
      [[TEX.alienB0, TEX.alienB1], 20],
      [[TEX.alienA0, TEX.alienA1], 10],
    ];

    showcase.forEach(([frames, points], index) => {
      const y = CANVAS_CENTER_Y - 76 + index * 30;
      const image = this.add.image(CENTER_X - 40, y, frames[0]).setOrigin(0.5);
      this.showcase.push(image);
      this.marchers.push({ image, frames });
      this.showcase.push(
        this.add
          .text(CENTER_X + 10, y, `= ${points} PTS`, {
            fontFamily: HUD_FONT_FAMILY,
            fontSize: '16px',
            color: toCss(PALETTE.phosphor),
          })
          .setOrigin(0, 0.5),
      );
    });
  }

  /**
   * Marcha dos aliens do titulo: os dois frames alternando e um passo lateral,
   * no mesmo ritmo do jogo parado.
   *
   * Derivada do relogio, sem tween e sem timer: a tela de titulo nao pode
   * acumular objetos de animacao entre visitas — ela e' reaproveitada toda vez
   * que o jogador volta do ranking.
   */
  private marchAliens(timeMs: number): void {
    const step = Math.floor(timeMs / ATTRACT.marchMs);
    const frame = step % 2;
    const offset = (frame === 0 ? -1 : 1) * ATTRACT.marchAmplitudePx;

    for (const marcher of this.marchers) {
      marcher.image.setTexture(marcher.frames[frame]!);
      marcher.image.setX(CENTER_X - 40 + offset);
    }
  }

  private buildScorePanel(): void {
    this.scorePanel.push(
      this.label(CANVAS_CENTER_Y - 100, 13, PALETTE.cyan).setText('MELHORES PILOTOS'),
    );
    for (let i = 0; i < TOP_ROWS; i++) {
      this.scorePanel.push(this.label(CANVAS_CENTER_Y - 72 + i * 22, 14, PALETTE.phosphor));
    }
    for (const object of this.scorePanel) object.setVisible(false);
  }

  private buildHowToPanel(): void {
    this.howToPanel.push(this.label(CANVAS_CENTER_Y - 100, 13, PALETTE.cyan).setText('COMO JOGAR'));
    HOW_TO_PLAY.forEach((line, index) => {
      this.howToPanel.push(
        this.label(CANVAS_CENTER_Y - 70 + index * 24, 11, PALETTE.white).setText(line),
      );
    });
    for (const object of this.howToPanel) object.setVisible(false);
  }

  /**
   * Recordes do painel de atracao. Falha em silencio: a tela de titulo nao pode
   * mostrar erro de ranking, e o painel simplesmente diz que nao ha' ninguem.
   */
  private async loadTopScores(): Promise<void> {
    let entries: ScoreEntry[] = [];
    try {
      entries = await getServices().scores.getLeaderboard('global', TOP_ROWS);
    } catch {
      entries = [];
    }
    if (!this.scene.isActive()) return;

    // O primeiro elemento e' o cabecalho; as linhas comecam no indice 1.
    for (let i = 0; i < TOP_ROWS; i++) {
      const row = this.scorePanel[i + 1];
      if (!row) continue;
      const entry = entries[i];
      if (!entry) {
        row.setText(i === 0 && entries.length === 0 ? 'NINGUEM AINDA — SEJA O PRIMEIRO' : '');
        row.setColor(toCss(PALETTE.violet));
        continue;
      }
      const name = entry.playerName.toUpperCase().slice(0, 8).padEnd(8, ' ');
      row.setText(`${i + 1}  ${name}  ${formatScore(entry.score)}`);
      row.setColor(toCss(i === 0 ? PALETTE.amber : PALETTE.phosphor));
    }
  }

  private setPanel(panel: Panel): void {
    this.panel = panel;
    const naming = this.mode === 'naming';

    for (const object of this.showcase) object.setVisible(!naming && panel === 'showcase');
    for (const object of this.scorePanel) object.setVisible(!naming && panel === 'scores');
    for (const object of this.howToPanel) object.setVisible(!naming && panel === 'howto');
  }

  /**
   * Ciclo do modo atracao.
   *
   * So' roda com a tela em `ready`: em `loading` a sessao ainda esta' vindo, e
   * em `naming` o miolo pertence ao seletor de nome — trocar de painel por baixo
   * dele apagaria o nome que o jogador esta' digitando da tela.
   */
  private tickAttract(timeMs: number): void {
    if (this.mode !== 'ready') return;
    if (timeMs < this.nextPanelAtMs) return;

    const index = PANEL_ORDER.indexOf(this.panel);
    this.setPanel(PANEL_ORDER[(index + 1) % PANEL_ORDER.length]!);
    this.nextPanelAtMs = timeMs + ATTRACT.panelMs;
  }

  /** Volta ao painel principal e reinicia o ciclo. Chamado a cada interacao. */
  private resetAttract(): void {
    this.setPanel('showcase');
    this.nextPanelAtMs = this.time.now + ATTRACT.panelMs;
  }

  // ---------------------------------------------------------------- menu

  /** Ranking e ajustes: uma linha cada, com alvo de toque e tecla propria. */
  private buildMenu(): void {
    const rankY = CANVAS_CENTER_Y + 224;
    this.label(rankY, 14, PALETTE.cyan).setText('RANKING');
    this.button(CENTER_X, rankY, LOGICAL_WIDTH * 0.6, 32, () => this.openLeaderboard());
    // So' fora do modo de nome: com o seletor aberto, R, N e S sao letras que o
    // jogador esta' digitando — nao atalhos. Ja' mordeu: digitar "RAM" abria o
    // ranking na primeira tecla.
    this.input.keyboard?.on('keydown-R', () => {
      if (this.shortcutsReady) this.openLeaderboard();
    });

    const settingsY = CANVAS_CENTER_Y + 256;
    this.label(settingsY, 14, PALETTE.violet).setText('AJUSTES');
    this.button(CENTER_X, settingsY, LOGICAL_WIDTH * 0.6, 32, () => this.openSettings());
    this.input.keyboard?.on('keydown-S', () => {
      if (this.shortcutsReady) this.openSettings();
    });

    /*
     * Aviso de instalacao: uma linha, sem alvo de toque proprio. O botao mesmo
     * esta' nos ajustes — aqui e' so' para o jogador descobrir que existe. Some
     * quando o jogo ja' esta' instalado ou quando o navegador nao instala.
     */
    this.installLabel = this.label(CANVAS_CENTER_Y + 284, 11, PALETTE.violet);
    this.refreshInstallLabel();
    const unsubscribe = onInstallChange(() => this.refreshInstallLabel());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
  }

  /** Texto derivado do navegador — nunca memorizado entre visitas. */
  private refreshInstallLabel(): void {
    if (!this.installLabel.active) return;
    this.installLabel.setText(INSTALL_NOTICES[resolveInstallOption(installAvailability())]);
  }

  // -------------------------------------------------------------- sessao

  /**
   * Sessao vem do `AuthService` — nunca de `localStorage` direto, que a regra do
   * ESLint proibe dentro de `src/game/`.
   */
  private async loadSession(): Promise<void> {
    const session = await getServices().auth.getSession();
    // A Scene pode ter sido trocada enquanto a promessa resolvia.
    if (!this.scene.isActive()) return;

    if (session) {
      this.playerName = session.displayName;
      this.setReady();
      return;
    }
    this.startNaming();
  }

  private startNaming(): void {
    this.mode = 'naming';
    this.nameEntry?.destroy();
    this.nameEntry = new NameEntry(this, CENTER_X, CANVAS_CENTER_Y, this.playerName);
    this.nameEntry.onConfirm = (name): void => void this.confirmName(name);

    // O seletor ocupa o miolo: nenhum painel de atracao pode dividir o espaco.
    this.setPanel('showcase');
    this.pilotLabel.setVisible(false);
    this.nameHint
      .setText('SEU NOME NO RANKING')
      .setVisible(true)
      .setY(CANVAS_CENTER_Y - 76);
    this.prompt.setText(
      this.controls.inputMode === 'touch' ? 'TOQUE EM OK PARA CONTINUAR' : 'ENTER CONFIRMA',
    );
    this.okButton();
  }

  /** Botao OK do modo de nome. So' existe enquanto ele durar. */
  private okButton(): void {
    const y = CANVAS_CENTER_Y + 90;
    const text = this.add
      .text(CENTER_X, y, 'OK', {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '20px',
        color: toCss(PALETTE.amber),
      })
      .setOrigin(0.5);
    const zone = this.add
      .zone(CENTER_X, y, 120, 44)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.tapHandledByButton = true;
      void this.confirmName(this.nameEntry?.value ?? DEFAULT_NAME);
      text.destroy();
      zone.destroy();
    });
    // O OK some junto com o editor quando o Enter confirma antes do toque.
    this.events.once('neon:name-confirmed', () => {
      text.destroy();
      zone.destroy();
    });
  }

  /**
   * Cria (ou recria) a sessao de convidado com o nome escolhido.
   *
   * Nome invalido nao trava a tela: cai no padrao. O seletor so' produz letras e
   * digitos, entao a unica recusa possivel seria de tamanho — e ele tem tres.
   */
  private async confirmName(name: string): Promise<void> {
    this.events.emit('neon:name-confirmed');
    try {
      const session = await getServices().auth.signInAsGuest(name);
      this.playerName = session.displayName;
    } catch {
      this.playerName = DEFAULT_NAME;
    }
    if (!this.scene.isActive()) return;
    this.setReady();
  }

  /** Atalhos de tecla valem so' com a tela em `ready` e passada a carencia. */
  private get shortcutsReady(): boolean {
    return this.mode === 'ready' && this.time.now >= this.shortcutsAtMs;
  }

  private setReady(): void {
    this.mode = 'ready';
    this.shortcutsAtMs = this.time.now + 300;
    this.nameEntry?.destroy();
    this.nameEntry = null;

    this.pilotLabel.setText(`PILOTO  ${this.playerName.toUpperCase()}`).setVisible(true);
    this.nameHint
      .setText(this.controls.inputMode === 'touch' ? 'TOQUE NO NOME PARA TROCAR' : 'N TROCA O NOME')
      .setY(CANVAS_CENTER_Y + 52)
      .setVisible(true);
    this.shownMode = null;
    this.refreshInstructions();
    // Quem acabou de escolher o nome ve' a vitrine, nao o painel em que a
    // atracao estava quando o seletor abriu.
    this.resetAttract();
  }

  private openLeaderboard(): void {
    this.tapHandledByButton = true;
    this.scene.start('Leaderboard', { returnTo: 'Title' });
  }

  private openSettings(): void {
    this.tapHandledByButton = true;
    this.scene.start('Settings', { returnTo: 'Title' });
  }

  /** Reescreve o texto so' quando a forma de jogar muda. */
  private refreshInstructions(): void {
    const mode = this.controls.inputMode;
    if (mode === this.shownMode) return;
    this.shownMode = mode;

    const [a, b] = INSTRUCTIONS[mode];
    this.lineA.setText(a);
    this.lineB.setText(b);
    if (this.mode === 'ready') {
      this.prompt.setText(mode === 'touch' ? 'TOQUE PARA COMECAR' : 'ENTER PARA COMECAR');
      // Trocar de maos e' interacao: devolve o painel principal.
      this.resetAttract();
    }
  }

  private button(x: number, y: number, width: number, height: number, onTap: () => void): void {
    this.add
      .zone(x, y, width, height)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        this.tapHandledByButton = true;
        onTap();
      });
  }

  private label(y: number, size: number, color: number): Phaser.GameObjects.Text {
    return this.add
      .text(CENTER_X, y, '', {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: `${size}px`,
        color: toCss(color),
      })
      .setOrigin(0.5);
  }
}
