/**
 * Parametros do audio sintetizado. Nenhum arquivo de som entra no repositorio —
 * tudo sai de osciladores e ruido em WebAudio (ver `systems/AudioSystem.ts`).
 *
 * Como no resto do projeto, os numeros moram aqui: mexer no "sentimento" do
 * jogo nao deve exigir abrir o sintetizador.
 */

/**
 * MECANICA-ASSINATURA: as 4 notas graves descendentes do heartbeat, em Hz.
 *
 * Uma nota por passo da formacao. Como o intervalo de marcha encolhe conforme
 * os aliens morrem, o loop acelera sozinho — e' dele que vem quase toda a
 * tensao do jogo. Sao um la' grave e tres descidas curtas; graves o bastante
 * para nao competirem com o tiro, espacadas o bastante para o ouvido perceber
 * a queda.
 */
export const HEARTBEAT_NOTES = [110, 98, 87.31, 82.41] as const;

export const AUDIO = {
  /** Ganho mestre. Jogo de arcade em navegador toca baixo por padrao. */
  masterGain: 0.35,

  heartbeat: {
    gain: 0.5,
    /** Duracao fixa: nota curta, para nao borrar quando a marcha acelera. */
    durationMs: 110,
    type: 'square' as OscillatorType,
  },

  playerShot: {
    gain: 0.22,
    startHz: 880,
    endHz: 220,
    durationMs: 90,
    type: 'square' as OscillatorType,
  },

  alienExplosion: {
    gain: 0.3,
    durationMs: 200,
    /** Corte do filtro passa-baixa, em Hz — define o "peso" do estouro. */
    filterHz: 1400,
  },

  playerExplosion: {
    gain: 0.45,
    durationMs: 650,
    filterHz: 700,
  },

  ufo: {
    gain: 0.16,
    /** Sirene: portadora modulada em frequencia. */
    carrierHz: 620,
    modulationHz: 9,
    modulationDepthHz: 190,
    type: 'sawtooth' as OscillatorType,
  },

  extraLife: {
    gain: 0.25,
    /** Arpejo ascendente, em Hz. */
    notes: [523.25, 659.25, 783.99, 1046.5],
    noteMs: 80,
    type: 'square' as OscillatorType,
  },

  /**
   * Coleta de power-up. As NOTAS nao estao aqui: cada tipo traz o arpejo dele
   * em `config/powerups/<tipo>.ts`, para que "som distinto por tipo" continue
   * sendo uma linha no arquivo do tipo novo. Aqui ficam so' o timbre e o ritmo,
   * comuns a todos — e' o que faz qualquer coleta soar como coleta.
   */
  powerUpPickup: {
    gain: 0.26,
    noteMs: 70,
    type: 'triangle' as OscillatorType,
  },

  /**
   * Coleta com o power-up ja' no maximo: em vez do arpejo, um acorde curto e
   * brilhante. O jogador precisa ouvir "virou ponto" sem olhar para o HUD.
   */
  powerUpMaxed: {
    gain: 0.22,
    notes: [1046.5, 1396.91, 1760],
    noteMs: 55,
    type: 'square' as OscillatorType,
  },

  /**
   * Alerta de chefao. Arpejo DESCENDENTE e grave — o oposto exato do arpejo de
   * coleta. Toca uma vez, quando a nave-mae entra.
   */
  bossAlert: {
    gain: 0.3,
    notes: [220, 174.61, 146.83, 110],
    noteMs: 190,
    type: 'sawtooth' as OscillatorType,
  },

  /** Salva do chefao. Mais grave e mais longa que o tiro da formacao. */
  bossShot: {
    gain: 0.2,
    startHz: 300,
    endHz: 90,
    durationMs: 160,
    type: 'sawtooth' as OscillatorType,
  },

  /**
   * Carga do telegraph: varredura ascendente que termina no instante do
   * disparo. E' o aviso sonoro que acompanha o pulso do nucleo.
   */
  bossTelegraph: {
    gain: 0.12,
    startHz: 140,
    endHz: 520,
    /** Casado com `BOSS.telegraphMs` — mexer em um pede mexer no outro. */
    durationMs: 500,
    type: 'triangle' as OscillatorType,
  },

  /** Mudanca de padrao a 50% de HP. Curto, dissonante, impossivel de ignorar. */
  bossEnrage: {
    gain: 0.32,
    notes: [110, 233.08, 110, 233.08],
    noteMs: 100,
    type: 'square' as OscillatorType,
  },

  /** Cada estouro da explosao em cadeia do chefao. */
  bossExplosion: {
    gain: 0.4,
    durationMs: 420,
    filterHz: 900,
  },
} as const;
