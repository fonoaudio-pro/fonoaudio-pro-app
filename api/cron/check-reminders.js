import { createClient } from '@supabase/supabase-js';

// Vercel Cron Job: Check appointment reminders every 15 minutes
export default async function handler(req, res) {
  // Verify cron secret
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
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('status', 'pending')
      .eq('date', today);

    if (error) throw error;
    if (!appointments || appointments.length === 0) {
      return res.json({ status: 'ok', sent: 0, message: 'No pending appointments' });
    }

    let sentCount = 0;
    for (const appt of appointments) {
      if (!appt.time) continue;
      const [aH, aM] = appt.time.split(':').map(Number);
      const diffMin = (aH * 60 + aM) - (currentHour * 60 + currentMin);

      if (diffMin > 0 && diffMin <= 30) {
        const msg = `🔔 *Recordatorio de Cita*\n\n👤 Paciente: ${appt.patient_name || 'Sin nombre'}\n🕐 Hora: ${appt.time} hs\n📋 Tipo: ${appt.type || 'Consulta'}\n\n_FonoAudio Pro - Te faltan ${diffMin} minutos_`;

        const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: Number(CHAT_ID), text: msg, parse_mode: 'Markdown' })
        });
        const d = await r.json();
        if (d.ok) sentCount++;
      }
    }

    res.json({ status: 'ok', sent: sentCount, total: appointments.length });
  } catch (e) {
    console.error('[Cron] check-reminders error:', e.message);
    res.status(500).json({ status: 'error', message: e.message });
  }
}
