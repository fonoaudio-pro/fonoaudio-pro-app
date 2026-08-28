var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api/cron/check-reminders.js
var check_reminders_exports = {};
__export(check_reminders_exports, {
  default: () => handler
});
module.exports = __toCommonJS(check_reminders_exports);
var import_supabase_js = require("@supabase/supabase-js");
var import_web_push = __toESM(require("web-push"), 1);
var VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
var VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  import_web_push.default.setVapidDetails("mailto:clinica@fonoaudio.local", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}
async function sendWebPush(supabase, payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  try {
    const { data: subs } = await supabase.from("push_subscriptions").select("endpoint, keys").not("endpoint", "is", null);
    for (const sub of Array.isArray(subs) ? subs : []) {
      try {
        await import_web_push.default.sendNotification(sub, JSON.stringify(payload));
      } catch {
      }
    }
  } catch {
  }
}
var localDeduplicationCache = /* @__PURE__ */ new Set();
async function wasAlreadyNotified(supabase, notificationKey) {
  if (localDeduplicationCache.has(notificationKey)) return true;
  if (!supabase) return false;
  try {
    const { data } = await supabase.from("distribution_logs").select("id").eq("channel", "telegram_cron").eq("recipient", notificationKey).limit(1).maybeSingle();
    if (data) {
      localDeduplicationCache.add(notificationKey);
      return true;
    }
  } catch (e) {
  }
  return false;
}
async function markAsNotified(supabase, notificationKey, details = {}) {
  localDeduplicationCache.add(notificationKey);
  if (!supabase) return;
  try {
    await supabase.from("distribution_logs").insert({
      channel: "telegram_cron",
      recipient: notificationKey,
      status: "sent",
      metadata: details,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (e) {
  }
}
async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized: Invalid CRON_SECRET token" });
  }
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  if (!supabaseUrl || !supabaseKey || !TELEGRAM_BOT_TOKEN || !CHAT_ID) {
    return res.json({ status: "skip", message: "Missing essential configuration (Supabase / Telegram)" });
  }
  const supabase = (0, import_supabase_js.createClient)(supabaseUrl, supabaseKey);
  const now = /* @__PURE__ */ new Date();
  const today = now.toISOString().split("T")[0];
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentTotalMinutes = currentHour * 60 + currentMin;
  let notificationsSent = 0;
  const auditLog = [];
  try {
    const { data: todayAppointments } = await supabase.from("appointments").select("*").eq("status", "pending").eq("date", today);
    if (todayAppointments && todayAppointments.length > 0) {
      for (const appt of todayAppointments) {
        if (!appt.time) continue;
        const [aH, aM] = appt.time.split(":").map(Number);
        const apptTotalMinutes = aH * 60 + aM;
        const diffMin = apptTotalMinutes - currentTotalMinutes;
        if (diffMin >= 15 && diffMin <= 120) {
          const dedupKey = `inminent_appt_${appt.id}_${today}`;
          const alreadyNotified = await wasAlreadyNotified(supabase, dedupKey);
          if (!alreadyNotified) {
            let lastObjective = appt.notes || "Consulta programada";
            if (appt.patient_id) {
              const { data: evolutions } = await supabase.from("clinical_evolution_entries").select("objective, notes").eq("patient_id", appt.patient_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
              if (evolutions?.objective) {
                lastObjective = evolutions.objective;
              }
            }
            const msg = `\u23F0 *Recordatorio de Turno Inminente*

\u{1F464} *Paciente:* ${appt.patient_name || "Sin nombre"}
\u{1F550} *Hora:* ${appt.time} hs (en ~${diffMin} min)
\u{1F4CB} *Tipo:* ${appt.type || "Sesi\xF3n fonoaudiol\xF3gica"}
\u{1F3AF} *\xDAltimo Objetivo:* ${lastObjective}`;
            const tgResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: Number(CHAT_ID), text: msg, parse_mode: "Markdown" })
            });
            const tgData = await tgResp.json();
            if (tgData.ok) {
              await markAsNotified(supabase, dedupKey, { appt_id: appt.id, diffMin });
              notificationsSent++;
              auditLog.push(`Sent inminent appointment reminder for ${appt.patient_name}`);
            }
            await sendWebPush(supabase, { title: "\u23F0 Turno pr\xF3ximo", body: `${appt.patient_name} a las ${appt.time} hs`, tag: `appt_${appt.id}`, url: "/" });
          }
        }
      }
    }
    const { data: alertPatients } = await supabase.from("patients").select("id, name, alerts, diagnosis").not("alerts", "is", null);
    if (alertPatients && alertPatients.length > 0) {
      for (const p of alertPatients) {
        if (!p.alerts || p.alerts.length === 0) continue;
        const dedupKey = `red_flags_${p.id}_${today}`;
        const alreadyNotified = await wasAlreadyNotified(supabase, dedupKey);
        if (!alreadyNotified) {
          const alertText = Array.isArray(p.alerts) ? p.alerts.join(", ") : String(p.alerts);
          const msg = `\u{1F6A8} *Alerta Cl\xEDnica sin Gestionar*

\u{1F464} *Paciente:* ${p.name}
\u{1FA7A} *Diagn\xF3stico:* ${p.diagnosis || "Sin especificar"}
\u26A0\uFE0F *Alertas Registradas:* ${alertText}

_Sugerencia: Revisar ficha cl\xEDnica y actualizar plan de tratamiento._`;
          const tgResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: Number(CHAT_ID), text: msg, parse_mode: "Markdown" })
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
    const { data: cancelledAppts } = await supabase.from("appointments").select("patient_id, patient_name, status, date").in("status", ["cancelled", "no_show"]).order("date", { ascending: false }).limit(20);
    if (cancelledAppts && cancelledAppts.length > 0) {
      const cancellationCounts = {};
      for (const ca of cancelledAppts) {
        if (!ca.patient_id) continue;
        cancellationCounts[ca.patient_id] = (cancellationCounts[ca.patient_id] || 0) + 1;
        if (cancellationCounts[ca.patient_id] >= 2) {
          const dedupKey = `recurrent_cancellation_${ca.patient_id}_${today}`;
          const alreadyNotified = await wasAlreadyNotified(supabase, dedupKey);
          if (!alreadyNotified) {
            const msg = `\u26A0\uFE0F *Seguimiento Cl\xEDnico: Cancelaciones Recurrentes*

\u{1F464} *Paciente:* ${ca.patient_name}
\u{1F4CC} El paciente acumula 2 o m\xE1s ausencias/cancelaciones recientes.

_Se recomienda contactar a la familia para reevaluar la adherencia o reprogramar._`;
            const tgResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: Number(CHAT_ID), text: msg, parse_mode: "Markdown" })
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
      status: "ok",
      sent: notificationsSent,
      audit: auditLog,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (e) {
    console.error("[Cron Engine] check-reminders error:", e.message);
    return res.status(500).json({ status: "error", message: e.message });
  }
}
