import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';
import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import cors from 'cors';

// Fallback: manually load .env if dotenv didn't populate TELEGRAM vars
if (!process.env.TELEGRAM_BOT_TOKEN) {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        for (const line of envContent.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1) continue;
            const key = trimmed.substring(0, eqIdx).trim();
            const val = trimmed.substring(eqIdx + 1).trim();
            if (!process.env[key]) process.env[key] = val;
        }
        console.log('[Env] Manual .env load complete. TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'SET' : 'MISSING');
    } catch (e) {
        console.error('[Env] Failed to load .env manually:', e.message);
    }
}

import { PIPER_COMMAND, VOICE_MODEL_PATH } from './config/serverConfig.js';
import distributionService from './services/distributionService.js';
import ttsRouter from './routes/tts.js';
import apiRouter from './routes/api.js';
import ocrRouter from './routes/ocr.js';
import clinicalRouter from './routes/clinical.js';
import communicationRouter from './routes/communication.js';
import workJournalRouter from './routes/workJournal.js';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const PORT = process.env.PORT || 3001;
app.locals.aiModel = aiModel; // Share model with routes

// ─── Pexels Image Search Proxy ───
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';

// ─── Reminders Engine ───
let isProcessingReminders = false;

async function startRemindersEngine() {
    console.log('[Reminders Engine] Started (non-blocking, errors logged)');
    setInterval(async () => {
        if (isProcessingReminders) return;
        isProcessingReminders = true;
        try {
            const result = await distributionService.processPendingReminders();
            if (result.status === 'ok' && result.processed > 0) {
                console.log(`[Reminders Engine] Processed ${result.processed} reminders`);
            }
        } catch (error) {
            // Silently skip if reminders table doesn't exist
        } finally {
            isProcessingReminders = false;
        }
    }, 60000);
}

// ─── Image Proxy (bypass CORS for canvas loading) ───
app.get('/api/images/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'FonoAudioPro/1.0' },
    });
    if (!resp.ok) return res.status(resp.status).json({ error: `Upstream ${resp.status}` });
    const contentType = resp.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const buffer = Buffer.from(await resp.arrayBuffer());
    res.send(buffer);
  } catch (e) {
    console.error('[Proxy] Failed:', e.message);
    res.status(502).json({ error: 'Failed to proxy image', detail: e.message });
  }
});

