// Post-build patch: convert remaining await import("pkg") -> await __dynImport("pkg")
// where __dynImport uses createRequire for CJS packages.
// This prevents Vercel Node 20 ESM compileSourceTextModule from triggering.
const fs = require('fs');
const file = 'C:/Users/Administrador/fonoaudio-pro-app-audit/server/handler.cjs';
let c = fs.readFileSync(file, 'utf8');

// Add polyfill at top: __dynImport using createRequire
const poly = `
// --- VERVER ESM-LOADER FIX ---
// Convert dynamic import() of CJS packages to require() via createRequire.
const __createRequire2 = require('module').createRequire;
const __dynRequire = __createRequire2 ? __createRequire2(__filename || process.cwd() + '/') : require;
function __dynImport(spec) {
  try { return Promise.resolve(__dynRequire(spec)); }
  catch(e) { return import(spec); }
}
// --- END FIX ---
`;
c = poly + '\n' + c;

// Replace await import("pkg") -> await __dynImport("pkg")
c = c.replace(/\bawait import\(/g, 'await __dynImport(');

fs.writeFileSync(file, c);
const ai = (c.match(/await import\(/g) || []).length;
console.log('await import remaining:', ai);
console.log('POST_PATCH_DONE');
