module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  reporters: process.env.CI
    ? [
        'default',
        [
          'jest-junit',
          {
            outputDirectory: 'reports',
            outputName: 'junit.xml',
            classname: '{classname}',
            title: '{title}',
            ancestorSeparator: ' > ',
            usePathForSuiteName: true,
          },
        ],
      ]
    : ['default'],
};
