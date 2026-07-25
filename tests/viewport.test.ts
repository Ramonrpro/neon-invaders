import { describe, expect, it } from 'vitest';
import { resolveCanvasHeight, type ViewportSpec } from '@game/core/viewport';
import {
  CANVAS_HEIGHT,
  DECK_HEIGHT,
  DECK_MAX_HEIGHT,
  PLAY_CENTER_Y,
  PLAY_HEIGHT,
} from '@game/config/screen';

const SPEC: ViewportSpec = {
  playWidth: 480,
  playHeight: 640,
  maxDeck: 224,
  grainPx: 2,
};

const CEILING = SPEC.playHeight + SPEC.maxDeck;

describe('resolveCanvasHeight', () => {
  it('tela larga nao ganha deck — o desktop fica como sempre foi', () => {
    expect(resolveCanvasHeight(SPEC, 1920, 1080)).toBe(640);
    expect(resolveCanvasHeight(SPEC, 800, 800)).toBe(640);
  });

  it('tablet 4:3 encaixa exato na area de jogo, sem deck', () => {
    // 480 * 1024/768 = 640. E' o aspecto para o qual o jogo foi desenhado.
    expect(resolveCanvasHeight(SPEC, 768, 1024)).toBe(640);
  });

  it('celular 16:9 preenche a tela e o deck sai da sobra', () => {
    // iPhone SE: 480 * 667/375 = 853,76 -> 854 no grao de 2.
    expect(resolveCanvasHeight(SPEC, 375, 667)).toBe(854);
  });

  it('celular muito alongado bate no teto do deck', () => {
    // 19,5:9 daria 1039; o teto impede que a acao encolha na tela.
    expect(resolveCanvasHeight(SPEC, 390, 844)).toBe(CEILING);
    expect(resolveCanvasHeight(SPEC, 300, 1200)).toBe(CEILING);
  });

  it('janela sem tamanho utilizavel cai na area de jogo', () => {
    // O caminho do Node e de qualquer aparelho que minta sobre as dimensoes.
    for (const bogus of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolveCanvasHeight(SPEC, bogus, 800)).toBe(640);
      expect(resolveCanvasHeight(SPEC, 400, bogus)).toBe(640);
    }
  });

  it('o resultado e sempre inteiro, no grao da arte e dentro dos limites', () => {
    for (let width = 240; width <= 1600; width += 7) {
      for (let height = 320; height <= 2400; height += 53) {
        const result = resolveCanvasHeight(SPEC, width, height);
        expect(Number.isInteger(result)).toBe(true);
        expect(result % SPEC.grainPx).toBe(0);
        expect(result).toBeGreaterThanOrEqual(SPEC.playHeight);
        expect(result).toBeLessThanOrEqual(CEILING);
      }
    }
  });
});

describe('config/screen sob Vitest', () => {
  it('sem DOM o canvas e a area de jogo, e nao explode', () => {
    // Este caso existe para que remover a guarda de `window` em `screen.ts`
    // quebre UM teste — sem ela, todo teste que importe `config/gameplay`
    // (formacao, limites de run) morre com `window is not defined`.
    expect(CANVAS_HEIGHT).toBe(PLAY_HEIGHT);
    expect(DECK_HEIGHT).toBe(0);
    expect(PLAY_CENTER_Y).toBe(320);
  });

  it('o teto do deck e multiplo do grao e de uma celula de formacao', () => {
    expect(DECK_MAX_HEIGHT % 2).toBe(0);
    expect(DECK_MAX_HEIGHT % 32).toBe(0);
  });
});
