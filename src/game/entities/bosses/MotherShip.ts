import Phaser from 'phaser';
import { BOSS, BOSS_MAX_X, BOSS_MIN_X, type BossConfig } from '@game/config/bosses';
import { CENTER_X } from '@game/config/screen';
import {
  attackPhase,
  entranceProgress,
  hpFraction,
  crossedEnrageThreshold,
  damageFor,
  fireIntervalFor,
  laserIntervalFor,
  shouldFire,
  spreadAngles,
  spreadShotsFor,
  stageFor,
  summonCountFor,
  summonIntervalFor,
  sweepSpeedFor,
  sweepStep,
  type BossStage,
  type SweepDirection,
} from '@game/core/boss';
import { TEX } from '@game/gfx/sprites';

/**
 * A nave-mae — o chefao de fim de fase.
 *
 * DECISAO DE ESCOPO: uma unica nave-mae parametrizada por fase substitui os
 * cinco chefoes distintos da especificacao na v1. Ver `config/bosses.ts`.
 *
 * Ela nao usa Arcade Physics (nem o resto do jogo usa): a varredura e' integrada
 * a mao e a colisao e' AABB manual, contra duas caixas — o casco e o nucleo.
 *
 * O corpo e o nucleo sao dois `Image` separados, e nao um container: o nucleo
 * precisa piscar, trocar de cor e ser testado por colisao independentemente do
 * casco, e um container so' atrapalharia as tres coisas.
 */
export type MotherShipPhase = 'entering' | 'fighting' | 'dead';

/**
 * O que a nave-mae pede a Scene neste frame.
 *
 * E' um objeto UNICO, reaproveitado a cada `update` e sobrescrito por inteiro:
 * o game loop nao pode alocar. Quem le precisa consumir no mesmo frame — nada
 * aqui sobrevive ao proximo `update`.
 */
export interface BossFrame {
  /** Projeteis da salva deste frame; 0 quando nao houve salva. */
  spreadShots: number;
  /** Borda de subida do telegraph do leque. */
  telegraphStarted: boolean;
  /** Borda: o aviso do laser comecou nesta coluna. */
  laserWarning: boolean;
  /** Borda: o laser disparou. */
  laserFire: boolean;
  /** Quantos minions invocar neste frame; 0 na maioria deles. */
  summon: number;
}

export class MotherShip {
  private readonly body: Phaser.GameObjects.Image;
  private readonly core: Phaser.GameObjects.Image;

  private config: BossConfig;
  private phase: MotherShipPhase = 'dead';
  private stage: BossStage = 1;
  private direction: SweepDirection = 1;

  private hpValue = 0;
  private elapsedMs = 0;
  private sinceLastShotMs = 0;

  private previousAttackPhase: 'idle' | 'telegraph' = 'idle';

  /** Ciclos independentes: leque, laser e invocacao nao se sincronizam. */
  private sinceLastLaserMs = 0;
  private laserWarned = false;
  private sinceLastSummonMs = 0;

  /**
   * Trava a varredura. Ligado pela Scene enquanto o laser esta' mirando ou
   * disparando.
   *
   * Duas razoes, e as duas importam. Visual: a coluna do laser trava no aviso,
   * entao uma nave que continuasse deslizando deixaria o feixe orfao no meio da
   * tela, parecendo defeito. Jogo: uma nave-mae imovel e' o premio de quem
   * sobreviveu ao laser — a janela para acertar o nucleo parado.
   */
  holdSweep = false;

  /** Ver `BossFrame`: objeto unico, reescrito por inteiro a cada `update`. */
  private readonly frame: BossFrame = {
    spreadShots: 0,
    telegraphStarted: false,
    laserWarning: false,
    laserFire: false,
    summon: 0,
  };

  /** Buffer reaproveitado por `spreadAngles` — uma posicao por projetil da salva. */
  private readonly angleBuffer: number[] = [];

  constructor(scene: Phaser.Scene, config: BossConfig) {
    this.config = config;
    this.body = scene.add.image(CENTER_X, BOSS.entranceStartY, TEX.mothership).setOrigin(0.5);
    this.core = scene.add.image(CENTER_X, BOSS.entranceStartY, TEX.mothershipCore).setOrigin(0.5);
    this.deactivate();
  }

  // ------------------------------------------------------------------ estado

  get active(): boolean {
    return this.phase !== 'dead';
  }

  /** So' aceita dano e so' atira depois que a entrada termina. */
  get fighting(): boolean {
    return this.phase === 'fighting';
  }

  get hp(): number {
    return this.hpValue;
  }

  get maxHp(): number {
    return this.config.hp;
  }

  get hpFraction(): number {
    return hpFraction(this.hpValue, this.config.hp);
  }

