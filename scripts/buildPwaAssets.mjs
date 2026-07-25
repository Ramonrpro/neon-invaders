/**
 * Gera os arquivos que o navegador exige para instalar o jogo: icones PNG,
 * `manifest.webmanifest` e o service worker com o nome de cache estampado.
 *
 * POR QUE ISTO EXISTE. Um PWA instalavel precisa de icone RASTER de verdade —
 * manifest com SVG nao e' aceito de forma confiavel, e o iOS ignora os icones do
 * manifest se nao houver `apple-touch-icon`. Ao mesmo tempo, a secao 2 do
 * CLAUDE.md proibe qualquer `.png` no repositorio: toda arte deste jogo e'
 * bitmap de string convertido em textura no boot. As duas regras convivem assim:
 * o icone e' desenhado em codigo, rasterizado em tempo de BUILD para `public/`
 * (que o `.gitignore` cobre por inteiro), e nenhum binario e' commitado.
 *
 * O PNG e' escrito a' mao com o `zlib` nativo do Node — assinatura, IHDR, IDAT e
 * IEND. E' menos codigo do que parece e evita uma dependencia nova num projeto
 * que hoje tem exatamente uma (`phaser`).
 *
 * EXCECAO DECLARADA: o bitmap do icone (`APP_ICON`, abaixo) e' a unica arte fora
 * de `src/game/gfx/sprites.ts`. Ele vive aqui porque `scripts/` roda em Node cru,
 * fora do `tsconfig.json`, e nao consegue importar TypeScript — e porque o JOGO
 * nao consome este icone, so' a loja/o launcher. Nao existindo dois leitores, nao
 * existe copia a divergir. As cores, que sim existem nos dois lados, estao
 * travadas contra `PALETTE` por `tests/pwaAssets.test.ts`.
 *
 * Uso: `npm run pwa:assets` (o `npm run build` ja' chama).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = resolve(ROOT, 'public');

/**
 * O icone: um invasor sobre o canhao do jogador, na mesma linguagem de bitmap
 * dos sprites (`#` aceso, `.` transparente). Quadrado de proposito — um retangulo
 * seria centralizado com sobra e leria como logo cortado no launcher.
 */
export const APP_ICON = [
  '..#......#..',
  '...#....#...',
  '..########..',
  '.##.####.##.',
  '############',
  '#.########.#',
  '#.#......#.#',
  '...##..##...',
  '............',
  '.....##.....',
  '..########..',
  '############',
];

/**
 * Fosforo sobre preto, como todo o resto do jogo. Duplica `PALETTE.phosphor` e
 * `PALETTE.black` porque a paleta e' TypeScript; `tests/pwaAssets.test.ts` falha
 * se os dois lados divergirem.
 */
export const ICON_STYLE = { fg: '#00ff41', bg: '#000000' };

/**
 * Os icones a gerar.
 *
 * A `safeZonePct` da maskable e' 22% por conta: a area segura da especificacao e'
 * o circulo de 80% do lado, e o maior quadrado inscrito nele tem lado
 * `0,8/raiz(2) = 0,566` do lado — o que deixa `(1 - 0,566)/2 = 0,217` de margem.
 * Abaixar isso faz alguns launchers do Android recortarem as pernas do invasor.
 */
export const ICON_TARGETS = [
  { file: 'icons/icon-192.png', size: 192, safeZonePct: 0.08, purpose: 'any' },
  { file: 'icons/icon-512.png', size: 512, safeZonePct: 0.08, purpose: 'any' },
  { file: 'icons/icon-maskable-512.png', size: 512, safeZonePct: 0.22, purpose: 'maskable' },
  { file: 'icons/apple-touch-icon.png', size: 180, safeZonePct: 0.08, purpose: null },
  { file: 'icons/icon-32.png', size: 32, safeZonePct: 0.06, purpose: null },
];

// ------------------------------------------------------------------ PNG

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/**
 * CRC32 do PNG (polinomio 0xEDB88320, refletido).
 *
 * @param {Uint8Array} bytes
 * @returns {number} inteiro sem sinal de 32 bits
 */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Um chunk de PNG: tamanho, tipo, dados e CRC de tipo+dados.
 *
 * @param {string} type quatro letras ASCII (IHDR, IDAT, IEND)
 * @param {Uint8Array} data
 * @returns {Buffer}
 */
export function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/**
 * Codifica RGBA cru em PNG sem filtro nenhum.
 *
 * Color type 6 (RGBA), bit depth 8, sem entrelace: o formato mais simples que
 * todo navegador le'. Cada scanline vai prefixada pelo byte de filtro 0 — e' o
 * que o `deflate` do IDAT espera.
 *
 * @param {{ width: number, height: number, rgba: Uint8Array }} image
 * @returns {Buffer}
 */
export function encodePng({ width, height, rgba }) {
  const expected = width * height * 4;
  if (rgba.length !== expected) {
    throw new Error(`encodePng: esperava ${expected} bytes de RGBA, recebeu ${rgba.length}.`);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compressao: deflate
  ihdr[11] = 0; // filtro: adaptativo
  ihdr[12] = 0; // entrelace: nenhum

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filtro da scanline
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    );
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', new Uint8Array(0)),
  ]);
}

// ------------------------------------------------------------------ arte

