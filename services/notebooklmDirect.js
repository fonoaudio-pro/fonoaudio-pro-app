/**
 * Direct NotebookLM API client — replaces Python CLI with Node.js fetch calls.
 * Uses the same batchexecute protocol as the Python library.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BASE_URL = 'https://notebooklm.google.com';
const BATCHEXECUTE_URL = `${BASE_URL}/_/LabsTailwindUi/data/batchexecute`;

// RPC method IDs (from Python library)
export const RPC = {
  LIST_NOTEBOOKS: 'wXbhsf',
  LIST_ARTIFACTS: 'gArtLc',
  CREATE_ARTIFACT: 'R7cb6c',
  GET_NOTEBOOK: 'rLM1Ne',
};

let _storagePath = null;

function getStoragePath() {
  if (_storagePath) return _storagePath;
  _storagePath = path.join(os.homedir(), '.notebooklm', 'profiles', 'default', 'storage_state.json');
  return _storagePath;
}

function loadCookies() {
  const storagePath = getStoragePath();
  if (!fs.existsSync(storagePath)) return [];
  const storage = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
  return (storage.cookies || []).filter(c => {
    const domain = c.domain || '';
    return domain.includes('google.com') || domain.includes('googleusercontent.com');
  });
}

function cookiesToHeader(cookies) {
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

function extractField(html, key) {
  // Pattern 1: Double-quoted "key":"value"
  const p1 = new RegExp(`"${key}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`);
  let m = p1.exec(html);
  if (m) return m[1];
  // Pattern 2: Single-quoted 'key':'value'
  const p2 = new RegExp(`'${key}'\\s*:\\s*'([^'\\\\]*(?:\\\\.[^'\\\\]*)*)'`);
  m = p2.exec(html);
  if (m) return m[1];
  // Pattern 3: HTML-escaped
  const p3 = new RegExp(`&quot;${key}&quot;\\s*:\\s*&quot;((?:(?!&quot;).)*)&quot;`);
  m = p3.exec(html);
  if (m) return m[1];
  return null;
}

let _csrfToken = null;
let _sessionId = null;

async function getTokens() {
  if (_csrfToken && _sessionId) return { csrf: _csrfToken, sid: _sessionId };

  const cookies = loadCookies();
  const cookieHeader = cookiesToHeader(cookies);

  const resp = await fetch(BASE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Cookie': cookieHeader,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch NotebookLM page: ${resp.status} ${resp.statusText}`);
  }

  const html = await resp.text();

  const csrf = extractField(html, 'SNlM0e');
  const sid = extractField(html, 'FdrFJe');

  if (!csrf) {
    // Check if we got redirected to login
    if (html.includes('accounts.google.com') || html.includes('Sign in')) {
      throw new Error('Authentication expired. Run: python -m notebooklm login');
    }
    throw new Error('CSRF token not found in page HTML');
  }

  _csrfToken = csrf;
  _sessionId = sid || '';
  console.log('[NBLM Direct] Got tokens, csrf length:', csrf.length, 'sid:', sid ? 'yes' : 'no');
  return { csrf: _csrfToken, sid: _sessionId };
}

function encodeRpcRequest(rpcId, params) {
  const paramsJson = JSON.stringify(params);
  const inner = [rpcId, paramsJson, null, 'generic'];
  return [[inner]];
}

function buildBody(rpcRequest, csrf) {
  const fReq = JSON.stringify(rpcRequest);
  const parts = [`f.req=${encodeURIComponent(fReq)}`];
  if (csrf) parts.push(`at=${encodeURIComponent(csrf)}`);
  return parts.join('&') + '&';
}

let _reqId = 0;
function nextReqId() {
  return String(++_reqId);
}

function buildRpcUrl(rpcId, sid) {
  const params = new URLSearchParams({
    rpcids: rpcId,
    'source-path': '/',
    'f.sid': sid || '',
    'hl': 'en',
    'rt': 'c',
    'authuser': '0',
    '_reqid': nextReqId(),
  });
  return `${BATCHEXECUTE_URL}?${params.toString()}`;
}

async function rpcCall(rpcId, params) {
  const { csrf, sid } = await getTokens();
  const cookies = loadCookies();
  const cookieHeader = cookiesToHeader(cookies);

  const request = encodeRpcRequest(rpcId, params);
  const body = buildBody(request, csrf);

  const url = buildRpcUrl(rpcId, sid);

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Cookie': cookieHeader,
      'Referer': `${BASE_URL}/`,
      'Origin': BASE_URL,
      'X-Goog-AuthUser': '0',
    },
    body,
    signal: AbortSignal.timeout(60000),
  });

  if (!resp.ok) {
    throw new Error(`RPC ${rpcId} failed: ${resp.status} ${resp.statusText}`);
  }

  const text = await resp.text();
  console.log('[NBLM Direct] RPC', rpcId, 'response length:', text.length);
  console.log('[NBLM Direct] RPC response preview:', text.substring(0, 500));
  return parseBatchExecuteResponse(text, rpcId);
}

function parseBatchExecuteResponse(text, rpcId) {
  // Strip anti-XSSI prefix )]}'
  let cleaned = text;
  if (cleaned.startsWith(")]}'")) {
    const nlIdx = cleaned.indexOf('\n');
    cleaned = nlIdx >= 0 ? cleaned.substring(nlIdx + 1) : cleaned.substring(4);
  }

  // Try to parse as JSON array (standard batchexecute format)
  try {
    const arr = JSON.parse(cleaned);
    if (Array.isArray(arr)) {
      // Look for wrb.fr entries
      for (const item of arr) {
        if (Array.isArray(item) && item.length >= 3 && item[0] === 'wrb.fr' && item[1] === rpcId) {
          const resultData = item[2];
          if (typeof resultData === 'string') {
            try { return JSON.parse(resultData); } catch { return resultData; }
          }
          return resultData;
        }
        // Handle nested arrays: [[wrb.fr, id, data], ...]
        if (Array.isArray(item) && item.length > 0 && Array.isArray(item[0])) {
          for (const inner of item) {
            if (Array.isArray(inner) && inner.length >= 3 && inner[0] === 'wrb.fr' && inner[1] === rpcId) {
              const resultData = inner[2];
              if (typeof resultData === 'string') {
                try { return JSON.parse(resultData); } catch { return resultData; }
              }
              return resultData;
            }
          }
        }
      }
    }
  } catch { /* not valid JSON, try line-by-line */ }

  // Fallback: line-by-line parsing for chunked format
  const lines = cleaned.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'null') continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (Array.isArray(item) && item.length >= 3 && item[0] === 'wrb.fr' && item[1] === rpcId) {
            const resultData = item[2];
            if (typeof resultData === 'string') {
              try { return JSON.parse(resultData); } catch { return resultData; }
            }
            return resultData;
          }
        }
      }
    } catch { continue; }
  }
  return null;
}