app.get('/api/images/search', async (req, res) => {
  const { q, per_page = 20, page = 1 } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query parameter "q"' });
  if (!PEXELS_API_KEY) return res.status(503).json({ error: 'PEXELS_API_KEY not configured', hint: 'Add PEXELS_API_KEY to .env' });

  try {
    const resp = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${per_page}&page=${page}`, {
      headers: { Authorization: PEXELS_API_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: `Pexels API error: ${resp.status}`, detail: text });
    }
    const data = await resp.json();
    const results = (data.photos || []).map(p => ({
      url: p.src.medium,
      thumb: p.src.small,
      alt: p.alt || q,
      photographer: p.photographer,
      photographer_url: p.photographer_url,
      pexels_url: p.url,
    }));
    res.json({ results, total: data.total_results || 0 });
  } catch (e) {
    console.error('[Pexels] Search error:', e.message);
    res.status(500).json({ error: 'Failed to search images', detail: e.message });
  }
});

// ─── Openverse Image Search (free, no API key) ───
app.get('/api/images/openverse', async (req, res) => {
  const { q, per_page = 20, page = 1 } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query parameter "q"' });

  try {
    const resp = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&per_page=${per_page}&page=${page}`, {
      headers: { 'User-Agent': 'FonoAudioPro/1.0 (clinical-app)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: `Openverse API error: ${resp.status}`, detail: text });
    }
    const data = await resp.json();
    const results = (data.results || []).map(p => ({
      url: p.image || p.thumbnail,
      thumb: p.thumbnail || p.image,
      alt: p.title || q,
      creator: p.creator || 'Unknown',
      license: p.license || 'unknown',
      license_version: p.license_version || '',
      source_url: p.foreign_landing_url || p.source || '',
      provider: 'openverse',
    }));
    res.json({ results, total: data.result_count || 0 });
  } catch (e) {
    console.error('[Openverse] Search error:', e.message);
    res.status(500).json({ error: 'Failed to search Openverse', detail: e.message });
  }
});

// ─── unDraw Illustrations (free, MIT license, no API key) ───
app.get('/api/images/undraw', async (req, res) => {
  const { q, per_page = 20 } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query parameter "q"' });

  try {
    const resp = await fetch(`https://raw.githubusercontent.com/ondras/undraw/refs/heads/master/README.md`, {
      signal: AbortSignal.timeout(10000),
    });
    // unDraw doesn't have a search API, so we use their GitHub repo to get SVG URLs
    // Fallback: use their CDN with search-like behavior
    const illustrations = [
      'doctor', 'therapy', 'education', 'children', 'family', 'health', 'communication',
      'learning', 'reading', 'writing', 'art', 'design', 'technology', 'science',
      'nature', 'animal', 'food', 'sport', 'music', 'travel',
    ];
    const matches = illustrations.filter(i => i.toLowerCase().includes(q.toLowerCase()));
    const results = matches.slice(0, parseInt(per_page)).map(term => ({
      url: `https://undraw.co/api/illustrations/${term}`,
      thumb: `https://undraw.co/api/illustrations/${term}`,
      alt: `unDraw: ${term}`,
      creator: 'Katerina Limpitsouni',
      license: 'MIT',
      source_url: `https://undraw.co/illustrations`,
      provider: 'undraw',
    }));
    res.json({ results, total: results.length, note: 'unDraw illustrations - visit undraw.co for full collection' });
  } catch (e) {
    console.error('[unDraw] Search error:', e.message);
    res.status(500).json({ error: 'Failed to search unDraw', detail: e.message });
  }
});

// ─── Pixabay Illustrations (free API, 500 req/hr) ───
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || '';
app.get('/api/images/pixabay', async (req, res) => {
  const { q, per_page = 20, page = 1, category = 'illustration' } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query parameter "q"' });
  if (!PIXABAY_API_KEY) return res.status(503).json({ error: 'PIXABAY_API_KEY not configured', hint: 'Add PIXABAY_API_KEY to .env. Get free key at https://pixabay.com/api/docs/' });

  try {
    const resp = await fetch(`https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(q)}&image_type=illustration&per_page=${per_page}&page=${page}&min_width=100&min_height=100`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: `Pixabay API error: ${resp.status}`, detail: text });
    }
    const data = await resp.json();
    const results = (data.hits || []).map(h => ({
      url: h.webformatURL,
      thumb: h.previewURL,
      alt: h.tags || q,
      creator: h.user || 'Pixabay',
      license: 'Pixabay License',
      source_url: `https://pixabay.com/users/${h.user}-${h.user_id}/`,
      provider: 'pixabay',
    }));
    res.json({ results, total: data.totalHits || 0 });
  } catch (e) {
    console.error('[Pixabay] Search error:', e.message);
    res.status(500).json({ error: 'Failed to search Pixabay', detail: e.message });
  }
});

// ─── IconScout (14M+ icons, illustrations, 3D — free plan 2000 credits/mo) ───
const ICONSCOUT_CLIENT_ID = process.env.ICONSCOUT_CLIENT_ID || '';
const ICONSCOUT_CLIENT_SECRET = process.env.ICONSCOUT_CLIENT_SECRET || '';
app.get('/api/images/iconscout', async (req, res) => {
  const { q, per_page = 20, asset = 'illustration' } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query parameter "q"' });
  if (!ICONSCOUT_CLIENT_ID) return res.status(503).json({ error: 'ICONSCOUT_CLIENT_ID not configured', hint: 'Add ICONSCOUT_CLIENT_ID to .env' });

  try {
    const resp = await fetch(`https://api.iconscout.com/v3/search?query=${encodeURIComponent(q)}&asset=${asset}&page=1&per_page=${per_page}`, {
      headers: { 'Client-ID': ICONSCOUT_CLIENT_ID },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: `IconScout API error: ${resp.status}`, detail: text });
    }
    const data = await resp.json();
    const items = data.response?.items?.data || data.response?.items || data.response || [];
    const total = data.response?.items?.total || data.meta?.total || items.length;
    const results = (Array.isArray(items) ? items : []).map(item => ({
      url: item.urls?.thumb || item.urls?.png || '',
      thumb: item.urls?.thumb || item.urls?.png || '',
      alt: item.name || item.slug || q,
      creator: 'IconScout',
      license: 'IconScout License',
      source_url: `https://iconscout.com/illustrations/${item.slug || item.id}`,
      provider: 'iconscout',
      format: item.asset === 'lottie' ? 'lottie' : 'png',
    }));
    res.json({ results, total });
  } catch (e) {
    console.error('[IconScout] Search error:', e.message);
    res.status(500).json({ error: 'Failed to search IconScout', detail: e.message });
  }
});

