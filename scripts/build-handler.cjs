// DEFINITIVE BUILD: Patch all `await import()` in the bundle to use createRequire.
// Vercel Node v20 ESM compileSourceTextModule crashes on >>> tokens when
// it detects dynamic import() in a .cjs file and switches to ESM loader.
// Solution: rewrite `await import(X)` to `require(X)` via banner injection.
const esbuild = require('esbuild');

const bannerCode = `
// Convert all dynamic import() to require() to prevent Vercel ESM loader.
const __requireDynamic = (typeof require !== 'undefined') ? require : null;
function __dynRequire(specifier) {
  if (__requireDynamic) {
    try { return __requireDynamic(specifier); } catch(e) {}
  }
  // Fallback: synchronous import for node built-ins
  return require(specifier);
}
`;

esbuild.buildSync({
  entryPoints: ['fonoaudio-server.js'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  external: [
    'googleapis',
    'google-auth-library',
    '@google/auth',
    '@google/generative-ai',
    'fs/promises'
  ],
  define: {
    'import.meta.env': 'process.env',
    'import.meta.url': 'undefined'
  },
  banner: {
    js: bannerCode + '\n// Patched: await import() -> requireSync (Vercel ESM loader fix)'
  },
  outfile: 'server/handler.cjs',
  target: 'node18',
  logLevel: 'silent',
  legalComments: 'none'
});

// Second pass: patch the output to convert await import() to require()
const fs = require('fs');
let content = fs.readFileSync('server/handler.cjs', 'utf8');
// Replace: const X = await import("Y") -> const X = require("Y")
// Replace: await import("Y") -> require("Y")
content = content.replace(/= await import\((['"`])([^'"`]+)\1\)/g, '= require($1$2$1)');
content = content.replace(/await import\((['"`])([^'"`]+)\1\)/g, 'require($1$2$1)');
// Replace: return await import -> return require
content = content.replace(/return await import\((['"`])([^'"`]+)\1\)/g, 'return require($1$2$1)');
fs.writeFileSync('server/handler.cjs', content);

console.log('BUILD_PATCHED_DONE');
