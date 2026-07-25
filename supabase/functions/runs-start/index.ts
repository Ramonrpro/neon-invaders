/**
 * `POST /runs/start` — abre uma partida.
 *
 * O token devolvido e' a unica porta de entrada de `runs-submit`, vale UMA vez e
 * expira em 2 horas. Ele nao existe para proteger o score (o cliente pode mentir
 * de qualquer jeito): existe para dar ao servidor um RELOGIO DE REFERENCIA. Sem
 * ele, `durationMs` seria mais um numero inventado pelo navegador, e metade das
 * regras do anti-cheat — que sao tetos por unidade de tempo — nao teria contra o
 * que ser conferida.
 *
 * Contrato: `docs/api-contract.md` §2.
 */

import { errorResponse, jsonResponse, preflight } from '../_shared/http.ts';
import { countSince, ensureProfile, originHash, resolveUser, serviceClient } from '../_shared/context.ts';
import {
  HOUR_MS,
  RUN_START_PER_IP_PER_HOUR,
  RUN_START_PER_USER_PER_HOUR,
  RUN_TOKEN_TTL_MS,
} from '../_shared/limits.ts';

/** Chance de podar tokens vencidos nesta chamada. Ver o comentario no fim. */
const PRUNE_CHANCE = 0.05;

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
  // Convidado tambem tem conta — o modo anonimo do GoTrue emite um usuario de
  // verdade. Chegar aqui sem nenhuma sessao e' bug de cliente, nao caso de uso.
  if (!user) return errorResponse('NOT_AUTHENTICATED', 'sessao ausente ou invalida', 401);

  const ip = await originHash(req);

  const byUser = await countSince(admin, 'run_tokens', 'user_id', user.id, HOUR_MS, 'started_at');
  if (byUser >= RUN_START_PER_USER_PER_HOUR) {
    return errorResponse('RATE_LIMITED', 'partidas demais nesta hora', 429);
  }
  if (ip) {
    const byIp = await countSince(admin, 'run_tokens', 'ip_hash', ip, HOUR_MS, 'started_at');
    if (byIp >= RUN_START_PER_IP_PER_HOUR) {
      return errorResponse('RATE_LIMITED', 'partidas demais nesta hora', 429);
    }
  }

  // Perfil garantido AQUI, no comeco da partida, e nao no fim: a view do ranking
  // e' um JOIN com `profiles`, e descobrir a falta dele so' na submissao faria a
  // partida sumir depois de jogada.
  await ensureProfile(admin, user.id, user.displayName);

  const { data, error } = await admin
    .from('run_tokens')
    .insert({ user_id: user.id, ip_hash: ip })
    .select('token, started_at')
    .single();

  if (error || !data) {
    return errorResponse('UNAVAILABLE', 'nao foi possivel abrir a partida', 500);
  }

  // Poda oportunista: 1 chamada em 20 limpa os tokens vencidos. Com pg_cron
  // habilitado isto e' redundante e inofensivo; sem ele, e' o que impede a
  // tabela de crescer para sempre — e ninguem espera pela resposta.
  if (Math.random() < PRUNE_CHANCE) {
    void admin.rpc('prune_run_tokens');
  }

  const startedAt = Date.parse(data.started_at as string);
  return jsonResponse({
    runToken: data.token as string,
    expiresAt: new Date(startedAt + RUN_TOKEN_TTL_MS).toISOString(),
  });
});
