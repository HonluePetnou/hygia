const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo pnpm : Metro doit voir les paquets partagés (@hygia/*) et suivre les liens symboliques.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

// Les sources suivent la convention du monorepo (imports relatifs en `./x.js`, comme TypeScript
// en résolution Bundler) : Metro doit retrouver `x.ts` / `x.tsx`.
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const target = /^\.{1,2}\//.test(moduleName) ? moduleName.replace(/\.js$/, '') : moduleName;
  return (defaultResolve ?? context.resolveRequest)(context, target, platform);
};

module.exports = config;
