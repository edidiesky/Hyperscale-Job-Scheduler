import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src/__tests__"],
  moduleNameMapper: {
    "^@shared/(.*)$": "<rootDir>/src/shared/$1",
    "^@domains/(.*)$": "<rootDir>/src/domains/$1",
    "^@infrastructure/(.*)$": "<rootDir>/src/infrastructure/$1",
    "^ioredis$": "<rootDir>/src/__mocks__/ioredis.ts",
  },
  setupFilesAfterFramework: [],
  projects: [
    {
      displayName: "unit",
      testMatch: ["<rootDir>/src/__tests__/unit/**/*.test.ts"],
      preset: "ts-jest",
      testEnvironment: "node",
      moduleNameMapper: {
        "^@shared/(.*)$": "<rootDir>/src/shared/$1",
        "^@domains/(.*)$": "<rootDir>/src/domains/$1",
        "^@infrastructure/(.*)$": "<rootDir>/src/infrastructure/$1",
        "^ioredis$": "<rootDir>/src/__mocks__/ioredis.ts",
      },
    },
    {
      displayName: "integration",
      testMatch: ["<rootDir>/src/__tests__/integration/**/*.test.ts"],
      preset: "ts-jest",
      testEnvironment: "node",
      globalSetup: "<rootDir>/src/__tests__/integration/setup/globalSetup.ts",
      globalTeardown: "<rootDir>/src/__tests__/integration/setup/globalTeardown.ts",
      setupFilesAfterFramework: [
        "<rootDir>/src/__tests__/integration/setup/setupFile.ts",
      ],
      moduleNameMapper: {
        "^@shared/(.*)$": "<rootDir>/src/shared/$1",
        "^@domains/(.*)$": "<rootDir>/src/domains/$1",
        "^@infrastructure/(.*)$": "<rootDir>/src/infrastructure/$1",
        "^ioredis$": "<rootDir>/src/__mocks__/ioredis.ts",
      },
      testTimeout: 30_000,
    },
  ],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/__tests__/**",
    "!src/__mocks__/**",
    "!src/server.ts",
  ],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;