import fs from 'fs';
import path from 'path';
import os from 'os';

const BASE_URL = 'https://notebooklm.google.com';
const BATCHEXECUTE_URL = BASE_URL + '/_/LabsTailwindUi/data/batchexecute';

function loadCookies() {
  const sp = path.join(os.homedir(), '.notebooklm', 'profiles', 'default', 'storage_state.json');
  const storage = JSON.parse(fs.readFileSync(sp, 'utf8'));
  return (storage.cookies || []).filter(c => (c.domain || '').includes('google.com'));
}

function cookiesToHeader(cookies) {
  return cookies.map(c => c.name + '=' + c.value).join('; ');
}

function extractField(html, key) {
  const patterns = [
    new RegExp(`"${key}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`),
    new RegExp(`'${key}'\\s*:\\s*'([^'\\\\]*(?:\\\\.[^'\\\\]*)*)'`),
  ];
  for (const p of patterns) {
    const m = p.exec(html);
    if (m) return m[1];
  }
  return null;
}

let _reqId = 0;

const cookies = loadCookies();
const cookieHeader = cookiesToHeader(cookies);

// Step 1: Get tokens
const resp = await fetch(BASE_URL, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Cookie': cookieHeader,
  },
  redirect: 'follow',
  signal: AbortSignal.timeout(30000),
});
const html = await resp.text();
const csrf = extractField(html, 'SNlM0e');
const sid = extractField(html, 'FdrFJe');
console.log('CSRF:', csrf ? 'OK' : 'MISSING');

async function rpcCall(rpcId, params) {
  const inner = [rpcId, JSON.stringify(params), null, 'generic'];
  const rpcRequest = [[inner]];
  const fReq = JSON.stringify(rpcRequest);
  const body = 'f.req=' + encodeURIComponent(fReq) + '&at=' + encodeURIComponent(csrf) + '&';

  let url = BATCHEXECUTE_URL + '?rpcids=' + rpcId + '&authuser=0&soc-app=162&soc-platform=1&_reqid=' + (++_reqId) + '&hl=en';
  if (sid) url += '&sid=' + sid + '&';

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Cookie': cookieHeader,
      'Referer': BASE_URL + '/',
      'Origin': BASE_URL,
      'X-Goog-AuthUser': '0',
    },
    body,
    signal: AbortSignal.timeout(30000),
  });

  const text = await r.text();
  // Parse batchexecute response
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'null' || trimmed.startsWith(")]}'")) continue;
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr) && arr.length >= 2) {
        const payload = arr[1];
        if (typeof payload === 'string') {
          return JSON.parse(payload);
        }
        return payload;
      }
    } catch { continue; }
  }
  return null;
}

// Step 2: List notebooks with correct params
console.log('\n=== LIST NOTEBOOKS ===');
const notebooks = await rpcCall('wXbhsf', [null, 1, null, [2]]);
console.log('Notebooks type:', typeof notebooks);
console.log('Notebooks is array:', Array.isArray(notebooks));
if (Array.isArray(notebooks)) {
  console.log('Count:', notebooks.length);
  // Each notebook is a nested array
  for (const nb of notebooks.slice(0, 3)) {
    console.log('NB type:', typeof nb, Array.isArray(nb) ? 'len=' + nb.length : '');
    if (Array.isArray(nb)) {
      console.log('  ID:', nb[0], 'Title:', nb[1]);
    } else {
      console.log('  Raw:', JSON.stringify(nb).substring(0, 200));
    }
  }
}

// Step 3: Get first notebook's artifacts
if (Array.isArray(notebooks) && notebooks.length > 0 && Array.isArray(notebooks[0])) {
  const nbId = notebooks[0][0];
  console.log('\n=== LIST ARTIFACTS for', nbId, '===');
  const artifacts = await rpcCall('gArtLc', [{ notebook_id: nbId }]);
  console.log('Artifacts type:', typeof artifacts);
  console.log('Artifacts is array:', Array.isArray(artifacts));
  if (Array.isArray(artifacts)) {
    console.log('Count:', artifacts.length);
    for (const art of artifacts.slice(0, 3)) {
      if (Array.isArray(art)) {
        console.log('  ID:', art[0], 'Title:', art[1], 'Type:', art[2], 'Status:', art[4]);
        // Check slide deck URL at position 16
        if (art[2] === 2 && art[16]) {
          const slideMeta = art[16];
          console.log('  Slide meta:', JSON.stringify(slideMeta).substring(0, 300));
        }
        if (art[2] === 1 && art[6]) {
          console.log('  Audio meta:', JSON.stringify(art[6]).substring(0, 300));
        }
      }
    }
  } else if (artifacts) {
    console.log('Raw:', JSON.stringify(artifacts).substring(0, 1000));
  }
}
