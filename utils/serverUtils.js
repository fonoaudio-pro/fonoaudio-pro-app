import 'dotenv/config';

export async function forwardToN8n(webhookPath, payload) {
  const n8nUrl = process.env.N8N_URL;
  if (!n8nUrl) return { status: 'error', message: 'N8N_URL no configurada' };

  try {
    const resp = await fetch(`${n8nUrl.replace(/\/$/, '')}/webhook/${webhookPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': process.env.N8N_API_KEY
      },
      body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
    });
    const text = await resp.text();
    try { return JSON.parse(text); } catch { return { status: 'ok', raw: text }; }
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}
