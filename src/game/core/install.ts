/**
 * O que oferecer ao jogador sobre instalar o jogo.
 *
 * Os fatos do navegador vem de `src/pwa/` (que sabe o que e' um
 * `beforeinstallprompt`); a REGRA fica aqui, pura e testada — mesma divisao de
 * `core/crt.ts`. Assim a `SettingsScene` nao precisa saber nada sobre eventos de
 * instalacao para decidir se mostra uma linha de menu.
 */

/** Fatos crus, na forma que `src/pwa/` reporta. */
export interface InstallFacts {
  readonly standalone: boolean;
  readonly promptAvailable: boolean;
  readonly iosSafari: boolean;
}

/**
 * - `prompt`: o navegador instala com um toque.
 * - `manual`: da' para instalar, mas o jogador tem de fazer a mao (iOS).
 * - `installed`: ja' esta' instalado; nao ha' o que oferecer.
 * - `none`: este navegador nao instala. A opcao nem aparece.
 */
export type InstallOption = 'prompt' | 'manual' | 'installed' | 'none';

/**
 * `standalone` ganha de tudo, e a precedencia e' explicita de proposito: o Chrome
 * ja' deixa de disparar o convite quando o app esta' instalado, mas um aparelho
 * que dispare de qualquer forma nao pode fazer o jogo oferecer instalacao a quem
 * abriu justamente pelo icone do app.
 */
export function resolveInstallOption(facts: InstallFacts): InstallOption {
  if (facts.standalone) return 'installed';
  if (facts.promptAvailable) return 'prompt';
  if (facts.iosSafari) return 'manual';
  return 'none';
}
