import { createClient } from '@supabase/supabase-js';

// In-memory fallback deduplication cache for serverless invocation lifecycle
const localDeduplicationCache = new Set();

async function wasAlreadyNotified(supabase, notificationKey) {
  if (localDeduplicationCache.has(notificationKey)) return true;
  if (!supabase) return false;

  try {
    // Try querying distribution_logs or reminders table for key
    const { data } = await supabase
      .from('distribution_logs')
      .select('id')
      .eq('channel', 'telegram_cron')
      .eq('recipient', notificationKey)
      .limit(1)
      .maybeSingle();

    if (data) {
      localDeduplicationCache.add(notificationKey);
      return true;
    }
  } catch (e) {
    // Silently continue if table structure differs
  }
  return false;
}

async function markAsNotified(supabase, notificationKey, details = {}) {
  localDeduplicationCache.add(notificationKey);
  if (!supabase) return;

  try {
    await supabase.from('distribution_logs').insert({
      channel: 'telegram_cron',
      recipient: notificationKey,
      status: 'sent',
      metadata: details,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    // Silently handle schema differences
  }
}

// Vercel Cron Job: Intelligent Clinical Reminder Engine (Deduplicated)
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
    return res.json({ status: 'skip', message: 'Missing essential configuration (Supabase / Telegram)' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentTotalMinutes = currentHour * 60 + currentMin;

  let notificationsSent = 0;
  const auditLog = [];

  try {
    // ══════════════════════════════════════════════════════════════════
    // REGLA 1: Turno Inminente (1 solo recordatorio en ventana de 1-2 hs)
    // ══════════════════════════════════════════════════════════════════
    const { data: todayAppointments } = await supabase
      .from('appointments')
      .select('*')
      .eq('status', 'pending')
      .eq('date', today);

    if (todayAppointments && todayAppointments.length > 0) {
      for (const appt of todayAppointments) {
        if (!appt.time) continue;
        const [aH, aM] = appt.time.split(':').map(Number);
        const apptTotalMinutes = aH * 60 + aM;
        const diffMin = apptTotalMinutes - currentTotalMinutes;

        // Ventana clínica: entre 15 y 120 minutos antes del turno
        if (diffMin >= 15 && diffMin <= 120) {
          const dedupKey = `inminent_appt_${appt.id}_${today}`;
          const alreadyNotified = await wasAlreadyNotified(supabase, dedupKey);

          if (!alreadyNotified) {
            // Buscar último objetivo/nota del paciente
            let lastObjective = appt.notes || 'Consulta programada';
            if (appt.patient_id) {
              const { data: evolutions } = await supabase
                .from('clinical_evolution_entries')
                .select('objective, notes')
                .eq('patient_id', appt.patient_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (evolutions?.objective) {
                lastObjective = evolutions.objective;
              }
            }

            const msg = `⏰ *Recordatorio de Turno Inminente*\n\n👤 *Paciente:* ${appt.patient_name || 'Sin nombre'}\n🕐 *Hora:* ${appt.time} hs (en ~${diffMin} min)\n📋 *Tipo:* ${appt.type || 'Sesión fonoaudiológica'}\n🎯 *Último Objetivo:* ${lastObjective}`;

            const tgResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: Number(CHAT_ID), text: msg, parse_mode: 'Markdown' }),
            });
            const tgData = await tgResp.json();

            if (tgData.ok) {
              await markAsNotified(supabase, dedupKey, { appt_id: appt.id, diffMin });
              notificationsSent++;
              auditLog.push(`Sent inminent appointment reminder for ${appt.patient_name}`);
            }
          }
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // REGLA 2: Alertas / Red Flags sin Gestionar
    // ══════════════════════════════════════════════════════════════════
    const { data: alertPatients } = await supabase
      .from('patients')
      .select('id, name, alerts, diagnosis')
      .not('alerts', 'is', null);

    if (alertPatients && alertPatients.length > 0) {
      for (const p of alertPatients) {
        if (!p.alerts || p.alerts.length === 0) continue;
        const dedupKey = `red_flags_${p.id}_${today}`;
        const alreadyNotified = await wasAlreadyNotified(supabase, dedupKey);

        if (!alreadyNotified) {
          const alertText = Array.isArray(p.alerts) ? p.alerts.join(', ') : String(p.alerts);
          const msg = `🚨 *Alerta Clínica sin Gestionar*\n\n👤 *Paciente:* ${p.name}\n🩺 *Diagnóstico:* ${p.diagnosis || 'Sin especificar'}\n⚠️ *Alertas Registradas:* ${alertText}\n\n_Sugerencia: Revisar ficha clínica y actualizar plan de tratamiento._`;

          const tgResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: Number(CHAT_ID), text: msg, parse_mode: 'Markdown' }),
          });
          const tgData = await tgResp.json();

          if (tgData.ok) {
            await markAsNotified(supabase, dedupKey, { patient_id: p.id });
            notificationsSent++;
            auditLog.push(`Sent red flag alert for patient ${p.name}`);
          }
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // REGLA 3: Seguimiento por Cancelaciones Recurrentes (2+ seguidas)
    // ══════════════════════════════════════════════════════════════════
    const { data: cancelledAppts } = await supabase
      .from('appointments')
      .select('patient_id, patient_name, status, date')
      .in('status', ['cancelled', 'no_show'])
      .order('date', { ascending: false })
      .limit(20);

    if (cancelledAppts && cancelledAppts.length > 0) {
      const cancellationCounts = {};
      for (const ca of cancelledAppts) {
        if (!ca.patient_id) continue;
        cancellationCounts[ca.patient_id] = (cancellationCounts[ca.patient_id] || 0) + 1;
        if (cancellationCounts[ca.patient_id] >= 2) {
          const dedupKey = `recurrent_cancellation_${ca.patient_id}_${today}`;
          const alreadyNotified = await wasAlreadyNotified(supabase, dedupKey);

          if (!alreadyNotified) {
            const msg = `⚠️ *Seguimiento Clínico: Cancelaciones Recurrentes*\n\n👤 *Paciente:* ${ca.patient_name}\n📌 El paciente acumula 2 o más ausencias/cancelaciones recientes.\n\n_Se recomienda contactar a la familia para reevaluar la adherencia o reprogramar._`;

            const tgResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: Number(CHAT_ID), text: msg, parse_mode: 'Markdown' }),
            });
            const tgData = await tgResp.json();

            if (tgData.ok) {
              await markAsNotified(supabase, dedupKey, { patient_id: ca.patient_id });
              notificationsSent++;
              auditLog.push(`Sent recurrent cancellation warning for ${ca.patient_name}`);
            }
          }
        }
      }
    }

    return res.json({
      status: 'ok',
      sent: notificationsSent,
      audit: auditLog,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[Cron Engine] check-reminders error:', e.message);
    return res.status(500).json({ status: 'error', message: e.message });
  }
}
