/**
 * O validador que roda na Edge Function e' o mesmo que roda no cliente.
 *
 * `supabase/functions/_shared/validation/` e' uma copia gerada de
 * `src/services/`, produzida por `npm run supabase:sync` — a unica diferenca sao
 * os specifiers de import, porque o Deno nao resolve os aliases do Vite. Este
 * teste roda o mesmo gerador em memoria e compara com o que esta' em disco.
 *
 * Sem ele, o roteiro do desastre e' curto: alguem afrouxa um teto no validador,
 * esquece de rodar o sync, e o servidor passa a recusar partida honesta com uma
 * regra que ninguem mais consegue achar no codigo. Mesmo arranjo de
 * `runLimits.test.ts`: copia deliberada, divergencia impossivel.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — ferramenta de build em .mjs, sem tipos e fora do tsconfig.
import { EDGE_VALIDATION_FILES, buildEdgeModule } from '../scripts/syncEdgeValidation.mjs';

const ROOT = resolve(__dirname, '..');

interface EdgeFile {
  source: string;
  target: string;
}

const files = EDGE_VALIDATION_FILES as EdgeFile[];

describe('validador compartilhado com as Edge Functions', () => {
  it('cobre os tres modulos que a funcao importa', () => {
    expect(files.map((file) => file.source)).toEqual([
      'src/services/types.ts',
      'src/services/validation/limits.ts',
      'src/services/validation/plausibility.ts',
    ]);
  });

  for (const file of files) {
    it(`${file.target} esta' em dia com ${file.source}`, () => {
      const onDisk = readFileSync(resolve(ROOT, file.target), 'utf8');
      // Mensagem explicita: quem quebrar isto vai estar pensando no validador,
      // nao no Deno, e precisa saber que o conserto e' um comando.
      expect(onDisk, 'copia desatualizada — rode `npm run supabase:sync`').toBe(
        buildEdgeModule(file) as string,
      );
    });
  }

  it('traduz o alias @services para caminho relativo com extensao', () => {
    const generated = readFileSync(
      resolve(ROOT, 'supabase/functions/_shared/validation/plausibility.ts'),
      'utf8',
    );
    expect(generated).toContain("from './limits.ts'");
    expect(generated).toContain("from './types.ts'");
    // O Deno nao resolve alias nenhum: um `@services/` sobrevivente vira erro de
    // modulo nao encontrado so' no deploy, longe da causa.
    expect(generated).not.toContain('@services/');
  });

  it('preserva as regras, e nao apenas os imports', () => {
    const source = readFileSync(resolve(ROOT, 'src/services/validation/plausibility.ts'), 'utf8');
    const generated = readFileSync(
      resolve(ROOT, 'supabase/functions/_shared/validation/plausibility.ts'),
      'utf8',
    );
    const bodyOf = (text: string): string => text.slice(text.indexOf('export type RejectionReason'));
    expect(bodyOf(generated)).toBe(bodyOf(source));
  });
});
