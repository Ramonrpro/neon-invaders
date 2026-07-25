/**
 * Contrato do registry de power-ups.
 *
 * A regra da especificacao e' que adicionar um tipo novo custe **um arquivo e
 * uma entrada** — por isso tudo que define um power-up (numeros, cor, icone,
 * som e efeito) mora junto, no arquivo dele, e o `index.ts` so' lista.
 *
 * O efeito e' expresso como uma funcao pura que reescreve o `FireProfile`. Um
 * power-up do backlog que nao mexa no tiro (escudo, vida extra) simplesmente
 * deixa o perfil intacto e e' lido pelo sistema que lhe interessa — a entrada
 * no registry continua sendo uma so'.
 */

export type PowerUpId = 'rapid' | 'multi';

/**
 * Um projetil dentro de um disparo.
 *
 * @property angleDeg inclinacao em graus; 0 e' vertical, positivo aponta para
 *   a direita. O leque nunca passa de `MULTI_MAX_SPREAD_DEG` para cada lado.
 * @property offsetX deslocamento lateral do ponto de saida, em px logicos.
 *   E' o que separa dois tiros "paralelos" — sem ele eles nasceriam sobrepostos.
 */
export interface ShotSpec {
  readonly angleDeg: number;
  readonly offsetX: number;
}

/**
 * Estado do canhao do jogador depois de aplicar todos os power-ups ativos.
 *
 * Recalculado so' na coleta e no reinicio, nunca por frame — o `PowerUpSystem`
 * guarda a instancia e o game loop apenas le.
 */
export interface FireProfile {
  /** Intervalo minimo entre disparos, em ms. */
  cooldownMs: number;
  /** Teto de projeteis do jogador na tela ao mesmo tempo. */
  maxBullets: number;
  /** Os projeteis que um unico disparo coloca na tela. */
  shots: readonly ShotSpec[];
}

export interface PowerUpDefinition {
  readonly id: PowerUpId;
  /** Rotulo curto no HUD. */
  readonly label: string;
  /** Nivel maximo. Coletar acima disso vale pontos em vez de subir. */
  readonly maxLevel: number;
  /** Cor da capsula e do indicador no HUD. Quebra o monocromatico de proposito. */
  readonly color: number;
  /** Chave da textura do icone (ver `gfx/sprites.ts`). */
  readonly texture: string;
  /** Arpejo ascendente da coleta, em Hz. Distinto por tipo. */
  readonly pickupNotes: readonly number[];
  /** Peso relativo no sorteio de qual tipo cai. */
  readonly dropWeight: number;
  /**
   * Aplica o efeito do nivel ao perfil de disparo, in-place.
   * Deve ser pura em relacao a `level` — o mesmo nivel produz sempre o mesmo
   * perfil, e o sistema recalcula do zero a cada coleta.
   */
  applyToFire(profile: FireProfile, level: number): void;
}
