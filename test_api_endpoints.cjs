const https = require('https');

const BASE_URL = 'fonoaudio-pro-ai.vercel.app';

const routesToTest = [
  { method: 'GET', path: '/api/health' },
  { method: 'GET', path: '/api/work-journal' },
  { method: 'GET', path: '/api/clinical/history' },
  { method: 'GET', path: '/api/communication/channels' },
  { method: 'GET', path: '/api/tts/voices' },
  { method: 'GET', path: '/api/images/openverse?q=test' },
  { method: 'POST', path: '/api/process', body: JSON.stringify({ action: 'test' }) },
];

function testEndpoint(route) {
  return new Promise((resolve) => {
    const postData = route.body || '';
    const options = {
      hostname: BASE_URL,
      path: route.path,
      method: route.method,
      family: 4,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };

    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log(`[${route.method}] ${route.path} => Status: ${res.statusCode} | Length: ${d.length} | Preview: ${d.substring(0, 150)}`);
        resolve({ path: route.path, status: res.statusCode, body: d });
      });
    });

    req.on('error', e => {
      console.log(`[${route.method}] ${route.path} => ERROR: ${e.message}`);
      resolve({ path: route.path, error: e.message });
    });

    req.on('timeout', () => {
      req.destroy();
      console.log(`[${route.method}] ${route.path} => TIMEOUT`);
      resolve({ path: route.path, error: 'TIMEOUT' });
    });

    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('Testing API Endpoints on Vercel...\n');
  for (const route of routesToTest) {
    await testEndpoint(route);
  }
}

runTests();
