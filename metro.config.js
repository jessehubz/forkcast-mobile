const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// @supabase/realtime-js bundles Node.js-only packages (ws, node-fetch) that
// require Node built-ins (stream, crypto, http, etc.) unavailable in React Native.
// React Native already provides native WebSocket and fetch globals — shim them.
const NODE_SHIMS = {
  ws: path.resolve(__dirname, 'shims/ws.js'),
  '@supabase/node-fetch': path.resolve(__dirname, 'shims/node-fetch.js'),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (NODE_SHIMS[moduleName]) {
    return { filePath: NODE_SHIMS[moduleName], type: 'sourceFile' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
