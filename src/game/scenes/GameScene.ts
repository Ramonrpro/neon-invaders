/**
 * GameScene — o loop principal.
 *
 * Milestone 3 (fidelidade classica): alem do loop base, ela coordena bunkers
 * destrutiveis, os tres tipos de tiro inimigo, o UFO, o audio sintetizado e o
 * ciclo morte → congelamento → respawn invulneravel.
 *
 * Milestone 5: power-ups. A Scene decide quando tentar um drop e traduz a
 * coleta em score, som e HUD; o estado (niveis, capsulas, perfil de disparo)
 * mora no `PowerUpSystem` e atravessa mortes e fases.
 *
 * O que NAO esta' aqui, de proposito: nenhuma regra. Quem decide quem atira,
 * como o projetil ondula, onde a cratera abre e quando o UFO volta mora em
 * `core/`. Esta Scene liga as pecas e aplica o resultado.
 */

import Phaser from 'phaser';
import { AlienGrid } from '@game/entities/AlienGrid';
import type { Alien } from '@game/entities/Alien';
import { Bullet } from '@game/entities/Bullet';
import { Bunker } from '@game/entities/Bunker';
import { EnemyBullet } from '@game/entities/EnemyBullet';
import { Explosion } from '@game/entities/Explosion';
import { Player } from '@game/entities/Player';
import { ParticleSystem } from '@game/systems/ParticleSystem';
import { Splitter } from '@game/entities/Splitter';
import { Ufo } from '@game/entities/Ufo';
import { BossLaser } from '@game/entities/bosses/BossLaser';
import { MotherShip } from '@game/entities/bosses/MotherShip';
import { Pool } from '@game/systems/PoolSystem';
import { AudioSystem } from '@game/systems/AudioSystem';
import { InputSystem } from '@game/systems/InputSystem';
import { PowerUpSystem, type CollectedEvent } from '@game/systems/PowerUpSystem';
import { BossBar } from '@ui/BossBar';
import { Hud } from '@ui/Hud';
import { BOSS, getBoss } from '@game/config/bosses';
import {
  BULLET,
  BUNKERS,
  ENEMY_BULLET,
  EXPLOSION,
  INVASION_Y,
  LEVEL_BANNER_MS,
  PLAYER,
  SPLITTER,
  WAVE_RESPAWN_DELAY_MS,
} from '@game/config/gameplay';
import { BURSTS, SHAKE, type BurstProfile } from '@game/config/juice';
import { LAST_LEVEL, getLevel, type LevelConfig } from '@game/config/levels';
import { PALETTE, toCss } from '@game/config/palette';
import { CENTER_X, CENTER_Y, HUD_FONT_FAMILY, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '@game/config/screen';
import { bunkerCenterX } from '@game/core/bunker';
import {
  nearestShooterIndex,
  pickKind,
  pickShooters,
  type EnemyBulletKind,
} from '@game/core/enemyFire';
import { shotVelocity } from '@game/core/powerups';
import { childDirection, shouldSplit, SPLIT_CHILDREN } from '@game/core/splitter';
import { createRunStats, resetRunStats } from '@game/core/runStats';
import { crossedExtraLifeThreshold } from '@game/core/scoring';
import { bonusFor, nextSpawnDelayMs } from '@game/core/ufo';
import { drawBackgroundBands, drawGroundLine } from '@game/gfx/background';
import { BUNKER_CARVE, TEX } from '@game/gfx/sprites';
import { RESTART_EVENT } from '@game/scenes/GameOverScene';
import { RESUME_EVENT } from '@game/scenes/PauseScene';
import { getRunReporter } from '@game/systems/RunReporter';
import { onSettings } from '@game/systems/settingsBus';
import { getServices } from '@services/index';
import type { GameSettings } from '@services/settings';

/**
 * `dying` congela a acao por ~1 s depois que a nave explode; `cleared` e o
 * intervalo entre ondas. Em ambos os projeteis continuam se movendo mas nada
 * colide — o jogador ve o resultado do golpe antes do jogo seguir.
 */
type PlayState = 'playing' | 'dying' | 'cleared' | 'gameover';

/** Margem alem da qual o projetil e' recolhido para o pool. */
const BULLET_DESPAWN_Y = -16;
const ENEMY_BULLET_DESPAWN_Y = LOGICAL_HEIGHT + 16;
/** Idem na horizontal: so' o leque do MULTI sai pelos lados. */
const BULLET_DESPAWN_MARGIN_X = 16;

/**
 * Le o atalho `?boss` / `?boss=N` da URL. Devolve `null` em producao e quando o
 * parametro nao esta' presente ou aponta para uma fase que nao existe.
 */
function readDevBossLevel(): number | null {
  if (!import.meta.env.DEV) return null;

  const raw = new URLSearchParams(window.location.search).get('boss');
  if (raw === null) return null;
  if (raw === '') return 1;

  const level = Number.parseInt(raw, 10);
  return Number.isInteger(level) && level >= 1 && level <= LAST_LEVEL ? level : 1;
}

export class GameScene extends Phaser.Scene {
  private controls!: InputSystem;
  private audio!: AudioSystem;
  private powerUps!: PowerUpSystem;
  private player!: Player;
  private grid!: AlienGrid;
  private ufo!: Ufo;
  private bullets!: Pool<Bullet>;
  private enemyBullets!: Pool<EnemyBullet>;
  private explosions!: Pool<Explosion>;
  private particles!: ParticleSystem;
  private bunkers: Bunker[] = [];
  private splitters!: Pool<Splitter>;
  private boss!: MotherShip;
  private bossLaser!: BossLaser;
  private bossBar!: BossBar;
  private hud!: Hud;
  private banner!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;

  private state: PlayState = 'playing';
  private score = 0;
  private lives = PLAYER.lives;
  private level = 1;
  private levelConfig: LevelConfig = getLevel(1);
  private runStartedAt = 0;

  /**
   * Contadores da partida para o ranking. Vivem na Scene porque so' ela ve' cada
   * abate; quem os envia e' o `RunReporter`.
   */
  private readonly runStats = createRunStats();
  private readonly reporter = getRunReporter();

  private invulnerableUntilMs = 0;
  private ufoNextSpawnMs = 0;

  /**
   * Atalho de desenvolvimento: `?boss` pula a formacao e vai direto ao chefao,
   * `?boss=3` vai direto ao da fase 3. Existe porque conferir a luta exigia
   * limpar 55 aliens antes — o mesmo espirito do `?sprites` do BootScene.
   * Zero em producao: `import.meta.env.DEV` apaga isto do bundle.
   */
  private readonly devBossLevel = readDevBossLevel();

  /** Buffer reaproveitado por `pickShooters` — um slot por coluna da formacao. */
  private readonly shooterSlots: (Alien | null)[] = [];

  constructor() {
    super('Game');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.black);
    drawBackgroundBands(this);
    drawGroundLine(this, PLAYER.y + 20);
    this.resetRunState();

    this.controls = new InputSystem(this);
    this.audio = new AudioSystem(getServices().settings);
    this.installAudioUnlock();
    // As preferencias vem do storage e o HUD so' pode refletir isso quando
    // chegarem. O auto-fire entra no mesmo bolo — ver `applySettings`.
    void this.loadSettings();
    // Mudanca feita na tela de ajustes durante a pausa vale na hora, sem
    // esperar a proxima partida.
    onSettings(this, (settings) => this.applySettings(settings));

    this.player = new Player(this);
    this.grid = new AlienGrid(this);
    this.ufo = new Ufo(this);
    this.bullets = new Pool(BULLET.poolSize, () => new Bullet(this, TEX.bulletPlayer));
    this.enemyBullets = new Pool(ENEMY_BULLET.poolSize, () => new EnemyBullet(this));
    this.explosions = new Pool(EXPLOSION.poolSize, () => new Explosion(this));
    this.particles = new ParticleSystem(this);

    this.powerUps = new PowerUpSystem(this, TEX.iconRapid);
    this.powerUps.onCollected = (event): void => this.onPowerUpCollected(event);

    this.splitters = new Pool(SPLITTER.poolSize, () => new Splitter(this));
    this.boss = new MotherShip(this, getBoss(1));
    this.bossLaser = new BossLaser(this);
    this.bossBar = new BossBar(this);

    this.shooterSlots.length = this.grid.columns;
    // O `create` pode rodar de novo (voltar ao titulo e comecar outra partida) e
    // o array de bunkers e' de instancia: sem zerar, ele acumularia 8, 12...
    this.bunkers.length = 0;
    this.buildBunkers();

    this.hud = new Hud(this, PLAYER.lives - 1);
    this.hud.setScore(this.score);
    this.hud.setLives(this.lives);
    this.hud.setLevel(this.level);
    this.hud.setPowerUpLevels(this.powerUps.currentLevels);
    this.hud.onMuteTapped = (): void => this.toggleMute();

    this.banner = this.add
      .text(CENTER_X, CENTER_Y - 20, '', {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '28px',
        color: toCss(PALETTE.phosphor),
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.hint = this.add
      .text(CENTER_X, CENTER_Y + 20, '', {
        fontFamily: HUD_FONT_FAMILY,
        fontSize: '14px',
        color: toCss(PALETTE.cyan),
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.runStartedAt = this.time.now;
    this.reporter.begin();
    if (this.devBossLevel !== null) this.level = this.devBossLevel;
    this.startWave();

    this.events.on(RESTART_EVENT, () => this.restart());
    this.events.on(RESUME_EVENT, () => this.controls.resetDrag());
    this.installAutoPause();
    // Sirene do UFO nao pode continuar tocando com a Scene fora do ar.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.audio.stopUfo());
  }

  /**
   * Estado de partida nova.
   *
   * Os inicializadores de campo (`score = 0`, `lives = PLAYER.lives`) rodam UMA
   * vez, na construcao da instancia — e o Phaser reaproveita a instancia da
   * Scene. Sem isto, sair para o titulo e comecar de novo traria o score, as
   * vidas e a fase da partida anterior. Ver a nota sobre overlays no CLAUDE.md.
   */
  private resetRunState(): void {
    this.state = 'playing';
    this.score = 0;
    this.lives = PLAYER.lives;
    this.level = 1;
    this.levelConfig = getLevel(1);
    this.invulnerableUntilMs = 0;
    this.ufoNextSpawnMs = 0;
    resetRunStats(this.runStats);
  }

  /**
   * Aba escondida (troca de app, tela bloqueada, outra aba) sobe o overlay de
   * pausa. O Phaser ja' congela o loop sozinho, mas so' isso devolveria o jogo
   * em movimento no instante em que a aba reaparece — com os projeteis a meio
   * caminho da nave. A sirene do UFO tambem precisa calar: audio que continua
   * tocando com o app em segundo plano e' motivo de desinstalacao.
   */
  private installAutoPause(): void {
    const onHidden = (): void => {
      if (document.visibilityState !== 'hidden') return;
      if (this.state === 'gameover' || !this.scene.isActive()) return;
      this.audio.stopUfo();
      this.scene.launch('Pause');
      this.scene.pause();
    };

    document.addEventListener('visibilitychange', onHidden);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onHidden);
    });
  }

  private toggleMute(): void {
    this.hud.setMuted(this.audio.toggleMute());
  }

  /**
   * Preferencias que a partida consome: audio e auto-fire. O CRT nao passa por
   * aqui — ele vive na `CrtScene`, que escuta o mesmo barramento.
   */
  private applySettings(settings: GameSettings): void {
    this.audio.setVolume(settings.volume);
    this.audio.setMuted(settings.muted);
    this.hud.setMuted(this.audio.muted);
    this.controls.setAutoFire(settings.autoFire);
  }

  private async loadSettings(): Promise<void> {
    const stored = await getServices().settings.load();
    // A Scene pode ter sido encerrada enquanto a promessa resolvia.
    if (!this.scene.isActive()) return;
    this.applySettings(stored);
  }

  update(time: number, delta: number): void {
    this.updatePlayer(delta, time);
    this.updateBullets(delta);
    this.updateEnemyBullets(delta);
    this.updateExplosions(delta);
    // Os estilhacos continuam voando em qualquer estado: congelar a poeira no
    // ar durante o congelamento da morte e' o que mais denuncia um jogo parado.
    this.particles.update(delta);
    this.updateUfo(delta, time);
    this.updatePowerUps(delta);

    if (this.state !== 'playing') return;

    this.updateBoss(delta);
    this.updateSplitters(delta);

    const step = this.grid.update(delta);
    if (step) {
      this.audio.playHeartbeat();
      this.onFormationStep();
    }
  }

  // ------------------------------------------------------------------- audio

  /**
   * Politica de autoplay: o `AudioContext` so' pode nascer dentro de um gesto
   * do usuario. Qualquer clique ou tecla serve, e repetir o unlock e'
   * inofensivo — por isso o listener fica permanente (ele tambem retoma o
   * contexto suspenso quando a aba volta a ter foco).
   *
   * Escuta no DOM, e nao em `this.input`: os eventos do Phaser so' sao
   * processados dentro de um passo do game loop, e o loop esta' parado
   * justamente nos dois momentos em que o jogador mais tende a dar o primeiro
   * clique — aba recem-aberta sem foco e tela de game over com esta Scene
   * pausada. O gesto seria engolido e o jogo ficaria mudo ate' o clique
   * seguinte.
   */
  private installAudioUnlock(): void {
    const unlock = (): void => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    });
  }

  // ---------------------------------------------------------------- jogador

  private updatePlayer(deltaMs: number, timeMs: number): void {
    this.player.tickCooldown(deltaMs);
    this.updateInvulnerabilityBlink(timeMs);

    if (this.controls.justToggledMute) this.toggleMute();

    // O arrasto e' consumido mesmo fora do estado 'playing': deixar acumular
    // durante a morte faria a nave saltar no respawn.
    const dragDeltaX = this.controls.consumeDragDeltaX();
    if (this.state !== 'playing') return;

    this.player.move(deltaMs, this.controls.moveAxis, dragDeltaX);

    if (this.controls.isFiring && this.player.canFire) {
      this.fire();
    }
  }

  private get isInvulnerable(): boolean {
    return this.time.now < this.invulnerableUntilMs;
  }

  /** Pisca-pisca da invulnerabilidade. Sem tween: o estado e' sempre derivavel. */
  private updateInvulnerabilityBlink(timeMs: number): void {
    if (this.state === 'dying' || this.state === 'gameover') return;
    if (!this.isInvulnerable) {
      this.player.setAlpha(1);
      return;
    }
    const phase = Math.floor(timeMs / PLAYER.blinkPeriodMs) % 2;
    this.player.setAlpha(phase === 0 ? 1 : 0.25);
  }

  /**
   * Um disparo pode colocar de 1 a 5 projeteis na tela, conforme o nivel do
   * MULTI. O teto e' cobrado da salva inteira, nao projetil a projetil: liberar
   * meio leque deixaria o tiro assimetrico sem que o jogador entendesse por que.
   */
  private fire(): void {
    const profile = this.powerUps.fireProfile;
    const shots = profile.shots;
    if (this.bullets.activeCount + shots.length > profile.maxBullets) return;
    if (this.bullets.freeCount < shots.length) return;

    const speed = Math.abs(BULLET.playerSpeed);
    for (const shot of shots) {
      const bullet = this.bullets.acquire();
      if (!bullet) break;
      const velocity = shotVelocity(shot.angleDeg, speed);
      bullet.fire(this.player.x + shot.offsetX, this.player.muzzleY, velocity.vy, velocity.vx);
    }

    this.player.consumeShot();
    // Conta PROJETEIS, nao disparos: e' assim que o anti-cheat mede cadencia.
    this.runStats.shotsFired += shots.length;
    this.audio.playPlayerShot();
  }

  // ---------------------------------------------------- projeteis do jogador

  private updateBullets(deltaMs: number): void {
    const active = this.bullets.activeItems;
    // De tras para frente: `release` faz swap-remove e reposiciona o ultimo item.
    for (let i = active.length - 1; i >= 0; i--) {
      const bullet = active[i]!;
      bullet.advance(deltaMs);

      if (
        bullet.y < BULLET_DESPAWN_Y ||
        bullet.x < -BULLET_DESPAWN_MARGIN_X ||
        bullet.x > LOGICAL_WIDTH + BULLET_DESPAWN_MARGIN_X
      ) {
        this.recycleBullet(bullet);
        continue;
      }

      if (this.state !== 'playing') continue;

      const halfW = bullet.displayWidth / 2;
      const halfH = bullet.displayHeight / 2;
      const left = bullet.x - halfW;
      const top = bullet.y - halfH;
      const right = bullet.x + halfW;
      const bottom = bullet.y + halfH;

      if (this.hitBunkers(left, top, right, bottom, true)) {
        this.recycleBullet(bullet);
        continue;
      }

      if (this.ufo.active && this.overlapsUfo(left, top, right, bottom)) {
        this.killUfo();
        this.recycleBullet(bullet);
        continue;
      }

      if (this.hitBoss(left, top, right, bottom)) {
        this.recycleBullet(bullet);
        continue;
      }

      if (this.hitSplitters(left, top, right, bottom)) {
        this.recycleBullet(bullet);
        continue;
      }

      const alien = this.grid.hitTest(left, top, right, bottom);
      if (alien) {
        const dropX = alien.x;
        const dropY = alien.y;
        this.burst(alien.x, alien.y, TEX.explosionAlien, EXPLOSION.alienMs, PALETTE.phosphor);
        this.grid.kill(alien);
        this.audio.playAlienExplosion();
        this.runStats.alienKills[alien.alienType]++;
        this.addScore(alien.points);
        this.recycleBullet(bullet);
        this.powerUps.tryDrop(dropX, dropY, this.levelConfig.powerUpDropRate, this.time.now);
        // A partida pode gerar filhotes — por isso o teste de onda limpa vem
        // DEPOIS dela, senao a onda acabaria com dois bichos ainda na tela.
        this.trySplit(alien);
        this.checkWaveCleared();
      }
    }
  }

  private recycleBullet(bullet: Bullet): void {
    bullet.deactivate();
    this.bullets.release(bullet);
  }

  // ---------------------------------------------------- projeteis inimigos

  /**
   * Chamado a cada passo da formacao: e' o tick que sorteia disparo inimigo e
   * verifica se a formacao ja' esta' esmagando bunker ou invadindo a base.
   * Amarrar o disparo ao passo (e nao ao frame) faz a chuva de tiros acelerar
   * junto com a marcha, de graca.
   */
  private onFormationStep(): void {
    this.crushBunkersUnderFormation();

    if (this.grid.liveBottom() >= INVASION_Y) {
      this.gameOver('OS ALIENS CHEGARAM');
      return;
    }

    this.tryEnemyFire();
  }

  private tryEnemyFire(): void {
    if (this.enemyBullets.activeCount >= this.levelConfig.maxEnemyBullets) return;
    if (Math.random() >= this.levelConfig.enemyFireChance) return;

    const available = pickShooters(this.grid.all, (alien) => alien.active, this.shooterSlots);
    if (available === 0) return;

    const kind: EnemyBulletKind = pickKind(Math.random());
    const shooter = this.chooseShooter(kind, available);
    if (!shooter) return;

    const bullet = this.enemyBullets.acquire();
    if (!bullet) return;
    bullet.fire(
      shooter.x,
      shooter.bottom,
      kind,
      this.levelConfig.enemyBulletSpeedMultiplier,
    );
  }

  /**
   * O "rolling" sai da coluna alinhada com a nave — e' o tiro que persegue, e
   * nascer longe do alvo tiraria o sentido dele. Os outros dois saem de uma
   * coluna sorteada entre as que tem alien vivo.
   */
  private chooseShooter(kind: EnemyBulletKind, available: number): Alien | null {
    if (kind === 'rolling') {
      const index = nearestShooterIndex(this.shooterSlots, this.player.x);
      return index >= 0 ? this.shooterSlots[index]! : null;
    }

    let wanted = Math.floor(Math.random() * available);
    for (const shooter of this.shooterSlots) {
      if (!shooter) continue;
      if (wanted === 0) return shooter;
      wanted--;
    }
    return null;
  }

  private updateEnemyBullets(deltaMs: number): void {
    const active = this.enemyBullets.activeItems;
    for (let i = active.length - 1; i >= 0; i--) {
      const bullet = active[i]!;
      bullet.advance(deltaMs, this.player.x);

      if (bullet.y > ENEMY_BULLET_DESPAWN_Y) {
        this.recycleEnemyBullet(bullet);
        continue;
      }

      if (this.state !== 'playing') continue;

      const halfW = bullet.displayWidth / 2;
      const halfH = bullet.displayHeight / 2;
      const left = bullet.x - halfW;
      const top = bullet.y - halfH;
      const right = bullet.x + halfW;
      const bottom = bullet.y + halfH;

      if (this.hitBunkers(left, top, right, bottom, false)) {
        this.recycleEnemyBullet(bullet);
        continue;
      }

      if (!this.isInvulnerable && this.overlapsPlayer(left, top, right, bottom)) {
        this.recycleEnemyBullet(bullet);
        this.killPlayer();
      }
    }
  }

  private recycleEnemyBullet(bullet: EnemyBullet): void {
    bullet.deactivate();
    this.enemyBullets.release(bullet);
  }

  private overlapsPlayer(left: number, top: number, right: number, bottom: number): boolean {
    const halfW = this.player.displayWidth / 2;
    const halfH = this.player.displayHeight / 2;
    if (right < this.player.x - halfW || left > this.player.x + halfW) return false;
    if (bottom < this.player.y - halfH || top > this.player.y + halfH) return false;
    return true;
  }

  // ----------------------------------------------------------------- bunkers

  private buildBunkers(): void {
    for (let i = 0; i < BUNKERS.count; i++) {
      const centerX = bunkerCenterX(i, BUNKERS.count, LOGICAL_WIDTH);
      this.bunkers.push(new Bunker(this, centerX, BUNKERS.topY));
    }
  }

  /**
   * Um retangulo contra todos os bunkers. Se acertar pixel intacto, abre a
   * cratera e devolve `true` — quem chamou recicla o projetil.
   *
   * @param movingUp projetil do jogador (sobe) ou inimigo (desce)
   */
  private hitBunkers(
    left: number,
    top: number,
    right: number,
    bottom: number,
    movingUp: boolean,
  ): boolean {
    for (const bunker of this.bunkers) {
      if (bunker.destroyed) continue;
      const hit = bunker.hitTest(left, top, right, bottom, movingUp);
      if (!hit) continue;
      bunker.carveAt(hit.x, hit.y, Math.floor(Math.random() * BUNKER_CARVE.length));
      return true;
    }
    return false;
  }

  /**
   * A formacao nao danifica bunker: ela o apaga na passagem.
   * Cada bunker olha so' para os aliens que estao sobre ELE — usar o alien mais
   * baixo da formacao inteira derrubaria os quatro de uma vez.
   */
  private crushBunkersUnderFormation(): void {
    for (const bunker of this.bunkers) {
      if (bunker.destroyed) continue;
      const bottom = this.grid.liveBottomInRange(bunker.left, bunker.right);
      if (bottom < bunker.top + BUNKERS.crushOverlapPx) continue;
      bunker.crushBelow(bottom);
    }
  }

  private restoreBunkers(): void {
    for (const bunker of this.bunkers) bunker.restore();
  }

  // --------------------------------------------------------------------- UFO

  private scheduleUfo(): void {
    this.ufoNextSpawnMs = this.time.now + nextSpawnDelayMs(Math.random());
  }

  private updateUfo(deltaMs: number, timeMs: number): void {
    if (this.ufo.active) {
      const gone = this.ufo.advance(deltaMs);
      if (gone) {
        this.ufo.deactivate();
        this.audio.stopUfo();
        this.scheduleUfo();
      }
      return;
    }

    if (this.state !== 'playing') return;
    if (timeMs < this.ufoNextSpawnMs) return;

    this.ufo.launch(Math.random() < 0.5);
    this.audio.startUfo();
  }

  private overlapsUfo(left: number, top: number, right: number, bottom: number): boolean {
    if (right < this.ufo.left || left > this.ufo.right) return false;
    if (bottom < this.ufo.top || top > this.ufo.bottom) return false;
    return true;
  }

  private killUfo(): void {
    const dropX = this.ufo.x;
    const dropY = this.ufo.y;
    this.burst(this.ufo.x, this.ufo.y, TEX.explosionAlien, EXPLOSION.ufoMs, PALETTE.cyan, BURSTS.ufo);
    this.ufo.deactivate();
    this.audio.stopUfo();
    this.audio.playAlienExplosion();
    this.runStats.ufoKills++;
    this.addScore(bonusFor(Math.random()));
    this.scheduleUfo();
    // MECANICA-ASSINATURA: o UFO SEMPRE solta um power-up. E' o que justifica
    // largar a formacao para persegui-lo.
    this.powerUps.dropGuaranteed(dropX, dropY, this.time.now);
  }

  // -------------------------------------------------------------- splitters

  /**
   * Um alien tipo B partido gera dois bichos menores, que saem em V.
   * A chance vem da fase (0 nas fases 1 e 2). Ver `core/splitter.ts`.
   */
  private trySplit(alien: Alien): void {
    if (!shouldSplit(alien.alienType, Math.random(), this.levelConfig.splitChance)) return;
    for (let i = 0; i < SPLIT_CHILDREN; i++) {
      this.spawnSplitter(alien.x, alien.y, childDirection(i));
    }
  }

  private spawnSplitter(x: number, y: number, direction: -1 | 1): void {
    const splitter = this.splitters.acquire();
    if (!splitter) return;
    splitter.spawn(x, y, direction);
  }

  private updateSplitters(deltaMs: number): void {
    const active = this.splitters.activeItems;
    // De tras para frente: `release` faz swap-remove.
    for (let i = active.length - 1; i >= 0; i--) {
      const splitter = active[i]!;
      if (splitter.advance(deltaMs)) {
        // Escapou pela base. Nao custa vida — so' os pontos que ele valia.
        this.recycleSplitter(splitter);
        continue;
      }

      if (this.isInvulnerable || !this.player.visible) continue;

      const halfW = this.player.displayWidth / 2;
      const halfH = this.player.displayHeight / 2;
      const hit = splitter.overlaps(
        this.player.x - halfW,
        this.player.y - halfH,
        this.player.x + halfW,
        this.player.y + halfH,
      );
      if (!hit) continue;

      this.burst(splitter.x, splitter.y, TEX.explosionAlien, EXPLOSION.alienMs, PALETTE.magenta);
      this.recycleSplitter(splitter);
      this.killPlayer();
      return;
    }
  }

  /** Um projetil do jogador contra os splitters. @returns `true` se acertou */
  private hitSplitters(left: number, top: number, right: number, bottom: number): boolean {
    const active = this.splitters.activeItems;
    for (let i = active.length - 1; i >= 0; i--) {
      const splitter = active[i]!;
      if (!splitter.overlaps(left, top, right, bottom)) continue;

      this.burst(splitter.x, splitter.y, TEX.explosionAlien, EXPLOSION.alienMs, PALETTE.magenta);
      this.recycleSplitter(splitter);
      this.audio.playAlienExplosion();
      this.runStats.splitterKills++;
      this.addScore(SPLITTER.points);
      this.checkWaveCleared();
      return true;
    }
    return false;
  }

  private recycleSplitter(splitter: Splitter): void {
    splitter.deactivate();
    this.splitters.release(splitter);
  }

  private releaseAllSplitters(): void {
    const active = this.splitters.activeItems;
    for (let i = active.length - 1; i >= 0; i--) {
      this.recycleSplitter(active[i]!);
    }
  }

  /**
   * A onda so' acaba quando a formacao esta' vazia E nenhum splitter sobrou —
   * o que saiu de um alien partido ainda e' parte da formacao.
   *
   * O guarda do chefao e' essencial: durante a luta a formacao ja' esta' vazia,
   * e matar um minion cairia aqui e chamaria `clearWave` uma segunda vez.
   */
  private checkWaveCleared(): void {
    if (this.state !== 'playing' || this.boss.active) return;
    if (!this.grid.isCleared || this.splitters.activeCount > 0) return;
    this.clearWave();
  }

  // ---------------------------------------------------------------- chefao

  /**
   * A nave-mae entra assim que a formacao e' limpa. Enquanto ela esta' em cena,
   * a formacao esta' vazia — o heartbeat cala sozinho (`grid.update` devolve
   * `null` sem aliens vivos) e a tensao passa a vir do telegraph.
   */
  private startBoss(): void {
    this.state = 'playing';
    this.banner.setVisible(false);
    this.hint.setVisible(false);
    this.releaseAllEnemyBullets();

    // A luta e' um duelo: o que sobrou da formacao sai de cena com ela.
    this.releaseAllSplitters();
    this.cancelBossLaser();

    this.boss.spawn(getBoss(this.level));
    this.bossBar.setHp(1, false);
    this.bossBar.setVisible(true);
    this.bossBar.bringToTop();
    this.audio.playBossAlert();
  }

  private updateBoss(deltaMs: number): void {
    if (!this.boss.active) {
      // O feixe pode sobreviver um instante a morte do chefao; ele mesmo se
      // recolhe ao fim da animacao.
      this.bossLaser.advance(deltaMs);
      return;
    }

    this.boss.clearFlash();
    // A nave para de varrer enquanto o laser esta' em cena. Um frame de atraso
    // em relacao ao feixe — imperceptivel, e evita ter de partir o update em
    // duas passadas so' por causa desta linha.
    this.boss.holdSweep = this.bossLaser.phase !== 'off';
    const frame = this.boss.update(deltaMs);

    if (frame.telegraphStarted) this.audio.playBossTelegraph();
    if (frame.spreadShots > 0) this.fireBossSpread(frame.spreadShots);

    // A coluna do laser trava no AVISO, na posicao atual da nave: e' o que da'
    // ao jogador o telegraph inteiro para sair da frente.
    if (frame.laserWarning) {
      this.bossLaser.startWarning(this.boss.x, this.boss.muzzleY);
      this.audio.playBossTelegraph();
    }
    // Trava dura: o feixe so' dispara se o aviso dele estiver na tela. Se algo
    // cancelou o aviso no meio (a morte do jogador cancela), o tiro e' perdido
    // em vez de sair sem telegraph.
    if (frame.laserFire && this.bossLaser.phase === 'warning') {
      this.bossLaser.fire();
      this.audio.playBossShot();
    }
    if (frame.summon > 0) this.summonMinions(frame.summon);

    this.bossLaser.advance(deltaMs);
    this.checkLaserHitsPlayer();
  }

  /**
   * A nave-mae invoca minions — os mesmos bichos que saem de um alien partido.
   * Um pool so' serve os dois casos: sao a mesma ameaca com origens diferentes.
   */
  private summonMinions(count: number): void {
    for (let i = 0; i < count; i++) {
      this.spawnSplitter(this.boss.x, this.boss.muzzleY, childDirection(i));
    }
  }

  /**
   * Apaga o feixe E zera o ciclo dele na nave-mae. Os dois juntos, sempre:
   * apagar so' o feixe deixa o relogio correndo e o proximo tiro sai sem aviso.
   */
  private cancelBossLaser(): void {
    this.bossLaser.deactivate();
    this.boss.cancelLaser();
  }

  private checkLaserHitsPlayer(): void {
    if (!this.bossLaser.lethal || this.isInvulnerable) return;
    if (this.state !== 'playing' || !this.player.visible) return;

    const halfW = this.player.displayWidth / 2;
    const halfH = this.player.displayHeight / 2;
    const hit = this.bossLaser.overlaps(
      this.player.x - halfW,
      this.player.y - halfH,
      this.player.x + halfW,
      this.player.y + halfH,
    );
    if (hit) this.killPlayer();
  }

  /** A salva do chefao sai da base do casco, em leque simetrico. */
  private fireBossSpread(shots: number): void {
    const config = getBoss(this.level);
    const angles = this.boss.spreadBuffer;

    for (let i = 0; i < shots; i++) {
      const bullet = this.enemyBullets.acquire();
      // Pool cheio: a salva sai incompleta em vez de nao sair. O jogador nunca
      // fica sem aviso — o telegraph ja' tocou.
      if (!bullet) break;
      bullet.fireSpread(this.boss.x, this.boss.muzzleY, angles[i]!, config.bulletSpeed);
    }
    this.audio.playBossShot();
  }

  /**
   * Um projetil do jogador contra a nave-mae.
   *
   * O nucleo e' testado ANTES do casco: quando as duas caixas se sobrepoem, o
   * acerto tem de contar como nucleo. A ordem inversa transformaria o ponto
   * fraco em decoracao.
   *
   * @returns `true` se acertou (quem chamou recicla o projetil)
   */
  private hitBoss(left: number, top: number, right: number, bottom: number): boolean {
    if (!this.boss.fighting) return false;

    const onCore = this.boss.overlapsCore(left, top, right, bottom);
    if (!onCore && !this.boss.overlapsBody(left, top, right, bottom)) return false;

    const result = this.boss.hit(onCore);
    this.boss.flash();
    this.audio.playAlienExplosion();
    this.bossBar.setHp(this.boss.hpFraction, this.boss.currentStage === 2);

    // So' o nucleo sacode. Acertar o casco tambem tremer apagaria a diferenca
    // entre o ponto fraco e a decoracao — que e' justamente a mecanica da luta.
    if (onCore) {
      this.particles.burst((left + right) / 2, (top + bottom) / 2, BURSTS.spark, PALETTE.red);
      this.shake(SHAKE.bossCore);
    }

    if (result.enraged) {
      this.audio.playBossEnrage();
      this.shake(SHAKE.bossEnrage);
    }
    if (result.killed) this.defeatBoss();
    return true;
  }

  /**
   * Morte do chefao: explosao em cadeia, 2 power-ups e a fase seguinte.
   *
   * A cadeia e' uma sequencia de `delayedCall` em vez de um loop de particulas —
   * o que vende o peso da coisa e' o espacamento no tempo, nao a quantidade.
   */
  private defeatBoss(): void {
    this.state = 'cleared';
    this.bossBar.setVisible(false);
    this.cancelBossLaser();
    this.releaseAllSplitters();
    this.runStats.bossKills++;
    this.addScore(this.boss.points);

    const centerX = this.boss.x;
    const centerY = this.boss.y;
    this.boss.deactivate();

    for (let i = 0; i < BOSS.deathBursts; i++) {
      this.time.delayedCall(i * BOSS.deathBurstIntervalMs, () => {
        const spreadX = (Math.random() - 0.5) * 90;
        const spreadY = (Math.random() - 0.5) * 40;
        this.burst(
          centerX + spreadX,
          centerY + spreadY,
          TEX.explosionAlien,
          EXPLOSION.ufoMs,
          i % 2 === 0 ? PALETTE.violet : PALETTE.red,
          BURSTS.boss,
        );
        this.shake(SHAKE.bossDeath);
        this.audio.playBossExplosion();
      });
    }

    // Os 2 power-ups da especificacao. Ignoram o cooldown global de drop: sao a
    // recompensa da luta, nao um drop de rotina.
    this.powerUps.dropFromBoss(centerX, centerY, BOSS.drops, BOSS.dropSpreadX);

    this.showBanner('NAVE-MAE ABATIDA', 'PROXIMA FASE...');
    this.time.delayedCall(BOSS.defeatDelayMs, () => this.advanceLevel());
  }

  private advanceLevel(): void {
    this.releaseAllEnemyBullets();
    this.powerUps.releaseAllCapsules();

    if (this.level >= LAST_LEVEL) {
      this.victory();
      return;
    }

    this.level++;
    this.startWave();
  }

  /**
   * As cinco naves-mae abatidas. Mesmo padrao de overlay da derrota — a
   * `GameScene` congela e a `VictoryScene` devolve por `RESTART_EVENT`.
   */
  private victory(): void {
    this.state = 'gameover';
    this.player.setVisible(false);
    this.audio.stopUfo();
    this.ufo.deactivate();
    this.submitRun(LAST_LEVEL, true);
    this.scene.launch('Victory', {
      score: this.score,
      elapsedMs: this.time.now - this.runStartedAt,
    });
    this.scene.pause();
  }

  /**
   * Fecha a partida no ranking. Nao espera resposta: o overlay sobe na hora e o
   * `RunReporter` guarda o resultado para quem chegar depois.
   */
  private submitRun(levelReached: number, completedGame: boolean): void {
    this.reporter.submit({
      score: this.score,
      levelReached,
      durationMs: Math.round(this.time.now - this.runStartedAt),
      completedGame,
      events: {
        alienKills: { ...this.runStats.alienKills },
        splitterKills: this.runStats.splitterKills,
        ufoKills: this.runStats.ufoKills,
        bossKills: this.runStats.bossKills,
        powerUpsCollected: this.runStats.powerUpsCollected,
        shotsFired: this.runStats.shotsFired,
      },
    });
  }

  // ------------------------------------------------------------- power-ups

  /**
   * As capsulas caem em qualquer estado — quem morre no instante em que uma
   * desce realmente a perde. Mas so' ha' coleta com a nave em jogo: durante o
   * congelamento da morte ou entre ondas o retangulo de coleta e' `null`.
   */
  private updatePowerUps(deltaMs: number): void {
    if (this.state !== 'playing') {
      this.powerUps.update(deltaMs, null);
      return;
    }

    const halfW = this.player.displayWidth / 2;
    const halfH = this.player.displayHeight / 2;
    this.powerUps.update(deltaMs, {
      left: this.player.x - halfW,
      top: this.player.y - halfH,
      right: this.player.x + halfW,
      bottom: this.player.y + halfH,
    });
  }

  /**
   * Empurra o perfil derivado dos niveis para quem precisa dele: a nave (que so'
   * conhece um numero de cooldown) e o HUD. Chamado na coleta e no jogo novo —
   * os dois unicos momentos em que os niveis mudam.
   */
  private syncFireProfile(): void {
    this.player.setFireCooldown(this.powerUps.fireProfile.cooldownMs);
    this.hud.setPowerUpLevels(this.powerUps.currentLevels);
  }

  /** Traduz a coleta em som e pontuacao. O estado ja' foi aplicado pelo sistema. */
  private onPowerUpCollected(event: CollectedEvent): void {
    this.syncFireProfile();
    this.runStats.powerUpsCollected++;

    if (event.leveledUp) {
      this.audio.playPowerUpPickup(event.definition.pickupNotes);
      return;
    }

    // Nivel maximo: a capsula vira pontuacao em vez de ser desperdicio.
    this.audio.playPowerUpMaxed();
    this.addScore(event.bonusPoints);
  }

  // ----------------------------------------------------------------- morte

  private killPlayer(): void {
    this.state = 'dying';
    this.player.setVisible(false);
    this.burst(
      this.player.x,
      this.player.y,
      TEX.explosionPlayer,
      EXPLOSION.playerMs,
      PALETTE.amber,
      BURSTS.player,
    );
    this.shake(SHAKE.playerDeath);
    this.audio.playPlayerExplosion();
    this.audio.stopUfo();

    this.lives--;
    this.hud.setLives(this.lives);

    this.time.delayedCall(PLAYER.deathFreezeMs, () => {
      if (this.lives <= 0) {
        this.gameOver('SEM NAVES');
        return;
      }
      this.respawn();
    });
  }

  /**
   * Renasce no centro, invulneravel e piscando.
   * Bunkers NAO sao restaurados aqui — eles voltam so' na fase seguinte.
   *
   * MECANICA-ASSINATURA: os power-ups sobrevivem a morte, e nada precisa ser
   * feito para isso — `resetToCenter` zera so' a recarga em andamento.
   */
  private respawn(): void {
    this.releaseAllEnemyBullets();
    // Splitters saem junto com os projeteis: renascer em cima de um bicho que
    // ja' estava descendo tiraria a vida seguinte sem o jogador poder reagir.
    this.releaseAllSplitters();
    this.cancelBossLaser();
    this.player.resetToCenter();
    this.player.setVisible(true);
    this.invulnerableUntilMs = this.time.now + PLAYER.respawnInvulnerableMs;
    this.state = 'playing';
  }

  // ------------------------------------------------------------------ score

  private addScore(points: number): void {
    const previous = this.score;
    this.score += points;
    this.hud.setScore(this.score);

    if (crossedExtraLifeThreshold(previous, this.score)) {
      this.lives++;
      this.hud.setLives(this.lives);
      this.audio.playExtraLife();
    }
  }

  // ------------------------------------------------------------- explosoes

  /**
   * Uma explosao = flash + estilhacos.
   *
   * O flash e' o que o jogador REGISTRA (ele diz "acertei"); os estilhacos sao o
   * que ele SENTE. Sao dois pools distintos porque tem tempos distintos: o flash
   * dura 220 ms e some no lugar, a poeira ainda esta' caindo meio segundo depois.
   */
  private burst(
    x: number,
    y: number,
    texture: string,
    durationMs: number,
    tint: number,
    profile: BurstProfile = BURSTS.alien,
  ): void {
    this.particles.burst(x, y, profile, tint);

    const explosion = this.explosions.acquire();
    if (!explosion) return;
    explosion.burst(x, y, texture, durationMs, tint);
  }

  /**
   * Screen shake.
   *
   * So' explosao grande e dano de chefao chegam aqui — ver a nota em
   * `config/juice.ts` sobre por que morte de alien nao treme a tela.
   */
  private shake(spec: { readonly durationMs: number; readonly intensity: number }): void {
    this.cameras.main.shake(spec.durationMs, spec.intensity);
  }

  private updateExplosions(deltaMs: number): void {
    const active = this.explosions.activeItems;
    for (let i = active.length - 1; i >= 0; i--) {
      const explosion = active[i]!;
      if (!explosion.advance(deltaMs)) continue;
      explosion.deactivate();
      this.explosions.release(explosion);
    }
  }

  // ------------------------------------------------------------------ ondas

  private startWave(): void {
    this.state = 'playing';
    this.banner.setVisible(false);
    this.hint.setVisible(false);
    this.levelConfig = getLevel(this.level);
    this.grid.build(this.levelConfig);
    this.player.resetToCenter();
    this.player.setVisible(true);
    this.boss.deactivate();
    this.bossBar.setVisible(false);
    this.cancelBossLaser();
    this.releaseAllSplitters();
    this.restoreBunkers();
    this.audio.resetHeartbeat();
    this.scheduleUfo();
    this.hud.setLevel(this.level);
    this.hud.bringToTop();

    // Atalho `?boss`: formacao ja' nasce limpa e o chefao entra na hora.
    if (this.devBossLevel !== null) {
      for (const alien of this.grid.all) this.grid.kill(alien);
      this.startBoss();
      return;
    }

    this.announceLevel();
  }

  /**
   * Cartao "FASE N" na entrada da fase. Nao congela nada: a formacao ja' esta'
   * marchando atras dele, como no arcade.
   */
  private announceLevel(): void {
    this.showBanner(`FASE ${this.level}`, '');
    this.time.delayedCall(LEVEL_BANNER_MS, () => {
      // So' apaga se ninguem tomou o banner no meio-tempo (morte, onda limpa).
      if (this.state !== 'playing' || this.boss.active) return;
      this.banner.setVisible(false);
      this.hint.setVisible(false);
    });
  }

  /**
   * Formacao limpa: a nave-mae da fase entra em seguida.
   *
   * As capsulas que ainda estavam caindo NAO sao recolhidas aqui — quem limpou
   * a formacao com um power-up a caminho merece pega-lo antes da luta.
   */
  private clearWave(): void {
    this.state = 'cleared';
    this.ufo.deactivate();
    this.audio.stopUfo();
    this.showBanner('FORMACAO LIMPA', 'ALERTA DE NAVE-MAE');
    this.time.delayedCall(WAVE_RESPAWN_DELAY_MS, () => this.startBoss());
  }

  /**
   * A tela de resultado sobe como overlay e esta Scene congela — ela nunca e'
   * destruida. Ver o comentario de arquitetura em `GameOverScene`.
   */
  private gameOver(reason: string): void {
    this.state = 'gameover';
    this.player.setVisible(false);
    this.audio.stopUfo();
    this.ufo.deactivate();
    this.boss.deactivate();
    this.bossBar.setVisible(false);
    this.cancelBossLaser();
    this.submitRun(this.level, false);
    this.scene.launch('GameOver', {
      score: this.score,
      level: this.level,
      elapsedMs: this.time.now - this.runStartedAt,
      reason,
    });
    this.scene.pause();
  }

  /** Jogo novo. Unico ponto em que os power-ups zeram. */
  private restart(): void {
    this.score = 0;
    this.lives = PLAYER.lives;
    this.level = 1;
    this.invulnerableUntilMs = 0;
    this.runStartedAt = this.time.now;
    // A instancia da Scene e' reaproveitada entre partidas: sem zerar aqui, a
    // segunda partida submeteria os abates da primeira somados aos dela.
    resetRunStats(this.runStats);
    this.reporter.begin();
    this.controls.resetDrag();
    this.powerUps.reset();
    // Sem isto a nave manteria o cooldown do RAPID da partida anterior.
    this.syncFireProfile();
    this.hud.setScore(this.score);
    this.hud.setLives(this.lives);
    this.releaseAllBullets();
    this.releaseAllEnemyBullets();
    this.releaseAllSplitters();
    // Poeira da morte que encerrou a partida anterior nao pode chover sobre a
    // primeira fase da nova.
    this.particles.releaseAll();
    this.startWave();
  }

  private releaseAllBullets(): void {
    const active = this.bullets.activeItems;
    for (let i = active.length - 1; i >= 0; i--) {
      this.recycleBullet(active[i]!);
    }
  }

  private releaseAllEnemyBullets(): void {
    const active = this.enemyBullets.activeItems;
    for (let i = active.length - 1; i >= 0; i--) {
      this.recycleEnemyBullet(active[i]!);
    }
  }

  private showBanner(title: string, subtitle: string): void {
    this.banner.setText(title).setVisible(true);
    this.hint.setText(subtitle).setVisible(true);
    this.children.bringToTop(this.banner);
    this.children.bringToTop(this.hint);
  }
}
