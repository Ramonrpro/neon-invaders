/**
 * Contrato de preferencias do jogador.
 *
 * Existe pela mesma razao que `ScoreService`: o codigo dentro de `src/game/`
 * nao pode tocar `localStorage` (regra do ESLint), entao qualquer coisa que
 * sobreviva ao reload passa por uma interface daqui.
 *
 * Assincrono de proposito, inclusive na implementacao local — no dia em que as
 * preferencias forem para a conta do jogador no servidor, o frontend nao muda
 * uma linha.
 */
export interface GameSettings {
  /** Audio silenciado. */
  muted: boolean;
  /**
   * Volume mestre, 0..1, aplicado por cima do ganho base do `AudioSystem`.
   * Independente do mute: silenciar e voltar devolve o volume que estava.
   */
  volume: number;
  /**
   * Efeito CRT (scanlines, vinheta, banho de fosforo).
   *
   * Tres estados: `true`, `false` e `'auto'`. `'auto'` significa "o jogador
   * ainda nao opinou" e e' resolvido pelo aparelho — ver `game/core/crt.ts`.
   * Guardar a indecisao explicitamente e' o que permite ligar por padrao no
   * desktop e desligar no celular sem que o servico saiba o que e' um celular.
   */
  crt: boolean | 'auto';
  /**
   * Tiro automatico permanente no teclado.
   *
   * No toque o auto-fire e' incondicional (nao ha' botao de tiro) — este ajuste
   * so' muda o teclado, onde o padrao continua sendo Espaco.
   */
  autoFire: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  muted: false,
  volume: 1,
  crt: 'auto',
  autoFire: false,
};

export interface SettingsService {
  load(): Promise<GameSettings>;
  save(settings: Partial<GameSettings>): Promise<void>;
}
