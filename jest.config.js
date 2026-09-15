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
    ...[18, 19].map(version => ({
      displayName: `react${version}`,
      testEnvironment: 'jsdom',
      testEnvironmentOptions: { customExportConditions: ['node', 'node-addons'] },
      testMatch: ['<rootDir>/packages/react/src/**/*.test.ts*'],
      ...projectCommonConfig,
      moduleNameMapper: Object.fromEntries(
        ['react', 'react-dom/client', 'react-dom/server'].map(name => [
          `^${name}$`,
          require.resolve(name, { paths: [path.join(__dirname, `examples/react${version}`)] }),
        ]),
      ),
    })),
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