function parseHexColor(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

/**
 * Desenha o bitmap centralizado num quadrado de `size`, deixando a margem da
 * area segura livre.
 *
 * A escala e' INTEIRA, mesma regra do `createBitmapTexture` do jogo: escala
 * fracionaria interpola e borra pixel art, que e' o oposto do ponto.
 *
 * @param {{ size: number, bitmap: string[], fg: string, bg: string, safeZonePct: number }} spec
 * @returns {Uint8Array} RGBA de `size * size`
 */
export function renderIcon({ size, bitmap, fg, bg, safeZonePct }) {
  const height = bitmap.length;
  const width = Math.max(...bitmap.map((row) => row.length));
  const usable = size * (1 - 2 * safeZonePct);
  const scale = Math.max(1, Math.floor(usable / Math.max(width, height)));
  const offsetX = Math.floor((size - width * scale) / 2);
  const offsetY = Math.floor((size - height * scale) / 2);

  const front = parseHexColor(fg);
  const back = parseHexColor(bg);
  const rgba = new Uint8Array(size * size * 4);

  // Fundo opaco: icone de launcher com alpha vira quadrado cinza no Android.
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = back.r;
    rgba[i * 4 + 1] = back.g;
    rgba[i * 4 + 2] = back.b;
    rgba[i * 4 + 3] = 0xff;
  }

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < bitmap[row].length; col++) {
      if (bitmap[row][col] !== '#') continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const x = offsetX + col * scale + dx;
          const y = offsetY + row * scale + dy;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          const i = (y * size + x) * 4;
          rgba[i] = front.r;
          rgba[i + 1] = front.g;
          rgba[i + 2] = front.b;
          rgba[i + 3] = 0xff;
        }
      }
    }
  }

  return rgba;
}

// ------------------------------------------------------------------ manifest

/**
 * O manifest.
 *
 * `start_url` e `scope` sao RELATIVOS de proposito: `vite.config.ts` usa
 * `base: './'` justamente para o jogo nao depender de estar na raiz do dominio.
 * Um `'/'` aqui quebraria um deploy em subpasta em silencio — o app abriria fora
 * do escopo e o navegador simplesmente pararia de oferecer a instalacao.
 *
 * @param {{ fg: string, bg: string }} style
 * @returns {object}
 */
export function renderManifest(style) {
  return {
    name: 'NEON INVADERS',
    short_name: 'NEON',
    description:
      "Shoot'em up de tela fixa: 5 fases, naves-mae, arte e audio gerados em codigo.",
    lang: 'pt-BR',
    start_url: './',
    scope: './',
    display: 'standalone',
    // Retrato: a area de jogo e' 3:4 e o deck de arrasto pressupoe tela em pe'.
    orientation: 'portrait',
    background_color: style.bg,
    theme_color: style.bg,
    icons: ICON_TARGETS.filter((icon) => icon.purpose !== null).map((icon) => ({
      src: `./${icon.file}`,
      sizes: `${icon.size}x${icon.size}`,
      type: 'image/png',
      purpose: icon.purpose,
    })),
  };
}

// ------------------------------------------------------------------ SW

const CACHE_PLACEHOLDER = '__CACHE_NAME__';

/**
 * Estampa o nome do cache no service worker.
 *
 * ISTO E' O MECANISMO DE ATUALIZACAO, nao um detalhe cosmetico. O navegador
 * decide reinstalar o SW comparando os BYTES do arquivo com os da versao
 * anterior. Um nome de cache fixo (`neon-v1`) nunca muda os bytes, o SW velho
 * nunca e' substituido e ele serve o bundle velho para sempre.
 *
 * @param {string} template conteudo de `src/pwa/sw.template.js`
 * @param {string} buildId identificador desta build
 * @returns {string}
 */
export function stampServiceWorker(template, buildId) {
  if (!template.includes(CACHE_PLACEHOLDER)) {
    throw new Error(`sw.template.js perdeu o marcador ${CACHE_PLACEHOLDER}.`);
  }
  return template.replaceAll(CACHE_PLACEHOLDER, `neon-invaders-${buildId}`);
}

/** Versao do package + commit, quando a Vercel informa. */
export function resolveBuildId(version, commitSha) {
  const suffix = commitSha ? commitSha.slice(0, 7) : Date.now().toString(36);
  return `${version}-${suffix}`;
}

// ------------------------------------------------------------------ main

function write(relativePath, content) {
  const target = resolve(PUBLIC_DIR, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  console.log(`public/${relativePath}`);
}

function main() {
  for (const icon of ICON_TARGETS) {
    const rgba = renderIcon({
      size: icon.size,
      bitmap: APP_ICON,
      fg: ICON_STYLE.fg,
      bg: ICON_STYLE.bg,
      safeZonePct: icon.safeZonePct,
    });
    write(icon.file, encodePng({ width: icon.size, height: icon.size, rgba }));
  }

  write('manifest.webmanifest', `${JSON.stringify(renderManifest(ICON_STYLE), null, 2)}\n`);

  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
  const template = readFileSync(resolve(ROOT, 'src/pwa/sw.template.js'), 'utf8');
  const buildId = resolveBuildId(pkg.version, process.env.VERCEL_GIT_COMMIT_SHA);
  write('sw.js', stampServiceWorker(template, buildId));
}

// Executado direto (`node scripts/buildPwaAssets.mjs`), nao quando o teste
// importa as funcoes acima.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
