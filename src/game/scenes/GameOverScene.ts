/**
 * Tela de fim de jogo.
 *
 * Roda como OVERLAY sobre a `GameScene` pausada, nao no lugar dela. A razao e'
 * pratica: a `GameScene` guarda estado em campos de instancia, e o Phaser
 * reaproveita a instancia da Scene entre `start`s — pausar e mandar
 * `RESTART_EVENT` mantem um unico caminho de reinicio.
 *
 * Milestone 7: ela tambem e' onde o jogador descobre se a partida entrou no
 * ranking. O envio ja' foi disparado pela `GameScene`; aqui so' se le' o
 * resultado do `RunReporter`, que o guarda justamente porque este overlay so'
 * existe um frame depois da submissao.
 */

import Phaser from 'phaser';
import { InputSystem } from '@game/systems/InputSystem';
import { getRunReporter, type SubmissionState } from '@game/systems/RunReporter';
import { PALETTE, toCss } from '@game/config/palette';
import { CENTER_X, CENTER_Y, HUD_FONT_FAMILY, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '@game/config/screen';
import { formatScore } from '@game/core/scoring';

/** Emitido na `GameScene` quando o jogador pede outra partida. */
export const RESTART_EVENT = 'neon:restart';

export interface GameOverData {
  score: number;
  level: number;
  elapsedMs: number;
  /** Por que a partida acabou — vira subtitulo. */
  reason: string;
}

/** mm:ss. Partida de arcade nunca passa de uma hora. */
function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Texto do estado do envio.
 *
 * Recusa e' informada sem drama e sem acusacao: quem jogou honesto e caiu aqui
 * por causa de um teto mal calibrado nao pode ler "trapaceiro". Ver
 * `docs/anti-cheat.md`.
 */
export function submissionText(state: SubmissionState): string {
  switch (state.status) {
    case 'idle':
    case 'pending':
      return 'ENVIANDO AO RANKING...';
    case 'accepted':
      return state.rank === null ? 'FORA DO TOP 100' : `RANKING  #${state.rank}`;
    case 'rejected':
      return 'PARTIDA NAO REGISTRADA';
    case 'unavailable':
      return 'RANKING INDISPONIVEL';
  }
}

export class GameOverScene extends Phaser.Scene {
  private controls!: InputSystem;
  private result!: GameOverData;
  private rankLabel!: Phaser.GameObjects.Text;
  private unsubscribe: (() => void) | null = null;
  /**
   * Ignora a confirmacao nos primeiros frames: o Espaco costuma estar segurado
   * no instante da morte e reiniciaria a partida antes do jogador ler a tela.
   */
  private acceptInputAtMs = 0;
  /** Um toque no botao de ranking nao pode valer tambem como "jogar de novo". */
  private tapHandledByButton = false;

  constructor() {
    super('GameOver');
  }

  init(data: GameOverData): void {
    this.result = data;
  }

  create(): void {
    this.controls = new InputSystem(this);
    this.acceptInputAtMs = this.time.now + 600;
    this.tapHandledByButton = false;

    // Veu escuro: a cena de jogo fica visivel atras, congelada, mas apagada o
    // bastante para a formacao nao brigar com o texto por cima dela.
    this.add.rectangle(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, PALETTE.black, 0.9).setOrigin(0, 0);

    this.label(CENTER_Y - 100, 'GAME OVER', 32, PALETTE.red);
    this.label(CENTER_Y - 64, this.result.reason, 13, PALETTE.magenta);

    this.label(CENTER_Y - 16, `SCORE   ${formatScore(this.result.score)}`, 18, PALETTE.phosphor);
    this.label(CENTER_Y + 14, `FASE    ${this.result.level}`, 16, PALETTE.cyan);
    this.label(CENTER_Y + 38, `TEMPO   ${formatDuration(this.result.elapsedMs)}`, 16, PALETTE.cyan);

    this.rankLabel = this.label(CENTER_Y + 74, '', 15, PALETTE.amber);
    // `onResolved` entrega na hora se a submissao ja' resolveu — o resultado
    // local costuma chegar antes de esta Scene existir.
    this.unsubscribe = getRunReporter().onResolved((state) => {
      if (this.rankLabel.active) this.rankLabel.setText(submissionText(state));
    });
    this.rankLabel.setText(submissionText(getRunReporter().current));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
    });

    this.label(CENTER_Y + 122, 'ENTER PARA JOGAR DE NOVO', 14, PALETTE.amber);

    const rankY = CENTER_Y + 156;
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

  update(): void {
    // Le sempre, para nao deixar um toque pendente valendo no frame seguinte.
    const confirmed = this.controls.justConfirmed;
    if (this.tapHandledByButton) {
      this.tapHandledByButton = false;
      return;
    }
    if (this.time.now < this.acceptInputAtMs || !confirmed) return;

    const game = this.scene.get('Game');
    this.scene.stop();
    this.scene.resume('Game');
    game.events.emit(RESTART_EVENT);
  }

  /**
   * Sair para o ranking ENCERRA a partida — a `GameScene` e' parada, nao
   * pausada. Deixa-la pausada a manteria desenhando congelada atras da tela de
   * ranking, e ela nao tem mais nada a fazer: a run ja' foi submetida.
   */
  private openLeaderboard(): void {
    this.scene.stop('Game');
    this.scene.start('Leaderboard', { returnTo: 'Title' });
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
