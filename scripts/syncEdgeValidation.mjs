/**
 * Leva o validador de plausibilidade para dentro das Edge Functions.
 *
 * POR QUE ISTO EXISTE. O validador tem de rodar em dois runtimes: o navegador
 * (via Vite, com os aliases `@services/*`) e o Deno das Edge Functions, que nao
 * conhece alias nenhum e exige extensao `.ts` em todo import. A unica coisa que
 * difere entre as duas copias e' o SPECIFIER dos imports — nenhuma linha de
 * regra muda.
 *
 * Este script faz essa reescrita e nada mais. `tests/edgeShared.test.ts` roda a
 * mesma funcao em memoria e compara com o que esta' em disco: no instante em que
 * alguem editar o validador e esquecer de rodar `npm run supabase:sync`, o teste
 * falha. E' o mesmo arranjo de `tests/runLimits.test.ts` — copia deliberada,
 * divergencia impossivel.
 *
 * Uso: `npm run supabase:sync`
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Os modulos que a Edge Function precisa, na ordem em que dependem uns dos
 * outros. `types.ts` entra porque `plausibility.ts` importa `RunSubmission`
 * dele — e' so' forma de dado, sem storage nem rede.
 */
export const EDGE_VALIDATION_FILES = [
  {
    source: 'src/services/types.ts',
    target: 'supabase/functions/_shared/validation/types.ts',
  },
  {
    source: 'src/services/validation/limits.ts',
    target: 'supabase/functions/_shared/validation/limits.ts',
  },
  {
    source: 'src/services/validation/plausibility.ts',
    target: 'supabase/functions/_shared/validation/plausibility.ts',
  },
];

/** Alias do bundler → caminho relativo com extensao, do jeito que o Deno exige. */
const SPECIFIERS = new Map([
  ['@services/types', './types.ts'],
  ['@services/validation/limits', './limits.ts'],
  ['@services/validation/plausibility', './plausibility.ts'],
]);

const BANNER = `/**
 * ARQUIVO GERADO — NAO EDITE.
 *
 * Copia de \`{{source}}\` para o runtime Deno das Edge Functions, produzida por
 * \`npm run supabase:sync\`. A unica diferenca em relacao ao original sao os
 * specifiers de import: o Deno nao resolve os aliases do Vite e exige \`.ts\`.
 *
 * Editar aqui e' trabalho perdido — o proximo sync sobrescreve, e
 * \`tests/edgeShared.test.ts\` falha antes disso.
 */

`;

/**
 * Reescreve os imports de um modulo do validador para o formato do Deno.
 *
 * @param {string} text conteudo do arquivo original
 * @param {string} source caminho do original, so' para o cabecalho
 * @returns {string} conteudo da copia
 */
export function renderEdgeModule(text, source) {
  const rewritten = text.replace(
    /(from\s+')([^']+)(')/g,
    (match, open, specifier, close) => {
      const mapped = SPECIFIERS.get(specifier);
      return mapped === undefined ? match : `${open}${mapped}${close}`;
    },
  );

  const leftover = [...rewritten.matchAll(/from\s+'(@[^']+)'/g)].map((m) => m[1]);
  if (leftover.length > 0) {
    // Falhar alto: um alias novo que passasse batido viraria erro de deploy
    // (modulo nao encontrado) muito depois, sem pista nenhuma da causa.
    throw new Error(
      `${source}: alias sem traducao para o Deno — ${leftover.join(', ')}. ` +
        'Acrescente-o a SPECIFIERS em scripts/syncEdgeValidation.mjs.',
    );
  }

  return BANNER.replace('{{source}}', source) + rewritten;
}

/** Le' o original e devolve o conteudo que a copia deve ter. */
export function buildEdgeModule({ source }) {
  const text = readFileSync(resolve(ROOT, source), 'utf8');
  return renderEdgeModule(text, source);
}

function main() {
  for (const file of EDGE_VALIDATION_FILES) {
    const content = buildEdgeModule(file);
    const target = resolve(ROOT, file.target);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');
    console.log(`${file.source} -> ${file.target}`);
  }
}

// Executado direto (`node scripts/syncEdgeValidation.mjs`), nao quando o teste
// importa as funcoes acima.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
