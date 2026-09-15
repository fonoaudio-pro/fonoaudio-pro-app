import express from 'express';
import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import notebooklmService from '../services/notebooklmService.js';

const router = express.Router();

router.get('/auth', async (req, res) => {
    try {
        const result = await notebooklmService.checkAuth();
        res.json(result);
    } catch (e) {
        console.error('[NotebookLM] auth check error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.post('/auth/extract-cookies', async (req, res) => {
    try {
        const result = await notebooklmService.extractChromeCookies();
        res.json(result);
    } catch (e) {
        console.error('[NotebookLM] extract-cookies error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.get('/notebooks', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 0;
        const result = await notebooklmService.listNotebooks(limit);
        res.json(result);
    } catch (e) {
        res.json({ notebooks: [], status: 'error', message: e.message });
    }
});

router.post('/notebooks', async (req, res) => {
    try {
        const { title } = req.body;
        if (!title) return res.status(400).json({ error: 'title required' });
        const result = await notebooklmService.createNotebook(title);
        res.json(result);
    } catch (e) {
        console.error('[NotebookLM] create notebook error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.delete('/notebooks/:id', async (req, res) => {
    try {
        const result = await notebooklmService.deleteNotebook(req.params.id);
        res.json(result);
    } catch (e) {
        console.error('[NotebookLM] delete notebook error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.put('/notebooks/:id', async (req, res) => {
    try {
        const { title } = req.body;
        if (!title) return res.status(400).json({ error: 'title required' });
        const result = await notebooklmService.renameNotebook(req.params.id, title);
        res.json(result);
    } catch (e) {
        console.error('[NotebookLM] rename notebook error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.get('/notebooks/:id/sources', async (req, res) => {
    try {
        const result = await notebooklmService.listSources(req.params.id);
        res.json(result);
    } catch (e) {
        console.error('[NotebookLM] list sources error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.post('/notebooks/:id/sources', async (req, res) => {
    try {
        const { content, type, title } = req.body;
        if (!content) return res.status(400).json({ error: 'content required' });
        const result = await notebooklmService.addSource(req.params.id, content, { type, title });
        res.json(result);
    } catch (e) {
        console.error('[NotebookLM] add source error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.delete('/notebooks/:nbId/sources/:srcId', async (req, res) => {
    try {
        const result = await notebooklmService.deleteSource(req.params.nbId, req.params.srcId);
        res.json(result);
    } catch (e) {
        console.error('[NotebookLM] delete source error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.get('/notebooks/:nbId/sources/:srcId/fulltext', async (req, res) => {
    try {
        const result = await notebooklmService.getSourceFulltext(req.params.nbId, req.params.srcId);
        res.json(result);
    } catch (e) {
        console.error('[NotebookLM] source fulltext error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.get('/notebooks/:nbId/sources/:srcId/guide', async (req, res) => {
    try {
        const result = await notebooklmService.getSourceGuide(req.params.nbId, req.params.srcId);
        res.json(result);
    } catch (e) {
        console.error('[NotebookLM] source guide error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.post('/notebooks/:id/ask', async (req, res) => {
    try {
        const { question, new: fresh, conversationId, sourceIds } = req.body;
        if (!question) return res.status(400).json({ error: 'question required' });
        const result = await notebooklmService.askNotebook(req.params.id, question, {
            new: fresh, conversationId, sourceIds,
        });
        res.json(result);
    } catch (e) {
        console.error('[NotebookLM] ask error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.post('/notebooks/:id/generate/:type', async (req, res) => {
    try {
        const { prompt } = req.body || {};
        const { type } = req.params;
        const genFn = {
            audio: notebooklmService.generateAudio,
            quiz: notebooklmService.generateQuiz,
            flashcards: notebooklmService.generateFlashcards,
            'mind-map': notebooklmService.generateMindMap,
            report: notebooklmService.generateReport,
            'slide-deck': notebooklmService.generateSlideDeck,
        }[type];
        if (!genFn) return res.status(400).json({ error: `Unknown type: ${type}` });
        const result = await genFn(req.params.id, prompt || '');
        res.json(result);
    } catch (e) {
        console.error('[NotebookLM] generate error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.get('/notebooks/:id/artifacts', async (req, res) => {
    try {
        // Try direct Node.js API first
        try {
            const direct = await import('../services/notebooklmDirect.js');
            console.log('[NotebookLM] Direct API: listing artifacts for', req.params.id);
            const artifacts = await direct.listArtifacts(req.params.id);
            console.log('[NotebookLM] Direct API: got', artifacts.length, 'artifacts');
            if (artifacts.length > 0) {
                return res.json({ artifacts });
            }
            console.log('[NotebookLM] Direct API returned 0 artifacts, falling back to CLI');
        } catch (e) {
            console.error('[NotebookLM] Direct API error:', e.message);
        }
        // Fallback to Python CLI
        const result = await notebooklmService.listArtifacts(req.params.id);
        res.json(result);
    } catch (e) {
        console.error('[NotebookLM] list artifacts error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// IMPORTANT: /content must come BEFORE :artId param route
router.get('/notebooks/:nbId/artifacts/:artId/content', async (req, res) => {
    try {
        const result = await notebooklmService.getArtifact(req.params.nbId, req.params.artId);
        console.log('[NotebookLM] artifact content raw:', JSON.stringify(result).substring(0, 3000));
        if (result.error) return res.status(500).json(result);

        const artifact = result.artifact || result;
        const allKeys = Object.keys(artifact).join(', ');
        console.log('[NotebookLM] artifact keys:', allKeys);

        // Try every possible field name for content
        const content = artifact.content || artifact.text || artifact.body || artifact.data
            || artifact.markdown || artifact.html || artifact.output || artifact.result
            || artifact.transcript || artifact.summary || artifact.description
            || artifact.value || artifact.value_string || artifact.string_value
            || result.content || result.text || result.raw || null;

        const downloadUrl = artifact.download_url || artifact.url || artifact.audio_url
            || artifact.pdf_url || artifact.file_url || artifact.downloadUrl
            || result.download_url || result.url || null;

        const slides = artifact.slides || artifact.pages || artifact.cards || artifact.items
            || artifact.slide_deck || artifact.presentation || null;

        const quizData = artifact.questions || artifact.quiz || artifact.quiz_data
            || result.questions || result.quiz || null;

        const flashcardData = artifact.flashcards || artifact.cards || artifact.flashcard_data
            || result.flashcards || result.cards || null;

        const mindMapData = artifact.mind_map || artifact.nodes || artifact.mindmap_data
            || result.mind_map || result.nodes || null;

        console.log('[NotebookLM] extracted:', {
            hasContent: !!content, contentType: typeof content,
            contentLen: content ? String(content).length : 0,
            hasDownloadUrl: !!downloadUrl,
            hasSlides: !!slides,
            keys: allKeys,
        });

        res.json({
            ...artifact,
            content,
            download_url: downloadUrl,
            slides,
            quiz_data: quizData,
            flashcard_data: flashcardData,
            mindmap_data: mindMapData,
        });
    } catch (e) {
        console.error('[NotebookLM] artifact content error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// Debug endpoint: dump full artifact JSON
router.get('/notebooks/:nbId/artifacts/:artId/debug', async (req, res) => {
    try {
        const result = await notebooklmService.getArtifact(req.params.nbId, req.params.artId);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get artifact content by asking the notebook about it
router.post('/notebooks/:nbId/artifacts/:artId/ask-content', async (req, res) => {
    try {
        const { nbId, artId } = req.params;
        // First get artifact metadata
        const artResult = await notebooklmService.getArtifact(nbId, artId);
        const artifact = artResult.artifact || artResult;
        const title = artifact.title || 'this content';
        const type = artifact.type || artifact.type_id || 'content';

        // Ask the notebook to describe/export the content
        const question = `Please provide the complete content of "${title}" (${type}). Give me ALL the text, slides, questions, or any content from this artifact. Do not summarize - give me everything.`;
        const askResult = await notebooklmService.askNotebook(nbId, question);

        if (askResult.error) {
            return res.json({ ...artifact, content: null, error: askResult.message });
        }

        const content = askResult.answer || askResult.raw || askResult.text || null;
        console.log('[NotebookLM] ask-content result:', content ? content.substring(0, 500) : 'null');

        res.json({
            ...artifact,
            content,
            source: 'ask',
        });
    } catch (e) {
        console.error('[NotebookLM] ask-content error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.get('/notebooks/:nbId/artifacts/:artId', async (req, res) => {
    try {
        const { nbId, artId } = req.params;

        // Try direct API first
        try {
            const direct = await import('../services/notebooklmDirect.js');
            const directArtifacts = await direct.listArtifacts(nbId);
            if (Array.isArray(directArtifacts) && directArtifacts.length > 0) {
                const match = directArtifacts.find(a => a.id === artId || (a.id && a.id.startsWith(artId)));
                if (match) {
                    const rawUrl = match.url || match.download_url || null;
                    console.log('[NotebookLM] Direct API matched artifact:', match.id, 'url:', rawUrl ? rawUrl.substring(0, 100) : 'none');
                    // If URL exists, the artifact is usable regardless of internal status
                    const effectiveStatus = rawUrl ? 'completed' : (match.status || 'completed');
                    return res.json({ ...match, status: effectiveStatus, artifactUrl: rawUrl, url: rawUrl });
                }
            }
        } catch (directErr) {
            console.warn('[NotebookLM] Direct API artifact lookup failed:', directErr.message);
        }

        // Fallback: Get artifact list from CLI service to find the download URL
        let artifacts = [];
        try {
            const listResult = await notebooklmService.listArtifacts(nbId);
            artifacts = Array.isArray(listResult) ? listResult : listResult?.artifacts || [];
        } catch (cliErr) {
            console.warn('[NotebookLM] CLI listArtifacts failed:', cliErr.message);
        }

        // Find the matching artifact
        const match = artifacts.find(a => a.id === artId || (a.id && a.id.startsWith(artId)));
        if (match) {
            const rawUrl = match.url || match.download_url || null;
            const effectiveStatus = rawUrl ? 'completed' : (match.status || 'completed');
            return res.json({ ...match, status: effectiveStatus, artifactUrl: rawUrl, url: rawUrl });
        }

        // Fallback single artifact fetch
        try {
            const fallback = await notebooklmService.getArtifact(nbId, artId);
            if (fallback && !fallback.error) {
                return res.json({ ...fallback, url: fallback.url || null });
            }
        } catch (fErr) {
            console.warn('[NotebookLM] CLI getArtifact failed:', fErr.message);
        }

        // Return a clean base metadata object instead of 500 error
        res.json({ id: artId, status: 'completed', content: null, url: null });
    } catch (e) {
        console.error('[NotebookLM] get artifact error:', e);
        res.json({ id: req.params.artId, status: 'completed', content: null, url: null });
    }
});

// Serve a downloaded artifact file from disk
router.get('/serve-artifact', (req, res) => {
    try {
        const { path: filePath, filename } = req.query;
        if (!filePath) return res.status(400).json({ error: 'path required' });

        // Security: only allow serving from temp dir
        const normalizedPath = filePath.replace(/\\/g, '/');
        if (!normalizedPath.includes('notebooklm_artifacts') && !normalizedPath.includes('temp')) {
            return res.status(403).json({ error: 'Path not allowed' });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found', path: filePath });
        }

        const ext = (filename || filePath).split('.').pop()?.toLowerCase() || 'bin';
        const mimeMap = { pdf: 'application/pdf', mp4: 'video/mp4', mp3: 'audio/mpeg', webm: 'video/webm', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', md: 'text/markdown', txt: 'text/plain' };
        const mime = mimeMap[ext] || 'application/octet-stream';

        res.setHeader('Content-Type', mime);
        if (filename) res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Cache-Control', 'public, max-age=3600');

        fs.createReadStream(filePath).pipe(res);
    } catch (e) {
        console.error('[NotebookLM] serve-artifact error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

router.post('/notebooks/:nbId/artifacts/:artId/wait', async (req, res) => {
    try {
        const timeout = req.body.timeout || 300;
        const result = await notebooklmService.waitArtifact(req.params.nbId, req.params.artId, timeout);
        res.json(result);
    } catch (e) {
        console.error('[NotebookLM] wait artifact error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.post('/notebooks/:nbId/artifacts/:artId/export', async (req, res) => {
    try {
        const { title, type } = req.body;
        if (!title) return res.status(400).json({ error: 'title required' });
        const result = await notebooklmService.exportArtifact(req.params.nbId, req.params.artId, title, type || 'docs');
        res.json(result);
    } catch (e) {
        console.error('[NotebookLM] export artifact error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.get('/notebooks/:id/summary', async (req, res) => {
    try {
        const result = await notebooklmService.getNotebookSummary(req.params.id);
        res.json(result);
    } catch (e) {
        console.error('[NotebookLM] summary error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.get('/notebooks/:id/history', async (req, res) => {
    try {
        const result = await notebooklmService.getHistory(req.params.id);
        res.json(result);
    } catch (e) {
        console.error('[NotebookLM] history error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.post('/notebooks/:id/generate-and-wait/:type', async (req, res) => {
    try {
        const { prompt, timeout } = req.body || {};
        const { type } = req.params;
        const result = await notebooklmService.generateWithWait(req.params.id, type, prompt || '', timeout || 300);
        res.json(result);
    } catch (e) {
        console.error('[NotebookLM] generate-and-wait error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// Proxy artifact file download — streams the file from Google's signed URL with auth cookies
router.get('/proxy-artifact', async (req, res) => {
    try {
        const { url, filename } = req.query;
        if (!url) return res.status(400).json({ error: 'url required' });

        console.log('[NotebookLM] proxy-artifact:', url.substring(0, 120));

        let cookieHeader = '';
        try {
            const storagePath = path.join(process.env.USERPROFILE || process.env.HOME || '', '.notebooklm', 'profiles', 'default', 'storage_state.json');
            const storage = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
            cookieHeader = (storage.cookies || [])
                .filter(c => {
                    const domain = c.domain || '';
                    return domain.includes('google.com') || domain.includes('googleusercontent.com');
                })
                .map(c => `${c.name}=${c.value}`)
                .join('; ');
        } catch (e) {
            console.log('[NotebookLM] Could not load cookies:', e.message);
        }

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Referer': 'https://notebooklm.google.com/',
            'X-Goog-AuthUser': '0',
            'Origin': 'https://notebooklm.google.com',
            'Accept': '*/*',
        };
        if (cookieHeader) headers['Cookie'] = cookieHeader;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const proxyRes = await fetch(url, {
            method: 'GET',
            headers,
            redirect: 'follow',
            signal: controller.signal,
        });
        clearTimeout(timeout);

        console.log('[NotebookLM] proxy response status:', proxyRes.status, 'content-type:', proxyRes.headers.get('content-type'));

        if (!proxyRes.ok) {
            return res.status(502).json({ error: `Google CDN returned ${proxyRes.status}`, hint: 'Try downloading directly from NotebookLM' });
        }

        const contentType = proxyRes.headers.get('content-type') || 'application/octet-stream';
        const contentLength = proxyRes.headers.get('content-length');

        // Check if we got HTML instead of the actual artifact (Google CDN login page)
        const reader = proxyRes.body.getReader();
        const firstChunk = await reader.read();
        const firstBytes = new TextDecoder('utf-8', { fatal: false }).decode(firstChunk.value).substring(0, 200).trim().toLowerCase();

        if (contentType.includes('text/html') || firstBytes.startsWith('<!doctype') || firstBytes.startsWith('<html')) {
            console.error('[NotebookLM] proxy got HTML login page — Google CDN rejected cookies');
            if (!res.headersSent) return res.status(502).json({
                error: 'Google CDN requires browser authentication',
                hint: 'Open artifact directly in NotebookLM',
            });
            return;
        }

        const ext = (filename || url.split('?')[0]).split('.').pop()?.toLowerCase() || 'bin';
        const mimeMap = { pdf: 'application/pdf', mp4: 'video/mp4', mp3: 'audio/mpeg', webm: 'video/webm', ogg: 'audio/ogg', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml' };
        const mime = mimeMap[ext] || contentType;

        res.setHeader('Content-Type', mime);
        if (contentLength) res.setHeader('Content-Length', contentLength);
        if (filename) res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Cache-Control', 'public, max-age=3600');

        res.write(firstChunk.value);
        while (true) {
            const { done, value } = await reader.read();
            if (done) { res.end(); return; }
            res.write(value);
        }
    } catch (fetchErr) {
        clearTimeout(timeout);
        if (!res.headersSent) {
            res.status(502).json({ error: fetchErr.message, hint: 'Try downloading directly from NotebookLM' });
        }
    }
});

function handleProxyResponse(proxyRes, res, filename, originalUrl) {
    if (proxyRes.statusCode >= 400) {
        console.error('[NotebookLM] proxy upstream error:', proxyRes.statusCode);
        if (!res.headersSent) res.status(proxyRes.statusCode).json({ error: `Upstream ${proxyRes.statusCode}` });
        return;
    }

    const contentType = proxyRes.headers['content-type'] || 'application/octet-stream';
    const contentLength = proxyRes.headers['content-length'];
    const ext = (filename || originalUrl.split('?')[0]).split('.').pop()?.toLowerCase() || 'bin';

    const mimeMap = { pdf: 'application/pdf', mp4: 'video/mp4', mp3: 'audio/mpeg', webm: 'video/webm', ogg: 'audio/ogg', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', html: 'text/html', json: 'application/json' };
    const mime = mimeMap[ext] || contentType;

    res.setHeader('Content-Type', mime);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (filename) res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    proxyRes.pipe(res);
}

// Get artifact metadata including download URL
router.get('/notebooks/:nbId/artifacts/:artId/url', async (req, res) => {
    try {
        const { nbId, artId } = req.params;
        const result = await notebooklmService.getArtifact(nbId, artId);
        console.log('[NotebookLM] artifact URL check:', JSON.stringify(result).substring(0, 1500));

        const artifact = result.artifact || result;
        // The CLI now includes url field
        const url = artifact.url || artifact.download_url || null;

        if (url) {
            res.json({ url, type: artifact.type_id || artifact.type, title: artifact.title });
        } else {
            // Fallback: try to infer from type
            res.json({ url: null, type: artifact.type_id || artifact.type, title: artifact.title, hint: 'No download URL available' });
        }
    } catch (e) {
        console.error('[NotebookLM] artifact url error:', e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
