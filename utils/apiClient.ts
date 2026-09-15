const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export async function callBackend(path: string, payload: any = {}) {
    if (!BACKEND_URL) {
        console.warn('[callBackend] VITE_BACKEND_URL no configurado. Backend no disponible.');
        return { status: 'error', message: 'Backend no configurado. Configurá VITE_BACKEND_URL en .env' };
    }
    try {
        const url = `${BACKEND_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const text = await resp.text();
        try { return JSON.parse(text); } catch { return { status: 'ok', raw: text, ok: resp.ok } }
    } catch (e: any) {
        console.warn('[callBackend] error', e?.message || e);
        return { status: 'error', message: e?.message || String(e) };
    }
}
