import express from 'express';
import crypto from 'crypto';
import pkg from 'ws';
const { WebSocket } = pkg;

const router = express.Router();

// ══════════════════════════════════════════════════════════════════
// VOICE MAP: Free Argentine Spanish Edge TTS voices
// ══════════════════════════════════════════════════════════════════
const VOICE_MAP = {
    'es_AR-masculino': { voice: 'es-AR-TomasNeural', label: 'Masculino' },
    'es_AR-daniela': { voice: 'es-AR-ElenaNeural', label: 'Femenino' },
    'default': { voice: 'es-AR-TomasNeural', label: 'Masculino' },
};

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const EDGE_WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;

function generateSecMs() {
    const ttl = 864000000; // 10 days
    const now = Date.now();
    const expires = now + ttl;
    return `1${expires}d`;
}

function generateRequestId() {
    return crypto.randomUUID();
}

function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function buildSSML(text, voice) {
    return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='es-AR'>
<voice name='${voice}'>
${escapeXml(text)}
</voice>
</speak>`;
}

// ══════════════════════════════════════════════════════════════════
// BACKEND 1: Edge TTS via WebSocket — FREE, no API key needed
// ══════════════════════════════════════════════════════════════════
async function synthesizeEdgeTTS(text, voiceName) {
    if (!text || !text.trim()) throw new Error('Empty text');

    return new Promise((resolve, reject) => {
        const requestId = generateRequestId();
        const connectionId = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
        const secMs = generateSecMs();

        const url = `${EDGE_WSS_URL}&ConnectionId=${connectionId}`;
        const ws = new WebSocket(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
                'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
                'Sec-WebSocket-Protocol': 'synapse-crossorigin',
            },
        });

        const audioChunks = [];
        let resolved = false;

        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                ws.close();
                reject(new Error('Edge TTS timeout'));
            }
        }, 30000);

        ws.on('open', () => {
            // Send config
            const configMsg = `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-96kbitrate-mono-mp3"}}}}`;
            ws.send(configMsg);

            // Send SSML
            const ssml = buildSSML(text, voiceName);
            const msgId = generateRequestId();
            const speechMsg = `X-RequestId:${msgId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toISOString()}\r\nPath:ssml\r\n\r\n${ssml}`;
            ws.send(speechMsg);
        });

        ws.on('message', (data, isBinary) => {
            if (isBinary) {
                // Binary audio data — extract MP3 bytes after the header
                const buf = Buffer.from(data);
                // Edge TTS sends: header + audio bytes. Header ends with "Path:audio\r\n\r\n"
                const headerEnd = buf.indexOf(Buffer.from('Path:audio\r\n\r\n'));
                if (headerEnd !== -1) {
                    const audioStart = headerEnd + 'Path:audio\r\n\r\n'.length;
                    if (audioStart < buf.length) {
                        audioChunks.push(buf.slice(audioStart));
                    }
                } else {
                    // Sometimes audio arrives without header marker
                    audioChunks.push(buf);
                }
            }
        });

        ws.on('close', () => {
            clearTimeout(timeout);
            if (!resolved) {
                resolved = true;
                if (audioChunks.length > 0) {
                    const buffer = Buffer.concat(audioChunks);
                    if (buffer.length < 100) {
                        reject(new Error('Edge TTS returned empty audio'));
                    } else {
                        console.log('[TTS] Edge TTS succeeded, voice:', voiceName, 'size:', buffer.length);
                        resolve(buffer);
                    }
                } else {
                    reject(new Error('Edge TTS: no audio received'));
                }
            }
        });

        ws.on('error', (err) => {
            clearTimeout(timeout);
            if (!resolved) {
                resolved = true;
                reject(new Error(`Edge TTS WebSocket error: ${err.message}`));
            }
        });
    });
}

// ══════════════════════════════════════════════════════════════════
// BACKEND 2: Google Translate TTS (free fallback, no voice selection)
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
    if (buffer.length < 100) throw new Error('Audio buffer too small');
    console.log('[TTS] Google Translate TTS succeeded (no voice selection)');
    return buffer;
}

// ══════════════════════════════════════════════════════════════════
// ROBUST SYNTHESIS: Edge TTS → Google Translate (emergency fallback)
// ══════════════════════════════════════════════════════════════════
async function synthesizeText(text, voice = 'es_AR-masculino') {
    if (!text || !text.trim()) return null;
    const cfg = VOICE_MAP[voice] || VOICE_MAP.default;

    // Backend 1: Edge TTS (Microsoft) — FREE, high quality, Argentine voices
    try {
        const buf = await synthesizeEdgeTTS(text, cfg.voice);
        return buf;
    } catch (e) {
        console.warn('[TTS] Edge TTS failed:', e.message);
    }

    // Backend 2: Google Translate TTS (emergency fallback, no voice selection)
    try {
        const buf = await synthesizeGoogleTranslate(text);
        return buf;
    } catch (e) {
        console.warn('[TTS] Google Translate fallback failed:', e.message);
    }

    console.error('[TTS] ALL backends failed. No audio generated.');
    return null;
}

// ══════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════
router.get('/voices', (req, res) => {
    res.json({
        voices: [
            { id: 'es_AR-masculino', name: 'Masculino (Tomas - es-AR)', language: 'es-AR', gender: 'male', engine: 'edge-tts' },
            { id: 'es_AR-daniela', name: 'Daniela (Elena - es-AR)', language: 'es-AR', gender: 'female', engine: 'edge-tts' },
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
