/**
 * O gerador de icones, manifest e service worker do PWA.
 *
 * Nada aqui le' `public/` — aquilo e' saida de build e pode nem existir. Tudo
 * roda em memoria, sobre as mesmas funcoes que o script usa.
 *
 * O que estes testes protegem, em ordem de gravidade: um PNG malformado (o
 * encoder e' escrito a' mao, sem biblioteca, entao o round-trip pelo `inflate` e'
 * a unica prova de que esta' certo); um `start_url` absoluto, que quebra o deploy
 * em subpasta em silencio e faz o navegador parar de oferecer a instalacao; uma
 * margem de maskable apertada, que recorta o icone so' em alguns launchers do
 * Android; e as cores divergindo da `PALETTE`, que e' a unica coisa realmente
 * duplicada entre o script e o jogo.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { PALETTE, toCss } from '@game/config/palette';
// @ts-expect-error — ferramenta de build em .mjs, sem tipos e fora do tsconfig.
import * as pwa from '../scripts/buildPwaAssets.mjs';

const ROOT = resolve(__dirname, '..');

interface IconTarget {
  file: string;
  size: number;
  safeZonePct: number;
  purpose: string | null;
}

interface IconSpec {
  size: number;
  bitmap: string[];
  fg: string;
  bg: string;
  safeZonePct: number;
}

interface Manifest {
  start_url: string;
  scope: string;
  display: string;
  orientation: string;
  background_color: string;
  theme_color: string;
  icons: { src: string; sizes: string; purpose: string }[];
}

/*
 * O modulo e' `.mjs` sem tipos; o contrato dele fica declarado aqui, uma vez, em
 * vez de virar `as` espalhado por assertiva. Se uma assinatura mudar do outro
 * lado, e' este bloco que precisa acompanhar.
 */
const {
  APP_ICON: bitmap,
  ICON_STYLE: style,
  ICON_TARGETS: targets,
  crc32,
  encodePng,
  pngChunk,
  renderIcon,
  renderManifest,
  resolveBuildId,
  stampServiceWorker,
} = pwa as {
  APP_ICON: string[];
  ICON_STYLE: { fg: string; bg: string };
  ICON_TARGETS: IconTarget[];
  crc32: (bytes: Uint8Array) => number;
  encodePng: (image: { width: number; height: number; rgba: Uint8Array }) => Buffer;
  pngChunk: (type: string, data: Uint8Array) => Buffer;
  renderIcon: (spec: IconSpec) => Uint8Array;
  renderManifest: (style: { fg: string; bg: string }) => Manifest;
  resolveBuildId: (version: string, commitSha: string | undefined) => string;
  stampServiceWorker: (template: string, buildId: string) => string;
};

const manifest = renderManifest(style);

describe('PNG escrito a mao', () => {
  it('o chunk vazio de IEND bate byte a byte com o valor conhecido', () => {
    // Trava CRC32 e formato de chunk numa assertiva so'. Se este vetor mudar, o
    // arquivo inteiro esta' malformado.
    const iend = pngChunk('IEND', new Uint8Array(0));
    expect([...iend]).toEqual([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  });

  it('o CRC32 e um inteiro sem sinal de 32 bits', () => {
    const value = crc32(new Uint8Array([1, 2, 3]));
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(0xffffffff);
  });

  it('um 1x1 sai com assinatura e IHDR corretos', () => {
    const rgba = new Uint8Array([0x11, 0x22, 0x33, 0xff]);
    const png = encodePng({ width: 1, height: 1, rgba });

    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(1); // largura
    expect(png.readUInt32BE(20)).toBe(1); // altura
    expect(png[24]).toBe(8); // bit depth
    expect(png[25]).toBe(6); // color type RGBA
    expect(png[26]).toBe(0); // compressao
    expect(png[27]).toBe(0); // filtro
    expect(png[28]).toBe(0); // entrelace
  });

  it('o IDAT descomprime de volta nas scanlines originais', () => {
    // Round-trip: sem biblioteca de PNG, e' isto que prova o encoder.
    const rgba = new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255]);
    const png = encodePng({ width: 2, height: 2, rgba });

    const start = png.indexOf(Buffer.from('IDAT', 'ascii'));
    const length = png.readUInt32BE(start - 4);
    const raw = inflateSync(png.subarray(start + 4, start + 4 + length));

    expect([...raw]).toEqual([
      0,
      1,
      2,
      3,
      255,
      4,
      5,
      6,
      255, // filtro + primeira linha
      0,
      7,
      8,
      9,
      255,
      10,
      11,
      12,
      255, // filtro + segunda linha
    ]);
  });

  it('recusa RGBA de tamanho incoerente em vez de gerar arquivo torto', () => {
    expect(() => encodePng({ width: 2, height: 2, rgba: new Uint8Array(4) })).toThrow();
  });
});

