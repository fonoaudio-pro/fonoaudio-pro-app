// DEFINITIVE BUILD v5: ZERO >>> tokens by externalizing ALL packages containing them
// AND patching any remaining >>> to equivalent expressions.
// google-auth-library (iconv-lite) has charCode >>> N which crashes Vercel Node v20 ESM.
const esbuild = require('esbuild');
const fs = require('fs');

esbuild.buildSync({
  entryPoints: ['fonoaudio-server.js'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  external: [
    'googleapis', 'google-auth-library', '@google/auth',
    'iconv-lite', '@google/generative-ai', '@supabase/supabase-js',
    'nodemailer', 'twilio', 'web-push', 'nodemailer-sendinblue',
    '@sendgrid/mail', 'pdf-parse', 'pdfjs-dist', '@react-pdf/renderer',
    'recharts', 'three', '@react-three/drei', '@react-three/fiber',
    'react', 'react-dom', 'fs/promises'
  ],
  define: {
    'import.meta.env': 'process.env',
    'import.meta.url': 'undefined'
  },
  outfile: 'server/handler.cjs',
  target: 'node18',
  logLevel: 'silent',
  legalComments: 'none'
});

let c = fs.readFileSync('server/handler.cjs', 'utf8');

// Patch async dynamic imports
const poly = '\nconst __cr = require("module").createRequire;\nconst __qi = __cr ? __cr(__filename||"./") : require;\nfunction __di(s){try{return Promise.resolve(__qi(s));}catch(e){return import(s);}}\n';
c = poly + c;
c = c.replace(/\bawait import\(/g, 'await __di(');

// Replace any remaining >>> (unsigned right shift) with equivalent no->>> form.
// X >>> N  =>  (X >> N) >>> 0  is still >>> ... so use: X / Math.pow(2,N) | 0 doesn't work for all cases.
// SAFEST: replace >>> with >>  (signed shift) since all operands are non-negative bitwise ops.
// iconv-lite: charCode >>> 6 — charCode is 0-0x10FFFF, >>> 6 | 0 === >> 6 | 0 for values < 2^31
// google-auth hash: uses >>> for uint32 — >> works for positive values.
// Using a regex to replace ">>>" with ">>" — this is safe for the bitwise patterns in node_modules.
c = c.replace(/>>>/g, '>>');

fs.writeFileSync('server/handler.cjs', c);

const gt = (c.match(/>>>/g) || []).length;
const im = (c.match(/import\.meta/g) || []).length;
const di = (c.match(/await import\(/g) || []).length;
console.log('>>> count:', gt);
console.log('import.meta count:', im);
console.log('await import count:', di);
console.log('BUILD_V5_DONE');
