/**
 * Tela de ranking — global, semanal e meus.
 *
 * Ela NAO sabe onde os scores moram. Pede tudo ao `ScoreService`, que hoje le'
 * `localStorage` e amanha fala com o servidor; e' o unico jeito de a troca de
 * adapter nao virar reescrita de tela.
 *
 * Sobe como Scene propria (nao overlay): ao contrario da pausa e do game over,
 * aqui nao ha' nada da partida atras que precise continuar existindo. Quem
 * abriu diz para onde voltar, em `LeaderboardData.returnTo`.
 */

import Phaser from 'phaser';
import { PALETTE, toCss } from '@game/config/palette';
import { CENTER_X, HUD_FONT_FAMILY, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '@game/config/screen';
import { formatScore } from '@game/core/scoring';
import { drawBackgroundBands } from '@game/gfx/background';
import { getServices } from '@services/index';
import type { LeaderboardScope, ScoreEntry } from '@services/types';

export interface LeaderboardData {
  /** Scene para onde o botao VOLTAR devolve. */
  returnTo: 'Title';
}

const SCOPES: readonly { id: LeaderboardScope; label: string }[] = [
  { id: 'global', label: 'GLOBAL' },
  { id: 'weekly', label: 'SEMANA' },
  { id: 'me', label: 'MEUS' },
];

/** Quantas linhas cabem sem apertar a fonte. */
const ROWS = 10;
const ROW_HEIGHT = 26;
const FIRST_ROW_Y = 168;
/** Alvo de toque das abas e do botao voltar. */
const TAB_HIT_HEIGHT = 40;

/** mm:ss. */
function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export class LeaderboardScene extends Phaser.Scene {
  private escKey: Phaser.Input.Keyboard.Key | null = null;
  private returnTo: LeaderboardData['returnTo'] = 'Title';
  private scope: LeaderboardScope = 'global';
  private tabs: Phaser.GameObjects.Text[] = [];
  private rows: Phaser.GameObjects.Text[] = [];
  private emptyLabel!: Phaser.GameObjects.Text;
  /**
   * Cada carregamento tem um numero. Uma resposta que chega depois de o jogador
   * ja' ter trocado de aba e' descartada — sem isso a lista pisca com dados da
   * aba anterior no dia em que a resposta vier da rede.
   */
  private loadId = 0;

  constructor() {
    super('Leaderboard');
  }

  init(data: Partial<LeaderboardData>): void {
    this.returnTo = data.returnTo ?? 'Title';
    this.scope = 'global';
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.black);
    drawBackgroundBands(this);
    this.escKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC) ?? null;

    this.label(CENTER_X, 60, 'RANKING', 30, PALETTE.phosphor);

    this.tabs = SCOPES.map((scope, index) => {
      const x = LOGICAL_WIDTH * ((index + 0.5) / SCOPES.length);
      const text = this.label(x, 110, scope.label, 15, PALETTE.cyan);
      this.zone(x, 110, LOGICAL_WIDTH / SCOPES.length, TAB_HIT_HEIGHT, () => {
        this.setScope(scope.id);
      });
      return text;
    });

    this.label(CENTER_X, 140, '-'.repeat(34), 12, PALETTE.violet);

    this.rows = [];
    for (let i = 0; i < ROWS; i++) {
      const row = this.add
        .text(24, FIRST_ROW_Y + i * ROW_HEIGHT, '', {
          fontFamily: HUD_FONT_FAMILY,
          fontSize: '13px',
          color: toCss(PALETTE.phosphor),
        })
        .setOrigin(0, 0.5);
      this.rows.push(row);
    }

    this.emptyLabel = this.label(
      CENTER_X,
      FIRST_ROW_Y + 60,
      'NENHUMA PARTIDA AINDA',
      13,
      PALETTE.amber,
    );

    const backY = LOGICAL_HEIGHT - 56;
    this.label(CENTER_X, backY, 'VOLTAR', 16, PALETTE.amber);
    this.zone(CENTER_X, backY, LOGICAL_WIDTH, TAB_HIT_HEIGHT, () => this.goBack());

    this.setScope('global');
  }

  update(): void {
    /*
     * Teclado: ESC volta. Aqui NAO existe "qualquer toque confirma" como nas
     * outras telas — o toque tem alvos proprios (abas e VOLTAR), e um toque
     * global fecharia a tela no mesmo gesto que troca de aba.
     */
    if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) this.goBack();
  }

  private goBack(): void {
    this.scene.start(this.returnTo);
  }

  private setScope(scope: LeaderboardScope): void {
    this.scope = scope;
    this.tabs.forEach((tab, index) => {
      const active = SCOPES[index]?.id === scope;
      tab.setColor(toCss(active ? PALETTE.amber : PALETTE.cyan));
    });
    void this.loadEntries();
  }

  /**
   * NAO se chama `load`: `Phaser.Scene.load` e' o LoaderPlugin, e um metodo com
   * esse nome sobrescreve o plugin da Scene. E' o terceiro nome desta lista a
   * morder o projeto, depois de `input` e `data` (ver CLAUDE.md, secao 8).
   */
  private async loadEntries(): Promise<void> {
    const id = ++this.loadId;
    const scope = this.scope;
    let entries: ScoreEntry[] = [];
    try {
      entries = await getServices().scores.getLeaderboard(scope, ROWS);
    } catch {
      // Ranking fora do ar nao pode derrubar a tela: mostra vazio com aviso.
      if (id === this.loadId) this.render([], 'RANKING INDISPONIVEL');
      return;
    }
    if (id !== this.loadId) return;
    this.render(entries, scope === 'me' ? 'VOCE AINDA NAO JOGOU' : 'NENHUMA PARTIDA AINDA');
  }

  private render(entries: readonly ScoreEntry[], emptyText: string): void {
    this.emptyLabel.setText(emptyText).setVisible(entries.length === 0);

    this.rows.forEach((row, index) => {
      const entry = entries[index];
      if (!entry) {
        row.setText('');
        return;
      }
      const position = `${index + 1}`.padStart(2, ' ');
      const name = entry.playerName.toUpperCase().padEnd(12, ' ').slice(0, 12);
      const flag = entry.completedGame ? '*' : ' ';
      row.setText(
        `${position} ${name} ${formatScore(entry.score)} F${entry.levelReached}${flag} ${formatDuration(entry.durationMs)}`,
      );
      // O asterisco marca quem terminou o jogo; o topo da tabela em ambar.
      row.setColor(toCss(index === 0 ? PALETTE.amber : PALETTE.phosphor));
    });
  }

  private zone(x: number, y: number, width: number, height: number, onTap: () => void): void {
    this.add
      .zone(x, y, width, height)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, onTap);
  }

  private label(
    x: number,
    y: number,
    text: string,
    size: number,
    color: number,
  ): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: `${size}px`,
        color: toCss(color),
      })
      .setOrigin(0.5);
  }
}
