// Shared configuration for all route modules
// Read env vars once, export as constants

export const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
export const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const GOOGLE_API_KEY = process.env.VITE_GOOGLE_API_KEY;
export const GROQ_API_KEY = process.env.VITE_GROQ_API_KEY;
export const OBSIDIAN_API_KEY = process.env.OBSIDIAN_API_KEY;
export const OBSIDIAN_URL = process.env.OBSIDIAN_URL;
export const BACKEND_URL = process.env.BACKEND_URL || (process.env.VERCEL === '1' ? '' : 'http://localhost:3001');

// In-memory stores (shared across modules)
export const pendingQueueMemory = [];

// Helper: fetch patient list from Supabase for a user
export async function fetchPatientsForUser(userId) {
    if (!SUPABASE_URL || !SUPABASE_KEY || !userId) return [];
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/patients?professional_id=eq.${userId}&select=id,name,diagnosis,age,phone,document,notes,history,reports,documents&order=name`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        return await res.json();
    } catch {
        return [];
    }
}

// Helper: send Telegram message
export async function sendTelegramMessage(chatId, text) {
    if (!TELEGRAM_BOT_TOKEN || !chatId || !text) return false;
    try {
        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
        });
        return res.ok;
    } catch {
        return false;
    }
}
