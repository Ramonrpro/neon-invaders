/**
 * ARQUIVO GERADO — NAO EDITE.
 *
 * Copia de `src/services/validation/limits.ts` para o runtime Deno das Edge Functions, produzida por
 * `npm run supabase:sync`. A unica diferenca em relacao ao original sao os
 * specifiers de import: o Deno nao resolve os aliases do Vite e exige `.ts`.
 *
 * Editar aqui e' trabalho perdido — o proximo sync sobrescreve, e
 * `tests/edgeShared.test.ts` falha antes disso.
 */

/**
 * TETOS TEORICOS DE UMA PARTIDA — a tabela do lado do servidor.
 *
 * Por que estes numeros estao AQUI e nao importados de `src/game/config/`:
 * a fronteira entre os agentes proibe o backend de depender de qualquer coisa
 * dentro de `src/game/`, e o servidor real (Supabase, ver `docs/api-contract.md`)
 * nao vai ter o bundle do jogo do lado dele. O validador precisa ser autonomo.
 *
 * O risco obvio dessa copia e' ela envelhecer: alguem rebalanceia a fase 4, o
 * teto continua o antigo e o ranking passa a recusar partida honesta. Por isso
 * existe `tests/runLimits.test.ts` — ele importa os DOIS lados e falha no
 * instante em que divergirem. A duplicacao e' deliberada; a divergencia, nao.
 *
 * Todo numero aqui e' um TETO, nunca uma media. O validador so' pode recusar o
 * que e' impossivel, jamais o que e' apenas improvavel: acusar um jogador bom
 * de trapaca custa mais do que deixar passar um trapaceiro mediocre.
 */

/** Fases do jogo. */
export const LAST_LEVEL = 5;

/** Pontos por tipo de alien da formacao. */
export const ALIEN_POINTS = { A: 10, B: 20, C: 30 } as const;

/** Quantos aliens de cada tipo existem numa formacao (5 linhas x 11 colunas). */
export const ALIENS_PER_FORMATION = { A: 22, B: 22, C: 11 } as const;

/** 11x30 + 22x20 + 22x10 = 990 pontos por formacao limpa. */
export const FORMATION_SCORE =
  ALIENS_PER_FORMATION.A * ALIEN_POINTS.A +
  ALIENS_PER_FORMATION.B * ALIEN_POINTS.B +
  ALIENS_PER_FORMATION.C * ALIEN_POINTS.C;

/** Pontos por splitter/minion abatido. */
export const SPLITTER_POINTS = 8;

/** Teto de filhos gerados numa fase: todo alien tipo B parte em dois. */
export const MAX_SPLITTERS_PER_FORMATION = ALIENS_PER_FORMATION.B * 2;

/** Fases em que um tipo B pode se partir (`splitChance > 0`). Indice = fase - 1. */
export const LEVEL_HAS_SPLITTERS: readonly boolean[] = [false, false, true, true, true];

/** Pontos da nave-mae de cada fase. Indice = fase - 1. */
export const BOSS_POINTS: readonly number[] = [1000, 1500, 2000, 2500, 3000];

/**
 * HP da nave-mae de cada fase. Vira teto de dano: um acerto no nucleo tira 1,
 * e nenhum projetil tira mais que isso — logo cada chefao custa ao menos `hp`
 * projeteis que acertaram.
 */
export const BOSS_HP: readonly number[] = [40, 55, 70, 85, 100];

/** Bonus maximo e minimo de um UFO abatido. */
export const UFO_MAX_BONUS = 300;
export const UFO_MIN_BONUS = 50;

/** O UFO nunca reaparece antes disto — teto de quantos cabem numa partida. */
export const UFO_MIN_SPAWN_INTERVAL_MS = 20_000;

/** Coletar power-up ja' no nivel maximo vale isto. E' o unico bonus de capsula. */
export const MAXED_POWERUP_POINTS = 500;

/**
 * Cooldown global entre drops de capsula. Nao vale para os 2 drops do chefao,
 * que sao somados a' parte em `maxPowerUpsFor`.
 */
export const POWERUP_MIN_INTERVAL_MS = 10_000;

/** Capsulas largadas pela nave-mae ao morrer. */
export const POWERUPS_PER_BOSS = 2;

/** Invocacao de minions: a nave-mae mais generosa chama 2 a cada 8 s. */
export const MINION_MIN_INTERVAL_MS = 8000;
export const MINION_MAX_COUNT = 2;

/**
 * Piso de duracao de uma fase, em ms.
 *
 * Vem da soma das esperas que nenhuma habilidade encurta: entrada da nave-mae
 * (1,6 s) + pausa apos derrota-la (2,2 s) + pausa entre limpar a formacao e o
 * chefao entrar (1,4 s). Sao 5,2 s de animacao obrigatoria; 6 s deixa margem
 * para o tempo minimo de matar 55 aliens e drenar o HP do chefao.
 */
export const MIN_LEVEL_DURATION_MS = 6000;

/**
 * Teto de projeteis por segundo: cadencia maxima do RAPID (100 ms) com a salva
 * maxima do MULTI (5 projeteis) = 50 por segundo. Passar disso e' autofire de
 * script, nao de dedo.
 */
export const MAX_SHOTS_PER_SECOND = 50;

/** Folga sobre `MAX_SHOTS_PER_SECOND`, para nao punir arredondamento de frame. */
export const SHOT_RATE_TOLERANCE = 1.15;

/** Pontos que a fase `level` (1..5) pode render, sem contar UFO e capsulas. */
export function levelScoreCap(level: number): number {
  const splitters = LEVEL_HAS_SPLITTERS[level - 1]
    ? MAX_SPLITTERS_PER_FORMATION * SPLITTER_POINTS
    : 0;
  return FORMATION_SCORE + splitters + (BOSS_POINTS[level - 1] ?? 0);
}

/**
 * Quantos UFOs cabem numa partida de `durationMs`.
 * O `+1` cobre o primeiro, que ja' pode estar em cena no instante zero.
 */
export function maxUfosFor(durationMs: number): number {
  return Math.floor(durationMs / UFO_MIN_SPAWN_INTERVAL_MS) + 1;
}

/** Quantas capsulas cabem: as do cooldown global mais as dos chefoes abatidos. */
export function maxPowerUpsFor(durationMs: number, bossKills: number): number {
  return (
    Math.floor(durationMs / POWERUP_MIN_INTERVAL_MS) + 1 + bossKills * POWERUPS_PER_BOSS
  );
}

/** Quantos minions a nave-mae consegue invocar em `durationMs`. */
export function maxMinionsFor(durationMs: number): number {
  return (Math.floor(durationMs / MINION_MIN_INTERVAL_MS) + 1) * MINION_MAX_COUNT;
}
