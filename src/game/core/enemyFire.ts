/**
 * Regras de disparo dos aliens. Logica pura.
 *
 * Duas coisas moram aqui: quem pode atirar (so' o alien mais baixo de cada
 * coluna viva) e como cada tipo de projetil se move. A Scene so' aplica o
 * resultado — nenhuma decisao de tiro e' tomada dentro do game loop.
 */

/** Os tres tipos de projetil que a FORMACAO dispara. */
export type EnemyBulletKind = 'straight' | 'wave' | 'rolling';

/**
 * O projetil do chefao. Fica fora de `EnemyBulletKind` de proposito: ele nunca
 * entra no sorteio da formacao (`pickKind`) nem na tabela de pesos, e mantendo
 * os tipos separados o compilador garante isso sozinho.
 */
export type BossBulletKind = 'spread';

/** Tudo que o pool de projeteis inimigos sabe carregar. */
export type AnyEnemyBulletKind = EnemyBulletKind | BossBulletKind;

/** O minimo que `pickShooters` precisa saber sobre um alien. */
export interface ShooterCandidate {
  readonly col: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Para cada coluna com algum alien vivo, o alien mais baixo dela.
 *
 * Escreve no array `out` fornecido pelo chamador e devolve quantas posicoes
 * foram preenchidas — nada de alocar array novo a cada tick de marcha.
 */
export function pickShooters<T extends ShooterCandidate>(
  aliens: readonly T[],
  isAlive: (alien: T) => boolean,
  out: (T | null)[],
): number {
  for (let i = 0; i < out.length; i++) out[i] = null;

  let count = 0;
  for (const alien of aliens) {
    if (!isAlive(alien)) continue;
    const current = out[alien.col];
    if (current === null || current === undefined) {
      out[alien.col] = alien;
      count++;
    } else if (alien.y > current.y) {
      out[alien.col] = alien;
    }
  }
  return count;
}

/**
 * Indice do atirador cuja coluna esta' mais proxima de `targetX`.
 * Retorna -1 se nao ha' nenhum. Usado pelo projetil "rolling", que sai da
 * coluna alinhada com o jogador em vez de uma coluna sorteada.
 */
export function nearestShooterIndex<T extends ShooterCandidate>(
  shooters: readonly (T | null)[],
  targetX: number,
): number {
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < shooters.length; i++) {
    const shooter = shooters[i];
    if (!shooter) continue;
    const distance = Math.abs(shooter.x - targetX);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/**
 * Sorteia o tipo do proximo projetil.
 *
 * O reto domina porque e' o mais legivel; o rolling e' o mais raro porque
 * persegue e, em quantidade, encurrala o jogador contra a parede.
 */
export const KIND_WEIGHTS: Readonly<Record<EnemyBulletKind, number>> = {
  straight: 0.5,
  wave: 0.3,
  rolling: 0.2,
};

export function pickKind(roll: number): EnemyBulletKind {
  const straight = KIND_WEIGHTS.straight;
  const wave = straight + KIND_WEIGHTS.wave;
  if (roll < straight) return 'straight';
  if (roll < wave) return 'wave';
  return 'rolling';
}

/**
 * Deslocamento lateral do projetil ondulado, relativo a coluna de origem.
 *
 * @param fallenPx distancia ja' percorrida na vertical
 * @param amplitude afastamento maximo para cada lado
 * @param wavelengthPx quantos pixels de queda completam um ciclo
 */
export function waveOffsetX(fallenPx: number, amplitude: number, wavelengthPx: number): number {
  if (wavelengthPx <= 0) return 0;
  return Math.sin((fallenPx / wavelengthPx) * Math.PI * 2) * amplitude;
}

/**
 * Passo horizontal do projetil "rolling" na direcao do jogador.
 *
 * Deriva, nao teleporta: o limite por frame e' o que mantem o projetil
 * desviavel. Sem esse teto ele grudaria na nave e viraria dano garantido.
 */
export function rollingStepX(
  bulletX: number,
  targetX: number,
  maxStepPx: number,
): number {
  const delta = targetX - bulletX;
  if (delta > maxStepPx) return maxStepPx;
  if (delta < -maxStepPx) return -maxStepPx;
  return delta;
}
