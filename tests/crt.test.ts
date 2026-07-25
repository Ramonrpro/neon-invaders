import { describe, expect, it } from 'vitest';
import { nextCrtPreference, resolveCrtEnabled } from '@game/core/crt';
import { DEFAULT_SETTINGS } from '@services/settings';
import { CRT } from '@game/config/juice';

describe('resolveCrtEnabled', () => {
  it('respeita a escolha explicita do jogador nos dois aparelhos', () => {
    expect(resolveCrtEnabled(true, true)).toBe(true);
    expect(resolveCrtEnabled(true, false)).toBe(true);
    expect(resolveCrtEnabled(false, true)).toBe(false);
    expect(resolveCrtEnabled(false, false)).toBe(false);
  });

  it("'auto' liga no desktop e desliga no toque", () => {
    expect(resolveCrtEnabled('auto', false)).toBe(true);
    expect(resolveCrtEnabled('auto', true)).toBe(false);
  });

  it('o padrao de fabrica e indeciso, nao desligado', () => {
    // Se isto virar `false`, o desktop perde o CRT no primeiro boot e o efeito
    // passa a existir so' para quem foi ate' a tela de ajustes.
    expect(DEFAULT_SETTINGS.crt).toBe('auto');
  });
});

describe('nextCrtPreference', () => {
  it('o primeiro toque sempre inverte o que esta na tela', () => {
    expect(nextCrtPreference('auto', false)).toBe(false);
    expect(nextCrtPreference('auto', true)).toBe(true);
    expect(nextCrtPreference(true, false)).toBe(false);
    expect(nextCrtPreference(false, true)).toBe(true);
  });
});

describe('CRT config', () => {
  it('a scanline nao pode comer o grao de 2 px da arte', () => {
    expect(CRT.scanlinePeriodPx).toBeGreaterThanOrEqual(3);
  });

  it('o banho de fosforo e a cintilacao ficam abaixo do perceptivel', () => {
    // Acima disso o efeito para de ser "monitor ligado" e vira filtro verde.
    expect(CRT.glowAlpha).toBeLessThanOrEqual(0.1);
    expect(CRT.flickerAmplitude).toBeLessThanOrEqual(0.1);
  });
});
