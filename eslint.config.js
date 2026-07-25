import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Ferramental de linha de comando: roda no Node, nao no navegador.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
  {
    files: ['src/game/core/**/*.ts'],
    rules: {
      // Regra dura da arquitetura: core e' logica pura e testavel, sem Phaser.
      'no-restricted-imports': ['error', { patterns: ['phaser', 'phaser/*', '**/phaser'] }],
    },
  },
  {
    files: ['src/game/**/*.ts', 'src/ui/**/*.ts'],
    rules: {
      // Fronteira de agentes: o frontend nunca fala com rede ou storage direto.
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Use as interfaces de src/services/.' },
        { name: 'localStorage', message: 'Use as interfaces de src/services/.' },
        { name: 'sessionStorage', message: 'Use as interfaces de src/services/.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage', message: 'Use as interfaces de src/services/.' },
        { object: 'window', property: 'fetch', message: 'Use as interfaces de src/services/.' },
      ],
    },
  },
  prettier,
);
