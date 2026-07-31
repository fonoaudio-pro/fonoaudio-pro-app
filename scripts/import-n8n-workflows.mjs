#!/usr/bin/env node
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';

const N8N_URL = process.env.N8N_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_URL) {
  console.error('N8N_URL is not set in .env');
  process.exit(1);
}

const workflowsDir = path.resolve(process.cwd(), 'n8n-workflows');

import http from 'http';
import https from 'https';
import { URL } from 'url';

async function tryPost(endpoint, body) {
  const url = new URL(endpoint);
  const payload = JSON.stringify(body);
  const isHttps = url.protocol === 'https:';
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    ...(N8N_API_KEY ? { 'X-N8N-API-KEY': N8N_API_KEY } : {})
  };

  return new Promise((resolve) => {
    const opts = { method: 'POST', headers, hostname: url.hostname, port: url.port || (isHttps ? 443 : 80), path: url.pathname + (url.search || '') };
    const req = (isHttps ? https : http).request(opts, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode || 0, ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300, text: data });
      });
    });
    req.on('error', (err) => { resolve({ status: 0, ok: false, text: String(err) }); });
    req.write(payload);
    req.end();
  });
}

async function importAll() {
  console.log('Importing workflows from', workflowsDir);
  const files = await fs.readdir(workflowsDir);
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  const results = [];

  for (const file of jsonFiles) {
    const full = path.join(workflowsDir, file);
    console.log('\n--', file);
    try {
      const raw = await fs.readFile(full, 'utf8');
      let payload;
      try { payload = JSON.parse(raw); } catch (e) { console.error('  Invalid JSON'); results.push({ file, ok: false, error: 'invalid json' }); continue; }

      const base = N8N_URL.replace(/\/$/, '');

      // Try common import endpoints
      const endpoints = [
        `${base}/workflows/import`,
        `${base}/rest/workflows/import`,
        `${base}/rest/workflows`,
        `${base}/workflows`
      ];

      let resp;
      for (const ep of endpoints) {
        process.stdout.write(`  Trying ${ep} ... `);
        resp = await tryPost(ep, payload);
        if (resp.ok) {
          console.log('OK');
          results.push({ file, ok: true, endpoint: ep, status: resp.status, text: resp.text });
          break;
        } else {
          console.log(`failed (${resp.status})`);
        }
      }

      if (!resp || !resp.ok) {
        results.push({ file, ok: false, error: resp ? resp.text : 'no response' });
      }
    } catch (e) {
      console.error('  Error reading file', e.message || e);
      results.push({ file, ok: false, error: String(e) });
    }
  }

  console.log('\nSummary:');
  for (const r of results) {
    if (r.ok) console.log(`  [OK]   ${r.file} -> ${r.endpoint} (${r.status})`);
    else console.log(`  [ERR]  ${r.file} -> ${r.error}`);
  }

  // Try to list workflows (best-effort)
  try {
    const listEpCandidates = [
      `${N8N_URL.replace(/\/$/, '')}/workflows`,
      `${N8N_URL.replace(/\/$/, '')}/rest/workflows`
    ];
    for (const le of listEpCandidates) {
      try {
        const r = await fetch(le, { headers: { ...(N8N_API_KEY ? { 'X-N8N-API-KEY': N8N_API_KEY } : {}) } });
        if (r.ok) {
          const j = await r.json();
          console.log('\nWorkflows on remote n8n (sample):', Array.isArray(j) ? j.slice(0,5).map(w=>w.name || w.id) : Object.keys(j || {}).slice(0,5));
          break;
        }
      } catch {}
    }
  } catch {}
}

importAll().catch(e => { console.error(e); process.exit(1); });
