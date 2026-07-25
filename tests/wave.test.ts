import { describe, expect, it } from 'vitest';
import { isWaveCleared, type WaveStatus } from '@game/core/wave';
import { LEVELS } from '@game/config/levels';

const playing: WaveStatus = {
  state: 'playing',
  bossActive: false,
  formationCleared: false,
  splittersAlive: 0,
};

describe('isWaveCleared', () => {
  it('a onda so acaba com a formacao vazia', () => {
    expect(isWaveCleared(playing)).toBe(false);
    expect(isWaveCleared({ ...playing, formationCleared: true })).toBe(true);
  });

  it('filhote de alien partido segura a onda', () => {
    // Splitter e' formacao: chamar a nave-mae com um deles ainda descendo
    // deixaria dois inimigos de origens diferentes na tela ao mesmo tempo.
    expect(isWaveCleared({ ...playing, formationCleared: true, splittersAlive: 1 })).toBe(false);
    expect(isWaveCleared({ ...playing, formationCleared: true, splittersAlive: 2 })).toBe(false);
  });

  it('REGRESSAO: o ultimo alien se parte e os filhotes escapam pela base', () => {
    // O travamento da fase 3. O ultimo alien vivo era tipo B, partiu-se, e os
    // dois filhotes sairam pela base em vez de serem abatidos. Com a checagem
    // amarrada so' ao abate, ninguem mais perguntava se a onda tinha acabado e
    // o chefao nunca entrava. Por frame, o estado seguinte fecha a onda.
    expect(LEVELS[2]!.splitChance).toBeGreaterThan(0);

    const comFilhotes = { ...playing, formationCleared: true, splittersAlive: 2 };
    expect(isWaveCleared(comFilhotes)).toBe(false);
    expect(isWaveCleared({ ...comFilhotes, splittersAlive: 0 })).toBe(true);
  });

  it('durante a luta a formacao esta vazia, e isso nao chama outra nave-mae', () => {
    expect(isWaveCleared({ ...playing, formationCleared: true, bossActive: true })).toBe(false);
    // Minion abatido no meio da luta: mesmo estado, mesma resposta.
    expect(
      isWaveCleared({ ...playing, formationCleared: true, bossActive: true, splittersAlive: 0 }),
    ).toBe(false);
  });

  it('so o estado `playing` fecha onda', () => {
    const limpa = { ...playing, formationCleared: true };
    // `cleared` ja' esta' esperando a nave-mae; repetir chamaria o chefao duas
    // vezes. `dying` e `gameover` nao tem partida em andamento.
    expect(isWaveCleared({ ...limpa, state: 'cleared' })).toBe(false);
    expect(isWaveCleared({ ...limpa, state: 'dying' })).toBe(false);
    expect(isWaveCleared({ ...limpa, state: 'gameover' })).toBe(false);
  });
});
