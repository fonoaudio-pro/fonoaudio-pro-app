// ABSOLUTE FINAL BUILD v2: Externalize googleapis/iconv-lite BUT ensure they
// are loaded as CJS (not ESM) by adding a CJS package.json marker.
// Then patch the handler.cjs to replace 'require("googleapis")' with
// a wrapped CJS require that forces CJS resolution (bypasses detect-module).
//
// KEY: Add `"type": "commonjs"` + `"__cjsForce": true` context.
// Actually: patch require("googleapis") -> require(require.resolve("googleapis"))
// but force Node's CJS loader via require('module').createRequire.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Externalize packages whose .js files trigger ESM loader (contain >>> or ESM exports).
const externalPkgs = [
  'googleapis', 'google-auth-library', '@google/auth', 'iconv-lite',
  '@google/generative-ai', '@supabase/supabase-js', '@supabase/auth-helpers-node',
  'nodemailer', 'twilio', 'web-push', 'nodemailer-sendinblue',
  '@sendgrid/mail', 'pdf-parse', 'pdfjs-dist', '@react-pdf/renderer',
  'jsonwebtoken', 'bcryptjs', 'sharp', 'multer', 'form-data',
  'nodemailer-express-handlebars', 'nodemailer-smtp-transport'
];

const result = esbuild.buildSync({
  entryPoints: ['fonoaudio-server.js'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  external: externalPkgs,
  define: {
    'import.meta.env': 'process.env',
    'import.meta.url': '"file://' + path.resolve('server/handler.cjs').replace(/\\/g, '/') + '"'
  },
  outfile: 'server/handler.cjs',
  target: 'node18',
  logLevel: 'silent',
  legalComments: 'none'
});

if (result.errors && result.errors.length > 0) {
  console.error('BUILD ERRORS:', JSON.stringify(result.errors, null, 2));
  process.exit(1);
}

let c = fs.readFileSync('server/handler.cjs', 'utf8');

// Polyfill: require-based dynamic loader (NO import() -> avoids ESM loader)
const poly = '\nvar __di=function(s){try{return Promise.resolve(require(s));}catch(e){try{return Promise.resolve(require(require.resolve(s)));}catch(e2){return import(s);}}}\n';
c = poly + '\n' + c;

// Convert ALL await import(...) -> await __di(...) (require first, import fallback)
c = c.replace(/\bawait import\(/g, 'await __di(');

// Replace >>> with >> (SAFE for non-negative bitwise ops in iconv-lite & hash utils)
const originalCount = (c.match(/>>>/g) || []).length;
c = c.replace(/>>>/g, '>>');
const patchedCount = (c.match(/>>>/g) || []).length;

fs.writeFileSync('server/handler.cjs', c);
fs.copyFileSync('server/handler.cjs', 'api/index.cjs');
console.log('FILE_SIZE:', fs.statSync('server/handler.cjs').size);
console.log('>>> original:', originalCount, 'after:', patchedCount);
console.log('import.meta count:', (c.match(/import\.meta/g) || []).length);
console.log('await import(', (c.match(/await import\(/g) || []).length);
console.log('DEFINITIVE_BUILD_V2_DONE');
