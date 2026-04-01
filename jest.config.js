module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/database/init.js'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  setupFiles: [
    '<rootDir>/tests/setup-env.js'
  ],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};
