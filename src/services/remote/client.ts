/**
 * Cliente HTTP do Supabase. Sem `@supabase/supabase-js`, de proposito.
 *
 * O que este jogo usa do servidor cabe em cinco rotas do GoTrue, duas consultas
 * ao PostgREST e duas Edge Functions — tudo `fetch` com dois cabecalhos. O SDK
 * traria um bundle inteiro, um segundo mecanismo de persistencia de sessao (que
 * escreveria em `localStorage` por fora do `JsonStore`, o unico arquivo do
 * projeto autorizado a isso) e um modelo de erro diferente do contrato. O jogo
 * ja' nao carrega um unico asset externo; nao vai ser aqui que ele comeca.
 *
 * As tres formas de erro que este arquivo precisa reconhecer:
 *
 * 1. **Edge Function nossa** — `{ error: { code, message } }`, o formato do
 *    contrato (`docs/api-contract.md` §1).
 * 2. **GoTrue** — `{ error_code, msg }` ou `{ error, error_description }`.
 * 3. **PostgREST** — `{ code, message, details, hint }`.
 */

import { ServiceError, type ServiceErrorCode } from '@services/types';
import type { SupabaseConfig } from '@services/remote/config';

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT';
  /** Corpo JSON. Ausente vira requisicao sem corpo. */
  body?: unknown;
  /** Sessao do jogador. Sem ela, a chamada vai como `anon`. */
  accessToken?: string | undefined;
  /** Cabecalhos extras (`Prefer` do PostgREST, por exemplo). */
  headers?: Record<string, string>;
}

/** Corpo de erro em qualquer uma das tres formas conhecidas. */
interface ErrorBody {
  error?: string | { code?: string; message?: string };
  error_code?: string;
  error_description?: string;
  code?: string | number;
  msg?: string;
  message?: string;
}

/**
 * Uma chamada JSON ao projeto.
 *
 * `credentials: 'omit'` de proposito: a sessao viaja no cabecalho
 * `Authorization`, nunca em cookie. Cookie de terceiro nao sobrevive ao Safari
 * nem ao modo privado, que sao exatamente os navegadores em que este jogo mais
 * roda.
 */
export async function supabaseFetch<T>(
  config: SupabaseConfig,
  path: string,
  options: RequestOptions,
): Promise<T> {
  const headers: Record<string, string> = {
    // O `apikey` identifica o PROJETO e e' exigido em toda rota, inclusive nas
    // que ja' levam um token de sessao no `Authorization`. Esquecer dele
    // devolve 401 sem explicacao nenhuma.
    apikey: config.anonKey,
    authorization: `Bearer ${options.accessToken ?? config.anonKey}`,
    ...options.headers,
  };
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${config.url}${path}`, {
      method: options.method,
      headers,
      credentials: 'omit',
      body: options.body === undefined ? null : JSON.stringify(options.body),
    });
  } catch {
    // Rede fora do ar nao pode virar excecao crua na Scene: o jogo continua
    // jogavel offline, so' o ranking fica indisponivel.
    throw new ServiceError('UNAVAILABLE', 'sem conexao com o ranking');
  }

  if (!response.ok) throw await toServiceError(response);

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** Traduz a resposta de erro para o codigo estavel do contrato. */
async function toServiceError(response: Response): Promise<ServiceError> {
  const body = (await response.json().catch(() => ({}))) as ErrorBody;

  const nested = typeof body.error === 'object' && body.error !== null ? body.error : null;
  const codes = [
    nested?.code,
    body.error_code,
    typeof body.error === 'string' ? body.error : undefined,
    typeof body.code === 'string' ? body.code : undefined,
  ].filter((value): value is string => typeof value === 'string');

  const message =
    nested?.message ??
    body.msg ??
    body.message ??
    body.error_description ??
    `HTTP ${response.status}`;

  for (const code of codes) {
    const mapped = mapCode(code);
    if (mapped) return new ServiceError(mapped, message);
  }
  return new ServiceError(mapByStatus(response.status, message), message);
}

/**
 * Codigo textual → codigo do contrato.
 *
 * Cobre os codigos do nosso proprio formato e os do GoTrue, que mudou de
 * vocabulario entre versoes: `invalid_grant` e' o antigo, `invalid_credentials`
 * o atual, e os dois significam a mesma coisa.
 */
function mapCode(code: string): ServiceErrorCode | null {
  switch (code) {
    case 'INVALID_NAME':
    case 'INVALID_EMAIL':
    case 'WEAK_PASSWORD':
    case 'EMAIL_TAKEN':
    case 'BAD_CREDENTIALS':
    case 'NOT_AUTHENTICATED':
    case 'UNAVAILABLE':
      return code;

    case 'user_already_exists':
    case 'email_exists':
      return 'EMAIL_TAKEN';

    case 'invalid_credentials':
    case 'invalid_grant':
      return 'BAD_CREDENTIALS';

    case 'weak_password':
      return 'WEAK_PASSWORD';

    case 'validation_failed':
    case 'email_address_invalid':
      return 'INVALID_EMAIL';

    case 'no_authorization':
    case 'bad_jwt':
    case 'session_not_found':
    case 'user_not_found':
      return 'NOT_AUTHENTICATED';

    default:
      return null;
  }
}

/**
 * Ultimo recurso: o status HTTP.
 *
 * `429` vira `UNAVAILABLE` e nao um codigo proprio porque e' isso que o jogo faz
 * com ele — "ranking indisponivel, tente daqui a pouco". Rate limit com
 * consequencia visivel existe so' na submissao de partida, e la' ele chega como
 * `{ accepted: false, reason: 'RATE_LIMITED' }`, que nao e' erro.
 */
function mapByStatus(status: number, message: string): ServiceErrorCode {
  if (status === 401 || status === 403) return 'NOT_AUTHENTICATED';
  if (status === 409) return 'EMAIL_TAKEN';
  if (status === 400 && /password/i.test(message)) return 'WEAK_PASSWORD';
  if (status === 400 && /email/i.test(message)) return 'INVALID_EMAIL';
  return 'UNAVAILABLE';
}
