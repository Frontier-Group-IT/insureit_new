// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "dist-web/*"],
    settings: {
      "import/resolver": {
        node: {
          paths: ["node_modules", "../../node_modules"],
        },
      },
    },
  }
]);
