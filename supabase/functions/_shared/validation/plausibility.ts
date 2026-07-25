/**
 * ARQUIVO GERADO — NAO EDITE.
 *
 * Copia de `src/services/validation/plausibility.ts` para o runtime Deno das Edge Functions, produzida por
 * `npm run supabase:sync`. A unica diferenca em relacao ao original sao os
 * specifiers de import: o Deno nao resolve os aliases do Vite e exige `.ts`.
 *
 * Editar aqui e' trabalho perdido — o proximo sync sobrescreve, e
 * `tests/edgeShared.test.ts` falha antes disso.
 */

/**
 * VALIDADOR DE PLAUSIBILIDADE DE RUN.
 *
 * Roda local hoje (dentro de `LocalScoreService`) e no servidor amanha, sem
 * mudar uma linha: e' logica pura, sem storage, sem rede, sem Phaser.
 *
 * O que ele responde nao e' "este jogador trapaceou?", e' "esta partida podia
 * ter acontecido?". A diferenca importa: cada regra aqui e' um limite FISICO do
 * jogo (quantos aliens existem numa fase, quanto HP tem cada chefao, quantos
 * projeteis cabem num segundo). Nada de heuristica de "score alto demais para
 * um humano" — jogador bom nao pode ser recusado.
 *
 * A lista completa do raciocinio esta' em `docs/anti-cheat.md`.
 */

import type { RunSubmission } from './types.ts';
import {
  ALIENS_PER_FORMATION,
  ALIEN_POINTS,
  BOSS_HP,
  BOSS_POINTS,
  LAST_LEVEL,
  LEVEL_HAS_SPLITTERS,
  MAXED_POWERUP_POINTS,
  MAX_SHOTS_PER_SECOND,
  MAX_SPLITTERS_PER_FORMATION,
  MIN_LEVEL_DURATION_MS,
  SHOT_RATE_TOLERANCE,
  SPLITTER_POINTS,
  UFO_MAX_BONUS,
  UFO_MIN_BONUS,
  levelScoreCap,
  maxMinionsFor,
  maxPowerUpsFor,
  maxUfosFor,
} from './limits.ts';

export type RejectionReason =
  /** Campo faltando, negativo, fracionario ou nao numerico. */
  | 'MALFORMED'
  /** Fase fora de 1..5, ou incoerente com `completedGame`. */
  | 'INVALID_LEVEL'
  /** Rapida demais para as animacoes obrigatorias das fases alcancadas. */
  | 'DURATION_TOO_SHORT'
  /** Mais abates do que existem alvos nas fases alcancadas. */
  | 'IMPOSSIBLE_KILLS'
  /** Score acima do teto teorico da partida. */
  | 'SCORE_ABOVE_CAP'
  /** Score nao fecha com os abates declarados, para cima ou para baixo. */
  | 'SCORE_MISMATCH'
  /** Menos projeteis do que o necessario para produzir os abates declarados. */
  | 'SHOTS_TOO_FEW'
  /** Mais projeteis do que a cadencia maxima permite no tempo declarado. */
  | 'SHOTS_TOO_MANY';

export interface PlausibilityVerdict {
  plausible: boolean;
  /** `null` quando plausivel. */
  reason: RejectionReason | null;
  /** Texto de log. Nunca vai para a tela do jogador. */
  detail: string;
  /** Teto teorico calculado para esta partida. Util em log e em teste. */
  maxScore: number;
}

function ok(maxScore: number): PlausibilityVerdict {
  return { plausible: true, reason: null, detail: '', maxScore };
}

function reject(reason: RejectionReason, detail: string, maxScore: number): PlausibilityVerdict {
  return { plausible: false, reason, detail, maxScore };
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Soma dos pontos dos chefoes das fases 1..`count`. */
function bossPointsUpTo(count: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) total += BOSS_POINTS[i] ?? 0;
  return total;
}

/** Soma do HP dos chefoes das fases 1..`count` — o piso de acertos que custaram. */
function bossHpUpTo(count: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) total += BOSS_HP[i] ?? 0;
  return total;
}

/** Teto de splitters gerados pela formacao ate' a fase `levelReached`. */
function splitterCapUpTo(levelReached: number): number {
  let total = 0;
  for (let level = 1; level <= levelReached; level++) {
    if (LEVEL_HAS_SPLITTERS[level - 1]) total += MAX_SPLITTERS_PER_FORMATION;
  }
  return total;
}

/** Teto absoluto de pontos de uma partida que chegou a' fase `levelReached`. */
export function theoreticalMaxScore(levelReached: number, durationMs: number): number {
  let total = 0;
  for (let level = 1; level <= levelReached; level++) total += levelScoreCap(level);
  total += maxUfosFor(durationMs) * UFO_MAX_BONUS;
  total += maxPowerUpsFor(durationMs, levelReached) * MAXED_POWERUP_POINTS;
  total += maxMinionsFor(durationMs) * SPLITTER_POINTS;
  return total;
}

/**
 * Verdadeiro se a partida podia ter acontecido.
 *
 * As checagens vao da mais barata a' mais cara, e a primeira que falha e'
 * a resposta — o motivo devolvido e' o mais especifico possivel para que o log
 * do servidor sirva para alguma coisa no dia em que alguem reclamar.
 */
