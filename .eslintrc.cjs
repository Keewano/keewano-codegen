/**
 * The layers of src/ and who may import whom, enforced below with
 * no-restricted-imports so a seam leak fails lint instead of review:
 *
 *   shared      <- nothing but node and packages
 *   events, set <- shared
 *   emitters    <- shared, events, set
 *   watch       <- shared
 *   cli         <- everything
 *
 * Tests (__tests__) may reach across features for fixtures.
 */
const LAYERS = ['shared', 'events', 'set', 'emitters', 'watch', 'cli'];

/** A no-restricted-imports entry forbidding `../<layer>/...` for every layer not in `allowed`. */
function forbidLayersExcept(allowed) {
  return LAYERS.filter((layer) => !allowed.includes(layer)).map((layer) => ({
    group: [`**/${layer}/**`, `**/${layer}`],
    message: `this layer must not import from src/${layer}`,
  }));
}

function layerOverride(layer, allowed) {
  return {
    files: [`src/${layer}/**/*.ts`],
    excludedFiles: [`src/${layer}/__tests__/**/*.ts`],
    rules: {
      'no-restricted-imports': ['error', { patterns: forbidLayersExcept([layer, ...allowed]) }],
    },
  };
}

module.exports = {
  root: true,
  env: {
    node: true,
    es2020: true,
  },
  parser: '@typescript-eslint/parser',
  // Type-aware linting: without type information the type-based sonarjs
  // rules (S6551 no-base-to-string and friends) are skipped silently, and
  // the local lint stops matching what SonarQube reports. `projectService`
  // rather than `project`: it follows the tsconfig the way the TypeScript
  // server does, so a file added or moved while an editor's ESLint server
  // is running is type-checked instead of resolving to `error` types.
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    projectService: {
      // The config files are outside tsconfig's `include`.
      allowDefaultProject: ['*.js', '*.cjs', 'bin/*.cjs'],
      defaultProject: 'tsconfig.json',
    },
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:sonarjs/recommended-legacy',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-empty-function': 'off',
    // One import order everywhere: type imports first, then packages, then
    // parent directories, then siblings; blank line between groups,
    // alphabetized within. Autofixable (`npm run lint:fix`).
    'import/order': [
      'error',
      {
        groups: ['type', ['builtin', 'external'], 'parent', 'sibling'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: false },
      },
    ],
    'import/no-duplicates': 'error',
  },
  overrides: [
    {
      // The config files and the bin shim are plain CommonJS - module,
      // require, __dirname - and are not part of the TypeScript program,
      // so the type-aware rules have nothing to reason about here and
      // `require` is the correct syntax rather than a finding.
      files: ['*.js', '*.cjs', 'bin/*.cjs'],
      extends: ['plugin:@typescript-eslint/disable-type-checked'],
      parserOptions: { sourceType: 'script' },
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    {
      // Test files legitimately use `require` for `jest.isolateModules` +
      // `jest.doMock`-driven module-cache resets.
      files: ['**/__tests__/**/*.ts'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    layerOverride('shared', []),
    layerOverride('events', ['shared']),
    layerOverride('set', ['shared', 'events']),
    layerOverride('emitters', ['shared', 'events', 'set']),
    layerOverride('watch', ['shared']),
    layerOverride('cli', LAYERS),
  ],
  // conformance/ holds recorded output plus the module stubs that let an
  // editor read it, and wrappers/gradle/build/ is Gradle's own output from
  // running the plugin's tests; none of it is source this project's rules
  // apply to.
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', 'conformance/', 'wrappers/gradle/build/'],
};