// ─── LibreClipart (CC0, free API, no key needed) ───
app.get('/api/images/libreclipart', async (req, res) => {
  const { q, per_page = 20 } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query parameter "q"' });

  try {
    const resp = await fetch(`https://libreclipart.org/api/v1/search?q=${encodeURIComponent(q)}&limit=${per_page}`, {
      headers: { 'User-Agent': 'FonoAudioPro/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      // Fallback: return empty with suggestion
      return res.json({ results: [], total: 0, note: 'LibreClipart API may be unavailable. Try Openverse instead.' });
    }
    const data = await resp.json();
    const results = (data.images || data.results || []).map(img => ({
      url: img.url || img.image_url || '',
      thumb: img.thumbnail_url || img.url || img.image_url || '',
      alt: img.title || img.name || q,
      creator: img.author || 'Unknown',
      license: 'CC0',
      source_url: img.page_url || '',
      provider: 'libreclipart',
    }));
    res.json({ results, total: data.total || results.length });
  } catch (e) {
    console.error('[LibreClipart] Search error:', e.message);
    res.json({ results: [], total: 0, note: 'LibreClipart unavailable: ' + e.message });
  }
});

// ─── Health Check ───
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ───
app.use('/api/tts', ttsRouter);
app.use('/api/ocr', ocrRouter);
app.use('/api/clinical', clinicalRouter);
app.use('/api/communication', communicationRouter);
app.use('/api/work-journal', workJournalRouter);
app.use('/api', apiRouter); // Includes /process, /calendar, /telegram, /obsidian, /gdrive, /notebooklm, /event

// ─── Piper Warmup ───
async function warmupModel() {
  try {
    const p = spawn(PIPER_COMMAND, [
      '-m', VOICE_MODEL_PATH, '-f', 'temp/warmup.wav',
      '--noise-scale', '0.6', '--noise-w-scale', '0.8', '--length-scale', '0.7'
    ]);
    p.stdin.write('Hola');
    p.stdin.end();
    await new Promise((resolve, reject) => {
      p.on('close', resolve);
      p.on('error', reject);
    });
    console.log('[Piper] Modelo pre-cargado');
  } catch (e) {
    console.error('[Piper] Warmup error:', e.message);
  }
}

// Prevent crashes from unhandled promise rejections
process.on('unhandledRejection', (reason) => {
    console.error('[Server] Unhandled rejection (non-fatal):', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
    console.error('[Server] Uncaught exception (non-fatal):', err.message);
});

// ─── 24/7 Background Worker: Check reminders every 15 minutes ───
let isWorkerRunning = false;
function startBackgroundWorker() {
    setInterval(async () => {
        if (isWorkerRunning) return;
        isWorkerRunning = true;
        try {
            const res = await fetch(`http://localhost:${PORT}/api/worker/check-reminders`);
            const data = await res.json();
            if (data.sent > 0) {
                console.log(`[Worker] Sent ${data.sent} appointment reminders`);
            }
        } catch (e) {
            console.error('[Worker] Background worker error:', e.message);
        } finally {
            isWorkerRunning = false;
        }
    }, 900000); // Every 15 minutes

    // Daily summary at 8:00 AM
    setInterval(async () => {
        const now = new Date();
        const hour = parseInt(now.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', hour12: false }));
        const min = parseInt(now.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', minute: '2-digit', hour12: false }));
        if (hour === 8 && min === 0) {
            try {
                await fetch(`http://localhost:${PORT}/api/worker/daily-summary`);
                console.log('[Worker] Daily summary sent');
            } catch (e) { }
        }
    }, 60000);
}

// ─── Start ───
if (fs.existsSync(PIPER_COMMAND) && fs.existsSync(VOICE_MODEL_PATH)) {
  warmupModel();
}

// ─── Background workers: only in development (not Vercel) ───
if (process.env.VERCEL !== '1') {
  startRemindersEngine();
  startBackgroundWorker();
}

app.listen(PORT, () => {
  console.log(`\n🧠 FonoAudio Server running on http://localhost:${PORT}`);
});
