/**
 * `POST /runs/submit` — a partida chega como PROPOSTA e sai como veredito.
 *
 * Esta funcao e' o unico caminho pelo qual uma linha entra em `scores`. A RLS da
 * tabela nao tem policy de insert; quem grava e' a service_role, que so' existe
 * aqui dentro. E' isso — e nao a obscuridade do bundle — que torna o validador
 * inescapavel.
 *
 * A ordem das checagens vai da mais barata a' mais cara, e a primeira que falha
 * e' a resposta:
 *
 *   rate limit → token → duracao → plausibilidade → gravacao
 *
 * RECUSA NAO E' ERRO HTTP. Volta 200 com `{ accepted: false, reason }`, porque a
 * tela de fim de jogo tem de continuar normal para quem acabou de jogar. O que a
 * pessoa perde e' a linha no ranking, nunca a partida.
 *
 * Contrato: `docs/api-contract.md` §2. Criterios: `docs/anti-cheat.md`.
 */

import { errorResponse, jsonResponse, preflight } from '../_shared/http.ts';
import { countSince, ensureProfile, originHash, resolveUser, serviceClient } from '../_shared/context.ts';
import {
  CLOCK_TOLERANCE_MS,
  HOUR_MS,
  LEADERBOARD_CAPACITY,
  RUN_TOKEN_TTL_MS,
  SUBMIT_MIN_INTERVAL_MS,
  SUBMIT_PER_IP_PER_HOUR,
  SUBMIT_PER_USER_PER_HOUR,
} from '../_shared/limits.ts';
import type { RunSubmission } from '../_shared/validation/types.ts';
import { validateRun } from '../_shared/validation/plausibility.ts';

/** Resposta de recusa, no formato que `RunReporter` ja' sabe ler. */
function refuse(reason: string): Response {
  return jsonResponse({ accepted: false, reason });
}

Deno.serve(async (req: Request): Promise<Response> => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') {
    return errorResponse('UNAVAILABLE', 'metodo nao suportado', 405);
  }

  let admin;
  try {
    admin = serviceClient();
  } catch {
    return errorResponse('UNAVAILABLE', 'funcao mal configurada', 500);
  }

  const user = await resolveUser(admin, req);
  if (!user) return errorResponse('NOT_AUTHENTICATED', 'sessao ausente ou invalida', 401);

  const ip = await originHash(req);

  /**
   * Registra a tentativa — aceita ou recusada. E' desta tabela que sai a
   * contagem do rate limit, entao ela conta TENTATIVA: contar so' o que foi
   * aceito deixaria um script tentar sem limite ate' acertar um payload
   * coerente.
   *
   * A unica coisa que NAO entra aqui e' a recusa por rate limit — ver o porque
   * na secao seguinte.
   */
  const audit = async (accepted: boolean, reason: string | null, score: unknown) => {
    const value = typeof score === 'number' && Number.isSafeInteger(score) ? score : null;
    await admin
      .from('submissions')
      .insert({ user_id: user.id, ip_hash: ip, accepted, reason, score: value });
  };

  let sub: RunSubmission;
  try {
    sub = (await req.json()) as RunSubmission;
  } catch {
    await audit(false, 'MALFORMED', null);
    return refuse('MALFORMED');
  }
  if (!sub || typeof sub.runToken !== 'string') {
    await audit(false, 'MALFORMED', null);
    return refuse('MALFORMED');
  }

  // ------------------------------------------------------------ rate limit
  // Recusa por rate limit nao vira linha de auditoria, de proposito: a contagem
  // sai desta mesma tabela, e registrar o bloqueio faria cada tentativa barrada
  // empurrar a janela para a frente — quem esbarrasse no teto uma vez ficaria
  // preso enquanto insistisse. O teto pune o excesso, nao a teimosia.
  const byUser = await countSince(admin, 'submissions', 'user_id', user.id, HOUR_MS, 'created_at');
  if (byUser >= SUBMIT_PER_USER_PER_HOUR) return refuse('RATE_LIMITED');
  if (ip) {
    const byIp = await countSince(admin, 'submissions', 'ip_hash', ip, HOUR_MS, 'created_at');
    if (byIp >= SUBMIT_PER_IP_PER_HOUR) return refuse('RATE_LIMITED');
  }

  const { data: recent } = await admin
    .from('submissions')
    .select('created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent && Date.now() - Date.parse(recent.created_at as string) < SUBMIT_MIN_INTERVAL_MS) {
    return refuse('RATE_LIMITED');
  }

  // ----------------------------------------------------------------- token
  // Consumo ATOMICO: o `used_at is null` no WHERE e' a corrida resolvida pelo
  // banco. Ler-depois-escrever deixaria duas submissoes simultaneas do mesmo
  // token passarem as duas.
  const cutoff = new Date(Date.now() - RUN_TOKEN_TTL_MS).toISOString();
  const { data: claimed } = await admin
    .from('run_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', sub.runToken)
    .eq('user_id', user.id)
    .is('used_at', null)
    .gte('started_at', cutoff)
    .select('started_at')
    .maybeSingle();

  if (!claimed) {
    await audit(false, 'UNKNOWN_RUN_TOKEN', sub.score);
    return refuse('UNKNOWN_RUN_TOKEN');
  }

  // --------------------------------------------------------------- duracao
  // So' teto: o relogio do Phaser PARA quando a aba perde o foco, entao declarar
  // menos tempo do que passou e' rotina. Declarar mais e' impossivel.
  const elapsed = Date.now() - Date.parse(claimed.started_at as string);
  if (typeof sub.durationMs !== 'number' || sub.durationMs > elapsed + CLOCK_TOLERANCE_MS) {
    await audit(false, 'DURATION_MISMATCH', sub.score);
    return refuse('DURATION_MISMATCH');
  }

  // -------------------------------------------------------- plausibilidade
  // O MESMO codigo que roda no cliente, sincronizado por `npm run supabase:sync`.
  const verdict = validateRun(sub);
  if (!verdict.plausible) {
    await audit(false, verdict.reason ?? 'IMPLAUSIBLE', sub.score);
    return refuse(verdict.reason ?? 'IMPLAUSIBLE');
  }

  // ------------------------------------------------------------- gravacao
  await ensureProfile(admin, user.id, user.displayName);

  const { data: inserted, error } = await admin
    .from('scores')
    .insert({
      user_id: user.id,
      score: sub.score,
      level_reached: sub.levelReached,
      duration_ms: sub.durationMs,
      completed_game: sub.completedGame === true,
      events: sub.events,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    await audit(false, 'UNAVAILABLE', sub.score);
    return errorResponse('UNAVAILABLE', 'nao foi possivel gravar a partida', 500);
  }

  await audit(true, null, sub.score);

  // `rank` ausente com `accepted: true` significa "gravada, fora das 100
  // melhores". Fora da tabela nao e' recusa — a UI mostra so' a pontuacao.
  const { data: rank } = await admin.rpc('score_rank', { target: inserted.id as string });
  const position = typeof rank === 'number' && rank <= LEADERBOARD_CAPACITY ? rank : null;

  return jsonResponse(position === null ? { accepted: true } : { accepted: true, rank: position });
});
