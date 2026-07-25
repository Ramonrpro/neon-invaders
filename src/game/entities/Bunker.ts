import Phaser from 'phaser';
import { BUNKERS } from '@game/config/gameplay';
import { parseBitmap, type Bitmap } from '@game/core/bitmap';
import {
  carve,
  clearRect,
  createMask,
  findSolidInRect,
  isDestroyed,
  resetMask,
  type BunkerMask,
} from '@game/core/bunker';
import { BUNKER, BUNKER_CARVE, TEX, carveTextureKey } from '@game/gfx/sprites';

/** Brochas em bitmap, compartilhadas por todos os bunkers. Parseadas uma vez. */
const CARVE_BITMAPS: Bitmap[] = BUNKER_CARVE.map((source) => parseBitmap(source));
let bunkerBitmap: Bitmap | null = null;

function baseBitmap(): Bitmap {
  bunkerBitmap ??= parseBitmap(BUNKER);
  return bunkerBitmap;
}

/**
 * Um bunker destrutivel pixel a pixel.
 *
 * O visual e' um `RenderTexture` sobre o qual se chama `erase`; a colisao e'
 * uma `BunkerMask` de bytes. As duas se mantem identicas porque a escavacao
 * usa o mesmo desenho de brocha nos dois lados — ver `core/bunker.ts`.
 */
export class Bunker {
  private readonly rt: Phaser.GameObjects.RenderTexture;
  private readonly mask: BunkerMask;
  private readonly pixel = BUNKERS.pixelSize;

  /** Canto superior esquerdo em coordenadas logicas. */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;

  constructor(scene: Phaser.Scene, centerX: number, topY: number) {
    const bitmap = baseBitmap();
    this.mask = createMask(BUNKER);
    this.width = bitmap.width * this.pixel;
    this.height = bitmap.height * this.pixel;
    this.left = Math.round(centerX - this.width / 2);
    this.top = topY;

    this.rt = scene.add
      .renderTexture(this.left, this.top, this.width, this.height)
      .setOrigin(0, 0);
    this.repaint();
  }

  get right(): number {
    return this.left + this.width;
  }

  get bottom(): number {
    return this.top + this.height;
  }

  get destroyed(): boolean {
    return isDestroyed(this.mask);
  }

  /** Restaura o bunker inteiro. Chamado a cada nova fase, nunca a cada vida. */
  restore(): void {
    resetMask(this.mask, baseBitmap());
    this.repaint();
  }

  private repaint(): void {
    this.rt.clear();
    this.rt.draw(TEX.bunker, 0, 0);
  }

  /**
   * Testa um retangulo em coordenadas logicas contra os pixels intactos.
   * Retorna o ponto de impacto (tambem logico) ou `null` se passou no vazio.
   *
   * @param movingUp o projetil sobe? Decide de que borda do retangulo sai o
   *                 pixel atingido — ver `findSolidInRect`.
   */
  hitTest(
    left: number,
    top: number,
    right: number,
    bottom: number,
    movingUp: boolean,
  ): { x: number; y: number } | null {
    if (right < this.left || left > this.right) return null;
    if (bottom < this.top || top > this.bottom) return null;

    const cell = findSolidInRect(
      this.mask,
      (left - this.left) / this.pixel,
      (top - this.top) / this.pixel,
      (right - this.left) / this.pixel,
      (bottom - this.top) / this.pixel,
      movingUp,
    );
    if (!cell) return null;

    return {
      x: this.left + (cell.x + 0.5) * this.pixel,
      y: this.top + (cell.y + 0.5) * this.pixel,
    };
  }

  /**
   * Abre uma cratera centrada no ponto logico informado.
   * @param brushIndex qual variante de brocha usar (sorteada pelo chamador)
   */
  carveAt(worldX: number, worldY: number, brushIndex: number): void {
    const index = Math.abs(Math.trunc(brushIndex)) % CARVE_BITMAPS.length;
    const brush = CARVE_BITMAPS[index]!;

    const cx = (worldX - this.left) / this.pixel;
    const cy = (worldY - this.top) / this.pixel;
    const result = carve(this.mask, brush, cx, cy);
    if (result.removed === 0) return;

    // O `erase` usa a MESMA brocha, no mesmo lugar: o buraco que aparece e' o
    // buraco por onde o projetil passa a partir de agora.
    const brushWidth = brush.width * this.pixel;
    const brushHeight = brush.height * this.pixel;
    this.rt.erase(
      carveTextureKey(index),
      Math.round(cx) * this.pixel - brushWidth / 2,
      Math.round(cy) * this.pixel - brushHeight / 2,
    );
  }

  /**
   * Apaga a faixa do bunker invadida por um alien. Nao e' dano: e' a formacao
   * passando por cima e levando o escudo junto.
   *
   * @param alienBottom base logica do alien invasor
   */
  crushBelow(alienBottom: number): void {
    const overlap = alienBottom - this.top;
    if (overlap <= 0) return;

    const rows = Math.min(this.mask.height - 1, Math.ceil(overlap / this.pixel));
    const result = clearRect(this.mask, 0, 0, this.mask.width - 1, rows);
    if (result.removed === 0) return;

    // `erase` nao aceita retangulo, so' uma textura. O bloco borracha tem o
    // tamanho exato do bunker; posicionando o rodape dele na ultima linha a
    // apagar, tudo que fica acima some e o que esta' abaixo nao e' tocado (o
    // excedente sai fora dos limites do RenderTexture e e' descartado).
    this.rt.erase(TEX.bunkerEraser, 0, (rows + 1) * this.pixel - this.height);
  }

  destroy(): void {
    this.rt.destroy();
  }
}
