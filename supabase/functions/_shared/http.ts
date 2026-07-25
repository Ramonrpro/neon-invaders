/**
 * Respostas HTTP no formato do contrato (`docs/api-contract.md` §1).
 *
 * Duas coisas que o resto das funcoes nao precisa lembrar:
 *
 * 1. **CORS.** O jogo e' servido de outro dominio que nao `*.supabase.co`.
 *    Sem o preflight respondido, o navegador nem chega a chamar a funcao.
 * 2. **Recusa nao e' erro HTTP.** Uma run implausivel volta 200 com
 *    `{ accepted: false, reason }` — a tela de fim de jogo continua normal, e o
 *    jogador so' perde a linha no ranking. Erro de verdade e' outra coisa.
 */

/**
 * Origem liberada. `*` de proposito: o jogo e' um bundle estatico que pode ser
 * servido de qualquer lugar (GitHub Pages, Netlify, um `npm run preview` na
 * rede local), e nao ha' cookie nem credencial de navegador em jogo — a sessao
 * viaja no cabecalho `Authorization`. Restrinja aqui se um dia houver um unico
 * dominio oficial.
 */
export const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-max-age': '86400',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

/** Erro no formato do contrato: `{ error: { code, message } }`. */
export function errorResponse(code: string, message: string, status: number): Response {
  return jsonResponse({ error: { code, message } }, status);
}

/** Responde ao preflight. `null` quando a requisicao nao e' um preflight. */
export function preflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
