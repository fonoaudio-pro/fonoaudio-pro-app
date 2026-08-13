/**
 * NotebookLM Service — Vercel-compatible (no Python CLI, no child_process)
 * All operations use the direct Node.js API (notebooklmDirect.js)
 * which uses the batchexecute protocol with stored browser cookies.
 */
import * as direct from './notebooklmDirect.js';

/**
 * Extract Chrome cookies for NotebookLM authentication.
 * This is a local-only operation (requires Playwright/Chrome).
 * In Vercel, this will return an error since there's no local browser.
 */
export async function extractChromeCookies() {
    if (process.env.VERCEL === '1') {
        return { success: false, message: 'Cookie extraction not available in Vercel. Run locally: python -m notebooklm login' };
    }
    try {
        const { execFile } = await import('node:child_process');
        const { promisify } = await import('node:util');
        const path = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const execFileAsync = promisify(execFile);
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const scriptPath = path.join(__dirname, '..', 'scripts', 'notebooklm_login.py');
        const { stdout, stderr } = await execFileAsync('python', [scriptPath], {
            timeout: 360000,
            maxBuffer: 5 * 1024 * 1024,
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        });
        const out = stdout.trim();
        if (out.startsWith("OK:")) {
            return { success: true, message: out };
        }
        return { success: false, message: stderr?.trim() || out };
    } catch (e) {
        return { success: false, message: e.stderr || e.message || String(e) };
    }
}

export async function checkAuth() {
    try {
        return await direct.checkAuth();
    } catch (e) {
        return { status: 'error', message: e.message };
    }
}

