/**
 * Ponto unico de acesso aos servicos para `src/game/`.
 *
 * O jogo nunca instancia um adapter pelo nome: ele chama `getServices()`. Este
 * arquivo e' o unico lugar do projeto que sabe se o ranking vive no aparelho ou
 * num servidor — e a escolha e' feita por variavel de ambiente, sem que uma
 * linha dentro de `src/game/` mude. E' para isso que o contrato inteiro e'
 * assincrono desde a v1.
 *
 * Sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` o jogo cai nos adapters
 * locais e continua completo: ranking no `localStorage`, modo convidado,
 * validador de plausibilidade rodando igual. O servidor e' um acrescimo, nunca
 * um requisito de boot.
 *
 * As instancias sao unicas por aplicacao. No local, porque `LocalScoreService`
 * guarda os tokens de partida abertos em memoria; no remoto, porque
 * `RemoteSession` renova o token de acesso — duas copias renovariam duas vezes
 * e uma invalidaria a outra.
 */

import { createAuthService } from '@services/local/authService';
import { createScoreService } from '@services/local/scoreService';
import { createSettingsService } from '@services/local/settingsService';
import { readSupabaseConfig } from '@services/remote/config';
import { RemoteAuthService } from '@services/remote/authService';
import { RemoteScoreService } from '@services/remote/scoreService';
import type { SettingsService } from '@services/settings';
import type { AuthService, ScoreService } from '@services/types';

export interface Services {
  auth: AuthService;
  scores: ScoreService;
  settings: SettingsService;
  /** Quem esta' respondendo. Existe para diagnostico — o jogo nao ramifica nisso. */
  backend: 'local' | 'supabase';
}

let services: Services | null = null;

export function getServices(): Services {
  if (!services) services = build();
  return services;
}

function build(): Services {
  // Preferencias (mudo, volume, CRT, tiro automatico) ficam SEMPRE locais: sao
  // do aparelho, nao da conta. Quem joga no celular e no desktop nao quer o CRT
  // que ligou na mesa aparecendo no telefone.
  const settings = createSettingsService();

  const config = readSupabaseConfig();
  if (config) {
    const auth = new RemoteAuthService(config);
    return {
      auth,
      scores: new RemoteScoreService(config, auth.session),
      settings,
      backend: 'supabase',
    };
  }

  const auth = createAuthService();
  return { auth, scores: createScoreService(auth), settings, backend: 'local' };
}
