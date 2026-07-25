/**
 * BootScene.
 *
 * Gera todas as texturas a partir dos bitmaps declarados em codigo e entrega o
 * controle. Nao desenha nada: e' so' o ponto onde o pipeline
 * "bitmap em TS -> CanvasTexture" acontece, uma unica vez.
 *
 * Dois atalhos de desenvolvimento na URL, ambos inertes em producao:
 * `?sprites` abre a vitrine de arte, e `?boss` (ou `?boss=3`) cai direto na
 * luta contra a nave-mae, sem passar pela formacao nem pela tela de titulo.
 */

import Phaser from 'phaser';
import { registerGameTextures } from '@game/gfx/textureFactory';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    registerGameTextures(this);

    // O CRT sobe uma vez e nunca mais sai: ele e' o vidro do monitor, nao uma
    // camada de uma tela especifica. `launch` (e nao `start`) porque ele roda
    // EM PARALELO com qualquer Scene que estiver no ar.
    this.scene.launch('Crt');

    const params = new URLSearchParams(window.location.search);
    if (params.has('sprites')) {
      this.scene.start('SpriteShowcase');
      return;
    }

    // A GameScene le o numero da fase; aqui so' importa pular o titulo.
    const straightToBoss = import.meta.env.DEV && params.has('boss');
    this.scene.start(straightToBoss ? 'Game' : 'Title');
  }
}
