import express from 'express';
import crypto from 'crypto';

const router = express.Router();

const VOICE_MAP = {
    'es_AR-masculino': { voice: 'es-AR-TomasNeural', label: 'Masculino' },
    'es_AR-daniela': { voice: 'es-AR-ElenaNeural', label: 'Femenino' },
    'default': { voice: 'es-AR-TomasNeural', label: 'Masculino' },
};

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const EDGE_WSS = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;

function escapeXml(t) {
    return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

async function synthesizeEdgeTTS(text, voiceName) {
    if (!text?.trim()) throw new Error('Empty text');

    const connectionId = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
    const requestId = crypto.randomUUID();
    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='es-AR'><voice name='${voiceName}'>${escapeXml(text.trim())}</voice></speak>`;

    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`${EDGE_WSS}&ConnectionId=${connectionId}`);
        const chunks = [];
        let done = false;

        const timer = setTimeout(() => {
            if (!done) { done = true; ws.close(); reject(new Error('Edge TTS timeout (30s)')); }
        }, 30000);

        ws.addEventListener('open', () => {
            ws.send(`Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-96kbitrate-mono-mp3"}}}}`);
            ws.send(`X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toISOString()}\r\nPath:ssml\r\n\r\n${ssml}`);
        });

        ws.addEventListener('message', (event) => {
            const data = event.data;
            if (data instanceof Blob) {
                data.arrayBuffer().then(buf => {
                    const b = Buffer.from(buf);
                    const marker = Buffer.from('Path:audio\r\n\r\n');
                    const idx = b.indexOf(marker);
                    if (idx !== -1) {
                        chunks.push(b.slice(idx + marker.length));
                    } else if (b.length > 0) {
                        chunks.push(b);
                    }
                });
            } else if (typeof data === 'string' && data.includes('Path:audio')) {
                // text frame with audio marker — skip
            }
        });

        ws.addEventListener('close', () => {
            clearTimeout(timer);
            if (done) return;
            done = true;
            if (chunks.length > 0) {
                const buf = Buffer.concat(chunks);
                if (buf.length < 100) { reject(new Error('Audio too small')); return; }
                console.log('[TTS] Edge TTS OK, voice:', voiceName, 'bytes:', buf.length);
                resolve(buf);
            } else {
                reject(new Error('Edge TTS: no audio data'));
            }
        });

        ws.addEventListener('error', (e) => {
            clearTimeout(timer);
            if (!done) { done = true; reject(new Error(`Edge TTS WS error: ${e.message || e.type}`)); }
        });
    });
}

async function synthesizeGoogleTranslate(text) {
    const clean = text.replace(/[^\w\s.,;:!?¡¿áéíóúñüÁÉÍÓÚÑÜ-]/g, '').substring(0, 200);
    if (!clean.trim()) throw new Error('Empty text');
    const resp = await fetch(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(clean)}&tl=es-AR&client=tw-ob`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`Google Translate error: ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length < 100) throw new Error('Audio too small');
    console.log('[TTS] Google Translate fallback OK');
    return buf;
}

async function synthesizeText(text, voice = 'es_AR-masculino') {
    if (!text?.trim()) return null;
    const cfg = VOICE_MAP[voice] || VOICE_MAP.default;

    try { return await synthesizeEdgeTTS(text, cfg.voice); }
    catch (e) { console.warn('[TTS] Edge TTS failed:', e.message); }

    try { return await synthesizeGoogleTranslate(text); }
    catch (e) { console.warn('[TTS] Translate fallback failed:', e.message); }

    console.error('[TTS] ALL backends failed');
    return null;
}

router.get('/voices', (_req, res) => {
    res.json({ voices: [
        { id: 'es_AR-masculino', name: 'Masculino (Tomas - es-AR)', language: 'es-AR', gender: 'male', engine: 'edge-tts' },
        { id: 'es_AR-daniela', name: 'Daniela (Elena - es-AR)', language: 'es-AR', gender: 'female', engine: 'edge-tts' },
    ]});
});

router.post('/', async (req, res) => {
    const { text, voice = 'es_AR-masculino' } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ error: 'Falta el texto' });
    try {
        const audio = await synthesizeText(text, voice);
        if (!audio) return res.status(503).json({ error: 'TTS no disponible' });
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', audio.length);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(audio);
    } catch (err) {
        res.status(500).json({ error: 'Error TTS', detail: err.message });
    }
});

export { synthesizeText };
export default router;
