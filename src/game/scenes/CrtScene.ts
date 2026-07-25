/**
 * Efeito CRT — scanlines, vinheta e banho de fosforo.
 *
 * E' uma Scene propria, sempre no topo da pilha, e nunca para. As alternativas
 * foram descartadas por motivos concretos:
 *
 * - **Overlay em DOM sobre o canvas**: teria de acompanhar a mao o retangulo
 *   que o Scale Manager escolhe a cada resize, e erraria em todo letterbox.
 *   Aqui o efeito vive em coordenadas logicas e escala junto com o jogo, de
 *   graca.
 * - **Uma camada dentro de cada Scene**: seriam sete copias para manter em dia,
 *   e a `GameScene` faz `bringToTop` do HUD toda troca de fase — a camada teria
 *   de ser reordenada junto, sempre.
 *
 * O shake da camera tambem entra nessa conta: a `GameScene` sacode a camera
 * DELA, e o vidro do monitor nao sacode junto. E' o comportamento certo, e sai
 * de graca por o efeito estar em outra Scene.
 *
 * Nao ha' glow por shader. Um bloom de verdade exige WebGL garantido (o jogo
 * roda em `Phaser.AUTO` e pode cair no renderer de canvas) e custa uma passada
 * de tela cheia por frame no celular. O que ha' e' uma camada aditiva de verde
 * muito fraca: nao borra os sprites, mas levanta o preto para o cinza-
 * esverdeado de um tubo ligado — que e' 90% do que o olho le' como "CRT".
 */

import Phaser from 'phaser';
import { CRT } from '@game/config/juice';
import { PALETTE } from '@game/config/palette';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '@game/config/screen';
import { resolveCrtEnabled, type CrtPreference } from '@game/core/crt';
import { CRT_TEXTURE, ensureCrtTexture } from '@game/gfx/crt';
import { guessInputMode } from '@game/systems/device';
import { onSettings } from '@game/systems/settingsBus';
import { getServices } from '@services/index';

export class CrtScene extends Phaser.Scene {
  private overlay: Phaser.GameObjects.Image | null = null;
  private glow: Phaser.GameObjects.Rectangle | null = null;
  private enabled = false;

  constructor() {
    super('Crt');
  }

  create(): void {
    this.scene.bringToTop();

    /*
     * A Scene fica por cima de tudo, entao ela NAO pode participar do input:
     * sem isto, o proximo GameObject interativo que alguem criar aqui roubaria
     * o toque do botao que estiver embaixo. Ela nao tem nenhum hoje — a
     * desativacao e' para continuar assim amanha.
     */
    this.input.enabled = false;

    onSettings(this, (settings) => this.apply(settings.crt));
    void this.loadPreference();
  }

  private async loadPreference(): Promise<void> {
    const stored = await getServices().settings.load();
    if (!this.scene.isActive()) return;
    this.apply(stored.crt);
  }

  /** Resolve a preferencia (inclusive `'auto'`) e liga ou desliga o efeito. */
  private apply(preference: CrtPreference): void {
    const touchDevice = guessInputMode() === 'touch';
    this.setEnabled(resolveCrtEnabled(preference, touchDevice));
  }

  private setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) this.build();
    this.overlay?.setVisible(enabled);
    this.glow?.setVisible(enabled);
  }

  /** Cria as camadas na primeira vez que o efeito liga. */
  private build(): void {
    if (this.overlay) return;
    ensureCrtTexture(this);

    this.glow = this.add
      .rectangle(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, PALETTE.phosphor)
      .setOrigin(0, 0)
      .setAlpha(CRT.glowAlpha)
      .setBlendMode(Phaser.BlendModes.ADD);

    // Scanlines e vinheta POR CIMA do banho de fosforo: o vidro escurece o
    // brilho do tubo, nao o contrario.
    this.overlay = this.add.image(0, 0, CRT_TEXTURE).setOrigin(0, 0);
  }

  update(time: number): void {
    if (!this.enabled || !this.glow) return;

    // Respiro do tubo. Uma senoide sobre o alfa do banho de fosforo, com
    // amplitude pequena o bastante para so' ser notada quando desligada — a
    // cintilacao de um CRT de verdade nunca chama atencao para si.
    const phase = Math.sin((time / CRT.flickerPeriodMs) * Math.PI * 2);
    this.glow.setAlpha(CRT.glowAlpha * (1 + CRT.flickerAmplitude * phase));
  }
}
