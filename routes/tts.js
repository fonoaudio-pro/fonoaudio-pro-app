import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { TEMP_DIR } from '../config/serverConfig.js';

const router = express.Router();

const PIPER_COMMAND = process.env.PIPER_COMMAND || 'piper';
const VOICE_MODEL_PATH = process.env.VOICE_MODEL_PATH;
let piperAvailable = null;

async function checkPiperAvailable() {
    if (process.env.VERCEL === '1') return false;
    if (piperAvailable !== null) return piperAvailable;
    try {
        const testPath = VOICE_MODEL_PATH || path.join(process.cwd(), 'es_AR-daniela-high.onnx');
        piperAvailable = fs.existsSync(testPath) && fs.existsSync(PIPER_COMMAND);
    } catch { piperAvailable = false; }
    return piperAvailable;
}

// ══════════════════════════════════════════════════════════════════
// BACKEND 1: Google Cloud TTS via OAuth2 (requires Calendar OAuth)
// ══════════════════════════════════════════════════════════════════
async function synthesizeGoogleOAuth(text, voiceName, ssmlGender) {
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
        throw new Error('Google OAuth2 credentials not configured');
    }
    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
    const ttsClient = google.texttospeech({ version: 'v1', auth: oauth2Client });
    const response = await ttsClient.text().synthesize({
        input: { text: text.trim() },
        voice: { languageCode: 'es-AR', name: voiceName, ssmlGender },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0 },
    });
    if (!response.data?.audioContent) throw new Error('No audioContent in OAuth response');
    console.log('[TTS] Google OAuth2 TTS succeeded');
    return Buffer.from(response.data.audioContent, 'base64');
}

// ══════════════════════════════════════════════════════════════════
// BACKEND 2: Google Cloud TTS via dedicated TTS API key
// ══════════════════════════════════════════════════════════════════
async function synthesizeGoogleApiKey(text, voiceName, ssmlGender) {
    const TTS_API_KEY = process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_CLOUD_TTS_KEY;
    if (!TTS_API_KEY) throw new Error('GOOGLE_TTS_API_KEY not configured');
    const resp = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${TTS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            input: { text: text.trim() },
            voice: { languageCode: 'es-AR', name: voiceName, ssmlGender },
            audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0 },
        }),
        signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) throw new Error(`Google TTS API key error: ${resp.status}`);
    const data = await resp.json();
    if (!data.audioContent) throw new Error('No audioContent in API key response');
    console.log('[TTS] Google API key TTS succeeded');
    return Buffer.from(data.audioContent, 'base64');
}

// ══════════════════════════════════════════════════════════════════
// BACKEND 3: OpenAI TTS (if OPENAI_API_KEY is available)
// ══════════════════════════════════════════════════════════════════
async function synthesizeOpenAI(text) {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
    const resp = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'tts-1',
            input: text.substring(0, 4000),
            voice: 'onyx',
            response_format: 'mp3',
        }),
        signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) throw new Error(`OpenAI TTS error: ${resp.status}`);
    const buffer = Buffer.from(await resp.arrayBuffer());
    console.log('[TTS] OpenAI TTS succeeded');
    return buffer;
}

