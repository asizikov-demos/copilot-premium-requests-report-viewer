const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

// Primer React and some of its dependencies ship ESM only; Jest needs to transform them to CommonJS.
const ESM_PACKAGES = [
  '@primer/react',
  '@github/relative-time-element',
  '@lit-labs/react',
  '@oddbird/popover-polyfill',
];

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/layout.tsx',
    '!src/app/page.tsx',
  ],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  testMatch: [
    '<rootDir>/__tests__/**/*.test.{js,jsx,ts,tsx}',
  ],
};

module.exports = async () => {
  const config = await createJestConfig(customJestConfig)();
  config.transformIgnorePatterns = config.transformIgnorePatterns.map((pattern) =>
    pattern.startsWith('/node_modules/(?!.pnpm)(?!(')
      ? pattern.replace('(?!(', `(?!(${ESM_PACKAGES.join('|')}|`)
      : pattern
  );
  return config;
};