describe('arte do icone', () => {
  it('e um quadrado nao vazio', () => {
    const width = Math.max(...bitmap.map((row) => row.length));
    expect(width).toBe(bitmap.length);
    expect(bitmap.join('').includes('#')).toBe(true);
  });

  it('usa fosforo sobre preto, como o resto do jogo', () => {
    // A unica duplicacao real entre o script e o jogo. Travada aqui.
    expect(style.fg).toBe(toCss(PALETTE.phosphor));
    expect(style.bg).toBe(toCss(PALETTE.black));
  });

  it('pinta o fundo inteiro opaco', () => {
    const size = 16;
    const rgba = renderIcon({ size, bitmap, ...style, safeZonePct: 0.1 });
    expect(rgba.length).toBe(size * size * 4);
    for (let i = 3; i < rgba.length; i += 4) expect(rgba[i]).toBe(0xff);
  });

  it('a maskable cabe no circulo de area segura da especificacao', () => {
    const target = targets.find((icon) => icon.purpose === 'maskable');
    expect(target).toBeDefined();
    const size = target!.size;
    const rgba = renderIcon({
      size,
      bitmap,
      ...style,
      safeZonePct: target!.safeZonePct,
    });

    const front = { r: 0x00, g: 0xff, b: 0x41 };
    const center = size / 2;
    const safeRadius = (size * 0.8) / 2;
    let litPixels = 0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        if (rgba[i] !== front.r || rgba[i + 1] !== front.g || rgba[i + 2] !== front.b) continue;
        litPixels++;
        // +0,5 para medir do centro do pixel, nao do canto.
        const distance = Math.hypot(x + 0.5 - center, y + 0.5 - center);
        expect(distance).toBeLessThanOrEqual(safeRadius);
      }
    }

    expect(litPixels).toBeGreaterThan(0);
  });
});

describe('manifest', () => {
  it('start_url e scope sao relativos', () => {
    // Absoluto quebra deploy em subpasta em silencio — `vite.config.ts` usa
    // `base: './'` exatamente para o jogo nao depender da raiz do dominio.
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
  });

  it('pede app em pe, em janela propria', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('portrait');
  });

  it('tem os icones que a instalacao exige, um deles maskable', () => {
    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons) expect(icon.src.startsWith('./')).toBe(true);
  });

  it('as cores vem da paleta, e o index.html concorda com o manifest', () => {
    expect(manifest.theme_color).toBe(toCss(PALETTE.black));
    expect(manifest.background_color).toBe(toCss(PALETTE.black));
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    expect(html).toContain(`name="theme-color" content="${manifest.theme_color}"`);
    expect(html).toContain('rel="manifest"');
  });
});

describe('service worker', () => {
  const template = readFileSync(resolve(ROOT, 'src/pwa/sw.template.js'), 'utf8');

  it('o fonte tem o marcador, e o gerado nao', () => {
    expect(template).toContain('__CACHE_NAME__');
    const stamped = stampServiceWorker(template, '9.9.9-abc1234');
    expect(stamped).not.toContain('__CACHE_NAME__');
    expect(stamped).toContain('neon-invaders-9.9.9-abc1234');
  });

  it('reclama se alguem apagar o marcador do fonte', () => {
    // Sem o marcador o SW iria ao ar com nome de cache fixo, e o navegador
    // pararia de reinstalar — servindo bundle velho para sempre, em silencio.
    expect(() => stampServiceWorker('const CACHE = "neon";', 'x')).toThrow();
  });

  it('o commit da Vercel entra no nome do cache quando existe', () => {
    expect(resolveBuildId('0.1.0', 'abcdef1234567890')).toBe('0.1.0-abcdef1');
    expect(resolveBuildId('0.1.0', undefined)).toMatch(/^0\.1\.0-[a-z0-9]+$/);
  });

  it('nao encosta no backend', () => {
    // A guarda de origem e' o que mantem o SW fora do territorio de
    // `src/services/`: ranking e sessao sao cross-origin e nunca sao cacheados.
    // Note que o template PODE mencionar o Supabase em comentario — o que ele nao
    // pode e' conhecer um host, uma rota ou uma chave.
    expect(template).toContain('self.location.origin');
    expect(template).toMatch(/origin !== self\.location\.origin\)\s*return/);
    expect(template).not.toMatch(/supabase\.(co|in)/i);
    expect(template).not.toMatch(/https?:\/\//);
  });
});
