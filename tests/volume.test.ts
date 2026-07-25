import { describe, expect, it } from 'vitest';
import { VOLUME_STEP, cycleVolume, stepVolume, volumeBar } from '@game/core/volume';
import { DEFAULT_SETTINGS } from '@services/settings';

describe('cycleVolume', () => {
  it('sobe um degrau por acionamento', () => {
    expect(cycleVolume(0)).toBeCloseTo(0.2, 10);
    expect(cycleVolume(0.4)).toBeCloseTo(0.6, 10);
  });

  it('da a volta ao silencio depois do maximo', () => {
    // Sem a volta, quem joga no dedo nao teria como baixar o volume: nao ha'
    // "seta para a esquerda" no toque.
    expect(cycleVolume(1)).toBe(0);
  });

  it('nao acumula erro de ponto flutuante ao dar voltas', () => {
    let volume = 0;
    for (let i = 0; i < 60; i++) {
      volume = cycleVolume(volume);
      expect(Number.isInteger(Math.round(volume * 10))).toBe(true);
      expect(volume).toBeGreaterThanOrEqual(0);
      expect(volume).toBeLessThanOrEqual(1);
    }
  });
});

describe('stepVolume', () => {
  it('anda um degrau para cada lado', () => {
    expect(stepVolume(0.6, 1)).toBeCloseTo(0.8, 10);
    expect(stepVolume(0.6, -1)).toBeCloseTo(0.4, 10);
  });

  it('para no piso e no teto em vez de dar a volta', () => {
    // Diferente do acionamento: quem tem seta espera um limite, nao um salto do
    // volume maximo para o silencio.
    expect(stepVolume(1, 1)).toBe(1);
    expect(stepVolume(0, -1)).toBe(0);
  });
});

describe('volumeBar', () => {
  it('desenha a barra em cinco degraus', () => {
    expect(volumeBar(0)).toBe('.....');
    expect(volumeBar(0.6)).toBe('###..');
    expect(volumeBar(1)).toBe('#####');
  });

  it('aguenta um valor corrompido vindo do storage', () => {
    expect(volumeBar(-3)).toBe('.....');
    expect(volumeBar(9)).toBe('#####');
  });

  it('o padrao de fabrica e volume cheio', () => {
    expect(DEFAULT_SETTINGS.volume).toBe(1);
    expect(volumeBar(DEFAULT_SETTINGS.volume)).toBe('#####');
  });

  it('o degrau divide 1 em partes inteiras', () => {
    expect(Number.isInteger(1 / VOLUME_STEP)).toBe(true);
  });
});
