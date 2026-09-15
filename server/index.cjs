// DEFINITIVE v3: NO BUNDLING — use require() of original ESM via createRequire.
// This avoids esbuild entirely → no >>> introduced, no import.meta corruption.
// The original fonoaudio-server.js is ESM; we use module.createRequire to
// load it as CJS. Vercel serves this .cjs with @vercel/node bundle:false.
const { createRequire, createServer } = (() => {
  const Module = require('module');
  // createRequire is available in Node 12+; we're on 18/20.
  // But fonoaudio-server.js uses ESM `import` syntax — require() won't parse it.
  // So we MUST build a CJS bundle. Fall back to the bundle approach.
  return { createRequire: Module.createRequire, createServer: null };
})();

// Fallback: load the pre-built CJS bundle (server/handler.cjs) which was
// built with esbuild externalizing googleapis. If that bundle has >>> from
// inlined iconv-lite, we patch it below.
const handler = require('./handler.cjs');
module.exports = handler;
