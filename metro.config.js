// Metro config: Expo defaults, plus one web-only alias. On the web, `expo-router` imports from the
// app resolve to the small shim in src/nav/expo-router.web.tsx (see DECISIONS D-043).
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const shim = path.join(__dirname, 'src', 'nav', 'expo-router.web.tsx');
const appDir = path.join(__dirname, 'src') + path.sep;
const upstream = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'expo-router' && context.originModulePath.startsWith(appDir)) {
    return { type: 'sourceFile', filePath: shim };
  }
  return upstream ? upstream(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
