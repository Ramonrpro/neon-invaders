/**
 * Converte os bitmaps declarados em `sprites.ts` em texturas do Phaser.
 *
 * Zero assets externos: tudo e' pintado em um CanvasTexture no boot. O desenho
 * usa `fillRect` por pixel — custa alguns milissegundos uma unica vez e evita
 * qualquer download.
 */

import Phaser from 'phaser';
import { parseBitmap, type BitmapSource } from '@game/core/bitmap';
import { BUNKERS } from '@game/config/gameplay';
import { PARTICLES } from '@game/config/juice';
import { PALETTE, toCss } from '@game/config/palette';
import {
  ALIEN_A,
  ALIEN_B,
  ALIEN_C,
  BULLET_BOSS,
  BULLET_PLAYER,
  BULLET_ROLLING,
  BULLET_STRAIGHT,
  BULLET_WAVE,
  BUNKER,
  BUNKER_CARVE,
  EXPLOSION_ALIEN,
  EXPLOSION_PLAYER,
  ICON_MULTI,
  ICON_RAPID,
  MOTHERSHIP,
  MOTHERSHIP_CORE,
  PARTICLE,
  PLAYER,
  SPEAKER_OFF,
  SPEAKER_ON,
  SPLITTER,
  TEX,
  UFO,
  carveTextureKey,
} from '@game/gfx/sprites';

export interface TextureOptions {
  /** Fator inteiro de ampliacao do bitmap. Mantem os pixels quadrados. */
  scale?: number;
  /** Cor de preenchimento (0xRRGGBB). */
  color?: number;
}

/**
 * Cria (ou substitui) uma textura a partir de um bitmap.
 * Retorna as dimensoes finais em pixels de tela logica.
 */
export function createBitmapTexture(
  scene: Phaser.Scene,
  key: string,
  source: BitmapSource,
  options: TextureOptions = {},
): { width: number; height: number } {
  const scale = Math.max(1, Math.trunc(options.scale ?? 1));
  const color = options.color ?? PALETTE.phosphor;
  const bitmap = parseBitmap(source);

  const width = bitmap.width * scale;
  const height = bitmap.height * scale;

  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }

  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) {
    throw new Error(`createBitmapTexture: nao foi possivel criar a textura "${key}"`);
  }

  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = toCss(color);

  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      if (bitmap.pixels[y * bitmap.width + x] === 0) continue;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  texture.refresh();
  return { width, height };
}

/**
 * Escala padrao dos sprites. Com 2x, um alien ocupa ~5% da largura logica —
 * mesma proporcao dos gabinetes do genero, e sobra espaco lateral para a
 * formacao de 11 colunas marchar.
 */
export const SPRITE_SCALE = 2;

/**
 * A nave-mae usa escala propria. Com 3x ela ocupa 120 px logicos — um quarto da
 * largura da tela, grande o bastante para o jogador nunca duvidar de que aquilo
 * e' o chefao, e estreita o bastante para ainda haver por onde desviar.
 */
export const BOSS_SCALE = 3;

/**
 * Registra todas as texturas do jogo. Chamado uma unica vez, no BootScene.
 * As cores seguem a faixa de tela onde cada elemento costuma aparecer.
 */
