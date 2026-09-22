module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  root: true,
  env: { node: true, jest: true, es2022: true },
  ignorePatterns: ['.eslintrc.js', 'dist', 'node_modules', 'scripts/*.ts'],
  rules: {
    // Deliberadamente permissivo: o objetivo do lint no CI é pegar erro real
    // (variável não usada, import quebrado), não impor um estilo rígido numa
    // base de código já grande. Regras de estilo/rigor viram "warn", que não
    // derruba o CI - só as que indicam bug de verdade ficam "error".
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-empty-function': 'warn',
    'no-empty': 'warn',
  },
};
