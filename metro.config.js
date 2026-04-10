const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Force react and react-native to resolve from project root (fixes "Unable to resolve react" when bundling from expo-router entry)
const projectRoot = __dirname;
const nodeModules = path.resolve(projectRoot, 'node_modules');
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: path.resolve(nodeModules, 'react'),
  'react-native': path.resolve(nodeModules, 'react-native'),
};

// react-native-health is iOS-only — return an empty module on Android so the
// bundler doesn't fail. The health.ts service wraps the require() in try/catch
// and skips gracefully at runtime when the native module isn't available.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'android' && moduleName === 'react-native-health') {
    return { type: 'empty' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
