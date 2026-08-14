const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);

const resolvePackage = (name) =>
  path.dirname(require.resolve(`${name}/package.json`, { paths: [projectRoot] }));

config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, "node_modules"),
  path.join(workspaceRoot, "node_modules"),
];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "expo-constants": resolvePackage("expo-constants"),
  "react-native": resolvePackage("react-native"),
  "react-native-safe-area-context": resolvePackage("react-native-safe-area-context"),
  "react-native-screens": resolvePackage("react-native-screens"),
};

config.resolver.blockList = [
  new RegExp(`${escapePath(path.join(projectRoot, "dist"))}[/\\\\].*`),
  new RegExp(`${escapePath(path.join(projectRoot, "dist-web"))}[/\\\\].*`),
  new RegExp(`${escapePath(path.join(projectRoot, ".expo", "web"))}[/\\\\].*`),
];

module.exports = config;

function escapePath(value) {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}
