'use strict';

module.exports = {
  root: true,
  extends: ['@mongodb-js/eslint-config-devtools'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig-lint.json'],
  },
  rules: {
    // This is a build tool, progress and diagnostics are meant for the terminal.
    'no-console': 'off',
  },
};
