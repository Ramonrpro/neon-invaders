/// <reference types="vite/client" />

/**
 * Variaveis de ambiente do jogo.
 *
 * As duas sao OPCIONAIS por desenho: sem elas, `getServices()` devolve os
 * adapters locais e o jogo roda completo, sem rede. Ver `src/services/index.ts`
 * e `.env.example`.
 *
 * Só entra aqui o que pode ser publico — tudo com prefixo `VITE_` vai para
 * dentro do bundle e qualquer um lê no DevTools. A chave que grava no ranking
 * (`service_role`) nunca aparece deste lado: ela vive no ambiente da Edge
 * Function.
 */
interface ImportMetaEnv {
  /** Raiz do projeto Supabase, ex.: `https://abcdefgh.supabase.co`. */
  readonly VITE_SUPABASE_URL?: string;
  /** Chave publica `anon` do projeto. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
