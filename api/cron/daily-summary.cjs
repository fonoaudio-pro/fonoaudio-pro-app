var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api/cron/daily-summary.js
var daily_summary_exports = {};
__export(daily_summary_exports, {
  default: () => handler
});
module.exports = __toCommonJS(daily_summary_exports);
var import_supabase_js = require("@supabase/supabase-js");
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
    return res.json({ status: "skip", message: "Missing essential configuration" });
  }
  try {
    const supabase = (0, import_supabase_js.createClient)(supabaseUrl, supabaseKey);
    const now = /* @__PURE__ */ new Date();
    const today = now.toISOString().split("T")[0];
    const dateFormatted = now.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "America/Argentina/Buenos_Aires"
    });
    const dedupKey = `daily_briefing_${today}`;
    const { data: existingLog } = await supabase.from("distribution_logs").select("id").eq("channel", "telegram_cron").eq("recipient", dedupKey).limit(1).maybeSingle();
    if (existingLog) {
      return res.json({ status: "ok", sent: 0, message: `Daily briefing already sent for ${today}` });
    }
    const { data: appointments } = await supabase.from("appointments").select("*").eq("date", today).order("time", { ascending: true });
    const { data: patients } = await supabase.from("patients").select("id, name, diagnosis, alerts");
    const pending = (appointments || []).filter((a) => a.status === "pending");
    const completed = (appointments || []).filter((a) => a.status === "completed");
    const priorityPatients = (patients || []).filter((p) => p.alerts && p.alerts.length > 0);
    let summaryText = `\u{1F4CB} *Briefing Cl\xEDnico Diario*
\u{1F4C5} *${dateFormatted}*

`;
    summaryText += `\u{1F4CA} *Resumen de Agenda:*
`;
    summaryText += `\u2022 Citas totales hoy: *${appointments?.length || 0}*
`;
    summaryText += `\u2022 Pendientes: *${pending.length}*
`;
    summaryText += `\u2022 Completadas: *${completed.length}*
`;
    summaryText += `\u2022 Pacientes con alertas activas: *${priorityPatients.length}*

`;
    if (pending.length > 0) {
      summaryText += `\u{1F550} *Cronograma de Pacientes Hoy:*
`;
      pending.forEach((a, i) => {
        summaryText += `${i + 1}. *${a.time || "--:--"} hs* - ${a.patient_name || "Sin nombre"} (${a.type || "Consulta"})
`;
      });
    } else {
      summaryText += `\u2728 *Sin turnos programados para la fecha.*
`;
    }
    if (priorityPatients.length > 0) {
      summaryText += `
\u26A0\uFE0F *Pacientes Prioritarios a Monitorear:*
`;
      priorityPatients.slice(0, 5).forEach((p) => {
        summaryText += `\u2022 *${p.name}* (${p.diagnosis || "Sin diag."}): ${Array.isArray(p.alerts) ? p.alerts.join(", ") : p.alerts}
`;
      });
    }
    summaryText += `
_Resumen diario generado para tu pr\xE1ctica fonoaudiol\xF3gica_`;
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: Number(CHAT_ID), text: summaryText, parse_mode: "Markdown" })
    });
    const data = await r.json();
    if (data.ok) {
      await supabase.from("distribution_logs").insert({
        channel: "telegram_cron",
        recipient: dedupKey,
        status: "sent",
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      }).catch(() => {
      });
      return res.json({ status: "ok", sent: 1, message: "Daily briefing sent successfully" });
    } else {
      return res.status(500).json({ status: "error", message: data.description });
    }
  } catch (e) {
    console.error("[Cron Engine] daily-summary error:", e.message);
    return res.status(500).json({ status: "error", message: e.message });
  }
}
