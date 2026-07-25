/**
 * Resolucao logica fixa do jogo. Todo posicionamento no codigo usa estas
 * coordenadas — o Scale Manager cuida de encaixar isso na tela real.
 * Retrato 3:4, coerente com os gabinetes verticais do genero.
 */
export const LOGICAL_WIDTH = 480;
export const LOGICAL_HEIGHT = 640;

/** Centro da area logica, atalho usado em praticamente toda Scene. */
export const CENTER_X = LOGICAL_WIDTH / 2;
export const CENTER_Y = LOGICAL_HEIGHT / 2;

/** Fonte do HUD: monoespacada de sistema, estilizada para lembrar pixel font. */
export const HUD_FONT_FAMILY =
  '"Courier New", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
