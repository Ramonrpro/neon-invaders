/**
 * Arte original do NEON INVADERS, declarada em codigo.
 *
 * Nada aqui e' copiado de nenhum jogo existente: sao desenhos proprios, apenas
 * inspirados na linguagem visual do genero (silhuetas legiveis em baixa
 * resolucao, dois frames por criatura para criar a marcha).
 *
 * `#` = pixel aceso, `.` = transparente.
 */

import type { BitmapSource } from '@game/core/bitmap';

/** Tipo A — 2 linhas de baixo da formacao, 10 pts. "Drone". */
export const ALIEN_A: readonly [BitmapSource, BitmapSource] = [
  [
    '..#....#..',
    '...#..#...',
    '..######..',
    '.##.##.##.',
    '##########',
    '#.######.#',
    '#.#....#.#',
    '..##..##..',
  ],
  [
    '..#....#..',
    '#..#..#..#',
    '#.######.#',
    '###.##.###',
    '##########',
    '..######..',
    '.#.#..#.#.',
    '#.#....#.#',
  ],
];

/** Tipo B — 2 linhas do meio, 20 pts. "Sentinela menor". */
export const ALIEN_B: readonly [BitmapSource, BitmapSource] = [
  [
    '....###....',
    '..#######..',
    '.##.###.##.',
    '###########',
    '#.#######.#',
    '#.#.....#.#',
    '...##.##...',
    '..##...##..',
  ],
  [
    '....###....',
    '..#######..',
    '.##.###.##.',
    '###########',
    '#.#######.#',
    '..#.....#..',
    '.#.##.##.#.',
    '#..#...#..#',
  ],
];

/** Tipo C — linha de cima, 30 pts. "Espectro". */
export const ALIEN_C: readonly [BitmapSource, BitmapSource] = [
  [
    '.....##.....',
    '....####....',
    '...######...',
    '..##.##.##..',
    '.##########.',
    '..#.####.#..',
    '.#........#.',
    '..##....##..',
  ],
  [
    '.....##.....',
    '....####....',
    '...######...',
    '..##.##.##..',
    '.##########.',
    '.#..####..#.',
    '#...#..#...#',
    '.#.#....#.#.',
  ],
];

/**
 * Splitter — o filhote que sai de um alien tipo B partido, e o minion invocado
 * pela nave-mae. Menor que qualquer alien da formacao (8x6 contra 11x8), com a
 * silhueta do tipo B encolhida: o jogador reconhece de onde ele veio.
 */
export const SPLITTER: BitmapSource = [
  '..####..',
  '.######.',
  '##.##.##',
  '########',
  '.#.##.#.',
  '#.#..#.#',
];

/** Nave do jogador. */
export const PLAYER: BitmapSource = [
  '.......#.......',
  '......###......',
  '......###......',
  '..###########..',
  '.#############.',
  '###############',
  '###.#######.###',
  '##...#####...##',
];

/** UFO / nave misteriosa. */
export const UFO: BitmapSource = [
  '....########....',
  '..############..',
  '.####..##..####.',
  '################',
  '..##..####..##..',
  '....##....##....',
];

/** Projetil do jogador. */
export const BULLET_PLAYER: BitmapSource = ['##', '##', '##', '##', '##', '##'];

/** Projetil inimigo reto — o mais rapido, silhueta de dardo. */
export const BULLET_STRAIGHT: BitmapSource = ['.#.', '###', '.#.', '.#.', '.#.', '.#.'];

/** Projetil inimigo ondulado — zigue-zague ja' embutido no desenho. */
export const BULLET_WAVE: BitmapSource = ['.#.', '##.', '.#.', '.##', '.#.', '##.'];

/** Projetil inimigo "rolling" — o que persegue a coluna do jogador. */
export const BULLET_ROLLING: BitmapSource = ['#.#', '.#.', '#.#', '.#.', '#.#', '.#.'];

/**
 * Projetil do chefao — mais encorpado que os da formacao. Num leque de cinco
 * vindo de cima, o jogador precisa distinguir de relance o que e' do chefao.
 */
export const BULLET_BOSS: BitmapSource = ['.##.', '####', '####', '####', '####', '.##.'];

/**
 * Bunker. 30x18 no bitmap; com `BUNKER_PIXEL` de 2 vira 60x36 na tela logica.
 * Essa resolucao e' o que define o "grao" da destruicao pixel a pixel.
 */
export const BUNKER: BitmapSource = [
  '.......################.......',
  '.....####################.....',
  '...########################...',
  '..##########################..',
  '.############################.',
  '##############################',
  '##############################',
  '##############################',
  '##############################',
  '##############################',
  '##############################',
  '##############################',
  '#############....#############',
  '############......############',
  '###########........###########',
  '##########..........##########',
  '#########............#########',
  '########..............########',
];

/**
 * Brochas de escavacao do bunker.
 *
 * Circulos deliberadamente tortos: o mesmo bitmap apaga os pixels da mascara de
 * colisao E da textura visivel, entao o buraco que se ve e' exatamente o buraco
 * por onde o tiro passa. Sortear entre variantes evita crateras clonadas.
 */
export const BUNKER_CARVE: readonly BitmapSource[] = [
  ['..###..', '.#####.', '#######', '#######', '#######', '.#####.', '..##...'],
  ['.###...', '#####..', '#######', '#######', '.######', '..####.', '...##..'],
  ['..##...', '.#####.', '#######', '.######', '#######', '.####..', '..###..'],
];

