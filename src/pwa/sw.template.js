/**
 * Service worker do NEON INVADERS. FONTE — o arquivo servido e' `public/sw.js`,
 * gerado por `scripts/buildPwaAssets.mjs` com o nome do cache estampado.
 *
 * O jogo e' 100% estatico e o ranking mora no `localStorage` quando nao ha'
 * Supabase configurado, entao offline aqui e' offline de verdade: da' para jogar
 * no metro do comeco ao fim.
 *
 * `__CACHE_NAME__` e' trocado no build. Nao substitua por uma constante fixa: e'
 * a mudanca dos BYTES deste arquivo que faz o navegador reinstalar o SW.
 */

const CACHE = '__CACHE_NAME__';

/**
 * `'./'` e `'./index.html'` sao duas chaves para o mesmo documento; guardar as
 * duas evita miss dependendo de por qual URL o jogador entrou. Tudo relativo,
 * porque o `scope` tambem e' (ver `base: './'` no `vite.config.ts`).
 */
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  /*
   * `skipWaiting` + `clients.claim` fazem o SW novo assumir na hora, em vez de
   * esperar todas as abas fecharem. E' seguro aqui porque os assets do Vite
   * levam hash de conteudo no nome — uma aba antiga continua rodando o JS que
   * ja' esta' na memoria dela — e evita o buraco classico de "a atualizacao so'
   * chega na terceira visita".
   */
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  /*
   * Fora da propria origem, o SW nao se mete. E' esta linha que o mantem longe do
   * territorio do backend: o Supabase e' cross-origin, entao ranking, sessao e
   * submissao de partida nunca passam pelo cache, nunca sao reescritos e nunca
   * sao observados por aqui.
   */
  if (new URL(request.url).origin !== self.location.origin) return;

  /*
   * Documento: rede primeiro, cache como rede de seguranca. O HTML e' o unico
   * arquivo cujo nome NAO muda entre deploys; cache-first nele prenderia o
   * jogador na versao velha para sempre. Sao ~2 KB — o custo e' irrelevante.
   */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          void cachePut(request, response);
          return response;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit ?? Response.error())),
    );
    return;
  }

  /*
   * Resto (bundle, icones, manifest): cache primeiro. Seguro exatamente porque o
   * Vite poe o hash do conteudo no nome do arquivo — um acerto no cache E' o
   * conteudo certo, por construcao. E' tambem o motivo de este SW nunca precisar
   * conhecer nomes como `index-D7NnS4Ml.js`: a primeira visita online de cada
   * deploy popula o cache sozinha.
   */
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        void cachePut(request, response);
        return response;
      });
    }),
  );
});

/** Guarda uma copia, quando a resposta e' guardavel. */
function cachePut(request, response) {
  // 206 faz a Cache API lancar excecao; `opaque` guardaria um corpo ilegivel.
  if (!response.ok || response.status === 206 || response.type === 'opaque') {
    return Promise.resolve();
  }
  const copy = response.clone();
  return caches.open(CACHE).then((cache) => cache.put(request, copy));
}
