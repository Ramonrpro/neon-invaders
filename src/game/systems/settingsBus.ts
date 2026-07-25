/**
 * Barramento de preferencias.
 *
 * A tela de ajustes muda uma preferencia e o jogo inteiro precisa reagir na
 * hora: o vidro do CRT vive numa Scene, o audio e o auto-fire vivem em outra, e
 * a tela de ajustes nao tem — nem deve ter — referencia a nenhuma das duas.
 *
 * O evento vai em `game.events`, e nao em `scene.events`, porque os ouvintes
 * estao em Scenes DIFERENTES da que emite. E carrega o objeto inteiro de
 * preferencias em vez de um campo: quem escuta aplica o que lhe interessa e
 * ignora o resto, entao uma preferencia nova amanha nao adiciona um evento.
 */

import Phaser from 'phaser';
import type { GameSettings } from '@services/settings';

export const SETTINGS_EVENT = 'neon:settings';

export function emitSettings(game: Phaser.Game, settings: GameSettings): void {
  game.events.emit(SETTINGS_EVENT, settings);
}

/**
 * Escuta as mudancas enquanto a Scene viver.
 *
 * O `off` no shutdown nao e' opcional: `game.events` sobrevive a troca de
 * Scene, entao um handler esquecido continuaria rodando contra objetos ja'
 * destruidos — e a `GameScene` e' reaproveitada entre partidas, o que
 * acumularia um handler por partida.
 */
export function onSettings(
  scene: Phaser.Scene,
  handler: (settings: GameSettings) => void,
): void {
  scene.game.events.on(SETTINGS_EVENT, handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.game.events.off(SETTINGS_EVENT, handler);
  });
}