/** Explosao de alien — flash unico, some rapido. */
export const EXPLOSION_ALIEN: BitmapSource = [
  '#..#.....#..',
  '.#..#.#.#...',
  '..#.###.#..#',
  '#..#####...#',
  '..#######.#.',
  '#..#####..#.',
  '.#.#.#.#.#..',
  '#...#...#..#',
];

/** Destrocos da nave do jogador. */
export const EXPLOSION_PLAYER: BitmapSource = [
  '#....#...#....#',
  '.#..#.#.#..#.#.',
  '..##..#..#..##.',
  '#.#.#####.#.#.#',
  '.###.###.###.#.',
  '#.#.#.#.#.#.#.#',
  '##..#..#..#..##',
  '#.#..#...#..#.#',
];

/** Botao de som ligado — alto-falante com ondas. */
export const SPEAKER_ON: BitmapSource = [
  '....##.....',
  '...###..#..',
  '..####.#.#.',
  '######.#..#',
  '######.#..#',
  '######.#..#',
  '..####.#.#.',
  '...###..#..',
  '....##.....',
];

/** Botao de som desligado — o mesmo alto-falante com um X no lugar das ondas. */
export const SPEAKER_OFF: BitmapSource = [
  '....##.....',
  '...###.....',
  '..####.#.#.',
  '######..#..',
  '######.#.#.',
  '######.....',
  '..####.....',
  '...###.....',
  '....##.....',
];

/** Icone do power-up RAPID (cadencia de tiro). */
export const ICON_RAPID: BitmapSource = [
  '....#....',
  '...###...',
  '..##.##..',
  '.##...##.',
  '....#....',
  '...###...',
  '..##.##..',
  '.##...##.',
  '#.......#',
];

/** Icone do power-up MULTI (multiplos tiros). */
export const ICON_MULTI: BitmapSource = [
  '#...#...#',
  '#...#...#',
  '##.###.##',
  '.#.###.#.',
  '.#.###.#.',
  '..#.#.#..',
  '..#.#.#..',
  '...###...',
  '....#....',
];

/**
 * Nave-mae — o chefao de fim de fase. 40x13 no bitmap; com `BOSS_SCALE` de 3
 * vira 120x39 na tela logica, um quarto da largura da tela.
 *
 * O casco e' macico em cima e se abre numa cavidade central embaixo: e' ali que
 * o nucleo (o ponto fraco) fica exposto. As duas pernas laterais sao os pods de
 * motor, e servem de referencia visual para o jogador entender que o meio e' o
 * unico lugar que vale a pena acertar.
 */
export const MOTHERSHIP: BitmapSource = [
  '.............##############.............',
  '..........####################..........',
  '.......##########################.......',
  '....################################....',
  '..####################################..',
  '########################################',
  '######..########........########..######',
  '####..##########........##########..####',
  '##....##########........##########....##',
  '......########............########......',
  '........######............######........',
  '..........####............####..........',
  '............##............##............',
];

/**
 * Nucleo da nave-mae — o ponto fraco. Desenho proprio, cor propria e piscada
 * propria: e' o unico alvo que vale dano cheio, entao precisa gritar isso.
 */
export const MOTHERSHIP_CORE: BitmapSource = [
  '...####...',
  '..######..',
  '.########.',
  '##########',
  '##########',
  '##########',
  '##########',
  '.########.',
  '..######..',
  '...####...',
];

/**
 * Estilhaco de explosao: um pixel so'.
 *
 * A textura e' branca e a cor sai do tint da instancia — e' o que permite a
 * mesma particula servir ao verde do alien, ao ambar da nave e ao violeta do
 * chefao sem uma textura por cor.
 */
export const PARTICLE: BitmapSource = ['#'];

/**
 * Chaves de textura registradas no boot. Usar sempre estas constantes,
 * nunca string literal espalhada pelo codigo.
 */
export const TEX = {
  alienA0: 'alien-a-0',
  alienA1: 'alien-a-1',
  alienB0: 'alien-b-0',
  alienB1: 'alien-b-1',
  alienC0: 'alien-c-0',
  alienC1: 'alien-c-1',
  player: 'player',
  ufo: 'ufo',
  bulletPlayer: 'bullet-player',
  bulletStraight: 'bullet-straight',
  bulletWave: 'bullet-wave',
  bulletRolling: 'bullet-rolling',
  bulletBoss: 'bullet-boss',
  bunker: 'bunker',
  /** Bloco solido do tamanho do bunker, usado so' como borracha de `erase`. */
  bunkerEraser: 'bunker-eraser',
  explosionAlien: 'explosion-alien',
  explosionPlayer: 'explosion-player',
  speakerOn: 'speaker-on',
  speakerOff: 'speaker-off',
  iconRapid: 'icon-rapid',
  iconMulti: 'icon-multi',
  mothership: 'mothership',
  mothershipCore: 'mothership-core',
  splitter: 'splitter',
  particle: 'particle',
} as const;

export type TextureKey = (typeof TEX)[keyof typeof TEX];

/** Chave da i-esima brocha de escavacao. Ver `BUNKER_CARVE`. */
export function carveTextureKey(index: number): string {
  return `bunker-carve-${index}`;
}
