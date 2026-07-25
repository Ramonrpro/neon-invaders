import { describe, expect, it } from 'vitest';
import { resolveInstallOption, type InstallFacts } from '@game/core/install';

const facts = (partial: Partial<InstallFacts>): InstallFacts => ({
  standalone: false,
  promptAvailable: false,
  iosSafari: false,
  ...partial,
});

describe('resolveInstallOption', () => {
  it('quem ja esta no app instalado nunca ve oferta de instalacao', () => {
    // Inclusive se o navegador insistir em oferecer o convite, e inclusive no
    // iOS: abrir pelo icone e receber "instale o app" e' bug visivel.
    expect(resolveInstallOption(facts({ standalone: true }))).toBe('installed');
    expect(resolveInstallOption(facts({ standalone: true, promptAvailable: true }))).toBe(
      'installed',
    );
    expect(resolveInstallOption(facts({ standalone: true, iosSafari: true }))).toBe('installed');
    expect(resolveInstallOption({ standalone: true, promptAvailable: true, iosSafari: true })).toBe(
      'installed',
    );
  });

  it('convite nativo disponivel vira instalacao com um toque', () => {
    expect(resolveInstallOption(facts({ promptAvailable: true }))).toBe('prompt');
    // No iOS o convite nao existe; se existisse, ele ganharia da instrucao manual.
    expect(resolveInstallOption(facts({ promptAvailable: true, iosSafari: true }))).toBe('prompt');
  });

  it('iOS sem convite e o unico caminho para a instrucao manual', () => {
    expect(resolveInstallOption(facts({ iosSafari: true }))).toBe('manual');
  });

  it('navegador que nao instala nao mostra nada', () => {
    expect(resolveInstallOption(facts({}))).toBe('none');
  });
});
