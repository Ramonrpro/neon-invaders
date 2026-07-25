/**
 * Resolucao logica do jogo. Todo posicionamento no codigo usa estas
 * coordenadas — o Scale Manager cuida de encaixar isso na tela real.
 *
 * Duas alturas, e a diferenca entre elas importa:
 *
 * - `PLAY_HEIGHT` (640) e' a AREA DE JOGO. Retrato 3:4, coerente com os
 *   gabinetes verticais do genero. E' imutavel: HUD, formacao, bunkers, nave e
 *   linha de invasao vivem aqui e nao mudam de lugar por causa do aparelho.
 * - `CANVAS_HEIGHT` e' a TELA. Num celular retrato ela e' maior que a area de
 *   jogo, e a sobra — o deck — e' a faixa vazia onde o polegar arrasta sem
 *   cobrir a nave. Ver `core/viewport.ts` para o porque.
 *
 * Na duvida entre as duas: a acao usa `PLAY_HEIGHT`, o vidro do monitor e o
 * layout de menu usam `CANVAS_HEIGHT`.
 */
import { resolveCanvasHeight, type ViewportSpec } from '@game/core/viewport';

export const LOGICAL_WIDTH = 480;

/** Altura da area de jogo. Imutavel — nada aqui depende do aparelho. */
export const PLAY_HEIGHT = 640;

/**
 * Teto do deck.
 *
 * 224 = 7 celulas de formacao (32 px), e multiplo de 2/8/16 — deck e bezel caem
 * sempre no grao da arte. Com ele, `640 + 224 = 864` da' aspecto 1,80: telas ate
 * 16:9 ficam sem letterbox nenhum (um iPhone SE 375x667 encaixa exato em 854) e
 * um tablet 4:3 continua com deck zero, identico ao layout antigo. Em 19,5:9 o
 * calculo bate neste teto e a sobra vai para baixo do deck. Acima de ~230 a
 * textura do CRT comeca a pesar (480x864 RGBA ja' sao ~1,7 MB).
 */
export const DECK_MAX_HEIGHT = 224;

/** Grao da arte: `SPRITE_SCALE` e `BUNKERS.pixelSize` sao 2. */
export const DECK_GRAIN_PX = 2;

const VIEWPORT_SPEC: ViewportSpec = {
  playWidth: LOGICAL_WIDTH,
  playHeight: PLAY_HEIGHT,
  maxDeck: DECK_MAX_HEIGHT,
  grainPx: DECK_GRAIN_PX,
};

/**
 * Atalho de desenvolvimento: `?viewport=390x844` finge que a janela tem esse
 * tamanho, so' para o calculo da altura do canvas.
 *
 * Existe porque o ambiente de automacao de navegador NAO redimensiona a janela
 * (pendencia registrada no Milestone 4), e sem isso nao ha' como conferir o deck
 * de arrasto fora de um celular de verdade. Some do bundle de producao junto com
 * `import.meta.env.DEV`, como o `?boss` e o `?sprites`.
 */
function readDevViewport(): { width: number; height: number } | null {
  if (!import.meta.env.DEV) return null;

  const raw = new URLSearchParams(window.location.search).get('viewport');
  const match = raw === null ? null : /^(\d{2,5})x(\d{2,5})$/.exec(raw);
  if (!match) return null;

  return { width: Number(match[1]), height: Number(match[2]) };
}

/*
 * A guarda de `window` nao e' higiene, e' obrigatoria: este arquivo e' importado
 * por `config/gameplay.ts`, que os testes de formacao e de limites importam sob
 * Vitest em ambiente `node`. Sem ela a suite inteira morre com
 * `window is not defined` — ha' um caso em `tests/viewport.test.ts` travando
 * isso, para que remover a guarda quebre um teste em vez de todos.
 */
const view =
  typeof window === 'undefined'
    ? { width: 0, height: 0 }
    : (readDevViewport() ?? { width: window.innerWidth, height: window.innerHeight });

/** Altura do canvas, medida uma vez no boot. */
export const CANVAS_HEIGHT = resolveCanvasHeight(VIEWPORT_SPEC, view.width, view.height);

/** Faixa de arrasto abaixo da area de jogo. Zero no desktop. */
export const DECK_HEIGHT = CANVAS_HEIGHT - PLAY_HEIGHT;

/** Centro horizontal, atalho usado em praticamente toda Scene. */
export const CENTER_X = LOGICAL_WIDTH / 2;

/** Centro da AREA DE JOGO. Ancora do que pertence a' acao. */
export const PLAY_CENTER_Y = PLAY_HEIGHT / 2;

/**
 * Centro da TELA. Ancora de layout de menu.
 *
 * O deck so' e' controle durante a partida; fora dela o canvas e' uma superficie
 * so', e e' ela que o jogador ve como "a tela do aparelho". Um menu ancorado em
 * `PLAY_CENTER_Y` ficaria colado no topo, com o deck vazio sobrando embaixo.
 */
export const CANVAS_CENTER_Y = CANVAS_HEIGHT / 2;

/** Fonte do HUD: monoespacada de sistema, estilizada para lembrar pixel font. */
export const HUD_FONT_FAMILY =
  '"Courier New", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
