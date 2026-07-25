/**
 * De onde saem a URL e a chave publica do projeto Supabase.
 *
 * Sem as duas variaveis, `getServices()` devolve os adapters locais e o jogo
 * roda exatamente como antes do Milestone 9 — ranking no aparelho, zero rede.
 * ESSA e' a decisao de desenho aqui: o servidor e' um acrescimo opcional, nunca
 * um requisito de boot. Quem clona o repositorio e roda `npm run dev` tem um
 * jogo completo sem criar conta em lugar nenhum.
 *
 * A chave `anon` e' publica por definicao (ela viaja no bundle e qualquer um a
 * le' no DevTools). O que a protege e' a RLS do banco, nao o segredo: com ela
 * da' para LER o ranking e criar a propria sessao, e nada mais. A chave que
 * grava e' a `service_role`, e essa so' existe dentro da Edge Function.
 */

export interface SupabaseConfig {
  /** Raiz do projeto, sem barra no fim. Ex.: `https://abc.supabase.co`. */
  url: string;
  /** Chave publica `anon`. */
  anonKey: string;
}

/**
 * Le' `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
 *
 * @returns `null` quando falta qualquer uma das duas — o sinal de "roda local".
 */
export function readSupabaseConfig(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/+$/, ''), anonKey };
}
