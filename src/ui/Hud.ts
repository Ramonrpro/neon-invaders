import Phaser from 'phaser';
import { formatScore } from '@game/core/scoring';
import { PALETTE, toCss } from '@game/config/palette';
import { POWERUP_REGISTRY, type PowerUpId } from '@game/config/powerups';
import { HUD_FONT_FAMILY, LOGICAL_WIDTH } from '@game/config/screen';
import { TEX } from '@game/gfx/sprites';

/**
 * HUD do jogo: pontuacao, vidas e fase.
 *
 * DECISAO: o HUD de combate e' desenhado DENTRO do canvas, em coordenadas
 * logicas, e nao em DOM sobreposto. Assim ele escala junto com o jogo sem
 * nenhuma sincronizacao com o Scale Manager e mantem o mesmo pixel look.
 * `src/ui/` segue sendo a casa dos overlays de DOM (menus, settings, ranking),
 * onde formularios e acessibilidade compensam sair do canvas.
 */
/**
 * Alvo de toque do botao de mudo, em px logicos. Bem maior que o icone de
 * 22x18 — as recomendacoes de acessibilidade para toque pedem ~44 px, e aqui
 * isso vale em dobro porque errar o botao no meio de uma onda custa uma vida.
 */
const MUTE_HIT_WIDTH = 48;
const MUTE_HIT_HEIGHT = 44;

/**
 * Indicadores de power-up: mesma linha do botao de mudo, a direita dele.
 * Um chip por entrada do registry, criado no construtor e apenas escondido
 * enquanto o nivel for zero — assim um tipo novo aparece no HUD sem tocar aqui.
 */
const POWERUP_ROW_Y = 46;
const POWERUP_FIRST_X = 76;
const POWERUP_CHIP_WIDTH = 62;
/** Folga entre o icone e o numero do nivel. */
const POWERUP_LABEL_GAP = 13;

/** Um chip do HUD: o icone do power-up e o nivel atual. */
interface PowerUpChip {
  readonly id: PowerUpId;
  readonly icon: Phaser.GameObjects.Image;
  readonly text: Phaser.GameObjects.Text;
}

export class Hud {
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly livesLabel: Phaser.GameObjects.Text;
  private readonly muteButton: Phaser.GameObjects.Image;
  private readonly muteZone: Phaser.GameObjects.Zone;
  private readonly lifeIcons: Phaser.GameObjects.Image[] = [];
  private readonly powerUpChips: PowerUpChip[] = [];

  /** Ligado pela Scene: o HUD avisa o toque, quem silencia e' o AudioSystem. */
  onMuteTapped: (() => void) | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    maxLifeIcons: number,
  ) {
    this.scoreText = scene.add
      .text(14, 14, '', {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '16px',
        color: toCss(PALETTE.cyan),
      })
      .setOrigin(0, 0);

    this.levelText = scene.add
      .text(LOGICAL_WIDTH / 2, 14, '', {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '16px',
        color: toCss(PALETTE.cyan),
      })
      .setOrigin(0.5, 0);

    this.livesLabel = scene.add
      .text(LOGICAL_WIDTH - 14, 14, 'VIDAS', {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '16px',
        color: toCss(PALETTE.cyan),
      })
      .setOrigin(1, 0);

    // Botao de mudo. No toque e' a unica forma de silenciar (nao ha' tecla M),
    // entao fica sempre visivel.
    this.muteButton = scene.add.image(20, 46, TEX.speakerOn).setOrigin(0, 0.5);

    /*
     * O alvo de toque e' uma Zone separada, bem maior que o desenho — polegar
     * nao tem a precisao de um cursor.
     *
     * Precisa ser uma Zone, e nao `muteButton.setInteractive()`: trocar a
     * textura do icone (que e' exatamente o que este botao faz) reinicia a
     * hitArea padrao para o tamanho do novo frame. O alvo encolheria de volta
     * no primeiro toque, e so' no aparelho de quem estivesse jogando no dedo.
     */
    this.muteZone = scene.add
      .zone(20 + MUTE_HIT_WIDTH / 2 - 10, 46, MUTE_HIT_WIDTH, MUTE_HIT_HEIGHT)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.muteZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.onMuteTapped?.();
    });

    // Icones de vida criados uma vez; sobra e' escondida, nunca destruida.
    for (let i = 0; i < maxLifeIcons; i++) {
      const icon = scene.add
        .image(LOGICAL_WIDTH - 20 - i * 30, 44, TEX.player)
        .setOrigin(1, 0.5)
        .setScale(0.6);
      this.lifeIcons.push(icon);
    }

    POWERUP_REGISTRY.forEach((definition, index) => {
      const x = POWERUP_FIRST_X + index * POWERUP_CHIP_WIDTH;
      const icon = scene.add
        .image(x, POWERUP_ROW_Y, definition.texture)
        .setOrigin(0, 0.5)
        .setVisible(false);
      const text = scene.add
        .text(x + icon.displayWidth + POWERUP_LABEL_GAP, POWERUP_ROW_Y, '', {
          fontFamily: HUD_FONT_FAMILY,
          fontSize: '14px',
          color: toCss(definition.color),
        })
        .setOrigin(0.5)
        .setVisible(false);
      this.powerUpChips.push({ id: definition.id, icon, text });
    });
  }

  setScore(score: number): void {
    this.scoreText.setText(`SCORE ${formatScore(score)}`);
  }

  setLevel(level: number): void {
    this.levelText.setText(`FASE ${level}`);
  }

  setLives(lives: number): void {
    // A vida em uso nao aparece como icone — igual ao arcade: os icones sao as
    // naves de reserva.
    const reserves = Math.max(0, lives - 1);
    this.lifeIcons.forEach((icon, index) => icon.setVisible(index < reserves));
    this.livesLabel.setText(reserves > 0 ? 'VIDAS' : '');
  }

  setMuted(muted: boolean): void {
    this.muteButton.setTexture(muted ? TEX.speakerOff : TEX.speakerOn);
  }

  /**
   * Niveis de power-up. Um chip so' aparece depois da primeira coleta do tipo:
   * antes disso ele nao existe para o jogador e ocuparia espaco a toa.
   */
  setPowerUpLevels(levels: Readonly<Record<PowerUpId, number>>): void {
    for (const chip of this.powerUpChips) {
      const level = levels[chip.id] ?? 0;
      const visible = level > 0;
      chip.icon.setVisible(visible);
      chip.text.setVisible(visible);
      if (visible) chip.text.setText(`x${level}`);
    }
  }

  /** Mantem o HUD acima de tudo depois que a Scene cria novos objetos. */
  bringToTop(): void {
    this.scene.children.bringToTop(this.scoreText);
    this.scene.children.bringToTop(this.levelText);
    this.scene.children.bringToTop(this.livesLabel);
    this.scene.children.bringToTop(this.muteButton);
    this.scene.children.bringToTop(this.muteZone);
    for (const icon of this.lifeIcons) this.scene.children.bringToTop(icon);
    for (const chip of this.powerUpChips) {
      this.scene.children.bringToTop(chip.icon);
      this.scene.children.bringToTop(chip.text);
    }
  }
}
