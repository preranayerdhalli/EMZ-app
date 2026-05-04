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


module.exports = config;
