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

function extractField(html, key) {
  const p1 = new RegExp(`"${key}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`);
  const m1 = p1.exec(html);
  if (m1) return m1[1];
  return null;
}

try {
  console.log('Step 1: Loading cookies...');
  const cookies = loadCookies();
  const cookieHeader = cookies.map(c => c.name + '=' + c.value).join('; ');
  console.log('Loaded', cookies.length, 'cookies');

  console.log('Step 2: Fetching NotebookLM page...');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  const resp = await fetch(BASE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Cookie': cookieHeader,
    },
    redirect: 'follow',
    signal: controller.signal,
  });
  clearTimeout(timeout);
  console.log('Page status:', resp.status);
  const html = await resp.text();
  console.log('HTML length:', html.length);

  const csrf = extractField(html, 'SNlM0e');
  const sid = extractField(html, 'FdrFJe');
  console.log('CSRF:', csrf ? csrf.length + ' chars' : 'MISSING');
  console.log('SID:', sid ? sid.length + ' chars' : 'MISSING');

  if (!csrf) {
    console.log('No CSRF, aborting');
    process.exit(1);
  }

  console.log('Step 3: RPC LIST_NOTEBOOKS...');
  const rpcId = 'wXbhsf';
  const params = [null, 1, null, [2]];
  const inner = [rpcId, JSON.stringify(params), null, 'generic'];
  const rpcRequest = [[inner]];
  const fReq = JSON.stringify(rpcRequest);
  const body = 'f.req=' + encodeURIComponent(fReq) + '&at=' + encodeURIComponent(csrf) + '&';

  let url = BATCHEXECUTE_URL + '?rpcids=' + rpcId + '&authuser=0&soc-app=162&soc-platform=1&_reqid=1&hl=en';
  if (sid) url += '&sid=' + sid + '&';

  const controller2 = new AbortController();
  const timeout2 = setTimeout(() => controller2.abort(), 20000);

  const resp2 = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Cookie': cookieHeader,
      'Referer': BASE_URL + '/',
      'Origin': BASE_URL,
      'X-Goog-AuthUser': '0',
    },
    body,
    signal: controller2.signal,
  });
  clearTimeout(timeout2);
  console.log('RPC status:', resp2.status);
  const text = await resp2.text();
  console.log('Response length:', text.length);
  console.log('Response:', text.substring(0, 2000));

  // Parse notebooks
  const lines = text.split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t || t === 'null' || t.startsWith(")]}'")) continue;
    try {
      const arr = JSON.parse(t);
      if (Array.isArray(arr) && arr.length >= 2) {
        const payload = arr[1];
        if (typeof payload === 'string') {
          const data = JSON.parse(payload);
          console.log('\nParsed notebooks data:');
          if (Array.isArray(data)) {
            console.log('Count:', data.length);
            for (const nb of data.slice(0, 5)) {
              if (Array.isArray(nb)) {
                console.log('  ID:', nb[0], 'Title:', nb[1]);
              }
            }
          }
        }
      }
    } catch { continue; }
  }

  console.log('\nDone!');
} catch (e) {
  console.error('ERROR:', e.message);
  if (e.name === 'AbortError') console.error('Request was aborted (timeout)');
}
process.exit(0);
