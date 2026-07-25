/**
 * Preferencias sobre `localStorage`.
 *
 * Storage indisponivel (modo privado, iframe com cookies bloqueados) e' tratado
 * em `JsonStore`: nesse caso as preferencias valem so' pela sessao. Perder o
 * mute salvo e' um aborrecimento; quebrar o boot do jogo por causa disso, nao.
 */

import { JsonStore } from '@services/local/storage';
import {
  DEFAULT_SETTINGS,
  type GameSettings,
  type SettingsService,
} from '@services/settings';

const SETTINGS_KEY = 'settings';

function isPartialSettings(value: unknown): value is Partial<GameSettings> {
  return typeof value === 'object' && value !== null;
}

/** Volume so' vale entre 0 e 1. `localStorage` e' editavel pelo jogador. */
function isVolume(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

export class LocalSettingsService implements SettingsService {
  private readonly store = new JsonStore();
  private cache: GameSettings = { ...DEFAULT_SETTINGS };

  async load(): Promise<GameSettings> {
    const parsed = this.store.read<Partial<GameSettings>>(SETTINGS_KEY, isPartialSettings, {});
    this.cache = {
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_SETTINGS.muted,
      volume: isVolume(parsed.volume) ? parsed.volume : DEFAULT_SETTINGS.volume,
      // `'auto'` e' um valor legitimo, nao ausencia de valor: qualquer outra
      // coisa (inclusive um `crt` de versao antiga com outro formato) volta
      // para o padrao em vez de vazar para dentro do jogo.
      crt:
        typeof parsed.crt === 'boolean' || parsed.crt === 'auto' ? parsed.crt : DEFAULT_SETTINGS.crt,
      autoFire: typeof parsed.autoFire === 'boolean' ? parsed.autoFire : DEFAULT_SETTINGS.autoFire,
    };
    return { ...this.cache };
  }

  async save(settings: Partial<GameSettings>): Promise<void> {
    this.cache = { ...this.cache, ...settings };
    this.store.write(SETTINGS_KEY, this.cache);
  }
}

export function createSettingsService(): SettingsService {
  return new LocalSettingsService();
}
