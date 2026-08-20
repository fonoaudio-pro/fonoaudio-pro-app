import express from 'express';
import { MsEdgeTTS } from '@travisvn/edge-tts';

const router = express.Router();

// ══════════════════════════════════════════════════════════════════
// VOICE MAP: Free Argentine Spanish Edge TTS voices
// ══════════════════════════════════════════════════════════════════
const VOICE_MAP = {
    'es_AR-masculino': { voice: 'es-AR-TomasNeural', label: 'Masculino' },
    'es_AR-daniela': { voice: 'es-AR-ElenaNeural', label: 'Femenino' },
    'default': { voice: 'es-AR-TomasNeural', label: 'Masculino' },
};

// ══════════════════════════════════════════════════════════════════
// BACKEND 1: Edge TTS (Microsoft) — FREE, no API key needed
// ══════════════════════════════════════════════════════════════════
async function synthesizeEdgeTTS(text, voiceName) {
    if (!text || !text.trim()) throw new Error('Empty text');
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voiceName, MsEdgeTTS.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const readable = tts.toStream(text.trim());
    const chunks = [];
    for await (const chunk of readable) {
        if (chunk instanceof Buffer) {
            chunks.push(chunk);
        } else if (typeof chunk === 'string') {
            chunks.push(Buffer.from(chunk, 'utf-8'));
        }
    }
    const buffer = Buffer.concat(chunks);
    if (buffer.length < 100) throw new Error('Edge TTS returned empty audio');
    console.log('[TTS] Edge TTS succeeded, voice:', voiceName, 'size:', buffer.length);
    return buffer;
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