  get currentStage(): BossStage {
    return this.stage;
  }

  get points(): number {
    return this.config.points;
  }

  get x(): number {
    return this.body.x;
  }

  get y(): number {
    return this.body.y;
  }

  /** Ponto de saida das salvas: a base do casco. */
  get muzzleY(): number {
    return this.body.y + this.body.displayHeight / 2;
  }

  // ------------------------------------------------------------- ciclo de vida

  /** Entra em cena pela fase informada. A descida leva `BOSS.entranceMs`. */
  spawn(config: BossConfig): void {
    this.config = config;
    this.hpValue = config.hp;
    this.stage = 1;
    this.direction = Math.random() < 0.5 ? -1 : 1;
    this.phase = 'entering';
    this.elapsedMs = 0;
    this.sinceLastShotMs = 0;
    this.previousAttackPhase = 'idle';
    this.sinceLastLaserMs = 0;
    this.laserWarned = false;
    this.sinceLastSummonMs = 0;
    this.holdSweep = false;

    this.body.setPosition(CENTER_X, BOSS.entranceStartY);
    this.core.setPosition(CENTER_X, BOSS.entranceStartY);
    this.body.setAlpha(1).setVisible(true).setActive(true);
    this.core.setAlpha(1).setVisible(true).setActive(true);
  }

  deactivate(): void {
    this.phase = 'dead';
    this.body.setVisible(false).setActive(false);
    this.core.setVisible(false).setActive(false);
  }

  // ------------------------------------------------------------------ update

  /**
   * Avanca um frame e devolve o que a Scene precisa executar.
   *
   * A entidade nao conhece pool de projeteis, laser nem pool de minions: ela
   * so' diz o que aconteceu. E' a Scene que liga as pontas.
   */
  update(deltaMs: number): Readonly<BossFrame> {
    const frame = this.frame;
    frame.spreadShots = 0;
    frame.telegraphStarted = false;
    frame.laserWarning = false;
    frame.laserFire = false;
    frame.summon = 0;

    if (this.phase === 'dead') return frame;

    this.elapsedMs += deltaMs;

    if (this.phase === 'entering') {
      this.advanceEntrance();
      return frame;
    }

    this.advanceSweep(deltaMs);
    this.advanceAttack(deltaMs);
    this.advanceLaser(deltaMs);
    this.advanceSummon(deltaMs);
    return frame;
  }

  private advanceEntrance(): void {
    const t = entranceProgress(this.elapsedMs, BOSS.entranceMs);
    const y = BOSS.entranceStartY + (BOSS.sweepY - BOSS.entranceStartY) * t;
    this.moveTo(this.body.x, y);

    if (t < 1) return;
    this.phase = 'fighting';
    this.sinceLastShotMs = 0;
  }

  private advanceSweep(deltaMs: number): void {
    if (this.holdSweep) return;

    const step = sweepStep({
      x: this.body.x,
      direction: this.direction,
      speed: sweepSpeedFor(this.config, this.stage),
      deltaMs,
      halfWidth: this.body.displayWidth / 2,
      minX: BOSS_MIN_X,
      maxX: BOSS_MAX_X,
    });
    this.direction = step.direction;
    this.moveTo(step.x, BOSS.sweepY);
  }

  /**
   * Ciclo de ataque: o nucleo pulsa devagar enquanto espera e pisca depressa
   * durante o telegraph. A salva sai no fim do telegraph, nunca antes — e' a
   * regra da secao 6 da especificacao, e ela vive aqui.
   */
  private advanceAttack(deltaMs: number): void {
    this.sinceLastShotMs += deltaMs;
    const interval = fireIntervalFor(this.config, this.stage);
    const phase = attackPhase(this.sinceLastShotMs, interval, BOSS.telegraphMs);
    this.frame.telegraphStarted = phase === 'telegraph' && this.previousAttackPhase === 'idle';
    this.previousAttackPhase = phase;
    this.updateCoreLook(phase);

    if (!shouldFire(this.sinceLastShotMs, interval)) return;

    this.sinceLastShotMs = 0;
    this.previousAttackPhase = 'idle';
    this.frame.spreadShots = spreadAngles(
      spreadShotsFor(this.config, this.stage),
      BOSS.spreadAngleDeg,
      this.angleBuffer,
    );
  }

  /**
   * Ciclo do laser (fases 4 e 5). Independente do ciclo do leque de proposito:
   * sincronizados, os dois ataques virariam um so' padrao decorado.
   */
  private advanceLaser(deltaMs: number): void {
    const interval = laserIntervalFor(this.config, this.stage);
    if (interval === null) return;

    this.sinceLastLaserMs += deltaMs;

    // O aviso comeca no rabo do intervalo, como todo telegraph do jogo.
    if (!this.laserWarned && this.sinceLastLaserMs >= interval - BOSS.telegraphMs) {
      this.laserWarned = true;
      this.frame.laserWarning = true;
      return;
    }

    if (this.sinceLastLaserMs < interval) return;
    this.sinceLastLaserMs = 0;
    this.laserWarned = false;
    this.frame.laserFire = true;
  }

