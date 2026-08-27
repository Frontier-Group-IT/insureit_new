const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
    settings: {
      'import/resolver': {
        node: { paths: ['node_modules', '../../node_modules'] },
      },
    },
  },
]);