export async function listNotebooks(limit = 0) {
    try {
        const notebooks = await direct.listNotebooks();
        const limited = limit > 0 ? notebooks.slice(0, limit) : notebooks;
        return { notebooks: limited.map((nb, i) => ({ ...nb, index: i + 1, is_owner: true, created_at: '' })), count: limited.length };
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function createNotebook(title) {
    try {
        const result = await direct.rawRpcCall('createNotebook', [null, title, null, null]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function deleteNotebook(notebookId) {
    try {
        const result = await direct.rawRpcCall('deleteNotebook', [notebookId]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function renameNotebook(notebookId, newTitle) {
    try {
        const result = await direct.rawRpcCall('renameNotebook', [notebookId, newTitle]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function useNotebook(notebookId) {
    try {
        const result = await direct.rawRpcCall('useNotebook', [notebookId]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function listSources(notebookId) {
    try {
        const result = await direct.rawRpcCall('listSources', [notebookId]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function addSource(notebookId, content, opts = {}) {
    try {
        const result = await direct.rawRpcCall('addSource', [notebookId, content, opts.type || null, opts.title || null]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function deleteSource(notebookId, sourceId) {
    try {
        const result = await direct.rawRpcCall('deleteSource', [notebookId, sourceId]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function getSourceFulltext(notebookId, sourceId) {
    try {
        const result = await direct.rawRpcCall('getSourceFulltext', [notebookId, sourceId]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function getSourceGuide(notebookId, sourceId) {
    try {
        const result = await direct.rawRpcCall('getSourceGuide', [notebookId, sourceId]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function askNotebook(notebookId, question, opts = {}) {
    try {
        const result = await direct.rawRpcCall('askNotebook', [notebookId, question, opts.new || false, opts.conversationId || null, opts.sourceIds || []]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function generateAudio(notebookId, prompt = '') {
    try {
        const result = await direct.rawRpcCall('generateAudio', [notebookId, prompt]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function generateQuiz(notebookId, prompt = '') {
    try {
        const result = await direct.rawRpcCall('generateQuiz', [notebookId, prompt]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function generateFlashcards(notebookId, prompt = '') {
    try {
        const result = await direct.rawRpcCall('generateFlashcards', [notebookId, prompt]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function generateMindMap(notebookId, prompt = '') {
    try {
        const result = await direct.rawRpcCall('generateMindMap', [notebookId, prompt]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function generateReport(notebookId, prompt = '') {
    try {
        const result = await direct.rawRpcCall('generateReport', [notebookId, prompt]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function generateSlideDeck(notebookId, prompt = '') {
    try {
        const result = await direct.rawRpcCall('generateSlideDeck', [notebookId, prompt]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function getArtifact(notebookId, artifactId) {
    try {
        const artifacts = await direct.listArtifacts(notebookId);
        const match = artifacts.find(a => a.id === artifactId || (a.id && a.id.startsWith(artifactId)));
        if (match) return { artifact: match };
        return { error: true, message: 'Artifact not found' };
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function listArtifacts(notebookId) {
    try {
        const artifacts = await direct.listArtifacts(notebookId);
        return { artifacts };
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function getArtifactUrls(notebookId, artifactId) {
    try {
        const artifacts = await direct.listArtifacts(notebookId);
        const match = artifacts.find(a => a.id === artifactId || (a.id && a.id.startsWith(artifactId)));
        if (match) {
            return {
                artifact_id: match.id,
                url: match.url || match.download_url || null,
                pptx_url: match.pptx_url || null,
                type: match.type_id || match.type,
                title: match.title,
            };
        }
        return { error: true, message: 'Artifact not found' };
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function waitArtifact(notebookId, artifactId, timeout = 300) {
    try {
        const pollInterval = 5000;
        const maxAttempts = Math.floor(timeout / pollInterval);
        for (let i = 0; i < maxAttempts; i++) {
            const artifacts = await direct.listArtifacts(notebookId);
            const match = artifacts.find(a => a.id === artifactId || (a.id && a.id.startsWith(artifactId)));
            if (match && match.status === 'completed') {
                return { artifact: match, status: 'completed' };
            }
            if (match && match.status === 'error') {
                return { artifact: match, status: 'error' };
            }
            await new Promise(r => setTimeout(r, pollInterval));
        }
        return { error: true, message: 'Timeout waiting for artifact' };
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function exportArtifact(notebookId, artifactId, title, type = 'docs') {
    try {
        const result = await direct.rawRpcCall('exportArtifact', [notebookId, artifactId, title, type]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function getNotebookSummary(notebookId) {
    try {
        const result = await direct.rawRpcCall('getNotebookSummary', [notebookId]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function getNotebookMetadata(notebookId) {
    try {
        const result = await direct.rawRpcCall('getNotebookMetadata', [notebookId]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function getHistory(notebookId) {
    try {
        const result = await direct.rawRpcCall('getHistory', [notebookId]);
        return result;
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export async function generateWithWait(notebookId, type, prompt = '', timeout = 300) {
    try {
        // First trigger generation
        const genResult = await direct.rawRpcCall('generateArtifact', [notebookId, type, prompt]);
        // Then poll for completion
        const pollInterval = 5000;
        const maxAttempts = Math.floor(timeout / pollInterval);
        for (let i = 0; i < maxAttempts; i++) {
            const artifacts = await direct.listArtifacts(notebookId);
            const latest = artifacts[0];
            if (latest && latest.status === 'completed') {
                return { artifact: latest, status: 'completed', generation: genResult };
            }
            await new Promise(r => setTimeout(r, pollInterval));
        }
        return { error: true, message: 'Timeout waiting for generation', generation: genResult };
    } catch (e) {
        return { error: true, message: e.message };
    }
}

export default {
    extractChromeCookies,
    checkAuth,
    listNotebooks,
    createNotebook,
    deleteNotebook,
    renameNotebook,
    useNotebook,
    listSources,
    addSource,
    deleteSource,
    getSourceFulltext,
    getSourceGuide,
    askNotebook,
    generateAudio,
    generateQuiz,
    generateFlashcards,
    generateMindMap,
    generateReport,
    generateSlideDeck,
    getArtifact,
    listArtifacts,
    getArtifactUrls,
    waitArtifact,
    exportArtifact,
    getNotebookSummary,
    getNotebookMetadata,
    getHistory,
    generateWithWait,
};
