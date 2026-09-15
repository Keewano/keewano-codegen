/** @type {import('jest').Config} */
module.exports = {
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  modulePathIgnorePatterns: ['/dist/'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  /**
   * GitLab CI ingests Cobertura XML for coverage; the default reporter
   * set does not produce one and the CI artifact step fails with "no
   * matching files".
   */
  coverageReporters: ['text-summary', 'cobertura', 'text', 'lcov'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          moduleResolution: 'Node16',
          module: 'Node16',
          target: 'ES2022',
          noUncheckedIndexedAccess: true,
          resolveJsonModule: true,
          esModuleInterop: true,
          isolatedModules: true,
          skipLibCheck: true,
          strict: true,
        },
      },
    ],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/index.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
  ],
  testMatch: ['**/__tests__/**/*.test.ts'],
  reporters: ['default', ['jest-junit', { outputName: 'junit.xml' }]],
  coverageThreshold: {
    global: {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95,
    },
  },
  testEnvironment: 'node',
  passWithNoTests: true,
};
