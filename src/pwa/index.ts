/**
 * Ponto unico de entrada da casca de PWA, como `getServices()` e' o de
 * `src/services/`. `src/game/` consome as funcoes de `install.ts` e nada mais.
 */
export { initInstall, installAvailability, onInstallChange, promptInstall } from '@pwa/install';
export type { InstallFacts, InstallOutcome } from '@pwa/install';

import { initInstall } from '@pwa/install';
import { registerServiceWorker } from '@pwa/registerServiceWorker';

export function initPwa(): void {
  initInstall();
  registerServiceWorker();
}
