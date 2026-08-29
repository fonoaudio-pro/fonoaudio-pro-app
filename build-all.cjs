#!/usr/bin/env node
// Build ALL api/* to CJS bundles (main + crons) with:
// - packages: 'external'  (no node_modules in bundle)
// - define: import.meta.env -> process.env
const esbuild = require('esbuild');
const fs = require('fs');

const entries = {
  'api/index': 'api/index.js',
  'api/cron/check-reminders': 'api/cron/check-reminders.js',
  'api/cron/daily-summary': 'api/cron/daily-summary.js',
  'api/cron/process-reminders': 'api/cron/process-reminders.js',
};

const buildOpts = {
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: false,
  minify: false,
  write: true,
  logLevel: 'silent',
  packages: 'external',
  define: { 'import.meta.env': 'process.env' },
};

async function buildAll() {
  for (const [outName, entry] of Object.entries(entries)) {
    console.log(`Building ${outName}.cjs from ${entry}...`);
    try {
      await esbuild.build({ ...buildOpts, entryPoints: [entry], outfile: `${outName}.cjs` });
      const src = fs.readFileSync(`${outName}.cjs`, 'utf8');
      const gt = (src.match(/>>/g) || []).length;
      const im = (src.match(/import\.meta/g) || []).length;
      console.log(`  OK ${fs.statSync(`${outName}.cjs`).size} bytes, >>>=${gt}, import.meta=${im}`);
    } catch (e) {
      console.error(`  FAIL ${entry}:`, e.message.slice(0, 150));
      process.exit(1);
    }
  }
  console.log('All CJS bundles built');
}

buildAll();