  /**
   * Cancela o ciclo do laser e recomeca a contagem do zero.
   *
   * Obrigatorio sempre que a Scene apaga o feixe por fora (morte do jogador,
   * fase nova). Sem isto o aviso some mas o relogio continua, e o disparo sai
   * sem telegraph nenhum — dano impossivel de prever, exatamente o que a secao
   * 6 da especificacao proibe. Ja' aconteceu.
   */
  cancelLaser(): void {
    this.sinceLastLaserMs = 0;
    this.laserWarned = false;
    this.holdSweep = false;
  }

  /** Invocacao de minions (fases 2 e 5). */
  private advanceSummon(deltaMs: number): void {
    const interval = summonIntervalFor(this.config, this.stage);
    if (interval === null) return;

    this.sinceLastSummonMs += deltaMs;
    if (this.sinceLastSummonMs < interval) return;

    this.sinceLastSummonMs = 0;
    this.frame.summon = summonCountFor(this.config);
  }

  /** Os angulos da salva mais recente. Valido so' no frame da salva. */
  get spreadBuffer(): readonly number[] {
    return this.angleBuffer;
  }

  /**
   * Pisca do nucleo, derivado do relogio — sem tween, igual ao resto do jogo.
   *
   * Os dois pisos de alpha sao diferentes de proposito. Parado, o nucleo apenas
   * respira (nunca abaixo de `corePulseFloor`): ele precisa estar sempre
   * legivel como alvo, e um piso baixo o transformava num buraco escuro no meio
   * do casco. Durante o telegraph ele apaga quase de vez — e' ali que o
   * contraste alto vira alarme.
   */
  private updateCoreLook(phase: 'idle' | 'telegraph'): void {
    const telegraphing = phase === 'telegraph';
    const period = telegraphing ? BOSS.coreTelegraphBlinkMs : BOSS.corePulseMs;
    const on = Math.floor(this.elapsedMs / period) % 2 === 0;
    const floor = telegraphing ? BOSS.coreTelegraphFloor : BOSS.corePulseFloor;
    this.core.setAlpha(on ? 1 : floor);
  }

  private moveTo(x: number, y: number): void {
    this.body.setPosition(x, y);
    // O nucleo mora na cavidade da base do casco, nao no centro geometrico.
    this.core.setPosition(x, y + this.body.displayHeight * 0.18);
  }

  // ------------------------------------------------------------------- dano

  /**
   * Aplica o acerto e devolve o que a Scene precisa saber.
   *
   * @returns `enraged` marca o unico acerto que cruzou os 50% — e' onde a Scene
   *   dispara o alerta sonoro e visual da mudanca de padrao.
   */
  hit(hitWeakPoint: boolean): { damage: number; killed: boolean; enraged: boolean } {
    const damage = damageFor(hitWeakPoint);
    const previous = this.hpValue;
    this.hpValue = Math.max(0, this.hpValue - damage);

    const enraged = crossedEnrageThreshold(previous, this.hpValue, this.config.hp);
    if (enraged) this.stage = stageFor(this.hpValue, this.config.hp);

    const killed = this.hpValue <= 0;
    if (killed) this.phase = 'dead';
    return { damage, killed, enraged };
  }

  /** Clarao branco de um frame ao levar dano. */
  flash(): void {
    this.body.setAlpha(0.45);
  }

  /** Volta o casco ao normal. Chamado no frame seguinte ao `flash`. */
  clearFlash(): void {
    if (this.phase !== 'dead') this.body.setAlpha(1);
  }

  // -------------------------------------------------------------- colisao

  /** O acerto caiu no nucleo? Testado antes do casco — o nucleo vale mais. */
  overlapsCore(left: number, top: number, right: number, bottom: number): boolean {
    return overlaps(this.core, left, top, right, bottom);
  }

  overlapsBody(left: number, top: number, right: number, bottom: number): boolean {
    return overlaps(this.body, left, top, right, bottom);
  }
}

function overlaps(
  image: Phaser.GameObjects.Image,
  left: number,
  top: number,
  right: number,
  bottom: number,
): boolean {
  const halfW = image.displayWidth / 2;
  const halfH = image.displayHeight / 2;
  if (right < image.x - halfW || left > image.x + halfW) return false;
  if (bottom < image.y - halfH || top > image.y + halfH) return false;
  return true;
}
