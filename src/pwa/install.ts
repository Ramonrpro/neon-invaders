/**
 * Instalacao do jogo na tela de inicio.
 *
 * Este modulo reporta FATOS do navegador e nada mais — nao decide o que mostrar.
 * A politica (qual opcao oferecer, se alguma) e' logica pura e mora em
 * `game/core/install.ts`, com teste. Mesma divisao de `core/crt.ts`: aqui o
 * ambiente, la' a regra.
 *
 * Fronteira de agentes (CLAUDE.md secao 4): `src/pwa/` e' a casca do app, dono
 * de `main.ts` e `index.html`. Nao e' `src/game/` nem `src/services/`. Ele expoe
 * ao jogo funcoes pequenas, sem rede, sem storage e sem endpoint — do mesmo
 * formato do contrato de `src/services/`.
 */

/**
 * O evento que o Chrome dispara quando o app e' instalavel. Nao existe no lib do
 * TypeScript porque nao esta' padronizado.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** O Safari antigo marcava app instalado aqui, fora de qualquer especificacao. */
interface LegacyStandaloneNavigator {
  standalone?: boolean;
}

export interface InstallFacts {
  /** Rodando como app instalado (janela propria, sem barra de navegador). */
  readonly standalone: boolean;
  /** O navegador ofereceu instalacao e o convite esta' guardado. */
  readonly promptAvailable: boolean;
  /** iOS/iPadOS: instala pela folha de compartilhamento, sem evento nenhum. */
  readonly iosSafari: boolean;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

let deferred: BeforeInstallPromptEvent | null = null;
let standalone = false;
let started = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return (navigator as Navigator & LegacyStandaloneNavigator).standalone === true;
}

/*
 * Sniffing de user agent, e sim, e' o que parece. Nao existe feature test para
 * "este navegador instala pela folha de compartilhamento": o iOS simplesmente
 * nunca dispara `beforeinstallprompt`, entao a ausencia do evento e'
 * indistinguivel de "este navegador nao instala nada". A checagem do iPad e'
 * necessaria porque o iPadOS se apresenta como macOS desde a versao 13 — o que
 * o denuncia e' um Mac com tela de toque.
 */
function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/**
 * Comeca a escutar. Chamada de `main.ts` ANTES de o Phaser subir: o Chrome
 * dispara `beforeinstallprompt` logo depois de parsear o manifest, muito antes
 * do primeiro frame, e um listener instalado depois perde o evento para sempre
 * naquela visita.
 */
export function initInstall(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  standalone = isStandalone();

  window.addEventListener('beforeinstallprompt', (event) => {
    // Sem o `preventDefault` o Chrome pode mostrar a faixa dele por cima do jogo.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    standalone = true;
    notify();
  });

  // O jogador pode instalar e voltar sem recarregar, ou abrir a versao instalada
  // enquanto a aba do navegador continua viva.
  window.matchMedia('(display-mode: standalone)').addEventListener('change', (event) => {
    standalone = event.matches;
    notify();
  });
}

export function installAvailability(): InstallFacts {
  return { standalone, promptAvailable: deferred !== null, iosSafari: isIosSafari() };
}

/**
 * Abre o dialogo nativo de instalacao.
 *
 * O convite serve UMA vez: depois de usado, o navegador nao o devolve, e por isso
 * ele e' descartado aqui mesmo — guardar o objeto morto faria a linha de ajustes
 * continuar dizendo "disponivel" para sempre.
 */
export async function promptInstall(): Promise<InstallOutcome> {
  const event = deferred;
  if (event === null) return 'unavailable';

  // Descartado ANTES de abrir: chamar `prompt()` duas vezes no mesmo evento
  // lanca excecao. O aviso aos interessados, porem, so' sai depois da escolha —
  // notificar agora faria a tela de ajustes se reconstruir com o dialogo nativo
  // do navegador aberto em cima dela.
  deferred = null;

  await event.prompt();
  const { outcome } = await event.userChoice;
  notify();
  return outcome;
}

/** Assina mudancas de disponibilidade. Devolve o cancelamento. */
export function onInstallChange(handler: () => void): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}
