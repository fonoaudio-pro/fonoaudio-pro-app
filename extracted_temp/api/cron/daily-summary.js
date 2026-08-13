import { createClient } from '@supabase/supabase-js';

// Vercel Cron Job: Daily summary at 8:00 AM Buenos Aires (11:00 UTC)
export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!supabaseUrl || !supabaseKey || !TELEGRAM_BOT_TOKEN || !CHAT_ID) {
    return res.json({ status: 'skip', message: 'Missing configuration' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const today = new Date().toISOString().split('T')[0];

    const { data: appointments } = await supabase
      .from('appointments')
      .select('*')
      .eq('date', today);

    const { data: patients } = await supabase
      .from('patients')
      .select('id, name, diagnosis, alerts');

    const pending = (appointments || []).filter(a => a.status === 'pending');
    const completed = (appointments || []).filter(a => a.status === 'completed');
    const criticalPatients = (patients || []).filter(p => p.alerts && p.alerts.length > 0);

    const summary = `📊 *Resumen del Dia*\n\n📅 Citas hoy: ${appointments?.length || 0}\n✅ Completadas: ${completed.length}\n⏳ Pendientes: ${pending.length}\n👥 Pacientes totales: ${patients?.length || 0}\n⚠️ Con alertas: ${criticalPatients.length}${pending.length > 0 ? '\n\nProximas citas:\n' + pending.map(a => `• ${a.time} hs - ${a.patient_name}`).join('\n') : ''}`;

    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(CHAT_ID), text: summary, parse_mode: 'Markdown' })
    });
    const d = await r.json();
    res.json({ status: d.ok ? 'ok' : 'error', message: d.description });
  } catch (e) {
    console.error('[Cron] daily-summary error:', e.message);
    res.status(500).json({ status: 'error', message: e.message });
  }
}
