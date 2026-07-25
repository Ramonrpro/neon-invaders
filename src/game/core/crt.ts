/**
 * Regras do efeito CRT que nao dependem do Phaser.
 *
 * O toggle tem tres estados, nao dois: ligado, desligado e `'auto'`. O terceiro
 * existe porque a preferencia certa depende do aparelho — num monitor de mesa o
 * banho de fosforo e' o visual pretendido, e num celular ele come brilho de uma
 * tela que ja' esta' brigando com o sol e ainda cobra uma camada de tela cheia
 * por frame do GPU. `'auto'` e' o que o jogador tem antes de opinar; assim que
 * ele mexe no toggle, a escolha dele passa a valer nos dois aparelhos.
 */

/** Preferencia armazenada. `'auto'` = ainda nao decidida pelo jogador. */
export type CrtPreference = boolean | 'auto';

/**
 * Resolve a preferencia no estado real do efeito.
 *
 * @param touchDevice o jogador esta' no dedo (ver `systems/device.ts`)
 */
export function resolveCrtEnabled(preference: CrtPreference, touchDevice: boolean): boolean {
  if (preference !== 'auto') return preference;
  return !touchDevice;
}

/**
 * Proximo estado ao tocar no toggle.
 *
 * Sair de `'auto'` sempre INVERTE o que o jogador esta' vendo — nunca repete o
 * estado atual. Um toggle que aparenta nao fazer nada no primeiro toque e' lido
 * como botao quebrado.
 */
export function nextCrtPreference(preference: CrtPreference, touchDevice: boolean): boolean {
  return !resolveCrtEnabled(preference, touchDevice);
}
