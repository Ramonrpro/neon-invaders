/**
 * Tela de vitoria — as cinco naves-mae abatidas.
 *
 * Mesmo padrao de overlay da `GameOverScene`, e pela mesma razao: a `GameScene`
 * guarda estado em campos de instancia e o Phaser reaproveita a instancia entre
 * `start`s. Pausar e mandar `RESTART_EVENT` mantem um unico caminho de reinicio.
 *
 * Nao e' uma variacao da tela de derrota com outro texto: a derrota conta por
 * que voce parou, a vitoria conta o que voce fez. Por isso o placar aqui e' o
 * total, e nao a fase alcancada — nao ha' fase alcancada, elas acabaram.
 */

import Phaser from 'phaser';
import { InputSystem } from '@game/systems/InputSystem';
import { getRunReporter } from '@game/systems/RunReporter';
import { PALETTE, toCss } from '@game/config/palette';
import {
  CANVAS_HEIGHT,
  CENTER_X,
  HUD_FONT_FAMILY,
  LOGICAL_WIDTH,
  PLAY_CENTER_Y,
} from '@game/config/screen';
import { formatScore } from '@game/core/scoring';
import { createStarfield, twinkleStarfield } from '@game/gfx/starfield';
import { RESTART_EVENT, submissionText } from '@game/scenes/GameOverScene';

export interface VictoryData {
  score: number;
  elapsedMs: number;
}

/** mm:ss. Partida de arcade nunca passa de uma hora. */
function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export class VictoryScene extends Phaser.Scene {
  private controls!: InputSystem;
  private result!: VictoryData;
  private acceptInputAtMs = 0;
  private rankLabel!: Phaser.GameObjects.Text;
  private unsubscribe: (() => void) | null = null;
  /** Um toque no botao de ranking nao pode valer tambem como "jogar de novo". */
  private tapHandledByButton = false;

  /** Estrelas do fundo: piscam derivadas do relogio, sem tween nem alocacao. */
  private stars: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super('Victory');
  }

  init(data: VictoryData): void {
    this.result = data;
  }

  create(): void {
    this.controls = new InputSystem(this);
    // Mais generoso que o da derrota: aqui o jogador quer olhar o numero.
    this.acceptInputAtMs = this.time.now + 1200;

    this.add.rectangle(0, 0, LOGICAL_WIDTH, CANVAS_HEIGHT, PALETTE.black, 0.92).setOrigin(0, 0);

    this.stars = createStarfield(this, 40);

    this.label(PLAY_CENTER_Y - 100, 'MISSAO', 30, PALETTE.phosphor);
    this.label(PLAY_CENTER_Y - 66, 'CUMPRIDA', 30, PALETTE.cyan);
    this.label(PLAY_CENTER_Y - 26, 'AS CINCO NAVES-MAE FORAM ABATIDAS', 11, PALETTE.violet);

    this.label(PLAY_CENTER_Y + 20, `SCORE   ${formatScore(this.result.score)}`, 20, PALETTE.amber);
    this.label(
      PLAY_CENTER_Y + 52,
      `TEMPO   ${formatDuration(this.result.elapsedMs)}`,
      16,
      PALETTE.cyan,
    );

    // Mesma leitura da tela de derrota: o envio ja' foi disparado pela
    // `GameScene` e o `RunReporter` guarda o resultado para quem chegar depois.
    this.rankLabel = this.label(PLAY_CENTER_Y + 84, '', 15, PALETTE.phosphor);
    this.rankLabel.setText(submissionText(getRunReporter().current));
    this.unsubscribe = getRunReporter().onResolved((state) => {
      if (this.rankLabel.active) this.rankLabel.setText(submissionText(state));
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
    });

    this.label(PLAY_CENTER_Y + 130, 'ENTER PARA JOGAR DE NOVO', 14, PALETTE.amber);

    const rankY = PLAY_CENTER_Y + 162;
    this.label(rankY, 'VER RANKING', 14, PALETTE.cyan);
    this.add
      .zone(CENTER_X, rankY, LOGICAL_WIDTH * 0.6, 40)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        this.tapHandledByButton = true;
        this.openLeaderboard();
      });
    this.input.keyboard?.on('keydown-R', () => this.openLeaderboard());
  }

  /** Ver o comentario em `GameOverScene.openLeaderboard`: a partida encerra aqui. */
  private openLeaderboard(): void {
    this.scene.stop('Game');
    this.scene.start('Leaderboard', { returnTo: 'Title' });
  }

  update(time: number): void {
    twinkleStarfield(this.stars, time);

    // Le sempre, para nao deixar um toque pendente valendo no frame seguinte.
    const confirmed = this.controls.justConfirmed;
    if (this.tapHandledByButton) {
      this.tapHandledByButton = false;
      return;
    }
    if (time < this.acceptInputAtMs || !confirmed) return;

    const game = this.scene.get('Game');
    this.scene.stop();
    this.scene.resume('Game');
    game.events.emit(RESTART_EVENT);
  }

  private label(y: number, text: string, size: number, color: number): Phaser.GameObjects.Text {
    return this.add
      .text(CENTER_X, y, text, {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: `${size}px`,
        color: toCss(color),
      })
      .setOrigin(0.5);
  }
}
