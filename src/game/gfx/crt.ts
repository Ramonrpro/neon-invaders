/**
 * Textura do efeito CRT — scanlines e vinheta, pintadas uma unica vez.
 *
 * As duas moram na MESMA textura de tela cheia. Separa-las nao daria controle
 * nenhum a mais (as duas ligam e desligam juntas) e custaria o dobro de memoria
 * de textura: 480x640 em RGBA sao ~1,2 MB por camada.
 *
 * A textura tambem nao nasce no boot como as outras: ela e' criada na primeira
 * vez que o efeito liga. Quem joga no celular com o CRT desligado nunca paga
 * por ela.
 */

import type Phaser from 'phaser';
import { CRT } from '@game/config/juice';
import { CENTER_X, CENTER_Y, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '@game/config/screen';

export const CRT_TEXTURE = 'crt-overlay';

/** Cria a textura do overlay se ela ainda nao existir. Idempotente. */
export function ensureCrtTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(CRT_TEXTURE)) return;

  const texture = scene.textures.createCanvas(CRT_TEXTURE, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  if (!texture) return;

  const ctx = texture.getContext();
  ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  // Scanlines: uma linha escura a cada periodo. A linha tem 1 px logico, nao
  // metade do periodo — em pixel art de grao 2, apagar duas linhas de cada tres
  // comeria os sprites finos (o projetil do jogador tem 2 px de largura).
  ctx.fillStyle = `rgba(0, 0, 0, ${CRT.scanlineAlpha})`;
  for (let y = 0; y < LOGICAL_HEIGHT; y += CRT.scanlinePeriodPx) {
    ctx.fillRect(0, y, LOGICAL_WIDTH, 1);
  }

  // Vinheta: o centro fica limpo ate' cerca de um terco do raio, e o
  // escurecimento so' acontece nas bordas — e' o formato do tubo, nao um
  // filtro sobre a imagem inteira.
  const outerRadius = Math.hypot(CENTER_X, CENTER_Y);
  const gradient = ctx.createRadialGradient(
    CENTER_X,
    CENTER_Y,
    outerRadius * 0.35,
    CENTER_X,
    CENTER_Y,
    outerRadius,
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, `rgba(0, 0, 0, ${CRT.vignetteAlpha})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  texture.refresh();
}
