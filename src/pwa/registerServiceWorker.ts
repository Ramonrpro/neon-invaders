/**
 * Registro do service worker que da' o modo offline.
 *
 * O arquivo servido e' `public/sw.js`, gerado no build a partir de
 * `src/pwa/sw.template.js` (ver `scripts/buildPwaAssets.mjs`).
 */

export function registerServiceWorker(): void {
  // Em `npm run dev` o SW cachearia o grafo de modulos do dev server e o HMR
  // passaria a mentir — sintoma horrivel de diagnosticar, por parecer bug do jogo.
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  // Depois do `load`: offline na primeirissima visita vale menos que o primeiro
  // frame chegar rapido.
  window.addEventListener('load', () => {
    navigator.serviceWorker
      // `updateViaCache: 'none'` obriga o proprio `sw.js` a vir da rede. Sem isso
      // um cabecalho de cache da CDN poderia servir o SW velho por horas, e o
      // mecanismo de atualizacao (nome de cache estampado por build) morre junto.
      // O `scope` relativo acompanha o `base: './'` do Vite.
      .register('./sw.js', { scope: './', updateViaCache: 'none' })
      .catch(() => {
        // Registro falhado nunca pode quebrar o jogo: sem SW ele so' deixa de
        // funcionar offline. Silencio de proposito.
      });
  });
}
