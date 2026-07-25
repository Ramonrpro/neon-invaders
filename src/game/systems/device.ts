/**
 * Deteccao de forma de jogar.
 *
 * "Touch" e "keyboard" nao sao categorias de aparelho, sao categorias de
 * momento: um tablet com teclado acoplado e' os dois, e um laptop com tela
 * sensivel tambem. Por isso o palpite inicial vem do `matchMedia`, mas quem
 * manda no fim e' o ultimo gesto que o jogador realmente fez — e' o unico
 * sinal que nunca erra.
 */

export type InputMode = 'touch' | 'keyboard';

/**
 * Palpite inicial, antes do primeiro gesto.
 * `pointer: coarse` e' o sinal mais confiavel: pergunta pela precisao do
 * apontador, nao pelo user agent.
 */
export function guessInputMode(): InputMode {
  const coarse =
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(pointer: coarse)').matches;
  const hasTouchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  return coarse || hasTouchPoints ? 'touch' : 'keyboard';
}