// ══════════════════════════════════════════════════════════════════
// BACKEND 4: Google Translate TTS (free, no credentials needed)
// ══════════════════════════════════════════════════════════════════
async function synthesizeGoogleTranslate(text) {
    const cleanText = text.replace(/[^\w\s.,;:!?¡¿áéíóúñüÁÉÍÓÚÑÜ-]/g, '').substring(0, 200);
    if (!cleanText.trim()) throw new Error('Empty text after cleaning');
    const encoded = encodeURIComponent(cleanText);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=es-AR&client=tw-ob`;
    const resp = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`Google Translate TTS error: ${resp.status}`);
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 100) throw new Error('Audio buffer too small, likely an error');
    console.log('[TTS] Google Translate TTS succeeded');
    return buffer;
}

// ══════════════════════════════════════════════════════════════════
// BACKEND 5: Piper local (dev only, never on Vercel)
// ══════════════════════════════════════════════════════════════════
async function synthesizePiper(text) {
    const { spawn } = await import('child_process');
    const filename = `${uuidv4()}.wav`;
    const outputPath = path.join(TEMP_DIR, filename);
    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
    return new Promise((resolve, reject) => {
        const piper = spawn(PIPER_COMMAND, [
            '-m', VOICE_MODEL_PATH || path.join(process.cwd(), 'es_AR-daniela-high.onnx'),
            '-f', outputPath, '--noise-scale', '0.6', '--noise-w-scale', '0.8', '--length-scale', '0.7'
        ]);
        let stderr = '';
        piper.stderr.on('data', d => stderr += d.toString());
        piper.stdin.write(text);
        piper.stdin.end();
        const timeout = setTimeout(() => { piper.kill(); reject(new Error('Piper timeout')); }, 30000);
        piper.on('close', code => {
            clearTimeout(timeout);
            if (code !== 0 || !fs.existsSync(outputPath)) { reject(new Error(`Piper error (${code})`)); return; }
            const buffer = fs.readFileSync(outputPath);
            try { fs.unlinkSync(outputPath); } catch {}
            console.log('[TTS] Piper local TTS succeeded');
            resolve(buffer);
        });
        piper.on('error', err => { clearTimeout(timeout); reject(err); });
    });
}

// ══════════════════════════════════════════════════════════════════
// ROBUST SYNTHESIS: tries all backends in order
// ══════════════════════════════════════════════════════════════════
const VOICE_MAP = {
    'es_AR-masculino': { voiceName: 'es-AR-Wavenet-B', ssmlGender: 'MALE' },
    'es_AR-daniela': { voiceName: 'es-AR-Wavenet-A', ssmlGender: 'FEMALE' },
    'default': { voiceName: 'es-AR-Wavenet-B', ssmlGender: 'MALE' },
};

async function synthesizeText(text, voice = 'es_AR-masculino') {
    if (!text || !text.trim()) return null;
    const cfg = VOICE_MAP[voice] || VOICE_MAP.default;

    // Backend 1: Google OAuth2 (most reliable if configured)
    try { return await synthesizeGoogleOAuth(text, cfg.voiceName, cfg.ssmlGender); } catch (e) { console.warn('[TTS] OAuth2 failed:', e.message); }

    // Backend 2: Google Cloud TTS API key
    try { return await synthesizeGoogleApiKey(text, cfg.voiceName, cfg.ssmlGender); } catch (e) { console.warn('[TTS] API key failed:', e.message); }

    // Backend 3: OpenAI TTS
    try { return await synthesizeOpenAI(text); } catch (e) { console.warn('[TTS] OpenAI failed:', e.message); }

    // Backend 4: Google Translate TTS (free fallback)
    try { return await synthesizeGoogleTranslate(text); } catch (e) { console.warn('[TTS] Translate fallback failed:', e.message); }

    // Backend 5: Piper local
    if (await checkPiperAvailable()) {
        try { return await synthesizePiper(text); } catch (e) { console.warn('[TTS] Piper failed:', e.message); }
    }

    console.error('[TTS] ALL backends failed. No audio generated.');
    return null;
}

router.get('/voices', (req, res) => {
    res.json({
        voices: [
            { id: 'es_AR-masculino', name: 'Masculino (Espanol Argentina Rioplatense)', language: 'es-AR', gender: 'male' },
            { id: 'es_AR-daniela', name: 'Daniela (Espanol Argentina)', language: 'es-AR', gender: 'female' },
        ]
    });
});

router.post('/', async (req, res) => {
    const { text, voice = 'es_AR-masculino' } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Falta el texto' });
    try {
        const audioBuffer = await synthesizeText(text, voice);
        if (!audioBuffer) return res.status(503).json({ error: 'TTS no disponible - todos los backends fallaron' });
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', audioBuffer.length);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(audioBuffer);
    } catch (err) {
        res.status(500).json({ error: 'Error de TTS', detail: err.message });
    }
});

export { synthesizeText };
export default router;
