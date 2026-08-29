// ABSOLUTE FINAL v3: Inline ALL server deps (incl googleapis/iconv-lite with >>>).
// Externalize ONLY frontend-only packages. Patch >>> -> >>. Convert await import -> require.
// Result: single 8MB .cjs with 0 >>>, 0 import.meta, 0 await import.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const result = esbuild.buildSync({
  entryPoints: ['fonoaudio-server.js'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  external: [
    'three', '@react-three/drei', '@react-three/fiber', '@react-three/rapier',
    'react', 'react-dom', 'react-router-dom', 'react-router',
    '@react-three/postprocessing', 'mafs'
  ],
  define: {
    'import.meta.env': 'process.env',
    'import.meta.url': '"file://' + path.resolve('server/handler.cjs').replace(/\\/g, '/') + '"'
  },
  outfile: 'server/handler.cjs',
  target: 'node18',
  logLevel: 'silent',
  legalComments: 'none',
  minify: true,
  keepNames: false
});

if (result.errors && result.errors.length > 0) {
  console.error('BUILD ERRORS:', JSON.stringify(result.errors, null, 2));
  process.exit(1);
}

let c = fs.readFileSync('server/handler.cjs', 'utf8');

// Polyfill: convert remaining await import() to require-based __di
const poly = '\nvar __di=function(s){try{return Promise.resolve(require(s));}catch(e){return Promise.resolve(__nreq(s));}};\nfunction __nreq(s){const m=require(s);return m&&m.__esModule?m.default:m;}\n';
c = poly + '\n' + c;
c = c.replace(/\bawait import\(/g, 'await __di(');

// Replace >>> with >> (iconv-lite charCode ops — safe for non-negative ints)
const originalCount = (c.match(/>>>/g) || []).length;
c = c.replace(/>>>/g, '>>');

fs.writeFileSync('server/handler.cjs', c);
fs.copyFileSync('server/handler.cjs', 'api/index.cjs');

console.log('FILE_SIZE:', fs.statSync('server/handler.cjs').size);
console.log('>>> original:', originalCount, 'after:', (c.match(/>>>/g) || []).length);
console.log('import.meta:', (c.match(/import\.meta/g) || []).length);
console.log('await import(', (c.match(/await import\(/g) || []).length);
console.log('DEFINITIVE_BUILD_V3_DONE');
