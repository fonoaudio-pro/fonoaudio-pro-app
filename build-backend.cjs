#!/usr/bin/env node
// Build the ENTIRE backend to a single self-contained CommonJS file (api/index.cjs)
// with ALL node_modules EXTERNAL and import.meta.env neutralized.
// This bundle is committed so Vercel serves a CJS file with ZERO '>>>' tokens —
// bypassing the ESM compileSourceTextModule crash entirely.
const esbuild = require('esbuild');
const fs = require('fs');

esbuild.build({
  entryPoints: ['api/index.js'],
  bundle: true,
  format: 'cjs',          // CommonJS output
  platform: 'node',
  target: 'node18',
  sourcemap: false,
  minify: false,
  write: true,
  outfile: 'api/index.cjs',
  logLevel: 'silent',
  packages: 'external',   // externalize ALL node_modules
  define: { 'import.meta.env': 'process.env' }
}).then(r => {
  const bytes = fs.statSync('api/index.cjs').size;
  const src = fs.readFileSync('api/index.cjs', 'utf8');
  console.log('BYTES=' + bytes);
  console.log('>>> count=' + (src.match(/>>/g) || []).length);
  console.log('import.meta count=' + (src.match(/import\.meta/g) || []).length);
  console.log('OK: api/index.cjs written');
}).catch(e => { console.error('FAIL=' + e.message.slice(0, 200)); process.exit(1); });
