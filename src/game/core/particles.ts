/**
 * Estilhacos de explosao — a parte que nao depende do Phaser.
 *
 * O flash de explosao (`entities/Explosion`) continua sendo o que o jogador
 * REGISTRA; as particulas sao o que ele SENTE. Por isso elas sao baratas e
 * burras: nascem em leque, caem, freiam e somem. Nenhuma colide com nada.
 *
 * Tudo aqui muta objetos que ja' existem no pool — nenhuma funcao devolve
 * objeto novo. Uma salva de 14 particulas por explosao, varias explosoes por
 * segundo na cadeia do chefao, e a alocacao por frame voltaria pela janela
 * depois de todo o cuidado que o pool tomou.
 */

const TWO_PI = Math.PI * 2;

/** Um estilhaco em voo. Posicao em px logicos, velocidade em px/s. */
export interface ParticleState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageMs: number;
  lifeMs: number;
}

/** Destino de `burstVector` — reaproveitado a cada particula da salva. */
export interface ParticleVector {
  vx: number;
  vy: number;
}

/**
 * Direcao e velocidade da i-esima particula de uma salva.
 *
 * O circulo e' dividido em `count` fatias iguais e cada particula sai DENTRO da
 * fatia dela — o sorteio move o angulo apenas de 0 a 1 fatia. Sortear o angulo
 * inteiro faria a salva sair em tufo de um lado so' com frequencia visivel: com
 * 12 particulas, tres ou quatro caem no mesmo setor a cada duas explosoes.
 *
 * @param angleRoll 0..1, desvio dentro da fatia
 * @param speedRoll 0..1, interpola entre a velocidade minima e a maxima
 */
export function burstVector(
  index: number,
  count: number,
  angleRoll: number,
  speedRoll: number,
  minSpeed: number,
  maxSpeed: number,
  out: ParticleVector,
): void {
  const slice = TWO_PI / Math.max(1, count);
  const angle = slice * (index + angleRoll);
  const speed = minSpeed + (maxSpeed - minSpeed) * speedRoll;
  out.vx = Math.cos(angle) * speed;
  out.vy = Math.sin(angle) * speed;
}

/**
 * Integra um passo de voo.
 *
 * O arrasto e' o que separa "destroco" de "tiro": sem ele o estilhaco sai em
 * linha reta e velocidade constante, e o olho le' aquilo como projetil inimigo
 * — exatamente a leitura que uma explosao nao pode ter.
 *
 * @param gravity px/s^2, positivo puxa para baixo
 * @param drag fracao da velocidade perdida por segundo
 */
export function stepParticle(
  particle: ParticleState,
  deltaMs: number,
  gravity: number,
  drag: number,
): void {
  const dt = deltaMs / 1000;
  particle.vy += gravity * dt;

  // Piso em 0: com delta grande (aba que volta do segundo plano) um fator
  // negativo inverteria a velocidade e a particula voltaria para dentro.
  const damping = Math.max(0, 1 - drag * dt);
  particle.vx *= damping;
  particle.vy *= damping;

  particle.x += particle.vx * dt;
  particle.y += particle.vy * dt;
  particle.ageMs += deltaMs;
}

/** Fracao de vida restante, de 1 a 0. Vale como alfa e como escala. */
export function particleFade(ageMs: number, lifeMs: number): number {
  if (lifeMs <= 0) return 0;
  const remaining = 1 - ageMs / lifeMs;
  if (remaining <= 0) return 0;
  return remaining >= 1 ? 1 : remaining;
}

export function isParticleDead(particle: ParticleState): boolean {
  return particle.ageMs >= particle.lifeMs;
}
