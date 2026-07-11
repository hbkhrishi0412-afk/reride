/** @type {import('jest').Config} */

/** Modules with dedicated unit tests and ≥70% branch coverage (enforced in CI). */
const TESTED_COVERAGE_PATHS = [
  'utils/api-schemas.ts',
  'utils/citySlug.ts',
  'utils/csrfCapacitorExempt.ts',
  'utils/listingStock.ts',
  'utils/nativePushPayload.ts',
  'utils/sellerVehicleFilter.ts',
  'utils/storefrontDiscoveryCounts.ts',
  'utils/unreadCounts.ts',
  'utils/user-role.ts',
  'utils/vehiclePrivacy.ts',
  'utils/view-track-token.ts',
  'utils/vehicleJsonLd.ts',
  'utils/serviceRequestStatusFlow.ts',
];

module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '^\\.\\/jwt-loader(\\.js)?$': '<rootDir>/__mocks__/utils/jwt-loader.ts',
    '^(\\.\\./)?utils/jwt-loader(\\.js)?$': '<rootDir>/__mocks__/utils/jwt-loader.ts',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/__mocks__/fileMock.js',
    '^\\.\\/security-config$': '<rootDir>/utils/security-config.ts',
    '^\\.\\./utils/security-config$': '<rootDir>/utils/security-config.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^(\\.{1,2}/.*)\\.ts$': '$1',
    '^(\\.{1,2}/.*)\\.tsx$': '$1',
  },
  transform: {
    '^.+\\.(t|j)sx?$': '<rootDir>/jest-esbuild-transform.cjs',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(mongodb|mongoose|bson|firebase|@firebase|@google)/)',
  ],
  testMatch: [
    '<rootDir>/__tests__/**/*.(test|spec).(ts|tsx|js)',
    '<rootDir>/src/**/*.(test|spec).(ts|tsx|js)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/',
    '/dist/',
    '/coverage/',
    '/playwright-report/',
  ],
  collectCoverageFrom: TESTED_COVERAGE_PATHS.map((p) => `<rootDir>/${p}`),
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: false,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
