import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { TEMP_DIR } from '../config/serverConfig.js';

const router = express.Router();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY;
const PIPER_COMMAND = process.env.PIPER_COMMAND || 'piper';
const VOICE_MODEL_PATH = process.env.VOICE_MODEL_PATH;
let piperAvailable = null;

// Check if Piper is available (local development only — never on Vercel)
async function checkPiperAvailable() {
    if (process.env.VERCEL === '1') return false;
    if (piperAvailable !== null) return piperAvailable;
    try {
        const testPath = VOICE_MODEL_PATH || path.join(process.cwd(), 'es_AR-daniela-high.onnx');
        piperAvailable = fs.existsSync(testPath) && fs.existsSync(PIPER_COMMAND);
    } catch {
        piperAvailable = false;
    }
    return piperAvailable;
}

// ─── Cloud TTS via Google Cloud Text-to-Speech ───
// Uses OAuth2 credentials (GOOGLE_CLIENT_ID + GOOGLE_REFRESH_TOKEN)
// Falls back to API key if OAuth2 is not configured
async function synthesizeWithGoogleCloud(text, voiceConfig) {
    const { google } = await import('googleapis');

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

    if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN) {
        const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
        oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
        const ttsClient = google.texttospeech({ version: 'v1', auth: oauth2Client });

        const response = await ttsClient.text().synthesize({
            input: { text: text.trim() },
            voice: voiceConfig,
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: 1.0,
                pitch: 0,
                volumeGainDb: 0,
            },
        });

        if (!response.data || !response.data.audioContent) {
            throw new Error('No audioContent in response');
        }
        return Buffer.from(response.data.audioContent, 'base64');
    }

    // Fallback: use API key with REST API
    if (GOOGLE_API_KEY) {
        const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_API_KEY}`;
        const response = await fetch(ttsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: { text: text.trim() },
                voice: voiceConfig,
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: 1.0,
                    pitch: 0,
                    volumeGainDb: 0,
                },
            }),
            signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            throw new Error(`Google Cloud TTS error: ${response.status} ${errBody.substring(0, 200)}`);
        }

        const data = await response.json();
        if (!data.audioContent) {
            throw new Error('No audioContent in response');
        }
        return Buffer.from(data.audioContent, 'base64');
    }

    throw new Error('No Google Cloud TTS credentials available');
}

// ─── Local TTS via Piper ───
async function synthesizeWithPiper(text) {
    const { spawn } = await import('child_process');
    const { PIPER_COMMAND, VOICE_MODEL_PATH, TEMP_DIR } = await import('../config/serverConfig.js');

    const filename = `${uuidv4()}.wav`;
    const outputPath = path.join(TEMP_DIR, filename);
    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

    return new Promise((resolve, reject) => {
        const piper = spawn(PIPER_COMMAND, [
            '-m', VOICE_MODEL_PATH, '-f', outputPath,
            '--noise-scale', '0.6', '--noise-w-scale', '0.8', '--length-scale', '0.7'
        ]);

        let stderr = '';
        piper.stderr.on('data', d => stderr += d.toString());
        piper.stdin.write(text);
        piper.stdin.end();

        const timeout = setTimeout(() => {
            piper.kill();
            reject(new Error('Piper timeout'));
        }, 30000);

        piper.on('close', code => {
            clearTimeout(timeout);
            if (code !== 0 || !fs.existsSync(outputPath)) {
                reject(new Error(`Piper error (${code}): ${stderr.slice(-200)}`));
                return;
            }
            const buffer = fs.readFileSync(outputPath);
            try { fs.unlinkSync(outputPath); } catch {}
            resolve(buffer);
        });

        piper.on('error', err => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

// Voice mapping: map Piper voice names to Google Cloud TTS voices
const VOICE_MAP = {
    'es_AR-daniela': { languageCode: 'es-AR', name: 'es-AR-Wavenet-A', ssmlGender: 'FEMALE' },
    'default': { languageCode: 'es-AR', name: 'es-AR-Wavenet-A', ssmlGender: 'FEMALE' },
};

router.post('/', async (req, res) => {
    const { text, voice = 'es_AR-daniela' } = req.body;
    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Falta el texto' });
    }

    const voiceConfig = VOICE_MAP[voice] || VOICE_MAP.default;

    try {
        // Try cloud TTS first (works on Vercel)
        try {
            const audioBuffer = await synthesizeWithGoogleCloud(text, voiceConfig);
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Content-Length', audioBuffer.length);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.setHeader('X-TTS-Source', 'google-cloud');
            return res.send(audioBuffer);
        } catch (cloudErr) {
            console.warn('[TTS] Google Cloud TTS failed, trying Piper:', cloudErr.message);

            // Fallback to Piper (local only)
            const available = await checkPiperAvailable();
            if (!available) {
                console.error('[TTS] No TTS available (cloud and Piper both failed)');
                return res.status(503).json({
                    error: 'TTS no disponible. Configura Google Cloud TTS o Piper local.',
                    detail: cloudErr.message,
                });
            }

            const audioBuffer = await synthesizeWithPiper(text);
            res.setHeader('Content-Type', 'audio/wav');
            res.setHeader('Content-Length', audioBuffer.length);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.setHeader('X-TTS-Source', 'piper-local');
            return res.send(audioBuffer);
        }
    } catch (err) {
        console.error('[TTS] Error:', err.message);
        if (err.code === 'ABORT_ERR' || err.name === 'AbortError') {
            return res.status(504).json({ error: 'Timeout' });
        }
        res.status(500).json({ error: 'Error interno de TTS', detail: err.message });
    }
});

export default router;
