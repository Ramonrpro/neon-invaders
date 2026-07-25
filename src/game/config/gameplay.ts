/**
 * Constantes de gameplay em coordenadas logicas (480x640).
 * Ponto unico de tuning — nenhum destes numeros pode aparecer solto no codigo.
 */

import { PLAY_HEIGHT, LOGICAL_WIDTH } from '@game/config/screen';

export const PLAYER = {
  /** Velocidade horizontal, px/s. */
  speed: 260,
  /** Linha da nave, fixa na base da tela. */
  y: PLAY_HEIGHT - 46,
  /** Folga das paredes laterais. */
  marginX: 10,
  /**
   * Cooldown base de disparo, em ms. O power-up RAPID substitui este valor —
   * ver `config/powerups/rapid.ts`.
   */
  fireCooldownMs: 400,
  /**
   * Maximo de disparos do jogador na tela sem nenhum power-up. RAPID soma slots
   * e MULTI multiplica pelo tamanho da salva — ver `config/powerups/`.
   */
  maxBullets: 2,
  /** Vidas iniciais. */
  lives: 3,
  /** Congelamento da acao apos a morte, antes do respawn. */
  deathFreezeMs: 1000,
  /** Invulnerabilidade piscante depois de renascer. */
  respawnInvulnerableMs: 1500,
  /** Periodo do pisca-pisca da invulnerabilidade. */
  blinkPeriodMs: 120,
} as const;

export const BULLET = {
  /** Velocidade do projetil do jogador, px/s (negativa = sobe). */
  playerSpeed: -520,
  /**
   * Tamanho do pool.
   *
   * O pior caso e' RAPID e MULTI no maximo: (2 + 5) disparos na tela x 5
   * projeteis por salva = 35. Um pool menor faria o leque sair incompleto
   * justamente no momento em que o jogador terminou de montar o canhao.
   */
  poolSize: 40,
} as const;

/**
 * Projeteis inimigos. As velocidades base sao multiplicadas por
 * `enemyBulletSpeedMultiplier` da fase (ver `config/levels.ts`).
 */
export const ENEMY_BULLET = {
  /** px/s, positivo = desce. O reto e' o mais rapido; o ondulado, o mais lento. */
  speedStraight: 210,
  speedWave: 160,
  speedRolling: 185,
  /** Afastamento lateral maximo do ondulado. */
  waveAmplitude: 11,
  /** Pixels de queda que completam um ciclo da onda. */
  waveLengthPx: 46,
  /** Teto de deriva lateral do "rolling", px/s. Acima disso vira dano garantido. */
  rollingTrackSpeed: 55,
  /**
   * Pool compartilhado por todos os tipos, inclusive o leque do chefao.
   *
   * O pior caso nao e' a fase 5 (6 tiros de formacao): e' a nave-mae enfurecida,
   * que solta 5 por salva a cada ~0,9 s enquanto os anteriores ainda cruzam a
   * tela. 20 e' folga sobre isso — salva incompleta e' pior que projetil a mais.
   */
  poolSize: 20,
} as const;

/** Bunkers destrutiveis. */
export const BUNKERS = {
  count: 4,
  /** Lado de um pixel do bitmap do bunker, em px logicos. Define o grao. */
  pixelSize: 2,
  /** Y do topo da fileira de bunkers. */
  topY: 486,
  /**
   * Quanto da altura do bunker a formacao precisa invadir para apaga-lo na
   * passagem. Zero apagaria o bunker no instante em que o alien encosta.
   */
  crushOverlapPx: 4,
} as const;

/**
 * Splitters — os bichos menores que saem de um alien tipo B partido, e tambem
 * os minions invocados pela nave-mae. Ver `core/splitter.ts`.
 */
export const SPLITTER = {
  /** Velocidade de descida, px/s. Mais rapida que a marcha da formacao. */
  fallSpeed: 88,
  /** Deriva lateral, px/s. Os dois filhos saem em sentidos opostos. */
  driftSpeed: 72,
  /**
   * Pontos por abater. Baixo de proposito: partir um alien tem de ser uma
   * ameaca, nao um bonus. Matar um B que se parte rende 20 + 2x8 = 36 contra os
   * 20 de um que nao se parte — pouco mais, e com muito mais risco.
   */
  points: 8,
  /** Folga das paredes no quique. */
  marginX: 8,
  /**
   * Pool. Pior caso: a fase 5 parte metade dos 22 aliens tipo B (11 partidas =
   * 22 filhos) e a nave-mae ainda invoca minions. 32 e' folga sobre isso.
   */
  poolSize: 32,
} as const;

export const SPLITTER_MIN_X = SPLITTER.marginX;
export const SPLITTER_MAX_X = LOGICAL_WIDTH - SPLITTER.marginX;

/** UFO / nave misteriosa. */
export const UFO = {
  /** Linha em que cruza a tela — dentro da faixa ciano do topo. */
  y: 88,
  /** px/s. O sentido e' sorteado a cada aparicao. */
  speed: 95,
  /** Folga fora da tela em que nasce e em que e' recolhido. */
  offscreenMarginX: 40,
} as const;

export const FORMATION = {
  rows: 5,
  cols: 11,
  /** Espacamento entre centros de aliens. */
  cellWidth: 32,
  cellHeight: 32,
  /** Folga entre as paredes e o limite de marcha. */
  edgeMarginX: 12,
  /** Y do topo do bloco quando `formationRowOffset` e' 0. */
  topY: 118,
  /** Deslocamento lateral por passo. */
  stepX: 6,
  /** Descida ao encostar na borda. */
  stepY: 16,
} as const;

/** Largura do bloco cheio da formacao. */
export const FORMATION_WIDTH = FORMATION.cols * FORMATION.cellWidth;

/**
 * X inicial do bloco: centralizado.
 *
 * ATENCAO: isto e' diferente dos limites de marcha abaixo. Fazer o bloco nascer
 * exatamente sobre o limite deixa a formacao presa na borda, descendo a cada
 * tick em vez de marchar — o jogo inteiro desanda. A folga total resultante
 * (~21% da largura da tela) e' a mesma proporcao dos gabinetes do genero.
 */
export const FORMATION_START_X = (LOGICAL_WIDTH - FORMATION_WIDTH) / 2;

/** Limites laterais em que a formacao pode marchar. */
export const FORMATION_MIN_X = FORMATION.edgeMarginX;
export const FORMATION_MAX_X = LOGICAL_WIDTH - FORMATION.edgeMarginX;

/**
 * Se a base de qualquer alien vivo alcancar esta linha, e' derrota instantanea.
 * Fica um pouco acima da nave — o jogador nunca e' esmagado sem aviso.
 */
export const INVASION_Y = PLAYER.y - 24;

/** Pausa entre limpar a formacao e a proxima onda entrar. */
export const WAVE_RESPAWN_DELAY_MS = 1400;

/**
 * Quanto tempo o cartao "FASE N" fica na tela ao comecar uma fase.
 *
 * O jogo NAO congela durante ele — no arcade a fase ja' esta' rodando quando o
 * aviso aparece. Congelar aqui so' adicionaria espera entre duas fases que o
 * jogador quer emendar.
 */
export const LEVEL_BANNER_MS = 1200;

/** Duracao dos flashes de explosao. Particulas de verdade entram no Milestone 8. */
export const EXPLOSION = {
  alienMs: 220,
  ufoMs: 320,
  playerMs: 700,
  poolSize: 10,
} as const;
