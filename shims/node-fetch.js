// React Native has a native global fetch — no need for node-fetch.
const f = global.fetch;
module.exports = f;
module.exports.default = f;
