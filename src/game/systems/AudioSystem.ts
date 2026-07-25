/**
 * Audio 100% sintetizado em WebAudio. Nenhum arquivo de som no repositorio.
 *
 * Tres restricoes moldam este arquivo:
 *
 * 1. **Autoplay.** Navegador nenhum deixa criar/retomar um `AudioContext` fora
 *    de um gesto do usuario. O contexto so' nasce em `unlock()`, chamado no
 *    primeiro toque ou tecla. Antes disso, todo `play*` e' silenciosamente
 *    ignorado — nunca lanca.
 * 2. **Sem lixo no game loop.** Nos de oscilador sao descartaveis por natureza
 *    (um `OscillatorNode` nao pode ser reiniciado), mas o buffer de ruido, o
 *    ganho mestre e a sirene do UFO sao criados uma unica vez.
 * 3. **Falha silenciosa.** Se o WebAudio nao existir, o jogo roda mudo. Audio
 *    nao derruba gameplay.
 */

import { AUDIO, HEARTBEAT_NOTES } from '@game/config/audio';
import type { SettingsService } from '@services/settings';

type AudioContextCtor = new () => AudioContext;

function resolveAudioContext(): AudioContextCtor | null {
  const scope = globalThis as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  /** Sirene do UFO: montada ao entrar em tela, desmontada ao sair. */
  private ufoGain: GainNode | null = null;
  private ufoNodes: { carrier: OscillatorNode; lfo: OscillatorNode } | null = null;
  private ufoRunning = false;

  private heartbeatIndex = 0;
  private mutedState = false;
  /** Volume mestre do jogador, 0..1, multiplicado pelo ganho base. */
  private volumeState = 1;

  constructor(private readonly settings: SettingsService) {}

  /** Le mute e volume salvos. Nao cria o contexto — isso e' do `unlock`. */
  async loadPreferences(): Promise<void> {
    const stored = await this.settings.load();
    this.volumeState = stored.volume;
    this.setMuted(stored.muted);
  }

  get muted(): boolean {
    return this.mutedState;
  }

  get volume(): number {
    return this.volumeState;
  }

  /**
   * Volume mestre. Guardado mesmo com o audio silenciado — mute e volume sao
   * controles independentes, e voltar do mudo tem de devolver o volume que
   * estava, nao o maximo.
   */
  setVolume(volume: number): void {
    this.volumeState = Math.min(1, Math.max(0, volume));
    this.applyGain();
  }

  /**
   * Cria o contexto no primeiro gesto do usuario. Idempotente: chamar de novo
   * so' tenta retomar um contexto suspenso (o que acontece ao voltar de aba).
   */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }

    const Ctor = resolveAudioContext();
    if (!Ctor) return;

    try {
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = this.mutedState ? 0 : AUDIO.masterGain * this.volumeState;
      master.connect(ctx.destination);

      this.ctx = ctx;
      this.master = master;
      this.noiseBuffer = this.createNoiseBuffer(ctx);
      if (ctx.state === 'suspended') void ctx.resume();
    } catch {
      this.ctx = null;
      this.master = null;
    }
  }

  setMuted(muted: boolean): void {
    this.mutedState = muted;
    this.applyGain();
    if (muted) this.stopUfo();
  }

  /** Ponto unico que escreve no ganho mestre. */
  private applyGain(): void {
    if (!this.master || !this.ctx) return;
    const target = this.mutedState ? 0 : AUDIO.masterGain * this.volumeState;
    this.master.gain.setValueAtTime(target, this.ctx.currentTime);
  }

  /** Alterna e persiste. Retorna o estado novo. */
  toggleMute(): boolean {
    this.setMuted(!this.mutedState);
    void this.settings.save({ muted: this.mutedState });
    return this.mutedState;
  }

  // ------------------------------------------------------------------ efeitos

  /**
   * Uma nota do heartbeat. Chamado a cada passo da formacao — como o intervalo
   * de marcha encolhe com os aliens vivos, o loop acelera de graca.
   */
  playHeartbeat(): void {
    const note = HEARTBEAT_NOTES[this.heartbeatIndex]!;
    this.heartbeatIndex = (this.heartbeatIndex + 1) % HEARTBEAT_NOTES.length;

    const cfg = AUDIO.heartbeat;
    this.playTone(note, note, cfg.durationMs, cfg.gain, cfg.type);
  }

  /** Volta o loop ao inicio — nova onda comeca sempre na nota mais grave. */
  resetHeartbeat(): void {
    this.heartbeatIndex = 0;
  }

  playPlayerShot(): void {
    const cfg = AUDIO.playerShot;
    this.playTone(cfg.startHz, cfg.endHz, cfg.durationMs, cfg.gain, cfg.type);
  }

  playAlienExplosion(): void {
    const cfg = AUDIO.alienExplosion;
    this.playNoise(cfg.durationMs, cfg.gain, cfg.filterHz);
  }

  playPlayerExplosion(): void {
    const cfg = AUDIO.playerExplosion;
    this.playNoise(cfg.durationMs, cfg.gain, cfg.filterHz);
  }

  playExtraLife(): void {
    this.playArpeggio(AUDIO.extraLife);
  }

  /**
   * Coleta de power-up. O arpejo vem do tipo coletado — cada power-up tem o
   * dele em `config/powerups/`, e e' assim que "som distinto por tipo" nao
   * custa nenhuma linha aqui quando um tipo novo entra.
   */
  playPowerUpPickup(notes: readonly number[]): void {
    this.playArpeggio({ ...AUDIO.powerUpPickup, notes });
  }

  /** Coleta de um power-up ja' no nivel maximo — virou pontuacao. */
  playPowerUpMaxed(): void {
    this.playArpeggio(AUDIO.powerUpMaxed);
  }

  // ------------------------------------------------------------------ chefao

  /** Entrada da nave-mae: arpejo grave e descendente. */
  playBossAlert(): void {
    this.playArpeggio(AUDIO.bossAlert);
  }

  /** Carga do telegraph. Termina exatamente quando a salva sai. */
  playBossTelegraph(): void {
    const cfg = AUDIO.bossTelegraph;
    this.playTone(cfg.startHz, cfg.endHz, cfg.durationMs, cfg.gain, cfg.type);
  }

  playBossShot(): void {
    const cfg = AUDIO.bossShot;
    this.playTone(cfg.startHz, cfg.endHz, cfg.durationMs, cfg.gain, cfg.type);
  }

  /** Mudanca de padrao a 50% de HP. */
  playBossEnrage(): void {
    this.playArpeggio(AUDIO.bossEnrage);
  }

  playBossExplosion(): void {
    const cfg = AUDIO.bossExplosion;
    this.playNoise(cfg.durationMs, cfg.gain, cfg.filterHz);
  }

  /** Sirene do UFO. Toca em loop enquanto ele estiver na tela. */
  startUfo(): void {
    if (this.ufoRunning || this.mutedState) return;
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const cfg = AUDIO.ufo;
    const carrier = ctx.createOscillator();
    carrier.type = cfg.type;
    carrier.frequency.value = cfg.carrierHz;

    // LFO sobre a frequencia da portadora: e' isso que faz "sirene" em vez de
    // "apito". Depth em Hz, nao em semitons — mais previsivel de tunar.
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = cfg.modulationHz;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = cfg.modulationDepthHz;
    lfo.connect(lfoDepth).connect(carrier.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(cfg.gain, ctx.currentTime + 0.08);
    carrier.connect(gain).connect(master);

    carrier.start();
    lfo.start();

    this.ufoGain = gain;
    this.ufoRunning = true;
    this.ufoNodes = { carrier, lfo };
  }

  stopUfo(): void {
    if (!this.ufoRunning) return;
    this.ufoRunning = false;

    const ctx = this.ctx;
    const gain = this.ufoGain;
    const nodes = this.ufoNodes;
    this.ufoGain = null;
    this.ufoNodes = null;
    if (!ctx || !gain || !nodes) return;

    const stopAt = ctx.currentTime + 0.1;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, stopAt);
    nodes.carrier.stop(stopAt);
    nodes.lfo.stop(stopAt);
  }

  // ----------------------------------------------------------------- oficina

  /** Sequencia de notas espacadas por `noteMs`. Sobe ou desce conforme a lista. */
  private playArpeggio(cfg: {
    notes: readonly number[];
    noteMs: number;
    gain: number;
    type: OscillatorType;
  }): void {
    cfg.notes.forEach((hz, index) => {
      this.playTone(hz, hz, cfg.noteMs, cfg.gain, cfg.type, (index * cfg.noteMs) / 1000);
    });
  }

  /**
   * Ruido branco de 1 s, gerado uma vez e reaproveitado por toda explosao.
   * `AudioBufferSourceNode` e' descartavel, mas o buffer nao precisa ser.
   */
  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /** Oscilador com varredura de frequencia e envelope de decaimento. */
  private playTone(
    startHz: number,
    endHz: number,
    durationMs: number,
    gainValue: number,
    type: OscillatorType,
    delaySec = 0,
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.mutedState) return;

    const start = ctx.currentTime + delaySec;
    const end = start + durationMs / 1000;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(startHz, start);
    if (endHz !== startHz) {
      // Exponencial, nao linear: a varredura precisa soar constante ao ouvido.
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endHz), end);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(gainValue, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(end + 0.02);
  }

  /** Estouro: ruido branco filtrado com envelope de decaimento. */
  private playNoise(durationMs: number, gainValue: number, filterHz: number): void {
    const ctx = this.ctx;
    const master = this.master;
    const buffer = this.noiseBuffer;
    if (!ctx || !master || !buffer || this.mutedState) return;

    const start = ctx.currentTime;
    const end = start + durationMs / 1000;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterHz, start);
    // Corte descendo junto com o volume: o estouro "afunda" em vez de sumir.
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, filterHz * 0.25), end);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    source.connect(filter).connect(gain).connect(master);
    source.start(start);
    source.stop(end + 0.02);
  }
}
