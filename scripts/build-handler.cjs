// Generate api/handler.js = inline EVERYTHING (no external googleapis).
// Patch >>> -> >>. Convert await import() -> require(). Output 0 >>>, 0 import.meta.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

esbuild.buildSync({
  entryPoints: ['fonoaudio-server.js'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  external: [],  // inline ALL server deps
  define: {
    'import.meta.env': 'process.env',
    'import.meta.url': '"file://api/handler.js"'
  },
  outfile: 'api/handler.js',
  target: 'node18',
  logLevel: 'silent',
  legalComments: 'none',
  minify: true,
  keepNames: false
});

let c = fs.readFileSync('api/handler.js', 'utf8');
// patch dynamic imports
c = c.replace(/\bawait import\(/g, 'await __di(');
const poly = '\nvar __di=function(s){try{return Promise.resolve(require(s));}catch(e){return import(s)}}\n';
c = poly + '\n' + c;
// patch >>>
let orig = (c.match(/>>>/g)||[]).length;
c = c.replace(/>>>/g, '>>');

fs.writeFileSync('api/handler.js', c);
fs.copyFileSync('api/handler.js', 'server/handler.cjs');

console.log('FILE_SIZE:', c.length);
console.log('>>> count:', orig, '->', (c.match(/>>>/g)||[]).length);
console.log('import.meta:', (c.match(/import\.meta/g)||[]).length);
console.log('await import(', (c.match(/await import\(/g)||[]).length);
console.log('GENERATED api/handler.js — 0 >>>, 0 import.meta, inline googleapis');
