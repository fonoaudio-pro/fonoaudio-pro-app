import { createClient } from '@supabase/supabase-js';

// Vercel Cron Job: Daily Briefing at 8:00 AM Buenos Aires (11:00 UTC)
export default async function handler(req, res) {
  // 1. Authorization check
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized: Invalid CRON_SECRET token' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!supabaseUrl || !supabaseKey || !TELEGRAM_BOT_TOKEN || !CHAT_ID) {
    return res.json({ status: 'skip', message: 'Missing essential configuration' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const dateFormatted = now.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'America/Argentina/Buenos_Aires',
    });

    // Deduplication check to prevent sending multiple daily summaries in a single day
    const dedupKey = `daily_briefing_${today}`;
    const { data: existingLog } = await supabase
      .from('distribution_logs')
      .select('id')
      .eq('channel', 'telegram_cron')
      .eq('recipient', dedupKey)
      .limit(1)
      .maybeSingle();

    if (existingLog) {
      return res.json({ status: 'ok', sent: 0, message: `Daily briefing already sent for ${today}` });
    }

    // Fetch today's agenda & clinical details
    const { data: appointments } = await supabase
      .from('appointments')
      .select('*')
      .eq('date', today)
      .order('time', { ascending: true });

    const { data: patients } = await supabase
      .from('patients')
      .select('id, name, diagnosis, alerts');

    const pending = (appointments || []).filter(a => a.status === 'pending');
    const completed = (appointments || []).filter(a => a.status === 'completed');
    const priorityPatients = (patients || []).filter(p => p.alerts && p.alerts.length > 0);

    let summaryText = `📋 *Briefing Clínico Diario*\n📅 *${dateFormatted}*\n\n`;
    summaryText += `📊 *Resumen de Agenda:*\n`;
    summaryText += `• Citas totales hoy: *${appointments?.length || 0}*\n`;
    summaryText += `• Pendientes: *${pending.length}*\n`;
    summaryText += `• Completadas: *${completed.length}*\n`;
    summaryText += `• Pacientes con alertas activas: *${priorityPatients.length}*\n\n`;

    if (pending.length > 0) {
      summaryText += `🕐 *Cronograma de Pacientes Hoy:*\n`;
      pending.forEach((a, i) => {
        summaryText += `${i + 1}. *${a.time || '--:--'} hs* - ${a.patient_name || 'Sin nombre'} (${a.type || 'Consulta'})\n`;
      });
    } else {
      summaryText += `✨ *Sin turnos programados para la fecha.*\n`;
    }

    if (priorityPatients.length > 0) {
      summaryText += `\n⚠️ *Pacientes Prioritarios a Monitorear:*\n`;
      priorityPatients.slice(0, 5).forEach(p => {
        summaryText += `• *${p.name}* (${p.diagnosis || 'Sin diag.'}): ${Array.isArray(p.alerts) ? p.alerts.join(', ') : p.alerts}\n`;
      });
    }

    summaryText += `\n_Resumen diario generado para tu práctica fonoaudiológica_`;

    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(CHAT_ID), text: summaryText, parse_mode: 'Markdown' }),
    });

    const data = await r.json();

    if (data.ok) {
      // Mark as notified in distribution_logs
      await supabase.from('distribution_logs').insert({
        channel: 'telegram_cron',
        recipient: dedupKey,
        status: 'sent',
        created_at: new Date().toISOString(),
      }).catch(() => {});

      return res.json({ status: 'ok', sent: 1, message: 'Daily briefing sent successfully' });
    } else {
      return res.status(500).json({ status: 'error', message: data.description });
    }
  } catch (e) {
    console.error('[Cron Engine] daily-summary error:', e.message);
    return res.status(500).json({ status: 'error', message: e.message });
  }
}
