import nextJest from 'next/jest'

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1', // adjust if you use absolute imports
  },
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
}

export default createJestConfig(customJestConfig)