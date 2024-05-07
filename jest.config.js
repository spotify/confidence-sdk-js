const path = require('path');

const projectCommonConfig = {
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.common.json',
      },
    ],
  },
  clearMocks: true,
  resolver: `${__dirname}/jest.resolver.js`,
  preset: 'ts-jest',
  setupFilesAfterEnv: ['jest-extended/all'],
};

module.exports = {
  rootDir: __dirname,
  coverageDirectory: path.join(process.cwd(), 'coverage'),
  collectCoverageFrom: ['packages/**/*.{jsx,ts,tsx}', '!**/*.d.ts', '!**/*.{test,setup}.{jsx,ts,tsx}'],
  coverageProvider: 'v8',
  projects: [
    {
      displayName: 'client-http',
      testMatch: ['<rootDir>/packages/client-http/src/**/*.test.ts*'],
      ...projectCommonConfig,
    },
    {
      displayName: 'sdk',
      testMatch: ['<rootDir>/packages/sdk/src/**/*.test.ts*'],
      ...projectCommonConfig,
    },
    {
      displayName: 'server-provider',
      testMatch: ['<rootDir>/packages/openfeature-server-provider/src/**/*.test.ts*'],
      ...projectCommonConfig,
    },
    {
      displayName: 'web-provider',
      testMatch: ['<rootDir>/packages/openfeature-web-provider/src/**/*.test.ts*'],
      ...projectCommonConfig,
    },
  ],
};