export function registerGameTextures(scene: Phaser.Scene): void {
  const s = SPRITE_SCALE;

  createBitmapTexture(scene, TEX.alienA0, ALIEN_A[0], { scale: s, color: PALETTE.phosphor });
  createBitmapTexture(scene, TEX.alienA1, ALIEN_A[1], { scale: s, color: PALETTE.phosphor });
  createBitmapTexture(scene, TEX.alienB0, ALIEN_B[0], { scale: s, color: PALETTE.phosphor });
  createBitmapTexture(scene, TEX.alienB1, ALIEN_B[1], { scale: s, color: PALETTE.phosphor });
  createBitmapTexture(scene, TEX.alienC0, ALIEN_C[0], { scale: s, color: PALETTE.phosphor });
  createBitmapTexture(scene, TEX.alienC1, ALIEN_C[1], { scale: s, color: PALETTE.phosphor });

  // Splitter em magenta: ele sai da grade e se move livre, entao quebra o
  // monocromatico da faixa do meio para o jogador nao perde-lo de vista.
  createBitmapTexture(scene, TEX.splitter, SPLITTER, { scale: s, color: PALETTE.magenta });

  createBitmapTexture(scene, TEX.player, PLAYER, { scale: s, color: PALETTE.amber });
  createBitmapTexture(scene, TEX.ufo, UFO, { scale: s, color: PALETTE.cyan });

  createBitmapTexture(scene, TEX.bulletPlayer, BULLET_PLAYER, { scale: 2, color: PALETTE.white });
  createBitmapTexture(scene, TEX.bulletStraight, BULLET_STRAIGHT, { scale: 2, color: PALETTE.white });
  createBitmapTexture(scene, TEX.bulletWave, BULLET_WAVE, { scale: 2, color: PALETTE.cyan });
  createBitmapTexture(scene, TEX.bulletRolling, BULLET_ROLLING, { scale: 2, color: PALETTE.magenta });
  createBitmapTexture(scene, TEX.bulletBoss, BULLET_BOSS, { scale: 2, color: PALETTE.violet });

  // O bunker vive na faixa verde da tela e usa a escala propria dele: e' o
  // tamanho de um pixel do bitmap que define o grao da destruicao.
  const bunkerPixel = BUNKERS.pixelSize;
  createBitmapTexture(scene, TEX.bunker, BUNKER, { scale: bunkerPixel, color: PALETTE.phosphor });
  createBitmapTexture(scene, TEX.bunkerEraser, solidBitmap(BUNKER), {
    scale: bunkerPixel,
    color: PALETTE.white,
  });
  BUNKER_CARVE.forEach((brush, index) => {
    createBitmapTexture(scene, carveTextureKey(index), brush, {
      scale: bunkerPixel,
      color: PALETTE.white,
    });
  });

  // Estilhaco: branco de proposito. Quem da' a cor e' o tint da instancia.
  createBitmapTexture(scene, TEX.particle, PARTICLE, {
    scale: PARTICLES.sizePx,
    color: PALETTE.white,
  });

  createBitmapTexture(scene, TEX.explosionAlien, EXPLOSION_ALIEN, { scale: s, color: PALETTE.white });
  createBitmapTexture(scene, TEX.explosionPlayer, EXPLOSION_PLAYER, { scale: s, color: PALETTE.amber });

  createBitmapTexture(scene, TEX.speakerOn, SPEAKER_ON, { scale: 2, color: PALETTE.cyan });
  createBitmapTexture(scene, TEX.speakerOff, SPEAKER_OFF, { scale: 2, color: PALETTE.magenta });

  createBitmapTexture(scene, TEX.iconRapid, ICON_RAPID, { scale: 2, color: PALETTE.magenta });
  createBitmapTexture(scene, TEX.iconMulti, ICON_MULTI, { scale: 2, color: PALETTE.violet });

  // O chefao quebra o monocromatico de proposito: casco violeta, nucleo
  // vermelho. E' a unica coisa em tela com essas duas cores juntas.
  createBitmapTexture(scene, TEX.mothership, MOTHERSHIP, {
    scale: BOSS_SCALE,
    color: PALETTE.violet,
  });
  createBitmapTexture(scene, TEX.mothershipCore, MOTHERSHIP_CORE, {
    scale: BOSS_SCALE,
    color: PALETTE.red,
  });
}

/**
 * Retangulo cheio com as mesmas dimensoes do bitmap informado.
 * A cor nao importa — a textura resultante so' e' usada como borracha em
 * `RenderTexture.erase`, onde vale apenas o canal alfa.
 */
function solidBitmap(reference: BitmapSource): BitmapSource {
  const width = reference[0]?.length ?? 0;
  return reference.map(() => '#'.repeat(width));
}