export function validateRun(sub: RunSubmission): PlausibilityVerdict {
  const { score, levelReached, durationMs, completedGame, events } = sub;

  // ---------------------------------------------------------------- formato
  if (!isCount(score) || !isCount(durationMs) || !isCount(levelReached)) {
    return reject('MALFORMED', 'score, duracao ou fase nao sao inteiros nao-negativos', 0);
  }
  if (typeof completedGame !== 'boolean' || !events || typeof events !== 'object') {
    return reject('MALFORMED', 'completedGame ou events ausentes', 0);
  }

  const { alienKills, splitterKills, ufoKills, bossKills, powerUpsCollected, shotsFired } = events;
  if (!alienKills || !isCount(alienKills.A) || !isCount(alienKills.B) || !isCount(alienKills.C)) {
    return reject('MALFORMED', 'contadores de alien invalidos', 0);
  }
  if (
    !isCount(splitterKills) ||
    !isCount(ufoKills) ||
    !isCount(bossKills) ||
    !isCount(powerUpsCollected) ||
    !isCount(shotsFired)
  ) {
    return reject('MALFORMED', 'contadores de eventos invalidos', 0);
  }

  // ------------------------------------------------------------------ fase
  if (levelReached < 1 || levelReached > LAST_LEVEL) {
    return reject('INVALID_LEVEL', `fase ${levelReached} fora de 1..${LAST_LEVEL}`, 0);
  }

  const maxScore = theoreticalMaxScore(levelReached, durationMs);

  // Terminar o jogo e' abater as cinco naves-mae — nao ha' outro caminho.
  if (completedGame && (levelReached !== LAST_LEVEL || bossKills !== LAST_LEVEL)) {
    return reject('INVALID_LEVEL', 'vitoria sem as cinco naves-mae abatidas', maxScore);
  }
  // Abater o chefao da fase N ja' leva a' fase N+1: quem parou na fase N so'
  // pode ter derrubado N-1 chefoes.
  if (!completedGame && bossKills > levelReached - 1) {
    return reject('INVALID_LEVEL', `${bossKills} chefoes com a partida na fase ${levelReached}`, maxScore);
  }

  // --------------------------------------------------------------- duracao
  const completedLevels = completedGame ? LAST_LEVEL : levelReached - 1;
  const minDuration = completedLevels * MIN_LEVEL_DURATION_MS;
  if (durationMs < minDuration) {
    return reject(
      'DURATION_TOO_SHORT',
      `${durationMs} ms para ${completedLevels} fases completas (minimo ${minDuration} ms)`,
      maxScore,
    );
  }

  // ---------------------------------------------------------------- abates
  const alienCaps = {
    A: ALIENS_PER_FORMATION.A * levelReached,
    B: ALIENS_PER_FORMATION.B * levelReached,
    C: ALIENS_PER_FORMATION.C * levelReached,
  };
  if (
    alienKills.A > alienCaps.A ||
    alienKills.B > alienCaps.B ||
    alienKills.C > alienCaps.C
  ) {
    return reject('IMPOSSIBLE_KILLS', 'mais aliens abatidos do que a formacao tem', maxScore);
  }

  const splitterCap = splitterCapUpTo(levelReached) + maxMinionsFor(durationMs);
  if (splitterKills > splitterCap) {
    return reject('IMPOSSIBLE_KILLS', `${splitterKills} splitters (teto ${splitterCap})`, maxScore);
  }

  const ufoCap = maxUfosFor(durationMs);
  if (ufoKills > ufoCap) {
    return reject('IMPOSSIBLE_KILLS', `${ufoKills} UFOs em ${durationMs} ms (teto ${ufoCap})`, maxScore);
  }

  const powerUpCap = maxPowerUpsFor(durationMs, bossKills);
  if (powerUpsCollected > powerUpCap) {
    return reject('IMPOSSIBLE_KILLS', `${powerUpsCollected} capsulas (teto ${powerUpCap})`, maxScore);
  }

  // -------------------------------------------------------------- projeteis
  // Um projetil acerta no maximo um alvo, e o nucleo do chefao tira 1 de HP por
  // acerto — logo os abates declarados tem um custo minimo em tiros.
  const minShots =
    alienKills.A +
    alienKills.B +
    alienKills.C +
    splitterKills +
    ufoKills +
    bossHpUpTo(bossKills);
  if (shotsFired < minShots) {
    return reject('SHOTS_TOO_FEW', `${shotsFired} tiros para um custo minimo de ${minShots}`, maxScore);
  }

  const maxShots = Math.ceil(
    (durationMs / 1000) * MAX_SHOTS_PER_SECOND * SHOT_RATE_TOLERANCE + MAX_SHOTS_PER_SECOND,
  );
  if (shotsFired > maxShots) {
    return reject('SHOTS_TOO_MANY', `${shotsFired} tiros em ${durationMs} ms (teto ${maxShots})`, maxScore);
  }

  // ------------------------------------------------------------------ score
  if (score > maxScore) {
    return reject('SCORE_ABOVE_CAP', `${score} acima do teto ${maxScore}`, maxScore);
  }

  const killScore =
    alienKills.A * ALIEN_POINTS.A +
    alienKills.B * ALIEN_POINTS.B +
    alienKills.C * ALIEN_POINTS.C +
    splitterKills * SPLITTER_POINTS +
    bossPointsUpTo(bossKills);
  // O UFO vale de 50 a 300, sorteado; a capsula no nivel maximo vale 500 ou
  // nada. E' dai' que sai a faixa em que o score declarado tem de cair.
  const minFromKills = killScore + ufoKills * UFO_MIN_BONUS;
  const maxFromKills =
    killScore + ufoKills * UFO_MAX_BONUS + powerUpsCollected * MAXED_POWERUP_POINTS;

  if (score < minFromKills || score > maxFromKills) {
    return reject(
      'SCORE_MISMATCH',
      `score ${score} fora da faixa [${minFromKills}, ${maxFromKills}] dos abates declarados`,
      maxScore,
    );
  }

  return ok(maxScore);
}
