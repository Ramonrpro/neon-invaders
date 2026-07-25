/**
 * Estado da partida e regra de fim de onda. Logica pura.
 *
 * `dying` congela a acao por ~1 s depois que a nave explode; `cleared` e' o
 * intervalo entre a formacao limpa e a entrada da nave-mae. Em ambos os
 * projeteis continuam se movendo mas nada colide — o jogador ve o resultado do
 * golpe antes do jogo seguir.
 */
export type PlayState = 'playing' | 'dying' | 'cleared' | 'gameover';

export interface WaveStatus {
  readonly state: PlayState;
  /** A nave-mae ja' esta' em cena? */
  readonly bossActive: boolean;
  /** Nenhum alien vivo na formacao. */
  readonly formationCleared: boolean;
  /** Splitters ainda descendo — filhotes de alien partido contam como formacao. */
  readonly splittersAlive: number;
}

/**
 * A onda acabou (e a nave-mae pode entrar)?
 *
 * Esta pergunta e' feita A CADA FRAME, e nao no momento de cada morte, porque
 * um splitter sai de cena por quatro caminhos diferentes: abatido, escapando
 * pela base, matando o jogador ou recolhido no respawn. Amarrar a checagem so'
 * ao abate travava a fase 3 — a primeira com `splitChance` > 0 — sempre que o
 * ULTIMO alien se partia e os filhotes saiam por qualquer um dos outros tres:
 * formacao vazia, nenhum splitter, e ninguem para chamar o chefao.
 *
 * O guarda do chefao e' essencial: durante a luta a formacao ja' esta' vazia, e
 * sem ele todo frame pediria uma nave-mae nova.
 */
export function isWaveCleared(status: WaveStatus): boolean {
  if (status.state !== 'playing' || status.bossActive) return false;
  return status.formationCleared && status.splittersAlive === 0;
}
