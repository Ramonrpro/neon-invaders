/**
 * Numeros do polimento (Milestone 8): particulas, screen shake e efeito CRT.
 *
 * Vivem separados de `gameplay.ts` de proposito. Nada aqui muda o resultado de
 * uma partida — mexer nestes valores nao rebalanceia nada, so' muda o quanto o
 * jogo "bate". Manter isso apartado do balanceamento evita a tentacao de
 * compensar dificuldade com efeito.
 */

/** Estilhacos de explosao. Ver `core/particles.ts`. */
export const PARTICLES = {
  /**
   * Pool unico para todas as salvas.
   *
   * Pior caso real: a cadeia de morte do chefao, 6 estouros de 18 particulas
   * espacados de 140 ms, com os primeiros ainda em voo (vida de 600 ms) — algo
   * como 4 estouros vivos ao mesmo tempo. 120 e' folga sobre isso, e particula
   * que falta simplesmente nao nasce.
   */
  poolSize: 120,
  /** Lado do estilhaco em px logicos. Um pixel do bitmap com escala 2. */
  sizePx: 2,
  /** px/s^2. Puxa para baixo — o destroco cai, nao flutua. */
  gravity: 210,
  /** Fracao da velocidade perdida por segundo. */
  drag: 1.6,
} as const;

/** Perfil de uma salva de estilhacos. */
export interface BurstProfile {
  readonly count: number;
  readonly minSpeed: number;
  readonly maxSpeed: number;
  readonly lifeMs: number;
}

/**
 * Um perfil por tipo de coisa que explode. A escala das salvas segue a
 * importancia do alvo: alien e' um estalo, a nave do jogador e' um evento.
 */
export const BURSTS: Readonly<
  Record<'spark' | 'alien' | 'ufo' | 'player' | 'boss', BurstProfile>
> = {
  /**
   * Faisca de acerto no ponto fraco do chefao. Minuscula de proposito: com o
   * RAPID no maximo o nucleo leva um tiro a cada 100 ms, e uma salva de tamanho
   * normal ai' viraria uma nuvem permanente sobre a luta.
   */
  spark: { count: 4, minSpeed: 30, maxSpeed: 90, lifeMs: 220 },
  alien: { count: 8, minSpeed: 45, maxSpeed: 120, lifeMs: 420 },
  ufo: { count: 12, minSpeed: 60, maxSpeed: 160, lifeMs: 520 },
  player: { count: 20, minSpeed: 55, maxSpeed: 180, lifeMs: 780 },
  boss: { count: 18, minSpeed: 70, maxSpeed: 210, lifeMs: 620 },
};

/**
 * Screen shake.
 *
 * Intensidade e' fracao da altura da tela por frame (a unidade do Phaser), nao
 * pixels. Os valores sao baixos de proposito: acima de ~0,012 o pixel art
 * inteiro perde o alinhamento com a grade e o efeito passa a parecer defeito de
 * render em vez de impacto.
 *
 * Nao ha' shake em morte de alien. Sessenta aliens por fase, cada um sacudindo
 * a tela, e o jogo vira gelatina — o tremor precisa ser raro para significar
 * alguma coisa.
 */
export const SHAKE = {
  /** Morte da nave do jogador — o tremor mais forte do jogo. */
  playerDeath: { durationMs: 420, intensity: 0.011 },
  /** Cada estouro da cadeia de morte do chefao. */
  bossDeath: { durationMs: 220, intensity: 0.008 },
  /** Acerto no nucleo (o ponto fraco). O casco nao treme — so' o ponto fraco. */
  bossCore: { durationMs: 90, intensity: 0.003 },
  /** Mudanca de padrao do chefao a 50% de HP. */
  bossEnrage: { durationMs: 300, intensity: 0.006 },
} as const;

/**
 * Modo atracao da tela de titulo.
 *
 * O gabinete parado nao fica parado: ele cicla entre o que o jogo e', quem sao
 * os melhores e como se joga. E' o unico "anuncio" que um arcade tem.
 */
export const ATTRACT = {
  /** Quanto tempo cada painel fica na tela. */
  panelMs: 6500,
  /** Passo da marcha dos aliens do titulo — o mesmo ritmo do jogo parado. */
  marchMs: 620,
  /** Deslocamento lateral da marcha, em px logicos. */
  marchAmplitudePx: 8,
} as const;

/** Efeito CRT. Ver `gfx/crt.ts` e `scenes/CrtScene.ts`. */
export const CRT = {
  /**
   * Altura de um par linha-acesa / linha-apagada, em px logicos.
   *
   * 3 e' o menor valor que sobrevive a escala: em 480x640 dentro de uma janela
   * de ~700 px de altura o jogo roda perto de 1x, e scanline de 2 px logicos
   * apagaria metade dos sprites de 2 px de grao (o projetil, o grao do bunker).
   */
  scanlinePeriodPx: 3,
  /** Opacidade da linha apagada. */
  scanlineAlpha: 0.22,
  /** Opacidade maxima da vinheta, nos cantos. */
  vignetteAlpha: 0.55,
  /**
   * Banho de fosforo: uma camada aditiva de verde muito fraca sobre a tela
   * inteira. E' o "glow" possivel sem shader — nao borra os sprites, mas eleva
   * o preto para o cinza-esverdeado de um tubo ligado.
   */
  glowAlpha: 0.05,
  /**
   * Cintilacao do brilho da tela: a amplitude e o periodo do respiro do CRT.
   * Sutil ao ponto de so' ser notada quando desligada.
   */
  flickerAmplitude: 0.035,
  flickerPeriodMs: 1900,
} as const;
