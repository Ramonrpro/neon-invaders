/**
 * Quanta tela o canvas ocupa, e onde acaba a area de jogo.
 *
 * A area de jogo e' 480x640 e nao muda — nenhum numero de balanceamento depende
 * do aparelho. O que passa a variar e' a altura do CANVAS: num celular retrato
 * ele cresce para baixo, e a faixa que sobra abaixo da acao (o "deck") existe
 * so' para o polegar arrastar sem cobrir a nave e os bunkers.
 *
 * Por que a faixa vive DENTRO do canvas: o Phaser so' recebe ponteiro no
 * proprio canvas. O letterbox do `Scale.FIT` e' area morta — arrastar ali nao
 * chega ao `InputSystem`, e era isso que forcava o dedo para cima da nave.
 *
 * A medida e' tirada uma vez, no boot. O jogo e' retrato e o manifest do PWA
 * trava a orientacao; girar o aparelho no navegador volta a produzir letterbox,
 * o que e' degradacao aceita e nao vale um listener de resize (que obrigaria
 * toda Scene, mais a textura do CRT, a se redesenhar).
 */

/** Dimensoes de referencia. Vem de `config/screen.ts` — aqui nada e' global. */
export interface ViewportSpec {
  /** Largura logica, sempre 480. */
  readonly playWidth: number;
  /** Altura da area de jogo, sempre 640. */
  readonly playHeight: number;
  /** Teto do deck. Acima disso a acao ficaria pequena demais na tela. */
  readonly maxDeck: number;
  /** Grao da arte, em pixels logicos. */
  readonly grainPx: number;
}

/**
 * Altura do canvas para uma janela de tamanho conhecido.
 *
 * Devolve `playHeight` (deck zero, comportamento identico ao de antes do deck)
 * quando a janela nao tem tamanho utilizavel: e' o caminho do Node — os testes
 * importam `config/screen.ts` sem DOM — e de qualquer aparelho que minta sobre
 * as proprias dimensoes.
 *
 * O resultado e' arredondado ao grao da arte de proposito. Com `autoRound: true`
 * uma altura impar faz a linha de bezel do deck oscilar entre 1 e 2 px conforme
 * o zoom que o Scale Manager escolher.
 */
export function resolveCanvasHeight(
  spec: ViewportSpec,
  windowWidth: number,
  windowHeight: number,
): number {
  if (!isUsable(windowWidth) || !isUsable(windowHeight)) return spec.playHeight;

  const raw = (spec.playWidth * windowHeight) / windowWidth;
  const snapped = Math.round(raw / spec.grainPx) * spec.grainPx;

  if (snapped < spec.playHeight) return spec.playHeight;
  const ceiling = spec.playHeight + spec.maxDeck;
  return snapped > ceiling ? ceiling : snapped;
}

function isUsable(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
