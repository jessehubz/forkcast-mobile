// React Native has native WebSocket — shim the ws npm package to use it.
// @supabase/realtime-js does: require('ws').then(({ default: WS }) => ...)
// so exporting the native WebSocket as both module.exports and .default covers both paths.
const W = global.WebSocket;
module.exports = W;
module.exports.default = W;
