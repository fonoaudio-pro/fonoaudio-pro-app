// FINAL SMART BUILD: inline @google/generative-ai + @supabase/supabase-js,
// externalize googleapis/iconv-lite (CJS-safe via require).
// Replace >>> with >> (safe bitwise for non-negative ints).
// Convert await import() -> require() where possible.
const esbuild = require('esbuild');
const fs = require('fs');

esbuild.buildSync({
  entryPoints: ['fonoaudio-server.js'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  external: [
    'googleapis',
    'google-auth-library',
    '@google/auth',
    'iconv-lite',
    'nodemailer', 'twilio', 'web-push', 'nodemailer-sendinblue',
    '@sendgrid/mail', 'pdf-parse', 'pdfjs-dist', '@react-pdf/renderer',
    'recharts', 'three', '@react-three/drei', '@react-three/fiber',
    'react', 'react-dom', 'fs/promises'
  ],
  define: {
    'import.meta.env': 'process.env',
    'import.meta.url': '"file://C:/Users/Administrador/fonoaudio-pro-app-audit/server/handler.cjs"'
  },
  outfile: 'server/handler.cjs',
  target: 'node18',
  logLevel: 'silent',
  legalComments: 'none'
});

let c = fs.readFileSync('server/handler.cjs', 'utf8');

// Polyfill for dynamic imports
const poly = '\nconst __cr=require("module").createRequire;const __qi=__cr?__cr(__filename||"./"):require;\nfunction __di(s){try{return Promise.resolve(__qi(s));}catch(e){return import(s);}}\n';
c = poly + '\n' + c;

// Convert await import("pkg") -> await __di("pkg")
c = c.replace(/\bawait import\(/g, 'await __di(');

// Replace >>> with >> (iconv-lite/hash bitwise — safe for non-negative ints < 2^31)
c = c.replace(/>>>/g, '>>');

fs.writeFileSync('server/handler.cjs', c);

const gt = (c.match(/>>>/g) || []).length;
const im = (c.match(/import\.meta/g) || []).length;
const ai = (c.match(/await import\(/g) || []).length;
console.log('FILE_SIZE:', c.length);
console.log('>>> count:', gt);
console.log('import.meta count:', im);
console.log('await import count:', ai);
console.log('BUILD_SMART_FINAL_DONE');