// ---- Public API ----

let _lastDebugRaw = null;

export function getLastDebugRaw() { return _lastDebugRaw; }

export async function rawRpcCall(rpcId, params) {
  const { csrf, sid } = await getTokens();
  const cookies = loadCookies();
  const cookieHeader = cookiesToHeader(cookies);

  const request = encodeRpcRequest(rpcId, params);
  const body = buildBody(request, csrf);

  const url = buildRpcUrl(rpcId, sid);

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Cookie': cookieHeader,
      'Referer': `${BASE_URL}/`,
      'Origin': BASE_URL,
      'X-Goog-AuthUser': '0',
    },
    body,
    signal: AbortSignal.timeout(60000),
  });

  if (!resp.ok) throw new Error(`RPC ${rpcId} failed: ${resp.status}`);
  return await resp.text();
}

export async function listNotebooks() {
  const result = await rpcCall(RPC.LIST_NOTEBOOKS, [null, 1, null, [2]]);
  if (!result || !Array.isArray(result)) return [];
  return result.map(row => {
    if (!Array.isArray(row)) return row;
    return {
      title: (row[0] || '').replace('thought\n', '').trim(),
      id: row[2] || '',
    };
  }).filter(nb => nb.id);
}

export async function listArtifacts(notebookId) {
  const result = await rpcCall(RPC.LIST_ARTIFACTS, [[2], notebookId, 'NOT artifact.status = "ARTIFACT_STATUS_SUGGESTED"']);
  if (!result) return [];

  const artifacts = [];
  // Handle wrapped envelope: [[row1, row2, ...]] or flat [row1, row2, ...]
  let rows = [];
  if (Array.isArray(result) && result.length === 1 && Array.isArray(result[0])) {
    rows = result[0];
  } else if (Array.isArray(result)) {
    rows = result;
  }

  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const art = {
      id: row[0],
      title: row[1],
      type_id: resolveTypeCode(row[2]),
      status_id: row[4],
      status: resolveStatusCode(row[4]),
    };
    // Extract URLs based on type
    const typeCode = row[2];
    if (typeCode === 8) {
      // SLIDE_DECK — PDF at [16][3], PPTX at [16][4]
      const slideMeta = row[16];
      if (Array.isArray(slideMeta)) {
        art.url = slideMeta[3] || null;
        art.pptx_url = slideMeta[4] || null;
      }
    } else if (typeCode === 1) {
      // AUDIO — media list at [6][5]
      const audioMeta = row[6];
      if (Array.isArray(audioMeta) && Array.isArray(audioMeta[5]) && audioMeta[5].length > 0) {
        art.url = audioMeta[5][0]?.[0] || null;
      }
    } else if (typeCode === 3) {
      // VIDEO — media at [8]
      const videoMeta = row[8];
      if (Array.isArray(videoMeta)) {
        for (const variant of videoMeta) {
          if (Array.isArray(variant) && variant.length > 0) {
            const mediaUrl = variant[0];
            if (mediaUrl && typeof mediaUrl === 'string') {
              art.url = mediaUrl;
              break;
            }
          }
        }
      }
    } else if (typeCode === 7) {
      // INFOGRAPHIC — content at [16][2]
      const infoMeta = row[16];
      if (Array.isArray(infoMeta) && Array.isArray(infoMeta[2]) && infoMeta[2].length > 0) {
        const content = infoMeta[2][0];
        if (Array.isArray(content) && content.length > 1) {
          art.url = content[1] || null;
        }
      }
    }
    artifacts.push(art);
  }
  return artifacts;
}

function resolveTypeCode(code) {
  const map = {
    1: 'audio',
    2: 'report',
    3: 'video',
    4: 'quiz',
    5: 'mind_map',
    7: 'infographic',
    8: 'slide_deck',
    9: 'data_table',
  };
  return map[code] || `type_${code}`;
}

function resolveStatusCode(code) {
  const map = {
    1: 'in_progress',
    2: 'completed',
    3: 'error',
  };
  return map[code] || 'pending';
}

/**
 * Refresh tokens by re-fetching the page.
 */
export function resetTokens() {
  _csrfToken = null;
  _sessionId = null;
}

export async function checkAuth() {
  try {
    const cookies = loadCookies();
    if (cookies.length === 0) return { status: 'no_cookies', message: 'No cookies found' };

    const { csrf } = await getTokens();
    return { status: 'authenticated', csrf_length: csrf.length };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}
