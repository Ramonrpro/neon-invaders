import Phaser from 'phaser';
import { PALETTE, toCss } from '@game/config/palette';
import { HUD_FONT_FAMILY, LOGICAL_WIDTH } from '@game/config/screen';

/**
 * Barra de HP do chefao, no topo da tela.
 *
 * Desenhada com `Rectangle`, nao com `Graphics`: sao dois retangulos que so'
 * mudam de largura, e redesenhar um path a cada frame para isso seria trabalho
 * a toa no game loop.
 *
 * Como o resto do HUD de combate, vive DENTRO do canvas em coordenadas logicas
 * — escala junto com o jogo sem nenhuma sincronizacao com o Scale Manager.
 */
const BAR_WIDTH = 300;
const BAR_HEIGHT = 10;
const BAR_Y = 78;
const BORDER = 2;

export class BossBar {
  private readonly frame: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {
    const left = (LOGICAL_WIDTH - BAR_WIDTH) / 2;

    this.frame = scene.add
      .rectangle(left - BORDER, BAR_Y - BORDER, BAR_WIDTH + BORDER * 2, BAR_HEIGHT + BORDER * 2)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PALETTE.violet)
      .setFillStyle(PALETTE.black, 0.6);

    this.fill = scene.add
      .rectangle(left, BAR_Y, BAR_WIDTH, BAR_HEIGHT, PALETTE.violet)
      .setOrigin(0, 0);

    this.label = scene.add
      .text(LOGICAL_WIDTH / 2, BAR_Y - 14, 'NAVE-MAE', {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '13px',
        color: toCss(PALETTE.violet),
      })
      .setOrigin(0.5, 1);

    this.setVisible(false);
  }

  setVisible(visible: boolean): void {
    this.frame.setVisible(visible);
    this.fill.setVisible(visible);
    this.label.setVisible(visible);
  }

  /**
   * @param fraction 0..1 de HP restante
   * @param enraged abaixo de 50% a barra vira vermelha — o jogador precisa ver
   *   a mudanca de padrao, nao so' ouvir
   */
  setHp(fraction: number, enraged: boolean): void {
    const clamped = Math.min(Math.max(fraction, 0), 1);
    // Largura zero deixa o Rectangle com tamanho indefinido em alguns builds;
    // esconder e' mais previsivel do que desenhar um retangulo de 0 px.
    this.fill.setVisible(clamped > 0);
    this.fill.width = BAR_WIDTH * clamped;

    const color = enraged ? PALETTE.red : PALETTE.violet;
    this.fill.setFillStyle(color);
    this.frame.setStrokeStyle(1, color);
    this.label.setColor(toCss(color));
  }

  bringToTop(): void {
    this.scene.children.bringToTop(this.frame);
    this.scene.children.bringToTop(this.fill);
    this.scene.children.bringToTop(this.label);
  }
}
