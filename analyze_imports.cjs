const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('fonoaudio-server.js', 'utf8');
const lines = content.split('\n');
const imports = [];

lines.forEach(line => {
  // Handle ESM imports
  const m1 = line.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/i);
  // Handle require
  const m2 = line.match(/require\(['"]([^'"]+)['"]\)/i);
  if (m1 && !m1[1].startsWith('http') && !m1[1].startsWith('npm')) {
    imports.push(m1[1]);
  }
  if (m2 && !m2[1].startsWith('http') && !m2[1].startsWith('npm')) {
    imports.push(m2[1]);
  }
});

console.log('Imports in fonoaudio-server.js:');
imports.slice(0, 30).forEach(i => console.log('  ', i));
console.log('Total:', imports.length);

// Now check what routes imports
const routeFiles = ['routes/api.js', 'routes/clinical.js', 'routes/communication.js', 'routes/config.js', 'routes/notebooklm.js', 'routes/ocr.js', 'routes/tts.js', 'routes/workJournal.js'];
console.log('\nRoute file imports:');
routeFiles.forEach(rf => {
  if (fs.existsSync(rf)) {
    const rc = fs.readFileSync(rf, 'utf8');
    const rlines = rc.split('\n');
    const rimports = [];
    rlines.forEach(line => {
      const m1 = line.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/i);
      const m2 = line.match(/require\(['"]([^'"]+)['"]\)/i);
      if (m1) rimports.push(m1[1]);
      if (m2) rimports.push(m2[1]);
    });
    console.log(rf + ':', rimports.length > 0 ? rimports.slice(0, 5).join(', ') : 'no local imports');
  }
});

// Check config/serverConfig.js
if (fs.existsSync('config/serverConfig.js')) {
  const cc = fs.readFileSync('config/serverConfig.js', 'utf8');
  console.log('\nserverConfig.js size:', cc.length, 'bytes');
}

// Count total files needed
console.log('\n--- File analysis ---');
function countFiles(dir) {
  if (!fs.existsSync(dir)) return { count: 0, size: 0 };
  let count = 0, size = 0;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      const sub = countFiles(fullPath);
      count += sub.count;
      size += sub.size;
    } else {
      const stat = fs.statSync(fullPath);
      count++;
      size += stat.size;
    }
  }
  return { count, size };
}

const dirs = ['dist', 'api', 'routes', 'config', 'utils', 'types', 'services'];
dirs.forEach(d => {
  const c = countFiles(d);
  console.log(d + ':', c.count, 'files,', Math.round(c.size/1024), 'KB');
});
