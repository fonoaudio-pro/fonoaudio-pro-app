var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
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

// config/serverConfig.js
var import_path, import_os, import_url, import_meta, __filename, __dirname, isWindows, PIPER_COMMAND, VOICE_MODEL_PATH, TEMP_DIR;
var init_serverConfig = __esm({
  "config/serverConfig.js"() {
    import_path = __toESM(require("path"), 1);
    import_os = __toESM(require("os"), 1);
    import_url = require("url");
    import_meta = {};
    __filename = (0, import_url.fileURLToPath)(import_meta.url);
    __dirname = import_path.default.dirname(__filename);
    isWindows = import_os.default.platform() === "win32";
    PIPER_COMMAND = isWindows ? import_path.default.join(__dirname, "..", "piper.exe") : "piper";
    VOICE_MODEL_PATH = import_path.default.join(__dirname, "..", "es_AR-daniela-high.onnx");
    TEMP_DIR = import_path.default.join(__dirname, "..", "temp");
  }
});

// services/distributionService.js
var import_supabase_js, import_uuid, DistributionService, distributionService_default;
var init_distributionService = __esm({
  "services/distributionService.js"() {
    import_supabase_js = require("@supabase/supabase-js");
    import_uuid = require("uuid");
    DistributionService = class {
      constructor() {
        this.supabase = null;
      }
      async _getSupabase() {
        if (!this.supabase) {
          const url = process.env.VITE_SUPABASE_URL;
          const key = process.env.VITE_SUPABASE_ANON_KEY;
          if (!url || !key) {
            throw new Error("Supabase credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are not configured in environment variables.");
          }
          this.supabase = (0, import_supabase_js.createClient)(url, key);
        }
        return this.supabase;
      }
      /**
       * Sends clinical material/guides to a caregiver via WhatsApp or Email.
       * @param {Object} params
       * @param {string} params.patientName
       * @param {string} params.materialTitle
       * @param {string} [params.materialUrl]
       * @param {string} params.recipientContact
       * @param {string} params.medium - 'whatsapp' or 'email'
       * @param {string} [params.message]
       * @param {string} [params.subject] - Only for email
       * @param {string} [params.sessionId] - The ID of the session that triggered this distribution
       * @returns {Promise<Object>}
       */
      async sendMaterialToCaregiver({ patientName, materialTitle, materialUrl, recipientContact, medium, message: message2, subject, sessionId }) {
        try {
          if (!materialTitle || materialTitle.trim() === "") {
            throw new Error("materialTitle is required.");
          }
          if (!["whatsapp", "email"].includes(medium)) {
            throw new Error("medium must be either 'whatsapp' or 'email'.");
          }
          if (medium === "email") {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(recipientContact)) {
              throw new Error("Invalid email format for recipientContact.");
            }
          } else if (medium === "whatsapp") {
            const phoneRegex = /^\+?[1-9]\d{6,14}$/;
            if (!phoneRegex.test(recipientContact.replace(/[\s()-]/g, ""))) {
              throw new Error("Invalid phone number format for recipientContact.");
            }
          }
          const supabase2 = await this._getSupabase();
          const { data: patients, error: pError } = await supabase2.from("patients").select("*").ilike("name", patientName).limit(1);
          if (pError || !patients || patients.length === 0) {
            throw new Error(`Patient "${patientName}" not found.`);
          }
          const patient = patients[0];
          const distributionId = (0, import_uuid.v4)();
          const timestamp = (/* @__PURE__ */ new Date()).toISOString();
          const historyEntry = {
            date: timestamp,
            type: "external_distribution",
            summary: `Material "${materialTitle}" enviado a cuidador v\xEDa ${medium}.`,
            observations: `Destinatario: ${recipientContact}. Mensaje: ${message2 || "Sin mensaje adicional."}`
          };
          const updatedHistory = [...patient.history || [], historyEntry];
          const { error: updateError } = await supabase2.from("patients").update({ history: updatedHistory }).eq("id", patient.id);
          if (updateError) {
            throw new Error(`Failed to update patient history: ${updateError.message}`);
          }
          const { error: logError2 } = await supabase2.from("distribution_logs").insert({
            distribution_id: distributionId,
            patient_id: patient.id,
            session_id: sessionId,
            // Persist the session ID for traceability
            status: "queued",
            medium,
            recipient_contact: recipientContact,
            material_title: materialTitle,
            material_url: materialUrl
          });
          if (logError2) {
            console.error("[DistributionService] Failed to create distribution log:", logError2);
          }
          const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
          if (n8nWebhookUrl) {
            fetch(n8nWebhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: "send_material_to_caregiver",
                data: {
                  distributionId,
                  patientId: patient.id,
                  sessionId,
                  // Include sessionId in the webhook payload
                  patientName: patient.name,
                  materialTitle,
                  materialUrl,
                  recipientContact,
                  medium,
                  message: message2,
                  subject,
                  timestamp
                }
              })
            }).catch((err) => console.error("[DistributionService] n8n webhook error:", err));
          } else {
            console.warn("[DistributionService] N8N_WEBHOOK_URL not configured. Skipping webhook.");
          }
          return { status: "ok", patientId: patient.id, distributionId };
        } catch (error) {
          console.error("[DistributionService] Error:", error);
          return { status: "error", message: error.message };
        }
      }
      /**
       * Gets the distribution history for a specific patient.
       * @param {string} patientId
       * @returns {Promise<Array>}
       */
      async getPatientDistributionHistory(patientId) {
        try {
          const supabase2 = await this._getSupabase();
          const { data, error } = await supabase2.from("distribution_logs").select("*").eq("patient_id", patientId).order("created_at", { ascending: false });
          if (error) throw error;
          return data || [];
        } catch (error) {
          console.error("[DistributionService] Error fetching history:", error);
          throw error;
        }
      }
      /**
       * Retries a failed distribution.
       * @param {string} distributionId - The ID of the failed distribution log.
       * @returns {Promise<Object>}
       */
      async retryDistribution(distributionId) {
        try {
          const supabase2 = await this._getSupabase();
          const { data: log, error: logError2 } = await supabase2.from("distribution_logs").select("*").eq("distribution_id", distributionId).single();
          if (logError2 || !log) {
            throw new Error("Original distribution log not found.");
          }
          const { data: patient, error: pError } = await supabase2.from("patients").select("name").eq("id", log.patient_id).single();
          if (pError || !patient) {
            throw new Error("Patient not found for retry.");
          }
          const result = await this.sendMaterialToCaregiver({
            patientName: patient.name,
            materialTitle: log.material_title,
            materialUrl: log.material_url,
            recipientContact: log.recipient_contact,
            medium: log.medium,
            message: log.error_message
          });
          return result;
        } catch (error) {
          console.error("[DistributionService] Error retrying distribution:", error);
          throw error;
        }
      }
      /**
       * Resends the last material sent to the patient.
       * @param {string} patientId
       * @returns {Promise<Object>}
       */
      async resendLastMaterial(patientId) {
        try {
          const supabase2 = await this._getSupabase();
          const { data: lastLog, error: logError2 } = await supabase2.from("distribution_logs").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(1).single();
          if (logError2 || !lastLog) {
            throw new Error("No previous distribution found for this patient.");
          }
          const { data: patient, error: pError } = await supabase2.from("patients").select("name").eq("id", patientId).single();
          if (pError || !patient) {
            throw new Error("Patient not found.");
          }
          const result = await this.sendMaterialToCaregiver({
            patientName: patient.name,
            materialTitle: lastLog.material_title,
            materialUrl: lastLog.material_url,
            recipientContact: lastLog.recipient_contact,
            medium: lastLog.medium,
            message: "Reenv\xEDo de material solicitado."
          });
          return result;
        } catch (error) {
          console.error("[DistributionService] Error resending last material:", error);
          return { status: "error", message: error.message };
        }
      }
      /**
       * Processes all pending reminders that are due.
       * @returns {Promise<Object>} Summary of processed reminders.
       */
      async processPendingReminders() {
        try {
          const supabase2 = await this._getSupabase();
          const now = (/* @__PURE__ */ new Date()).toISOString();
          const { data: pendingReminders, error: fetchError } = await supabase2.from("reminders").select("*").eq("status", "pending").lte("scheduled_at", now);
          if (fetchError) throw fetchError;
          if (!pendingReminders || pendingReminders.length === 0) {
            return { status: "ok", processed: 0 };
          }
          let successCount = 0;
          let failureCount = 0;
          for (const reminder of pendingReminders) {
            try {
              const { data: patient, error: pError } = await supabase2.from("patients").select("name").eq("id", reminder.patient_id).single();
              if (pError || !patient) {
                throw new Error(`Patient ${reminder.patient_id} not found.`);
              }
              const result = await this.sendMaterialToCaregiver({
                patientName: patient.name,
                materialTitle: reminder.material_title,
                recipientContact: reminder.recipient_contact,
                medium: reminder.medium,
                message: "Recordatorio de material cl\xEDnico pendiente."
              });
              if (result.status === "ok") {
                await supabase2.from("reminders").update({ status: "sent", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", reminder.id);
                successCount++;
              } else {
                throw new Error(result.message);
              }
            } catch (err) {
              console.error(`[DistributionService] Failed to process reminder ${reminder.id}:`, err);
              await supabase2.from("reminders").update({ status: "failed", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", reminder.id);
              failureCount++;
            }
          }
          return { status: "ok", processed: pendingReminders.length, success: successCount, failure: failureCount };
        } catch (error) {
          console.error("[DistributionService] Error processing reminders:", error);
          return { status: "error", message: error.message };
        }
      }
    };
    distributionService_default = new DistributionService();
  }
});

// routes/tts.js
function escapeXml(t) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
async function synthesizeEdgeTTS(text, voiceName) {
  if (!text?.trim()) throw new Error("Empty text");
  let WebSocketImpl;
  try {
    const wsMod = await import("ws");
    WebSocketImpl = wsMod.default || wsMod;
  } catch {
    WebSocketImpl = globalThis.WebSocket;
  }
  if (!WebSocketImpl) throw new Error("No WebSocket implementation available");
  const connectionId = import_crypto.default.randomUUID().replace(/-/g, "").substring(0, 32);
  const requestId = import_crypto.default.randomUUID();
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='es-AR'><voice name='${voiceName}'>${escapeXml(text.trim())}</voice></speak>`;
  return new Promise((resolve, reject) => {
    const ws = new WebSocketImpl(`${EDGE_WSS}&ConnectionId=${connectionId}`);
    const chunks = [];
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        try {
          ws.close();
        } catch {
        }
        reject(new Error("Edge TTS timeout"));
      }
    }, 25e3);
    ws.on("open", () => {
      ws.send(`Content-Type:application/json; charset=utf-8\r
Path:speech.config\r
\r
{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-96kbitrate-mono-mp3"}}}}`);
      ws.send(`X-RequestId:${requestId}\r
Content-Type:application/ssml+xml\r
X-Timestamp:${(/* @__PURE__ */ new Date()).toISOString()}\r
Path:ssml\r
\r
${ssml}`);
    });
    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        const marker = Buffer.from("Path:audio\r\n\r\n");
        const idx = buf.indexOf(marker);
        if (idx !== -1) {
          const audio2 = buf.slice(idx + marker.length);
          if (audio2.length > 0) chunks.push(audio2);
        } else if (buf.length > 100) {
          chunks.push(buf);
        }
      }
    });
    ws.on("close", () => {
      clearTimeout(timer);
      if (done) return;
      done = true;
      if (chunks.length > 0) {
        const buf = Buffer.concat(chunks);
        if (buf.length < 100) {
          reject(new Error("Audio too small"));
          return;
        }
        console.log("[TTS] Edge TTS OK, voice:", voiceName, "bytes:", buf.length);
        resolve(buf);
      } else {
        reject(new Error("Edge TTS: no audio"));
      }
    });
    ws.on("error", (e) => {
      clearTimeout(timer);
      if (!done) {
        done = true;
        reject(new Error(`Edge TTS error: ${e.message || e.type}`));
      }
    });
  });
}
async function synthesizeGoogleTranslate(text) {
  const clean = text.replace(/[^\w\s.,;:!?¡¿áéíóúñüÁÉÍÓÚÑÜ-]/g, "").substring(0, 200);
  if (!clean.trim()) throw new Error("Empty text");
  const resp = await fetch(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(clean)}&tl=es-AR&client=tw-ob`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(15e3)
  });
  if (!resp.ok) throw new Error(`Google Translate error: ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.length < 100) throw new Error("Audio too small");
  console.log("[TTS] Google Translate fallback OK");
  return buf;
}
async function synthesizeText(text, voice2 = "es_AR-masculino") {
  if (!text?.trim()) return null;
  const cfg = VOICE_MAP[voice2] || VOICE_MAP.default;
  try {
    return await synthesizeEdgeTTS(text, cfg.voice);
  } catch (e) {
    console.warn("[TTS] Edge TTS failed:", e.message);
  }
  try {
    return await synthesizeGoogleTranslate(text);
  } catch (e) {
    console.warn("[TTS] Translate fallback failed:", e.message);
  }
  console.error("[TTS] ALL backends failed");
  return null;
}
var import_express, import_crypto, router, VOICE_MAP, TRUSTED_CLIENT_TOKEN, EDGE_WSS, tts_default;
var init_tts = __esm({
  "routes/tts.js"() {
    import_express = __toESM(require("express"), 1);
    import_crypto = __toESM(require("crypto"), 1);
    router = import_express.default.Router();
    VOICE_MAP = {
      "es_AR-masculino": { voice: "es-AR-TomasNeural", label: "Masculino" },
      "es_AR-daniela": { voice: "es-AR-ElenaNeural", label: "Femenino" },
      "default": { voice: "es-AR-TomasNeural", label: "Masculino" }
    };
    TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
    EDGE_WSS = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
    router.get("/voices", (_req, res) => {
      res.json({ voices: [
        { id: "es_AR-masculino", name: "Masculino (Tomas - es-AR)", language: "es-AR", gender: "male", engine: "edge-tts" },
        { id: "es_AR-daniela", name: "Daniela (Elena - es-AR)", language: "es-AR", gender: "female", engine: "edge-tts" }
      ] });
    });
    router.post("/", async (req, res) => {
      const { text, voice: voice2 = "es_AR-masculino" } = req.body || {};
      if (!text?.trim()) return res.status(400).json({ error: "Falta el texto" });
      try {
        const audio2 = await synthesizeText(text, voice2);
        if (!audio2) return res.status(503).json({ error: "TTS no disponible" });
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Length", audio2.length);
        res.setHeader("Cache-Control", "public, max-age=3600");
        return res.send(audio2);
      } catch (err) {
        res.status(500).json({ error: "Error TTS", detail: err.message });
      }
    });
    tts_default = router;
  }
});

// services/notebooklmDirect.js
var notebooklmDirect_exports = {};
__export(notebooklmDirect_exports, {
  RPC: () => RPC,
  checkAuth: () => checkAuth,
  getLastDebugRaw: () => getLastDebugRaw,
  listArtifacts: () => listArtifacts,
  listNotebooks: () => listNotebooks,
  rawRpcCall: () => rawRpcCall,
  resetTokens: () => resetTokens
});
function getStoragePath() {
  if (_storagePath) return _storagePath;
  _storagePath = import_node_path.default.join(import_node_os.default.homedir(), ".notebooklm", "profiles", "default", "storage_state.json");
  return _storagePath;
}
function loadCookies() {
  const envCookies = process.env.NOTEBOOKLM_COOKIES;
  if (envCookies) {
    try {
      const parsed = JSON.parse(envCookies);
      return (parsed.cookies || parsed).filter((c) => {
        const domain = c.domain || "";
        return domain.includes("google.com") || domain.includes("googleusercontent.com");
      });
    } catch (e) {
      console.error("[NBLM] Failed to parse NOTEBOOKLM_COOKIES env var:", e.message);
    }
  }
  const storagePath = getStoragePath();
  if (!import_node_fs.default.existsSync(storagePath)) return [];
  const storage = JSON.parse(import_node_fs.default.readFileSync(storagePath, "utf8"));
  return (storage.cookies || []).filter((c) => {
    const domain = c.domain || "";
    return domain.includes("google.com") || domain.includes("googleusercontent.com");
  });
}
function cookiesToHeader(cookies) {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}
function extractField(html, key) {
  const p1 = new RegExp(`"${key}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`);
  let m = p1.exec(html);
  if (m) return m[1];
  const p2 = new RegExp(`'${key}'\\s*:\\s*'([^'\\\\]*(?:\\\\.[^'\\\\]*)*)'`);
  m = p2.exec(html);
  if (m) return m[1];
  const p3 = new RegExp(`&quot;${key}&quot;\\s*:\\s*&quot;((?:(?!&quot;).)*)&quot;`);
  m = p3.exec(html);
  if (m) return m[1];
  return null;
}
async function getTokens() {
  if (_csrfToken && _sessionId) return { csrf: _csrfToken, sid: _sessionId };
  const cookies = loadCookies();
  const cookieHeader = cookiesToHeader(cookies);
  const resp = await fetch(BASE_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Cookie": cookieHeader,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(3e4)
  });
  if (!resp.ok) {
    throw new Error(`Failed to fetch NotebookLM page: ${resp.status} ${resp.statusText}`);
  }
  const html = await resp.text();
  const csrf = extractField(html, "SNlM0e");
  const sid = extractField(html, "FdrFJe");
  if (!csrf) {
    if (html.includes("accounts.google.com") || html.includes("Sign in")) {
      throw new Error("Authentication expired. Run: python -m notebooklm login");
    }
    throw new Error("CSRF token not found in page HTML");
  }
  _csrfToken = csrf;
  _sessionId = sid || "";
  console.log("[NBLM Direct] Got tokens, csrf length:", csrf.length, "sid:", sid ? "yes" : "no");
  return { csrf: _csrfToken, sid: _sessionId };
}
function encodeRpcRequest(rpcId, params) {
  const paramsJson = JSON.stringify(params);
  const inner = [rpcId, paramsJson, null, "generic"];
  return [[inner]];
}
function buildBody(rpcRequest, csrf) {
  const fReq = JSON.stringify(rpcRequest);
  const parts = [`f.req=${encodeURIComponent(fReq)}`];
  if (csrf) parts.push(`at=${encodeURIComponent(csrf)}`);
  return parts.join("&") + "&";
}
function nextReqId() {
  return String(++_reqId);
}
function buildRpcUrl(rpcId, sid) {
  const params = new URLSearchParams({
    rpcids: rpcId,
    "source-path": "/",
    "f.sid": sid || "",
    "hl": "en",
    "rt": "c",
    "authuser": "0",
    "_reqid": nextReqId()
  });
  return `${BATCHEXECUTE_URL}?${params.toString()}`;
}
async function rpcCall(rpcId, params) {
  const { csrf, sid } = await getTokens();
  const cookies = loadCookies();
  const cookieHeader = cookiesToHeader(cookies);
  const request = encodeRpcRequest(rpcId, params);
  const body = buildBody(request, csrf);
  const url = buildRpcUrl(rpcId, sid);
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Cookie": cookieHeader,
      "Referer": `${BASE_URL}/`,
      "Origin": BASE_URL,
      "X-Goog-AuthUser": "0"
    },
    body,
    signal: AbortSignal.timeout(6e4)
  });
  if (!resp.ok) {
    throw new Error(`RPC ${rpcId} failed: ${resp.status} ${resp.statusText}`);
  }
  const text = await resp.text();
  console.log("[NBLM Direct] RPC", rpcId, "response length:", text.length);
  console.log("[NBLM Direct] RPC response preview:", text.substring(0, 500));
  return parseBatchExecuteResponse(text, rpcId);
}
function parseBatchExecuteResponse(text, rpcId) {
  let cleaned = text;
  if (cleaned.startsWith(")]}'")) {
    const nlIdx = cleaned.indexOf("\n");
    cleaned = nlIdx >= 0 ? cleaned.substring(nlIdx + 1) : cleaned.substring(4);
  }
  try {
    const arr = JSON.parse(cleaned);
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (Array.isArray(item) && item.length >= 3 && item[0] === "wrb.fr" && item[1] === rpcId) {
          const resultData = item[2];
          if (typeof resultData === "string") {
            try {
              return JSON.parse(resultData);
            } catch {
              return resultData;
            }
          }
          return resultData;
        }
        if (Array.isArray(item) && item.length > 0 && Array.isArray(item[0])) {
          for (const inner of item) {
            if (Array.isArray(inner) && inner.length >= 3 && inner[0] === "wrb.fr" && inner[1] === rpcId) {
              const resultData = inner[2];
              if (typeof resultData === "string") {
                try {
                  return JSON.parse(resultData);
                } catch {
                  return resultData;
                }
              }
              return resultData;
            }
          }
        }
      }
    }
  } catch {
  }
  const lines = cleaned.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "null") continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (Array.isArray(item) && item.length >= 3 && item[0] === "wrb.fr" && item[1] === rpcId) {
            const resultData = item[2];
            if (typeof resultData === "string") {
              try {
                return JSON.parse(resultData);
              } catch {
                return resultData;
              }
            }
            return resultData;
          }
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}
function getLastDebugRaw() {
  return _lastDebugRaw;
}
async function rawRpcCall(rpcId, params) {
  const { csrf, sid } = await getTokens();
  const cookies = loadCookies();
  const cookieHeader = cookiesToHeader(cookies);
  const request = encodeRpcRequest(rpcId, params);
  const body = buildBody(request, csrf);
  const url = buildRpcUrl(rpcId, sid);
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Cookie": cookieHeader,
      "Referer": `${BASE_URL}/`,
      "Origin": BASE_URL,
      "X-Goog-AuthUser": "0"
    },
    body,
    signal: AbortSignal.timeout(6e4)
  });
  if (!resp.ok) throw new Error(`RPC ${rpcId} failed: ${resp.status}`);
  return await resp.text();
}
async function listNotebooks() {
  try {
    const rpcId = " notebooklmGetNotebooks";
    const body = JSON.stringify({ rpcId, params: {} });
    const resp = await fetch(BACKEND_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `__Secure-1PSID=${PSID}; __Secure-3PSID=${PSID3}; __Secure-1PSIDTS=${PSIDTS}; __Secure-3PSIDTS=${PSIDTS3}; SID=${SID}`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      body,
      signal: AbortSignal.timeout(3e4)
    });
    if (!resp.ok) throw new Error(`RPC ${rpcId} failed: ${resp.status}`);
    const text = await resp.text();
    const lines = text.split("\n").filter((l) => l.trim());
    let notebooks = [];
    for (const line of lines) {
      try {
        notebooks.push(JSON.parse(line));
      } catch {
      }
    }
    return notebooks;
  } catch (e) {
    console.error("[notebooklmDirect] listNotebooks error:", e.message);
    throw e;
  }
}
async function listArtifacts(notebookId) {
  const result = await rpcCall(RPC.LIST_ARTIFACTS, [[2], notebookId, 'NOT artifact.status = "ARTIFACT_STATUS_SUGGESTED"']);
  if (!result) return [];
  const artifacts = [];
  let rows = [];
  if (Array.isArray(result) && result.length === 1 && Array.isArray(result[0])) {
    rows = result[0];
  } else if (Array.isArray(result)) {
    rows = result;
  }
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const art = {
      id: row[0],
      title: row[1],
      type_id: resolveTypeCode(row[2]),
      status_id: row[4],
      status: resolveStatusCode(row[4])
    };
    const typeCode = row[2];
    if (typeCode === 8) {
      const slideMeta = row[16];
      if (Array.isArray(slideMeta)) {
        art.url = slideMeta[3] || null;
        art.pptx_url = slideMeta[4] || null;
      }
    } else if (typeCode === 1) {
      const audioMeta = row[6];
      if (Array.isArray(audioMeta) && Array.isArray(audioMeta[5]) && audioMeta[5].length > 0) {
        art.url = audioMeta[5][0]?.[0] || null;
      }
    } else if (typeCode === 3) {
      const videoMeta = row[8];
      if (Array.isArray(videoMeta)) {
        for (const variant of videoMeta) {
          if (Array.isArray(variant) && variant.length > 0) {
            const mediaUrl = variant[0];
            if (mediaUrl && typeof mediaUrl === "string") {
              art.url = mediaUrl;
              break;
            }
          }
        }
      }
    } else if (typeCode === 7) {
      const infoMeta = row[16];
      if (Array.isArray(infoMeta) && Array.isArray(infoMeta[2]) && infoMeta[2].length > 0) {
        const content = infoMeta[2][0];
        if (Array.isArray(content) && content.length > 1) {
          art.url = content[1] || null;
        }
      }
    }
    artifacts.push(art);
  }
  return artifacts;
}
function resolveTypeCode(code) {
  const map = {
    1: "audio",
    2: "report",
    3: "video",
    4: "quiz",
    5: "mind_map",
    7: "infographic",
    8: "slide_deck",
    9: "data_table"
  };
  return map[code] || `type_${code}`;
}
function resolveStatusCode(code) {
  const map = {
    1: "in_progress",
    2: "completed",
    3: "error"
  };
  return map[code] || "pending";
}
function resetTokens() {
  _csrfToken = null;
  _sessionId = null;
}
async function checkAuth() {
  try {
    const cookies = loadCookies();
    if (cookies.length === 0) return { status: "no_cookies", message: "No cookies found" };
    const { csrf } = await getTokens();
    return { status: "authenticated", csrf_length: csrf.length };
  } catch (e) {
    return { status: "error", message: e.message };
  }
}
var import_node_fs, import_node_path, import_node_os, BASE_URL, BATCHEXECUTE_URL, RPC, _storagePath, _csrfToken, _sessionId, _reqId, _lastDebugRaw;
var init_notebooklmDirect = __esm({
  "services/notebooklmDirect.js"() {
    import_node_fs = __toESM(require("node:fs"), 1);
    import_node_path = __toESM(require("node:path"), 1);
    import_node_os = __toESM(require("node:os"), 1);
    BASE_URL = "https://notebooklm.google.com";
    BATCHEXECUTE_URL = `${BASE_URL}/_/LabsTailwindUi/data/batchexecute`;
    RPC = {
      LIST_NOTEBOOKS: "wXbhsf",
      LIST_ARTIFACTS: "gArtLc",
      CREATE_ARTIFACT: "R7cb6c",
      GET_NOTEBOOK: "rLM1Ne"
    };
    _storagePath = null;
    _csrfToken = null;
    _sessionId = null;
    _reqId = 0;
    _lastDebugRaw = null;
  }
});

// services/notebooklmService.js
async function extractChromeCookies() {
  if (process.env.VERCEL === "1") {
    return { success: false, message: "Cookie extraction not available in Vercel. Run locally: python -m notebooklm login" };
  }
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const path5 = await import("node:path");
    const { fileURLToPath: fileURLToPath2 } = await import("node:url");
    const execFileAsync = promisify(execFile);
    const __filename2 = fileURLToPath2(import_meta2.url);
    const __dirname2 = path5.dirname(__filename2);
    const scriptPath = path5.join(__dirname2, "..", "scripts", "notebooklm_login.py");
    const { stdout, stderr } = await execFileAsync("python", [scriptPath], {
      timeout: 36e4,
      maxBuffer: 5 * 1024 * 1024,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" }
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
async function checkAuth2() {
  try {
    return await checkAuth();
  } catch (e) {
    return { status: "error", message: e.message };
  }
}
async function listNotebooks2(limit = 0) {
  try {
    const notebooks = await listNotebooks();
    const limited = limit > 0 ? notebooks.slice(0, limit) : notebooks;
    return { notebooks: limited.map((nb, i) => ({ ...nb, index: i + 1, is_owner: true, created_at: "" })), count: limited.length };
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function createNotebook(title) {
  try {
    const result = await rawRpcCall("createNotebook", [null, title, null, null]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function deleteNotebook(notebookId) {
  try {
    const result = await rawRpcCall("deleteNotebook", [notebookId]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function renameNotebook(notebookId, newTitle) {
  try {
    const result = await rawRpcCall("renameNotebook", [notebookId, newTitle]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function useNotebook(notebookId) {
  try {
    const result = await rawRpcCall("useNotebook", [notebookId]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function listSources(notebookId) {
  try {
    const result = await rawRpcCall("listSources", [notebookId]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function addSource(notebookId, content, opts = {}) {
  try {
    const result = await rawRpcCall("addSource", [notebookId, content, opts.type || null, opts.title || null]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function deleteSource(notebookId, sourceId) {
  try {
    const result = await rawRpcCall("deleteSource", [notebookId, sourceId]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function getSourceFulltext(notebookId, sourceId) {
  try {
    const result = await rawRpcCall("getSourceFulltext", [notebookId, sourceId]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function getSourceGuide(notebookId, sourceId) {
  try {
    const result = await rawRpcCall("getSourceGuide", [notebookId, sourceId]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function askNotebook(notebookId, question, opts = {}) {
  try {
    const result = await rawRpcCall("askNotebook", [notebookId, question, opts.new || false, opts.conversationId || null, opts.sourceIds || []]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function generateAudio(notebookId, prompt = "") {
  try {
    const result = await rawRpcCall("generateAudio", [notebookId, prompt]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function generateQuiz(notebookId, prompt = "") {
  try {
    const result = await rawRpcCall("generateQuiz", [notebookId, prompt]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function generateFlashcards(notebookId, prompt = "") {
  try {
    const result = await rawRpcCall("generateFlashcards", [notebookId, prompt]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function generateMindMap(notebookId, prompt = "") {
  try {
    const result = await rawRpcCall("generateMindMap", [notebookId, prompt]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function generateReport(notebookId, prompt = "") {
  try {
    const result = await rawRpcCall("generateReport", [notebookId, prompt]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function generateSlideDeck(notebookId, prompt = "") {
  try {
    const result = await rawRpcCall("generateSlideDeck", [notebookId, prompt]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function getArtifact(notebookId, artifactId) {
  try {
    const artifacts = await listArtifacts(notebookId);
    const match = artifacts.find((a) => a.id === artifactId || a.id && a.id.startsWith(artifactId));
    if (match) return { artifact: match };
    return { error: true, message: "Artifact not found" };
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function listArtifacts2(notebookId) {
  try {
    const artifacts = await listArtifacts(notebookId);
    return { artifacts };
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function getArtifactUrls(notebookId, artifactId) {
  try {
    const artifacts = await listArtifacts(notebookId);
    const match = artifacts.find((a) => a.id === artifactId || a.id && a.id.startsWith(artifactId));
    if (match) {
      return {
        artifact_id: match.id,
        url: match.url || match.download_url || null,
        pptx_url: match.pptx_url || null,
        type: match.type_id || match.type,
        title: match.title
      };
    }
    return { error: true, message: "Artifact not found" };
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function waitArtifact(notebookId, artifactId, timeout2 = 300) {
  try {
    const pollInterval = 5e3;
    const maxAttempts = Math.floor(timeout2 / pollInterval);
    for (let i = 0; i < maxAttempts; i++) {
      const artifacts = await listArtifacts(notebookId);
      const match = artifacts.find((a) => a.id === artifactId || a.id && a.id.startsWith(artifactId));
      if (match && match.status === "completed") {
        return { artifact: match, status: "completed" };
      }
      if (match && match.status === "error") {
        return { artifact: match, status: "error" };
      }
      await new Promise((r) => setTimeout(r, pollInterval));
    }
    return { error: true, message: "Timeout waiting for artifact" };
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function exportArtifact(notebookId, artifactId, title, type = "docs") {
  try {
    const result = await rawRpcCall("exportArtifact", [notebookId, artifactId, title, type]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function getNotebookSummary(notebookId) {
  try {
    const result = await rawRpcCall("getNotebookSummary", [notebookId]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function getNotebookMetadata(notebookId) {
  try {
    const result = await rawRpcCall("getNotebookMetadata", [notebookId]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function getHistory(notebookId) {
  try {
    const result = await rawRpcCall("getHistory", [notebookId]);
    return result;
  } catch (e) {
    return { error: true, message: e.message };
  }
}
async function generateWithWait(notebookId, type, prompt = "", timeout2 = 300) {
  try {
    const genResult = await rawRpcCall("generateArtifact", [notebookId, type, prompt]);
    const pollInterval = 5e3;
    const maxAttempts = Math.floor(timeout2 / pollInterval);
    for (let i = 0; i < maxAttempts; i++) {
      const artifacts = await listArtifacts(notebookId);
      const latest = artifacts[0];
      if (latest && latest.status === "completed") {
        return { artifact: latest, status: "completed", generation: genResult };
      }
      await new Promise((r) => setTimeout(r, pollInterval));
    }
    return { error: true, message: "Timeout waiting for generation", generation: genResult };
  } catch (e) {
    return { error: true, message: e.message };
  }
}
var import_meta2, notebooklmService_default;
var init_notebooklmService = __esm({
  "services/notebooklmService.js"() {
    init_notebooklmDirect();
    import_meta2 = {};
    notebooklmService_default = {
      extractChromeCookies,
      checkAuth: checkAuth2,
      listNotebooks: listNotebooks2,
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
      listArtifacts: listArtifacts2,
      getArtifactUrls,
      waitArtifact,
      exportArtifact,
      getNotebookSummary,
      getNotebookMetadata,
      getHistory,
      generateWithWait
    };
  }
});

// services/clinicalPlanningService.js
var import_generative_ai, import_config, import_supabase_js2, genAI, model, ClinicalPlanningService, clinicalPlanningService_default;
var init_clinicalPlanningService = __esm({
  "services/clinicalPlanningService.js"() {
    import_generative_ai = require("@google/generative-ai");
    import_config = require("dotenv/config");
    import_supabase_js2 = require("@supabase/supabase-js");
    genAI = new import_generative_ai.GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    ClinicalPlanningService = class {
      constructor() {
        this.supabase = null;
      }
      async _getSupabase() {
        if (!this.supabase) {
          const url = process.env.VITE_SUPABASE_URL;
          const key = process.env.VITE_SUPABASE_ANON_KEY;
          if (!url || !key) {
            throw new Error("Supabase credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are not configured in environment variables.");
          }
          this.supabase = (0, import_supabase_js2.createClient)(url, key);
        }
        return this.supabase;
      }
      /**
       * Generates a structured clinical planning analysis.
       * @param {string} patientId 
       * @returns {Promise<any>}
       */
      async generateAnalysis(patientId) {
        try {
          const supabase2 = await this._getSupabase();
          const { data: patient, error: pError } = await supabase2.from("patients").select("*").eq("id", patientId).single();
          if (pError || !patient) {
            throw new Error(`Patient not found: ${pError?.message || patientId}`);
          }
          let clinicalRecord = null;
          try {
            const { data: crData } = await supabase2.from("clinical_records").select("*").eq("patient_id", patientId).maybeSingle();
            clinicalRecord = crData;
          } catch {
          }
          let anamnesisData = null;
          try {
            const { data: anData } = await supabase2.from("anamnesis").select("*").eq("patient_id", patientId).maybeSingle();
            anamnesisData = anData;
          } catch {
          }
          let analysisHistory = [];
          try {
            const { data: ahData } = await supabase2.from("analysis_history").select("*").eq("patient_id", patientId).order("timestamp", { ascending: false }).limit(10);
            analysisHistory = ahData || [];
          } catch {
          }
          let contextParts = [];
          contextParts.push({
            text: `[DATOS DEL PACIENTE]
Nombre: ${patient.name}
Edad: ${patient.age} a\xF1os
Diagn\xF3stico: ${patient.diagnosis}
Notas: ${patient.notes || "Sin notas"}
Historial de sesiones: ${JSON.stringify(patient.history || [])}
Evaluaciones: ${JSON.stringify(patient.evaluations || [])}
Plan de tratamiento actual: ${JSON.stringify(patient.treatmentPlan || {})}
Alertas: ${patient.alerts?.join(", ") || "Ninguna"}`
          });
          if (clinicalRecord) {
            const crParts = [`[FICHA CL\xCDNICA]`];
            if (clinicalRecord.chief_complaint) crParts.push(`Motivo de consulta: ${clinicalRecord.chief_complaint}`);
            if (clinicalRecord.chief_complaint_onset) crParts.push(`Cronolog\xEDa del motivo: ${clinicalRecord.chief_complaint_onset}`);
            if (clinicalRecord.primary_diagnosis_name) crParts.push(`Diagn\xF3stico principal: ${clinicalRecord.primary_diagnosis_name} (${clinicalRecord.primary_diagnosis_code || "sin c\xF3digo"})`);
            if (clinicalRecord.secondary_diagnosis_codes?.length) crParts.push(`Diagn\xF3sticos secundarios: ${clinicalRecord.secondary_diagnosis_codes.join(", ")}`);
            if (clinicalRecord.personal_history && Object.keys(clinicalRecord.personal_history).length > 0) {
              crParts.push(`Antecedentes personales: ${JSON.stringify(clinicalRecord.personal_history)}`);
            }
            if (clinicalRecord.family_history && Object.keys(clinicalRecord.family_history).length > 0) {
              crParts.push(`Antecedentes familiares: ${JSON.stringify(clinicalRecord.family_history)}`);
            }
            if (clinicalRecord.medical_history && Object.keys(clinicalRecord.medical_history).length > 0) {
              crParts.push(`Historial m\xE9dico: ${JSON.stringify(clinicalRecord.medical_history)}`);
            }
            if (clinicalRecord.developmental_history && Object.keys(clinicalRecord.developmental_history).length > 0) {
              crParts.push(`Historial del desarrollo: ${JSON.stringify(clinicalRecord.developmental_history)}`);
            }
            if (clinicalRecord.clinical_observations) crParts.push(`Observaciones cl\xEDnicas: ${clinicalRecord.clinical_observations}`);
            if (clinicalRecord.affected_areas?.length) {
              const affected = clinicalRecord.affected_areas.filter((a) => a.affected);
              if (affected.length > 0) {
                crParts.push(`\xC1reas afectadas: ${affected.map((a) => `${a.name} (${a.level || "no especificado"})`).join(", ")}`);
              }
            }
            contextParts.push({ text: crParts.join("\n") });
          }
          if (anamnesisData) {
            const anParts = [`[ANAMNESIS]`];
            if (anamnesisData.chief_complaint) anParts.push(`Motivo de consulta (anamnesis): ${anamnesisData.chief_complaint}`);
            if (anamnesisData.personal_history) {
              const ph = typeof anamnesisData.personal_history === "string" ? anamnesisData.personal_history : JSON.stringify(anamnesisData.personal_history);
              anParts.push(`Historia personal: ${ph}`);
            }
            if (anamnesisData.family_history) {
              const fh = typeof anamnesisData.family_history === "string" ? anamnesisData.family_history : JSON.stringify(anamnesisData.family_history);
              anParts.push(`Historia familiar: ${fh}`);
            }
            contextParts.push({ text: anParts.join("\n") });
          }
          if (analysisHistory.length > 0) {
            const ahParts = [`[HISTORIAL DE AN\xC1LISIS - TENDENCIA]`];
            for (const ah of analysisHistory) {
              ahParts.push(`- ${new Date(ah.timestamp).toLocaleDateString()}: Riesgo=${ah.risk_level}, Acci\xF3n=${ah.action_level}, M\xF3dulo=${ah.module}`);
            }
            contextParts.push({ text: ahParts.join("\n") });
          }
          if (patient.documents && patient.documents.length > 0) {
            contextParts.push({ text: "[DOCUMENT CONTEXT]" });
            for (const doc of patient.documents) {
              if (doc.content && doc.mimeType) {
                contextParts.push({
                  inlineData: {
                    mimeType: doc.mimeType,
                    data: doc.content
                    // Assumes doc.content is base64 string
                  }
                });
                contextParts.push({ text: `[End of Document: ${doc.name}]` });
              }
            }
          }
          const prompt = `
            Sos un asistente cl\xEDnico altamente experimentado y profesional, especializado en Fonoaudiolog\xEDa.
            Tu tarea es realizar un an\xE1lisis de razonamiento cl\xEDnico profundo para el paciente descrito arriba.
            
            CONTEXTO DISPONIBLE:
            Ten\xE9s acceso a:
            - Datos estructurados del paciente (nombre, edad, diagn\xF3stico)
            - Ficha Cl\xEDnica completa (motivo de consulta, antecedentes, \xE1reas afectadas, observaciones)
            - Anamnesis (historia personal y familiar)
            - Historial de an\xE1lisis previos (tendencia de riesgo)
            - Documentos adjuntos (im\xE1genes, PDFs)
            
            MISI\xD3N:
            Analiz\xE1 TODA la informaci\xF3n disponible para proveer un razonamiento cl\xEDnico profesional, prudente y basado en evidencia.
            NO inventes diagn\xF3sticos. En cambio, suger\xED hip\xF3tesis basadas en la evidencia disponible.
            PRIORIZ\xC1 la informaci\xF3n de la Ficha Cl\xEDnica y la Anamnesis para fundamentar tus respuestas.
            
            FORMATO DE SALIDA:
            Deber\xEDas responder SOLO con un objeto JSON v\xE1lido. No incluyas backticks de markdown ni texto adicional.
            La estructura del JSON debe ser exactamente la siguiente:
            {
              "motivo_de_consulta_resumido": "Resumen conciso del motivo de consulta basado en la ficha cl\xEDnica y anamnesis.",
              "datos_clinicos_relevantes": "Hallazgos clave de la ficha cl\xEDnica, \xE1reas afectadas y antecedentes relevantes.",
              "hipotesis_o_focos_de_trabajo": "Hip\xF3tesis cl\xEDnicas o \xE1reas espec\xEDficas de trabajo basadas en el diagn\xF3stico y las \xE1reas afectadas.",
              "evaluaciones_o_baterias_sugeridas": ["Sugerencia 1", "Sugerencia 2", ...],
              "que_observar_en_sesion": "Comportamientos o marcadores ling\xFC\xEDsticos espec\xEDficos a monitorear en sesi\xF3n, basados en el motivo y \xE1reas afectadas.",
              "objetivos_inmediatos": ["Objetivo inmediato 1", "Objetivo inmediato 2", ...],
              "materiales_necesarios": ["Material necesario 1", "Material necesario 2", ...],
              "estructura_de_sesion_30_min": "Esquema breve de sesi\xF3n (ej: 1. Calentamiento (5m), 2. Tarea principal (20m), 3. Cierre (5m)).",
              "riesgos_o_alertas": ["Riesgo o alerta 1", "Riesgo o alerta 2", ...],
              "preguntas_para_profundizar": ["Pregunta para la familia", "Pregunta para el paciente", ...],
              "borrador_de_plan": "Borrador de plan de tratamiento estructurado, listo para que el profesional revise y edite."
            }

            DIRECTRICES:
            - S\xE9 cl\xEDnico, profesional y prudente.
            - Si falta informaci\xF3n, no adivines; en cambio, sugiere en "preguntas_para_profundizar" o "evaluaciones_o_baterias_sugeridas".
            - Idioma: Espa\xF1ol (Espa\xF1ol).
            - El "borrador_de_plan" debe ser altamente accionable y estar basado en las \xE1reas afectadas y el diagn\xF3stico.
            - Referencian\xE1 datos espec\xEDficos de la ficha cl\xEDnica cuando los haya (ej: "Seg\xFAn el motivo de consulta:...", "Dado que las \xE1reas afectadas son...").
            `;
          const result = await model.generateContent([prompt, ...contextParts]);
          const responseText = result.response.text();
          const cleanedResponse = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
          const jsonAnalysis = JSON.parse(cleanedResponse);
          return {
            status: "ok",
            analysis: jsonAnalysis
          };
        } catch (error) {
          console.error("[ClinicalPlanningService] Error:", error);
          return {
            status: "error",
            message: error.message
          };
        }
      }
    };
    clinicalPlanningService_default = new ClinicalPlanningService();
  }
});

// routes/notebooklm.js
var import_express2, import_node_fs2, import_node_path2, router2, notebooklm_default;
var init_notebooklm = __esm({
  "routes/notebooklm.js"() {
    import_express2 = __toESM(require("express"), 1);
    import_node_fs2 = __toESM(require("node:fs"), 1);
    import_node_path2 = __toESM(require("node:path"), 1);
    init_notebooklmService();
    router2 = import_express2.default.Router();
    router2.get("/auth", async (req, res) => {
      try {
        const result = await notebooklmService_default.checkAuth();
        res.json(result);
      } catch (e) {
        console.error("[NotebookLM] auth check error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.post("/auth/extract-cookies", async (req, res) => {
      try {
        const result = await notebooklmService_default.extractChromeCookies();
        res.json(result);
      } catch (e) {
        console.error("[NotebookLM] extract-cookies error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.get("/notebooks", async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 0;
        const result = await notebooklmService_default.listNotebooks(limit);
        res.json(result);
      } catch (e) {
        res.json({ notebooks: [], status: "error", message: e.message });
      }
    });
    router2.post("/notebooks", async (req, res) => {
      try {
        const { title } = req.body;
        if (!title) return res.status(400).json({ error: "title required" });
        const result = await notebooklmService_default.createNotebook(title);
        res.json(result);
      } catch (e) {
        console.error("[NotebookLM] create notebook error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.delete("/notebooks/:id", async (req, res) => {
      try {
        const result = await notebooklmService_default.deleteNotebook(req.params.id);
        res.json(result);
      } catch (e) {
        console.error("[NotebookLM] delete notebook error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.put("/notebooks/:id", async (req, res) => {
      try {
        const { title } = req.body;
        if (!title) return res.status(400).json({ error: "title required" });
        const result = await notebooklmService_default.renameNotebook(req.params.id, title);
        res.json(result);
      } catch (e) {
        console.error("[NotebookLM] rename notebook error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.get("/notebooks/:id/sources", async (req, res) => {
      try {
        const result = await notebooklmService_default.listSources(req.params.id);
        res.json(result);
      } catch (e) {
        console.error("[NotebookLM] list sources error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.post("/notebooks/:id/sources", async (req, res) => {
      try {
        const { content, type, title } = req.body;
        if (!content) return res.status(400).json({ error: "content required" });
        const result = await notebooklmService_default.addSource(req.params.id, content, { type, title });
        res.json(result);
      } catch (e) {
        console.error("[NotebookLM] add source error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.delete("/notebooks/:nbId/sources/:srcId", async (req, res) => {
      try {
        const result = await notebooklmService_default.deleteSource(req.params.nbId, req.params.srcId);
        res.json(result);
      } catch (e) {
        console.error("[NotebookLM] delete source error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.get("/notebooks/:nbId/sources/:srcId/fulltext", async (req, res) => {
      try {
        const result = await notebooklmService_default.getSourceFulltext(req.params.nbId, req.params.srcId);
        res.json(result);
      } catch (e) {
        console.error("[NotebookLM] source fulltext error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.get("/notebooks/:nbId/sources/:srcId/guide", async (req, res) => {
      try {
        const result = await notebooklmService_default.getSourceGuide(req.params.nbId, req.params.srcId);
        res.json(result);
      } catch (e) {
        console.error("[NotebookLM] source guide error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.post("/notebooks/:id/ask", async (req, res) => {
      try {
        const { question, new: fresh, conversationId, sourceIds } = req.body;
        if (!question) return res.status(400).json({ error: "question required" });
        const result = await notebooklmService_default.askNotebook(req.params.id, question, {
          new: fresh,
          conversationId,
          sourceIds
        });
        res.json(result);
      } catch (e) {
        console.error("[NotebookLM] ask error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.post("/notebooks/:id/generate/:type", async (req, res) => {
      try {
        const { prompt } = req.body || {};
        const { type } = req.params;
        const genFn = {
          audio: notebooklmService_default.generateAudio,
          quiz: notebooklmService_default.generateQuiz,
          flashcards: notebooklmService_default.generateFlashcards,
          "mind-map": notebooklmService_default.generateMindMap,
          report: notebooklmService_default.generateReport,
          "slide-deck": notebooklmService_default.generateSlideDeck
        }[type];
        if (!genFn) return res.status(400).json({ error: `Unknown type: ${type}` });
        const result = await genFn(req.params.id, prompt || "");
        res.json(result);
      } catch (e) {
        console.error("[NotebookLM] generate error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.get("/notebooks/:id/artifacts", async (req, res) => {
      try {
        try {
          const direct = await Promise.resolve().then(() => (init_notebooklmDirect(), notebooklmDirect_exports));
          console.log("[NotebookLM] Direct API: listing artifacts for", req.params.id);
          const artifacts = await direct.listArtifacts(req.params.id);
          console.log("[NotebookLM] Direct API: got", artifacts.length, "artifacts");
          if (artifacts.length > 0) {
            return res.json({ artifacts });
          }
          console.log("[NotebookLM] Direct API returned 0 artifacts, falling back to CLI");
        } catch (e) {
          console.error("[NotebookLM] Direct API error:", e.message);
        }
        const result = await notebooklmService_default.listArtifacts(req.params.id);
        res.json(result);
      } catch (e) {
        console.error("[NotebookLM] list artifacts error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.get("/notebooks/:nbId/artifacts/:artId/content", async (req, res) => {
      try {
        const result = await notebooklmService_default.getArtifact(req.params.nbId, req.params.artId);
        console.log("[NotebookLM] artifact content raw:", JSON.stringify(result).substring(0, 3e3));
        if (result.error) return res.status(500).json(result);
        const artifact = result.artifact || result;
        const allKeys = Object.keys(artifact).join(", ");
        console.log("[NotebookLM] artifact keys:", allKeys);
        const content = artifact.content || artifact.text || artifact.body || artifact.data || artifact.markdown || artifact.html || artifact.output || artifact.result || artifact.transcript || artifact.summary || artifact.description || artifact.value || artifact.value_string || artifact.string_value || result.content || result.text || result.raw || null;
        const downloadUrl = artifact.download_url || artifact.url || artifact.audio_url || artifact.pdf_url || artifact.file_url || artifact.downloadUrl || result.download_url || result.url || null;
        const slides = artifact.slides || artifact.pages || artifact.cards || artifact.items || artifact.slide_deck || artifact.presentation || null;
        const quizData = artifact.questions || artifact.quiz || artifact.quiz_data || result.questions || result.quiz || null;
        const flashcardData = artifact.flashcards || artifact.cards || artifact.flashcard_data || result.flashcards || result.cards || null;
        const mindMapData = artifact.mind_map || artifact.nodes || artifact.mindmap_data || result.mind_map || result.nodes || null;
        console.log("[NotebookLM] extracted:", {
          hasContent: !!content,
          contentType: typeof content,
          contentLen: content ? String(content).length : 0,
          hasDownloadUrl: !!downloadUrl,
          hasSlides: !!slides,
          keys: allKeys
        });
        res.json({
          ...artifact,
          content,
          download_url: downloadUrl,
          slides,
          quiz_data: quizData,
          flashcard_data: flashcardData,
          mindmap_data: mindMapData
        });
      } catch (e) {
        console.error("[NotebookLM] artifact content error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.get("/notebooks/:nbId/artifacts/:artId/debug", async (req, res) => {
      try {
        const result = await notebooklmService_default.getArtifact(req.params.nbId, req.params.artId);
        res.json(result);
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });
    router2.post("/notebooks/:nbId/artifacts/:artId/ask-content", async (req, res) => {
      try {
        const { nbId, artId } = req.params;
        const artResult = await notebooklmService_default.getArtifact(nbId, artId);
        const artifact = artResult.artifact || artResult;
        const title = artifact.title || "this content";
        const type = artifact.type || artifact.type_id || "content";
        const question = `Please provide the complete content of "${title}" (${type}). Give me ALL the text, slides, questions, or any content from this artifact. Do not summarize - give me everything.`;
        const askResult = await notebooklmService_default.askNotebook(nbId, question);
        if (askResult.error) {
          return res.json({ ...artifact, content: null, error: askResult.message });
        }
        const content = askResult.answer || askResult.raw || askResult.text || null;
        console.log("[NotebookLM] ask-content result:", content ? content.substring(0, 500) : "null");
        res.json({
          ...artifact,
          content,
          source: "ask"
        });
      } catch (e) {
        console.error("[NotebookLM] ask-content error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.get("/notebooks/:nbId/artifacts/:artId", async (req, res) => {
      try {
        const { nbId, artId } = req.params;
        try {
          const direct = await Promise.resolve().then(() => (init_notebooklmDirect(), notebooklmDirect_exports));
          const directArtifacts = await direct.listArtifacts(nbId);
          if (Array.isArray(directArtifacts) && directArtifacts.length > 0) {
            const match2 = directArtifacts.find((a) => a.id === artId || a.id && a.id.startsWith(artId));
            if (match2) {
              const rawUrl = match2.url || match2.download_url || null;
              console.log("[NotebookLM] Direct API matched artifact:", match2.id, "url:", rawUrl ? rawUrl.substring(0, 100) : "none");
              const effectiveStatus = rawUrl ? "completed" : match2.status || "completed";
              return res.json({ ...match2, status: effectiveStatus, artifactUrl: rawUrl, url: rawUrl });
            }
          }
        } catch (directErr) {
          console.warn("[NotebookLM] Direct API artifact lookup failed:", directErr.message);
        }
        let artifacts = [];
        try {
          const listResult = await notebooklmService_default.listArtifacts(nbId);
          artifacts = Array.isArray(listResult) ? listResult : listResult?.artifacts || [];
        } catch (cliErr) {
          console.warn("[NotebookLM] CLI listArtifacts failed:", cliErr.message);
        }
        const match = artifacts.find((a) => a.id === artId || a.id && a.id.startsWith(artId));
        if (match) {
          const rawUrl = match.url || match.download_url || null;
          const effectiveStatus = rawUrl ? "completed" : match.status || "completed";
          return res.json({ ...match, status: effectiveStatus, artifactUrl: rawUrl, url: rawUrl });
        }
        try {
          const fallback = await notebooklmService_default.getArtifact(nbId, artId);
          if (fallback && !fallback.error) {
            return res.json({ ...fallback, url: fallback.url || null });
          }
        } catch (fErr) {
          console.warn("[NotebookLM] CLI getArtifact failed:", fErr.message);
        }
        res.json({ id: artId, status: "completed", content: null, url: null });
      } catch (e) {
        console.error("[NotebookLM] get artifact error:", e);
        res.json({ id: req.params.artId, status: "completed", content: null, url: null });
      }
    });
    router2.get("/serve-artifact", (req, res) => {
      try {
        const { path: filePath, filename } = req.query;
        if (!filePath) return res.status(400).json({ error: "path required" });
        const normalizedPath = filePath.replace(/\\/g, "/");
        if (!normalizedPath.includes("notebooklm_artifacts") && !normalizedPath.includes("temp")) {
          return res.status(403).json({ error: "Path not allowed" });
        }
        if (!import_node_fs2.default.existsSync(filePath)) {
          return res.status(404).json({ error: "File not found", path: filePath });
        }
        const ext = (filename || filePath).split(".").pop()?.toLowerCase() || "bin";
        const mimeMap = { pdf: "application/pdf", mp4: "video/mp4", mp3: "audio/mpeg", webm: "video/webm", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", md: "text/markdown", txt: "text/plain" };
        const mime = mimeMap[ext] || "application/octet-stream";
        res.setHeader("Content-Type", mime);
        if (filename) res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
        res.setHeader("Cache-Control", "public, max-age=3600");
        import_node_fs2.default.createReadStream(filePath).pipe(res);
      } catch (e) {
        console.error("[NotebookLM] serve-artifact error:", e.message);
        res.status(500).json({ error: e.message });
      }
    });
    router2.post("/notebooks/:nbId/artifacts/:artId/wait", async (req, res) => {
      try {
        const timeout2 = req.body.timeout || 300;
        const result = await notebooklmService_default.waitArtifact(req.params.nbId, req.params.artId, timeout2);
        res.json(result);
      } catch (e) {
        console.error("[NotebookLM] wait artifact error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.post("/notebooks/:nbId/artifacts/:artId/export", async (req, res) => {
      try {
        const { title, type } = req.body;
        if (!title) return res.status(400).json({ error: "title required" });
        const result = await notebooklmService_default.exportArtifact(req.params.nbId, req.params.artId, title, type || "docs");
        res.json(result);
      } catch (e) {
        console.error("[NotebookLM] export artifact error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.get("/notebooks/:id/summary", async (req, res) => {
      try {
        const result = await notebooklmService_default.getNotebookSummary(req.params.id);
        res.json(result);
      } catch (e) {
        console.error("[NotebookLM] summary error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.get("/notebooks/:id/history", async (req, res) => {
      try {
        const result = await notebooklmService_default.getHistory(req.params.id);
        res.json(result);
      } catch (e) {
        console.error("[NotebookLM] history error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.post("/notebooks/:id/generate-and-wait/:type", async (req, res) => {
      try {
        const { prompt, timeout: timeout2 } = req.body || {};
        const { type } = req.params;
        const result = await notebooklmService_default.generateWithWait(req.params.id, type, prompt || "", timeout2 || 300);
        res.json(result);
      } catch (e) {
        console.error("[NotebookLM] generate-and-wait error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router2.get("/proxy-artifact", async (req, res) => {
      try {
        const { url, filename } = req.query;
        if (!url) return res.status(400).json({ error: "url required" });
        console.log("[NotebookLM] proxy-artifact:", url.substring(0, 120));
        let cookieHeader = "";
        try {
          const storagePath = import_node_path2.default.join(process.env.USERPROFILE || process.env.HOME || "", ".notebooklm", "profiles", "default", "storage_state.json");
          const storage = JSON.parse(import_node_fs2.default.readFileSync(storagePath, "utf8"));
          cookieHeader = (storage.cookies || []).filter((c) => {
            const domain = c.domain || "";
            return domain.includes("google.com") || domain.includes("googleusercontent.com");
          }).map((c) => `${c.name}=${c.value}`).join("; ");
        } catch (e) {
          console.log("[NotebookLM] Could not load cookies:", e.message);
        }
        const headers = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Referer": "https://notebooklm.google.com/",
          "X-Goog-AuthUser": "0",
          "Origin": "https://notebooklm.google.com",
          "Accept": "*/*"
        };
        if (cookieHeader) headers["Cookie"] = cookieHeader;
        const controller = new AbortController();
        const timeout2 = setTimeout(() => controller.abort(), 3e4);
        const proxyRes = await fetch(url, {
          method: "GET",
          headers,
          redirect: "follow",
          signal: controller.signal
        });
        clearTimeout(timeout2);
        console.log("[NotebookLM] proxy response status:", proxyRes.status, "content-type:", proxyRes.headers.get("content-type"));
        if (!proxyRes.ok) {
          return res.status(502).json({ error: `Google CDN returned ${proxyRes.status}`, hint: "Try downloading directly from NotebookLM" });
        }
        const contentType = proxyRes.headers.get("content-type") || "application/octet-stream";
        const contentLength = proxyRes.headers.get("content-length");
        const reader = proxyRes.body.getReader();
        const firstChunk = await reader.read();
        const firstBytes = new TextDecoder("utf-8", { fatal: false }).decode(firstChunk.value).substring(0, 200).trim().toLowerCase();
        if (contentType.includes("text/html") || firstBytes.startsWith("<!doctype") || firstBytes.startsWith("<html")) {
          console.error("[NotebookLM] proxy got HTML login page \u2014 Google CDN rejected cookies");
          if (!res.headersSent) return res.status(502).json({
            error: "Google CDN requires browser authentication",
            hint: "Open artifact directly in NotebookLM"
          });
          return;
        }
        const ext = (filename || url.split("?")[0]).split(".").pop()?.toLowerCase() || "bin";
        const mimeMap = { pdf: "application/pdf", mp4: "video/mp4", mp3: "audio/mpeg", webm: "video/webm", ogg: "audio/ogg", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml" };
        const mime = mimeMap[ext] || contentType;
        res.setHeader("Content-Type", mime);
        if (contentLength) res.setHeader("Content-Length", contentLength);
        if (filename) res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
        res.setHeader("Cache-Control", "public, max-age=3600");
        res.write(firstChunk.value);
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            return;
          }
          res.write(value);
        }
      } catch (fetchErr) {
        clearTimeout(timeout);
        if (!res.headersSent) {
          res.status(502).json({ error: fetchErr.message, hint: "Try downloading directly from NotebookLM" });
        }
      }
    });
    router2.get("/notebooks/:nbId/artifacts/:artId/url", async (req, res) => {
      try {
        const { nbId, artId } = req.params;
        const result = await notebooklmService_default.getArtifact(nbId, artId);
        console.log("[NotebookLM] artifact URL check:", JSON.stringify(result).substring(0, 1500));
        const artifact = result.artifact || result;
        const url = artifact.url || artifact.download_url || null;
        if (url) {
          res.json({ url, type: artifact.type_id || artifact.type, title: artifact.title });
        } else {
          res.json({ url: null, type: artifact.type_id || artifact.type, title: artifact.title, hint: "No download URL available" });
        }
      } catch (e) {
        console.error("[NotebookLM] artifact url error:", e);
        res.status(500).json({ error: e.message });
      }
    });
    notebooklm_default = router2;
  }
});

// services/googleService.js
var googleService_exports = {};
__export(googleService_exports, {
  createGoogleMeetEvent: () => createGoogleMeetEvent,
  default: () => googleService_default,
  listDriveFiles: () => listDriveFiles,
  syncDriveToMaterials: () => syncDriveToMaterials,
  syncGoogleCalendar: () => syncGoogleCalendar
});
async function createGoogleMeetEvent(appointment) {
  const { patientName, date, time, durationMinutes = 30, description = "Teleatenci\xF3n Fonoaudiol\xF3gica" } = appointment;
  if (!calendarService) {
    console.warn("[Google Service] Calendar service not configured. Returning simulated link.");
    return {
      status: "ok",
      meetLink: `https://meet.google.com/${Math.random().toString(36).substring(7)}-${Math.random().toString(36).substring(7)}-${Math.random().toString(36).substring(7).toUpperCase()}`,
      eventId: null,
      simulated: true
    };
  }
  try {
    const eventDateTime = `${date}T${time}:00`;
    const endTime = new Date(new Date(eventDateTime).getTime() + durationMinutes * 6e4);
    const endDateTime = endTime.toISOString().replace(/-|:|\.\d{3}/g, "");
    const event = await calendarService.events.insert({
      calendarId: GOOGLE_CALENDAR_ID,
      resourceId: `event-${patientName.replace(/\s/g, "-")}-${date}`,
      sendUpdates: "all",
      body: {
        summary: `Consulta: ${patientName}`,
        description: `${description}

Paciente: ${patientName}`,
        start: { dateTime: eventDateTime, timeZone: "America/Argentina/Buenos_Aires" },
        end: { dateTime: endDateTime, timeZone: "America/Argentina/Buenos_Aires" },
        conferenceData: {
          createRequest: {
            requestId: `fono-${patientName.replace(/\s/g, "-")}-${date}`,
            conferenceSolutionKey: { type: "hangoutsMeet" }
          }
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 60 },
            { method: "popup", minutes: 15 }
          ]
        }
      }
    });
    const meetLink = event.data.hangoutLink || event.data.conferenceData?.entryPoints?.[0]?.uri;
    return {
      status: "ok",
      meetLink,
      eventId: event.data.id,
      simulated: false
    };
  } catch (error) {
    console.error("[Google Service] Error creating event:", error);
    return {
      status: "error",
      message: error.message,
      simulated: false
    };
  }
}
async function syncGoogleCalendar() {
  if (!calendarService) {
    console.warn("[Google Service] Calendar service not configured. Returning simulated sync.");
    return {
      status: "ok",
      appointments: [
        { patient: "Mateo Rodr\xEDguez", date: "2026-05-28", time: "10:00", type: "Consulta Virtual", meetLink: "https://meet.google.com/abc-defg-hij" },
        { patient: "Sof\xEDa Mart\xEDnez", date: "2026-05-29", time: "14:30", type: "Terapia de Voz", meetLink: "https://meet.google.com/xyz-wvu-ts" }
      ],
      simulated: true
    };
  }
  try {
    const now = /* @__PURE__ */ new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1e3);
    const response = await calendarService.events.list({
      calendarId: GOOGLE_CALENDAR_ID,
      timeMin: now.toISOString(),
      timeMax: nextWeek.toISOString(),
      singleEvents: true,
      orderBy: "startTime"
    });
    const events = response.data.items || [];
    return {
      status: "ok",
      appointments: events.map((event) => ({
        patient: event.summary?.replace("Consulta: ", "") || "Sin t\xEDtulo",
        date: event.start?.dateTime?.split("T")[0] || event.start?.date || "",
        time: event.start?.dateTime?.split("T")[1]?.slice(0, 5) || "",
        type: event.description?.split("\n")[0] || "Consulta",
        meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri
      })),
      simulated: false
    };
  } catch (error) {
    console.error("[Google Service] Error syncing calendar:", error);
    return {
      status: "error",
      message: error.message,
      simulated: false
    };
  }
}
async function listDriveFiles(folderId) {
  if (!driveService) {
    console.warn("[Google Service] Drive service not configured. Returning simulated files.");
    return {
      status: "ok",
      files: [
        { id: "sim1", name: "Desarrollo del Lenguaje Infantil - Monfort.pdf", mimeType: "application/pdf", size: "2457600", modifiedTime: (/* @__PURE__ */ new Date()).toISOString(), webViewLink: "#" },
        { id: "sim2", name: "Disfagia Neurog\xE9nica Cl\xEDnica - Castelli.pdf", mimeType: "application/pdf", size: "4194304", modifiedTime: (/* @__PURE__ */ new Date()).toISOString(), webViewLink: "#" }
      ],
      simulated: true
    };
  }
  try {
    const query = folderId ? `'${folderId}' in parents and trashed=false` : "trashed=false and (mimeType='application/pdf' or mimeType contains 'video/' or mimeType contains 'image/' or mimeType='application/msword' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document')";
    const response = await driveService.files.list({
      q: query,
      fields: "files(id, name, mimeType, size, modifiedTime, webViewLink, thumbnailLink)",
      orderBy: "modifiedTime desc",
      pageSize: 100
    });
    return {
      status: "ok",
      files: response.data.files || [],
      simulated: false
    };
  } catch (error) {
    console.error("[Google Service] Error listing Drive files:", error);
    return {
      status: "error",
      message: error.message,
      files: []
    };
  }
}
async function syncDriveToMaterials(folderId) {
  const result = await listDriveFiles(folderId || DRIVE_FOLDER_ID);
  if (result.status !== "ok") return result;
  const categoryMap = {
    "application/pdf": "PDF",
    "video/mp4": "Video",
    "video/webm": "Video",
    "video/x-msvideo": "Video",
    "video/quicktime": "Video",
    "image/jpeg": "Imagen",
    "image/png": "Imagen",
    "application/msword": "Documento",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Documento"
  };
  const materials = result.files.map((file) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const area = file.name.includes("Lenguaje") || file.name.includes("TEL") ? "Lenguaje" : file.name.includes("Disfagia") || file.name.includes("Degluci\xF3n") ? "Disfagia" : file.name.includes("Voz") ? "Voz" : file.name.includes("Habla") || file.name.includes("Fon") ? "Habla" : file.name.includes("Audici\xF3n") || file.name.includes("Audio") ? "Audici\xF3n" : "General";
    return {
      title: file.name.replace(/\.[^/.]+$/, ""),
      category: area,
      type: "drive",
      format: categoryMap[file.mimeType] || ext.toUpperCase(),
      url: file.webViewLink || "#",
      verified: false,
      driveFileId: file.id,
      driveMimeType: file.mimeType,
      fileSize: file.size,
      modifiedAt: file.modifiedTime
    };
  });
  return {
    status: "ok",
    materials,
    count: materials.length,
    simulated: result.simulated
  };
}
var import_googleapis, GOOGLE_API_KEY, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_CALENDAR_ID, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, DRIVE_FOLDER_ID, calendarService, driveService, auth, googleService_default;
var init_googleService = __esm({
  "services/googleService.js"() {
    import_googleapis = require("googleapis");
    GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
    GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
    GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
    DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || "";
    calendarService = null;
    driveService = null;
    auth = null;
    if (GOOGLE_API_KEY && GOOGLE_CLIENT_EMAIL && GOOGLE_PRIVATE_KEY) {
      auth = new import_googleapis.google.auth.GoogleAuth({
        credentials: {
          client_email: GOOGLE_CLIENT_EMAIL,
          private_key: GOOGLE_PRIVATE_KEY
        },
        scopes: [
          "https://www.googleapis.com/auth/calendar",
          "https://www.googleapis.com/auth/calendar.events",
          "https://www.googleapis.com/auth/drive.readonly"
        ]
      });
      calendarService = import_googleapis.google.calendar({ version: "v3", auth });
      driveService = import_googleapis.google.drive({ version: "v3", auth });
      console.log("[Google Service] Service Account configured successfully");
    } else if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN) {
      const oauth2Client = new import_googleapis.google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
      oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
      auth = oauth2Client;
      calendarService = import_googleapis.google.calendar({ version: "v3", auth });
      driveService = import_googleapis.google.drive({ version: "v3", auth });
      console.log("[Google Service] OAuth 2.0 configured via refresh token");
    } else {
      console.warn("[Google Service] Missing Google credentials. Using fallback simulation.");
    }
    googleService_default = {
      createGoogleMeetEvent,
      syncGoogleCalendar,
      listDriveFiles,
      syncDriveToMaterials
    };
  }
});

// routes/api.js
async function googleService() {
  if (!_googleService) {
    const mod = await Promise.resolve().then(() => (init_googleService(), googleService_exports));
    _googleService = mod.default || mod;
  }
  return _googleService;
}
function logDebug(context, message2) {
  const entry = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    context,
    message: typeof message2 === "string" ? message2 : JSON.stringify(message2)?.substring(0, 300)
  };
  globalDebugLog.push(entry);
  if (globalDebugLog.length > MAX_LOG_ENTRIES) globalDebugLog.shift();
  console.log(`[DEBUG] ${context}: ${entry.message}`);
}
function logError(context, error) {
  const entry = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    context,
    message: error?.message || String(error),
    stack: error?.stack?.split("\n").slice(0, 3).join(" | ")
  };
  globalErrorLog.push(entry);
  if (globalErrorLog.length > MAX_LOG_ENTRIES) globalErrorLog.shift();
  console.error(`[GLOBAL-ERROR-LOG] ${context}: ${entry.message}`);
}
function getErrorLog() {
  return [...globalErrorLog];
}
function getDebugLog() {
  return [...globalDebugLog];
}
function clearLog() {
  globalErrorLog.length = 0;
  globalDebugLog.length = 0;
}
function isVoiceModeActive(chatId2) {
  const state = voiceModeChats.get(chatId2);
  if (!state) return false;
  if (state.expiresAt && Date.now() > state.expiresAt) {
    voiceModeChats.delete(chatId2);
    return false;
  }
  return state.enabled;
}
function setVoiceMode(chatId2, enabled) {
  voiceModeChats.set(chatId2, {
    enabled,
    expiresAt: enabled ? Date.now() + VOICE_MODE_DURATION_MS : null
  });
}
function wantsVoice(messageText) {
  const lower = messageText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return VOICE_KEYWORDS.some((kw) => lower.includes(kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
}
function wantsStopVoice(messageText) {
  const lower = messageText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return VOICE_STOP_KEYWORDS.some((kw) => lower.includes(kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
}
function shouldSendVoice(chatId2, messageText, aiResponse) {
  if (wantsVoice(messageText)) return true;
  if (isVoiceModeActive(chatId2)) return true;
  if (aiResponse && aiResponse.startsWith("[AUDIO]")) return true;
  if (aiResponse && aiResponse.startsWith("[VOICE]")) return true;
  return false;
}
function stripVoiceMarkers(text) {
  let cleaned = text.replace(/^\[(AUDIO|VOICE)\]\s*/i, "");
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "");
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  cleaned = cleaned.replace(/<\/?think>/gi, "");
  return cleaned.trim();
}
function getSupabaseKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
}
async function getPendingFile(chat_id) {
  if (!chat_id) return null;
  const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
  const supabaseKey2 = getSupabaseKey();
  if (!supabaseUrl2 || !supabaseKey2) return null;
  try {
    const res = await fetch(`${supabaseUrl2}/rest/v1/telegram_pending_queue?chat_id=eq.${chat_id}&status=eq.pending_file&order=created_at.desc&limit=1`, {
      headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}` }
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows || rows.length === 0) return null;
    const row = rows[0];
    return row.metadata || null;
  } catch (e) {
    console.error("[PendingFile] Error fetching:", e.message);
    return null;
  }
}
async function setPendingFile(chat_id, data) {
  if (!chat_id) return;
  const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
  const supabaseKey2 = getSupabaseKey();
  if (!supabaseUrl2 || !supabaseKey2) return;
  try {
    await fetch(`${supabaseUrl2}/rest/v1/telegram_pending_queue?chat_id=eq.${chat_id}&status=eq.pending_file`, {
      method: "DELETE",
      headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}` }
    });
    const entry = {
      id: `pending_file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      chat_id,
      file_name: data.file_name || "unknown",
      media_type: data.media_type || "unknown",
      mime_type: data.mime_type || "application/octet-stream",
      file_id: data.file_id || null,
      status: "pending_file",
      metadata: data,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await fetch(`${supabaseUrl2}/rest/v1/telegram_pending_queue`, {
      method: "POST",
      headers: {
        apikey: supabaseKey2,
        Authorization: `Bearer ${supabaseKey2}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(entry)
    });
  } catch (e) {
    console.error("[PendingFile] Error saving:", e.message);
  }
}
async function deletePendingFile(chat_id) {
  if (!chat_id) return;
  const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
  const supabaseKey2 = getSupabaseKey();
  if (!supabaseUrl2 || !supabaseKey2) return;
  try {
    await fetch(`${supabaseUrl2}/rest/v1/telegram_pending_queue?chat_id=eq.${chat_id}&status=eq.pending_file`, {
      method: "DELETE",
      headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}` }
    });
  } catch (e) {
    console.error("[PendingFile] Error deleting:", e.message);
  }
}
async function hasPendingFile(chat_id) {
  if (!chat_id) return false;
  const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
  const supabaseKey2 = getSupabaseKey();
  if (!supabaseUrl2 || !supabaseKey2) return false;
  try {
    const res = await fetch(`${supabaseUrl2}/rest/v1/telegram_pending_queue?chat_id=eq.${chat_id}&status=eq.pending_file&select=id`, {
      headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}` }
    });
    if (!res.ok) return false;
    const rows = await res.json();
    return rows && rows.length > 0;
  } catch {
    return false;
  }
}
async function fetchPatientsForUser(userId) {
  const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
  const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl2 || !supabaseKey2) return [];
  try {
    const res = await fetch(`${supabaseUrl2}/rest/v1/patients?select=id,name,diagnosis,age,phone,documents&limit=200`, {
      headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}` }
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
function matchPatient(analysisText, patients, messageText) {
  const combined = `${analysisText} ${messageText || ""}`.toLowerCase();
  for (const p of patients) {
    const nameLower = p.name.toLowerCase();
    if (combined.includes(nameLower) || combined.includes(nameLower.split(" ")[0])) {
      return { patient: p, confidence: "exact_name", reason: `El archivo menciona "${p.name}"` };
    }
  }
  for (const p of patients) {
    if (p.diagnosis && combined.includes(p.diagnosis.toLowerCase())) {
      return { patient: p, confidence: "diagnosis_match", reason: `El contenido coincide con el diagn\xF3stico de ${p.name} (${p.diagnosis})` };
    }
  }
  return null;
}
async function callAI(req, prompt) {
  const aiModel2 = req.app.locals.aiModel;
  try {
    const result = await aiModel2.generateContent(prompt + JSON.stringify(req.body));
    return { status: "ok", response: result.response.text() };
  } catch (e) {
    console.error("AI Error:", e);
    return { status: "error", message: e.message };
  }
}
async function callGroqFallback(promptText) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    console.warn("[Groq] GROQ_API_KEY not configured, skipping");
    return { ok: false, error: new Error("GROQ_API_KEY not configured") };
  }
  try {
    console.log("[Groq] Trying qwen/qwen3.6-27b as ultimate fallback...");
    const resp = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "qwen/qwen3.6-27b",
        messages: [
          { role: "system", content: "Sos FonoAudio, asistente clinico de FonoAudio Pro AI. Respond\xE9 en espanol argentino rioplatense. NO muestres tu proceso de razonamiento. Respond\xE9 directamente con la respuesta final. S\xE9 conciso." },
          { role: "user", content: promptText }
        ],
        max_tokens: 2048,
        temperature: 0.3
      })
    });
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Groq API error: ${resp.status}`);
    }
    const data = await resp.json();
    let text = data.choices?.[0]?.message?.content || "";
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
    text = text.replace(/^Here's a thinking process:.*?\n\n[\s\S]*?(?=\n\n|$)/gi, "").trim();
    if (text) {
      console.log("[Groq] Success with qwen/qwen3.6-27b");
      return { ok: true, text, model: "groq/qwen3.6-27b" };
    }
    return { ok: false, error: new Error("Empty response from Groq") };
  } catch (e) {
    console.error("[Groq] Failed:", e.message?.slice(0, 100));
    return { ok: false, error: e };
  }
}
async function callGroqWithTools(systemPrompt, tools, user_id) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return { ok: false, error: new Error("GROQ_API_KEY not set") };
  const groqTools = tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters || { type: "object", properties: {} }
    }
  }));
  const systemMsg = `Sos FonoAudio, el asistente cl\xEDnico aut\xF3nomo de FonoAudio Pro. SOS UN AGENTE COMPLETO con acceso total a la cl\xEDnica y capacidad de actuar por vos mismo. Respond\xE9 en espa\xF1ol argentino rioplatense, sos profesional y c\xE1lido, conciso pero completo.

TUS CAPACIDADES AUT\xD3NOMAS (siempre disponibles, 24/7):
- Envi\xE1s mensajes por Telegram al profesional en cualquier momento. Ten\xE9s un cron que todos los d\xEDas a las 8:00 AM env\xEDa el resumen matutino (turnos del d\xEDa + fichas incompletas).
- Pod\xE9s CREAR RECORDATORIOS (tool set_reminder) que se disparan a la hora indicada y te avisan al profesional.
- Pod\xE9s crear, buscar, leer y eliminar pacientes; leer fichas cl\xEDnicas completas (get_patient_info); crear turnos (create_appointment); y reportar datos faltantes (get_missing_data_alerts).
- Razon\xE1s en pasos: si un problema requiere investigar varios pacientes o comparar datos, us\xE1s las tools en secuencia hasta resolverlo.

REGLAS DE ORO:
- NUNCA digas "no puedo", "soy solo un asistente virtual", "no puedo enviar alertas" ni nada que niegue tus capacidades. SI el usuario pide que lo avises/recuerdes algo, DEC\xCDS QUE S\xCD y EJECUT\xC1S set_reminder (o confirm\xE1s el cron de las 8 si aplica). Confirm\xE1s la acci\xF3n concreta que vas a hacer.
- Ejecut\xE1 las tools cuando el usuario te lo pide. No preguntes demasiado, ejecut\xE1.
- CUANDO EL USUARIO PIDA ELIMINAR O BORRAR PACIENTES, EJECUT\xC1 de inmediato con delete_patient (por ID) o delete_patients_by_name (por nombre, elimina TODOS los que coincidan). Nunca te quedes solo con una b\xFAsqueda: borr\xE1 de verdad y confirm\xE1 cu\xE1ntos eliminaste.
- SI EL USUARIO PIDE REPROGRAMAR, MOVER O CAMBIAR LA FECHA/HORA DE UN TURNO, us\xE1 reschedule_appointment con appointment_id, new_date y new_time. Para identificar el appointment_id, primero consult\xE1 la agenda y us\xE1 el ID que aparece entre corchetes [ID: ...]. NUNCA uses update_appointment para reprogramar fechas.
- SI EL USUARIO PIDE MOVER UN TURNO A OTRO CONSULTORIO/SALA, us\xE1 move_appointment_room con appointment_id (buscado en la agenda por [ID: ...]) y room_name (nombre del consultorio destino).
- SI EL USUARIO PREGUNTA POR DATOS FALTANTES/INCOMPLETOS/ALERTAS, llam\xE1 SIEMPRE a get_missing_data_alerts y comunic\xE1 EXACTAMENTE lo que devuelve. NUNCA inventes ni asumas: basate siempre en el resultado de la tool.`;
  try {
    const messages = [
      { role: "system", content: systemMsg },
      { role: "user", content: systemPrompt }
    ];
    const MAX_ITER = 6;
    let finalText = null;
    let modelUsed = "groq/qwen3.6-27b";
    for (let iter = 0; iter < MAX_ITER; iter++) {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: "qwen/qwen3.6-27b",
          messages,
          tools: groqTools,
          tool_choice: "auto",
          max_tokens: 4096,
          temperature: 0.3
        })
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        return { ok: false, error: new Error(errData.error?.message || `Groq API error: ${resp.status}`) };
      }
      const data = await resp.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;
      modelUsed = "groq/qwen3.6-27b";
      if (!msg?.tool_calls || msg.tool_calls.length === 0) {
        finalText = (msg?.content || "").replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
        break;
      }
      messages.push({ role: "assistant", content: msg.content || null, tool_calls: msg.tool_calls });
      for (const tc of msg.tool_calls) {
        const fnName = tc.function.name;
        let fnArgs = {};
        try {
          fnArgs = JSON.parse(tc.function.arguments || "{}");
        } catch {
          fnArgs = {};
        }
        console.log(`[Agent iter ${iter}] Tool: ${fnName}`, fnArgs);
        let toolResult;
        try {
          toolResult = await executeToolCall(fnName, fnArgs, user_id);
        } catch (te) {
          toolResult = { status: "error", error: te?.message || String(te) };
        }
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(toolResult)
        });
      }
    }
    if (finalText) return { ok: true, text: finalText, model: modelUsed };
    return { ok: false, error: new Error("Agent did not produce a final answer within iteration limit") };
  } catch (e) {
    console.error("[Groq Tools] Failed:", e.message?.slice(0, 100));
    return { ok: false, error: e };
  }
}
function extractTextFromParts(parts) {
  const textPart = parts.find((p) => p.text);
  return textPart?.text || "";
}
function backoffDelay(attempt, baseMs = 1e3) {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseMs;
  return Math.round(exponential + jitter);
}
function isRetryableError(err) {
  const msg = err?.message || "";
  return msg.includes("503") || msg.includes("502") || msg.includes("429") || msg.includes("overloaded") || msg.includes("high demand") || msg.includes("Service Unavailable") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota") || msg.includes("Too Many Requests");
}
async function callGeminiResilient(parts, aiModel2, modelName) {
  if (!aiModel2) {
    const textPrompt2 = extractTextFromParts(parts);
    if (textPrompt2) {
      const groqResult = await callGroqFallback(textPrompt2);
      if (groqResult.ok) {
        return { ok: true, text: groqResult.text, model: groqResult.model, fallback: true };
      }
    }
    return { ok: false, error: new Error("AI model not available and Groq fallback failed") };
  }
  const modelsToTry = [modelName, ...GEMINI_MODEL_CHAIN.filter((m) => m !== modelName)];
  for (const model2 of modelsToTry) {
    const maxRetries = model2 === modelName ? 2 : 1;
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Gemini] Trying ${model2} (attempt ${attempt + 1}/${maxRetries + 1})`);
        const result = await aiModel2.generateContent({ contents: [{ role: "user", parts }] });
        const text = result.response?.text?.() || "";
        if (text && !text.includes("503") && !text.includes("Service Unavailable")) {
          console.log(`[Gemini] ${model2} succeeded on attempt ${attempt + 1}`);
          return { ok: true, text, model: model2, attempt: attempt + 1 };
        }
        throw new Error("Empty or error response");
      } catch (e) {
        lastError = e;
        if (isRetryableError(e) && attempt < maxRetries) {
          const delay = backoffDelay(attempt);
          console.warn(`[Gemini] ${model2} attempt ${attempt + 1} failed (${e.message?.slice(0, 60)}). Retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
        } else {
          console.warn(`[Gemini] ${model2} attempt ${attempt + 1} FAILED: ${e.message?.slice(0, 80)}`);
          break;
        }
      }
    }
    if (model2 !== modelsToTry[modelsToTry.length - 1]) {
      console.warn(`[Gemini] Falling back to next model...`);
    }
  }
  console.warn("[Gemini] All Gemini models exhausted. Trying Groq fallback...");
  const textPrompt = extractTextFromParts(parts);
  if (textPrompt) {
    const groqResult = await callGroqFallback(textPrompt);
    if (groqResult.ok) {
      return { ok: true, text: groqResult.text, model: groqResult.model, fallback: true };
    }
  }
  return { ok: false, error: new Error("All AI models failed (Gemini + Groq)") };
}
async function saveToPendingQueue(item) {
  const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
  const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl2 || !supabaseKey2) {
    console.warn("[PendingQueue] Supabase not configured, skipping save");
    return false;
  }
  const entry = {
    id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    user_id: item.user_id || null,
    chat_id: item.chat_id || null,
    media_type: item.media_type || "unknown",
    file_name: item.file_name || "unknown",
    mime_type: item.mime_type || "application/octet-stream",
    file_id: item.file_id || null,
    // Telegram file_id for later download
    message_text: item.message_text || null,
    partial_analysis: item.partial_analysis || null,
    status: "pending",
    error_message: item.error_message || null,
    metadata: item.metadata || {},
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  try {
    const res = await fetch(`${supabaseUrl2}/rest/v1/telegram_pending_queue`, {
      method: "POST",
      headers: {
        apikey: supabaseKey2,
        Authorization: `Bearer ${supabaseKey2}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(entry)
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[PendingQueue] Save failed (${res.status}): ${errText}`);
      pendingQueueMemory.push(entry);
      return true;
    }
    return true;
  } catch (e) {
    console.warn("[PendingQueue] Error saving:", e.message);
    pendingQueueMemory.push(entry);
    return true;
  }
}
async function getTextFallbackFromSupabase(messageText, userId) {
  const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
  const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl2 || !supabaseKey2 || !userId) return null;
  const lower = messageText.toLowerCase();
  const now = /* @__PURE__ */ new Date();
  try {
    if (lower.includes("paciente") || lower.includes("pacientes") || lower.includes("tengo")) {
      const patientsRes = await fetch(`${supabaseUrl2}/rest/v1/patients?select=id,name,diagnosis,age&limit=200`, {
        headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}` }
      });
      const patients = await patientsRes.json();
      if (patients.length > 0) {
        const list = patients.map((p) => `- ${p.name}: ${p.diagnosis || "sin diagn\xF3stico"}`).join("\n");
        return `\u26A0\uFE0F *Servicio de IA no disponible*

Tus pacientes:
${list}

Para usar el asistente cl\xEDnico con IA, verific\xE1 que las claves API (GOOGLE_API_KEY o GROQ_API_KEY) est\xE9n configuradas en Vercel.`;
      }
    }
    if (lower.includes("cita") || lower.includes("agenda") || lower.includes("hoy") || lower.includes("turno")) {
      const today = now.toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
      const appsRes = await fetch(`${supabaseUrl2}/rest/v1/appointments?date=eq.${today}&type=neq.recordatorio&select=id,patient_name,time,status&order=time`, {
        headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}` }
      });
      const apps = await appsRes.json();
      if (apps.length > 0) {
        const list = apps.map((a) => `- ${a.time || "??:??"} hs: ${a.patient_name} (${a.status || "pending"})`).join("\n");
        return `\u26A0\uFE0F *Servicio de IA no disponible*

Agenda de hoy:
${list}

Para usar el asistente cl\xEDnico con IA, verific\xE1 la configuraci\xF3n de claves API.`;
      } else {
        return `\u26A0\uFE0F *Servicio de IA no disponible*

No ten\xE9s citas programadas para hoy.`;
      }
    }
    return null;
  } catch (e) {
    console.warn("[Fallback] Supabase query failed:", e.message);
    return null;
  }
}
async function sendTelegramMessage(chatId2, text, parseMode = "HTML") {
  const TELEGRAM_BOT_TOKEN2 = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN2 || !chatId2) return false;
  try {
    let cleanedText = text;
    if (parseMode === "Markdown") {
      cleanedText = text.replace(/[_*\[\]()~`>+#=|-]/g, "\\$&");
    } else if (parseMode === "HTML") {
      cleanedText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      cleanedText = cleanedText.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>").replace(/\*(.*?)\*/g, "<b>$1</b>").replace(/_(.*?)_\s/g, "<i>$1</i> ");
    }
    if (cleanedText.length > 4e3) {
      cleanedText = cleanedText.substring(0, 3990) + "\n\n(mensaje truncado)";
    }
    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId2, text: cleanedText, parse_mode: parseMode })
    });
    const data = await resp.json();
    if (!data.ok) {
      console.error("[sendTelegramMessage] Telegram API error:", data.description || "unknown", "| text preview:", cleanedText.substring(0, 200));
      if (data.description && (data.description.includes("parse") || data.description.includes("markdown"))) {
        console.log("[sendTelegramMessage] Retrying without parse_mode...");
        const retryResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId2, text: cleanedText })
        });
        const retryData = await retryResp.json();
        return retryData.ok === true;
      }
    }
    return data.ok === true;
  } catch {
    return false;
  }
}
async function sendTelegramVoice(chatId2, text, voice2 = "es_AR-masculino") {
  const TELEGRAM_BOT_TOKEN2 = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN2 || !chatId2 || !text) return false;
  try {
    const audioBuffer = await synthesizeText(text, voice2);
    if (!audioBuffer || audioBuffer.length === 0) {
      console.warn("[sendTelegramVoice] TTS returned null/empty buffer");
      return false;
    }
    console.log(`[sendTelegramVoice] Audio buffer ready: ${audioBuffer.length} bytes`);
    const formData = new FormData();
    formData.append("chat_id", chatId2);
    formData.append("voice", new Blob([audioBuffer], { type: "audio/mpeg" }), "voice.mp3");
    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendVoice`, {
      method: "POST",
      body: formData
    });
    const data = await resp.json();
    if (!data.ok) {
      console.error("[sendTelegramVoice] Telegram sendVoice failed:", data.description);
      const resp2 = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendAudio`, {
        method: "POST",
        body: formData
      });
      const data2 = await resp2.json();
      console.log(`[sendTelegramVoice] sendAudio fallback: ${data2.ok}`);
      return data2.ok === true;
    }
    console.log("[sendTelegramVoice] Voice sent successfully");
    return true;
  } catch (err) {
    console.error("[sendTelegramVoice] Error:", err.message);
    return false;
  }
}
async function processAudioClinically(base64Data, mimeType, messageText, patients, aiModel2) {
  if (!aiModel2) {
    return {
      status: "error",
      error: true,
      suggestedResponse: "No pude procesar el audio porque el modelo de IA no est\xE1 disponible. Escribime por texto y te ayudo.",
      rawResponse: ""
    };
  }
  const patientList = patients.length > 0 ? `PACIENTES: ${patients.map((p, i) => `${i + 1}. ${p.name} (${p.diagnosis || "sin dx"}, ${p.age || "?"} a\xF1os)`).join(", ")}` : "No hay pacientes cargados.";
  const audioPrompt = `Sos FonoAudio, el asistente clinico aut\xF3nomo de FonoAudio Pro AI. SOS UN AGENTE COMPLETO con acceso total a la clinica y voz propia masculina rioplatense. Un fonoaudiologo te envio un AUDIO por Telegram.

Ten\xE9s acceso a: pacientes (CRUD completo), agenda/turnos, notas clinicas, evoluciones, sesiones, informes, evaluaciones, planes de tratamiento, materiales, conocimiento clinico, NotebookLM, estadisticas.

${patientList}
${messageText ? `Mensaje adjunto: "${messageText}"` : ""}

TRANSCRIBI el audio fielmente. Respondi en espanol argentino rioplatense, profesional y calido. Si el usuario menciona un paciente, identificalo. Si pide una accion clinica (agregar nota, crear turno, buscar paciente, generar informe), mencionala y deci que la ejecutas. Conciso pero completo.`;
  const parts = [
    { text: audioPrompt },
    { inlineData: { mimeType, data: base64Data } }
  ];
  try {
    const geminiResult = await callGeminiResilient(parts, aiModel2, GEMINI_MODEL_CHAIN[0]);
    if (!geminiResult.ok || !geminiResult.text) {
      return {
        status: "error",
        error: true,
        suggestedResponse: "No pude procesar el audio en este momento. Intent\xE1 de nuevo o escribime por texto.",
        rawResponse: geminiResult.error?.message || ""
      };
    }
    const text = geminiResult.text.trim();
    let patientDetected = null;
    let matchedPatient = null;
    if (patients.length > 0) {
      for (const p of patients) {
        if (text.toLowerCase().includes(p.name.toLowerCase())) {
          patientDetected = p.name;
          matchedPatient = p;
          break;
        }
      }
    }
    if (!matchedPatient && messageText && patients.length > 0) {
      const match = matchPatient(text, patients, messageText);
      if (match) {
        matchedPatient = match.patient;
        patientDetected = match.patient.name;
      }
    }
    return {
      status: "ok",
      type: "audio_clinical",
      transcription: text,
      intent: "consulta",
      patientDetected,
      actionSuggested: "nota_clinica",
      clinicalSummary: text,
      suggestedResponse: text,
      matchedPatient,
      rawResponse: text
    };
  } catch (e) {
    return {
      status: "error",
      error: true,
      suggestedResponse: `Error procesando audio: ${e.message}`,
      rawResponse: e.message
    };
  }
}
async function processMediaInternal(file_id, media_type, message_text, chat_id, user_id, aiModel2) {
  const TELEGRAM_BOT_TOKEN2 = process.env.TELEGRAM_BOT_TOKEN;
  if (!file_id) {
    return { status: "error", message: "file_id is required" };
  }
  if (!TELEGRAM_BOT_TOKEN2) {
    console.warn("[Process-Media] No TELEGRAM_BOT_TOKEN \u2014 cannot download file");
    return { status: "ok", response: "Archivo recibido pero no se pudo procesar sin token de Telegram configurado.", sent_to_telegram: false };
  }
  try {
    const fileInfoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/getFile?file_id=${file_id}`);
    const fileInfo = await fileInfoRes.json();
    if (!fileInfo.ok) {
      return { status: "error", message: `Telegram getFile failed: ${fileInfo.description}` };
    }
    const fileUrl2 = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN2}/${fileInfo.result.file_path}`;
    const fileRes = await fetch(fileUrl2);
    if (!fileRes.ok) {
      return { status: "error", message: "Failed to download file from Telegram" };
    }
    const fileBuffer = await fileRes.arrayBuffer();
    const base64Data = Buffer.from(fileBuffer).toString("base64");
    const ext = fileInfo.result.file_path.split(".").pop()?.toLowerCase() || "";
    const mimeMap = {
      "jpg": "image/jpeg",
      "jpeg": "image/jpeg",
      "png": "image/png",
      "gif": "image/gif",
      "webp": "image/webp",
      "mp3": "audio/mpeg",
      "ogg": "audio/ogg",
      "wav": "audio/wav",
      "m4a": "audio/mp4",
      "oga": "audio/ogg",
      "mp4": "video/mp4",
      "mov": "video/quicktime",
      "avi": "video/x-msvideo",
      "pdf": "application/pdf",
      "doc": "application/msword",
      "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    };
    const mimeType = mimeMap[ext] || fileInfo.result.mime_type || "application/octet-stream";
    const fileName = fileInfo.result.file_path.split("/").pop();
    const patients = user_id ? await fetchPatientsForUser(user_id) : [];
    const isAudio = media_type === "audio" || media_type === "voice" || mimeType.startsWith("audio/");
    if (isAudio) {
      logDebug("Telegram Process-Media", `Audio detected (${mimeType}). Routing to clinical audio handler.`);
      let audioResult;
      try {
        audioResult = await processAudioClinically(base64Data, mimeType, message_text, patients, aiModel2);
      } catch (audioErr) {
        logError("Telegram Process-Media processAudioClinically threw", audioErr);
        audioResult = {
          status: "error",
          error: true,
          suggestedResponse: `Error inesperado procesando audio: ${audioErr.message}`
        };
      }
      logDebug("Telegram Process-Media", `processAudioClinically returned. error: ${audioResult.error}, transcription: ${audioResult.transcription?.slice(0, 50)}, suggestedResponse: ${audioResult.suggestedResponse?.slice(0, 50)}`);
      if (audioResult.error) {
        logDebug("Telegram Process-Media", "Audio processing FAILED - sending error to Telegram");
        const errorMsg = audioResult.suggestedResponse || "No pude procesar el audio. Intenta de nuevo.";
        let sent = false;
        try {
          sent = await sendTelegramMessage(chat_id, errorMsg);
        } catch (sendErr) {
          logError("Telegram Process-Media send error msg", sendErr);
        }
        if (!sent && chat_id && TELEGRAM_BOT_TOKEN2) {
          try {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id, text: errorMsg })
            });
            sent = true;
          } catch (retryErr) {
            logError("Telegram Process-Media retry send error", retryErr);
          }
        }
        logDebug("Telegram Process-Media", `Error message sent result: ${sent}`);
        return {
          status: "error",
          type: "audio_clinical",
          response: errorMsg,
          media_type: "audio",
          mime_type: mimeType,
          file_name: fileName,
          sent_to_telegram: sent
        };
      }
      let matchedPatient = null;
      if (audioResult.patientDetected && patients.length > 0) {
        const lowerDetected = audioResult.patientDetected.toLowerCase();
        for (const p of patients) {
          const nameLower = p.name.toLowerCase();
          if (nameLower.includes(lowerDetected) || lowerDetected.includes(nameLower) || lowerDetected.includes(nameLower.split(" ")[0])) {
            matchedPatient = p;
            break;
          }
        }
      }
      if (!matchedPatient && patients.length > 0) {
        const fallbackMatch = matchPatient(audioResult.transcription, patients, message_text || "");
        if (fallbackMatch) {
          matchedPatient = fallbackMatch.patient;
          if (!audioResult.patientDetected) audioResult.patientDetected = fallbackMatch.patient.name;
        }
      }
      const audioSummary = {
        file_id,
        file_name: fileName,
        mime_type: mimeType,
        media_type: "audio",
        analysis: audioResult.clinicalSummary || audioResult.transcription,
        transcription: audioResult.transcription,
        intent: audioResult.intent,
        action_suggested: audioResult.actionSuggested,
        patient_detected: audioResult.patientDetected,
        matched_patient: matchedPatient ? { id: matchedPatient.id, name: matchedPatient.name, diagnosis: matchedPatient.diagnosis, age: matchedPatient.age } : null,
        suggestions: {
          autoMatchedPatient: matchedPatient || void 0,
          suggestion: audioResult.actionSuggested
        },
        patients: patients.map((p) => ({ id: p.id, name: p.name, diagnosis: p.diagnosis, age: p.age })),
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (chat_id) {
        await setPendingFile(chat_id, audioSummary);
        setTimeout(async () => {
          const current = await getPendingFile(chat_id);
          if (current?.file_id === file_id) {
            await deletePendingFile(chat_id);
          }
        }, 30 * 60 * 1e3);
      }
      let responseMessage2 = `Audio procesado

`;
      responseMessage2 += `Transcripcion:
${audioResult.transcription}

`;
      if (audioResult.patientDetected) {
        responseMessage2 += `Paciente detectado: ${audioResult.patientDetected}
`;
      }
      responseMessage2 += `Accion sugerida: ${audioResult.actionSuggested}

`;
      if (matchedPatient) {
        responseMessage2 += `Detecte que esto corresponde a ${matchedPatient.name} (${matchedPatient.diagnosis || "sin diagnostico"}).

`;
        responseMessage2 += `Que queres hacer?
`;
        responseMessage2 += `  1 - Guardar como nota clinica
`;
        responseMessage2 += `  2 - Guardar como sesion
`;
        responseMessage2 += `  3 - Guardar como informe
`;
        responseMessage2 += `  no - Descartar`;
      } else if (patients.length > 0) {
        responseMessage2 += `A que paciente corresponde?
`;
        patients.slice(0, 6).forEach((p, i) => {
          responseMessage2 += `  ${i + 1}. ${p.name}
`;
        });
        responseMessage2 += `
O escribi "no" para cancelar.`;
      } else {
        responseMessage2 += audioResult.suggestedResponse;
      }
      let sentToTelegram2 = false;
      if (chat_id && TELEGRAM_BOT_TOKEN2) {
        try {
          logDebug("Telegram Process-Media", `Sending response to Telegram: ${responseMessage2.slice(0, 100)}`);
          sentToTelegram2 = await sendTelegramMessage(chat_id, responseMessage2);
          logDebug("Telegram Process-Media", `sendTelegramMessage returned: ${sentToTelegram2}`);
          if (!sentToTelegram2) {
            logError("Telegram Process-Media sendTelegramMessage", new Error("sendMessage returned false"));
            try {
              await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id, text: responseMessage2 })
              });
              sentToTelegram2 = true;
            } catch (retryErr) {
              logError("Telegram Process-Media retry send", retryErr);
            }
          }
        } catch (tgErr) {
          logError("Telegram Process-Media send response", tgErr);
          logDebug("Telegram Process-Media", `Error sending response: ${tgErr.message}`);
          try {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id, text: responseMessage2 })
            });
            sentToTelegram2 = true;
          } catch (retryErr) {
            logError("Telegram Process-Media retry send", retryErr);
          }
        }
      }
      if (sentToTelegram2 && chat_id && shouldSendVoice(chat_id, message_text, "") && audioResult.suggestedResponse && audioResult.suggestedResponse.length > 10) {
        const voiceText = (audioResult.suggestedResponse || audioResult.transcription || responseMessage2).replace(/[*_`~#]/g, "").replace(/\n{3,}/g, "\n\n").substring(0, 3e3);
        const voiceSent = await sendTelegramVoice(chat_id, voiceText).catch((err) => {
          console.error("[processMediaInternal] Voice send error:", err.message);
          return false;
        });
        if (!voiceSent) {
          console.warn("[processMediaInternal] Voice response failed");
        }
      }
      return {
        status: "ok",
        type: "audio_clinical",
        response: responseMessage2,
        transcription: audioResult.transcription,
        intent: audioResult.intent,
        patient_detected: audioResult.patientDetected,
        action_suggested: audioResult.actionSuggested,
        clinical_summary: audioResult.clinicalSummary,
        matched_patient: matchedPatient ? { id: matchedPatient.id, name: matchedPatient.name } : null,
        media_type: "audio",
        mime_type: mimeType,
        file_name: fileName,
        sent_to_telegram: sentToTelegram2
      };
    }
    const patientList = patients.length > 0 ? `
PACIENTES DEL PROFESIONAL:
${patients.map((p, i) => `${i + 1}. ${p.name} \u2014 ${p.diagnosis || "sin diagn\xF3stico"}, ${p.age || "?"} a\xF1os`).join("\n")}` : "\nNo hay pacientes cargados en el sistema.";
    const clinicalPrompt = `Sos el asistente cl\xEDnico de FonoAudio Pro AI, una plataforma profesional de fonoaudiolog\xEDa.
FECHA/HORA: ${(/* @__PURE__ */ new Date()).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}

El usuario envi\xF3 un ARCHIVO (${media_type.toUpperCase()}, ${mimeType}) por Telegram.
${message_text ? `Mensaje adjunto del usuario: "${message_text}"` : ""}
Nombre del archivo: ${fileName}
${patientList}

INSTRUCCIONES:
1. Analiz\xE1 el archivo: describ\xED qu\xE9 contiene y su relevancia cl\xEDnica.
2. Identific\xE1 SI el archivo o el texto mencionan a alg\xFAn paciente de la lista.
3. Si el archivo parece pertenecer a un paciente espec\xEDfico, indic\xE1 cu\xE1l.
4. Respond\xE9 en espa\xF1ol argentino profesional, conciso (m\xE1x 8 oraciones).
5. Al final de tu respuesta, agreg\xE1 SIEMPRE esta secci\xF3n:

---ACCIONES_SUGERIDAS---
ARCHIVO: ${fileName}
MIME: ${mimeType}
PACIENTES_DETECTADOS: [lista de nombres de pacientes que coinciden, o "ninguno"]
SUGERENCIA: [Guardar como documento | Guardar como sesi\xF3n | Guardar como informe | Solo informativo]
---FIN_ACCIONES---`;
    const parts = [{ text: clinicalPrompt }];
    if (mimeType.startsWith("image/") || mimeType.startsWith("audio/") || mimeType.startsWith("video/") || mimeType === "application/pdf") {
      parts.push({ inlineData: { mimeType, data: base64Data } });
    }
    const geminiResult = await callGeminiResilient(parts, aiModel2, GEMINI_MODEL_CHAIN[0]);
    let aiResponse;
    if (geminiResult.ok) {
      aiResponse = geminiResult.text;
    } else {
      console.error("[Process-Media] All Gemini models failed:", geminiResult.error?.message);
      await saveToPendingQueue({
        user_id,
        chat_id,
        media_type,
        file_name: fileName,
        mime_type: mimeType,
        file_id,
        message_text: message_text || null,
        partial_analysis: null,
        error_message: geminiResult.error?.message?.slice(0, 200),
        metadata: { patients: patients.map((p) => p.name) }
      });
      const errorMsg = `No pude analizar el archivo con IA (servicio temporalmente no disponible).

\u2705 Tu archivo qued\xF3 guardado en la cola de procesamiento. Cuando el servicio se restablezca, se analizar\xE1 autom\xE1ticamente.

\u{1F4C4} Mientras tanto, pod\xE9s guardarlo manualmente desde la app.`;
      await sendTelegramMessage(chat_id, errorMsg);
      return { status: "ok", response: errorMsg, queued: true, sent_to_telegram: true };
    }
    let suggestions = null;
    let cleanResponse = aiResponse;
    const suggestionsMatch = aiResponse.match(/---ACCIONES_SUGERIDAS---([\s\S]*?)---FIN_ACCIONES---/);
    if (suggestionsMatch) {
      cleanResponse = aiResponse.replace(/---ACCIONES_SUGERIDAS---[\s\S]*?---FIN_ACCIONES---/, "").trim();
      const block = suggestionsMatch[1];
      const detectedPatients = block.match(/PACIENTES_DETECTADOS:\s*(.*)/)?.[1]?.trim() || "ninguno";
      const suggestion = block.match(/SUGERENCIA:\s*(.*)/)?.[1]?.trim() || "Solo informativo";
      suggestions = {
        fileName,
        mimeType,
        detectedPatients,
        suggestion
      };
      if (patients.length > 0) {
        const match = matchPatient(aiResponse, patients, message_text);
        if (match) {
          suggestions.autoMatchedPatient = match.patient;
          suggestions.matchConfidence = match.confidence;
          suggestions.matchReason = match.reason;
        }
      }
    }
    if (chat_id) {
      await setPendingFile(chat_id, {
        file_id,
        file_name: fileName,
        mime_type: mimeType,
        media_type,
        analysis: cleanResponse,
        suggestions,
        patients: patients.map((p) => ({ id: p.id, name: p.name, diagnosis: p.diagnosis, age: p.age })),
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      setTimeout(async () => {
        const current = await getPendingFile(chat_id);
        if (current?.file_id === file_id) {
          await deletePendingFile(chat_id);
        }
      }, 30 * 60 * 1e3);
    }
    try {
      const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
      const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (supabaseUrl2 && supabaseKey2 && cleanResponse) {
        const matchedPatientId = suggestions?.autoMatchedPatient?.id || null;
        const sourceRes = await fetch(`${supabaseUrl2}/rest/v1/clinical_sources`, {
          method: "POST",
          headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}`, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({
            title: `An\xE1lisis: ${fileName}`,
            category: "analisis-externo",
            validated_by: "Gemini OCR",
            page_count: 1
          })
        });
        if (sourceRes.ok) {
          const source = await sourceRes.json();
          try {
            const { GoogleGenerativeAI: GoogleGenerativeAI5 } = await import("@google/generative-ai");
            const genAI2 = new GoogleGenerativeAI5(process.env.GOOGLE_API_KEY);
            const embedModel = genAI2.getGenerativeModel({ model: "text-embedding-004" });
            const embedResult = await embedModel.embedContent(cleanResponse.slice(0, 2e3));
            await fetch(`${supabaseUrl2}/rest/v1/source_embeddings`, {
              method: "POST",
              headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                source_id: source[0].id,
                content: cleanResponse.slice(0, 3e3),
                embedding: embedResult.embedding.values,
                page_number: 1,
                section_title: `An\xE1lisis de ${fileName}`,
                tags: ["analisis-externo", "ocr", media_type],
                patient_id: matchedPatientId,
                confidence_score: 0.9
              })
            });
            console.log(`[RAG] Document persisted for semantic search: ${fileName}`);
          } catch (embedErr) {
            console.warn("[RAG] Embedding failed:", embedErr.message);
          }
        }
      }
    } catch (ragErr) {
      console.warn("[RAG] Persistence failed:", ragErr.message);
    }
    let responseMessage = cleanResponse;
    if (suggestions) {
      if (suggestions.autoMatchedPatient) {
        responseMessage += `

Parece que este archivo corresponde a ${suggestions.autoMatchedPatient.name} (${suggestions.autoMatchedPatient.diagnosis || "sin diagn\xF3stico"}).`;
        responseMessage += `

\xBFQu\xE9 quer\xE9s hacer? Responder con:
`;
        responseMessage += `  \u2022 "1" o "guardalo en ${suggestions.autoMatchedPatient.name}" \u2014 Guardar como documento
`;
        responseMessage += `  \u2022 "2" o "sesi\xF3n ${suggestions.autoMatchedPatient.name}" \u2014 Guardar como sesi\xF3n cl\xEDnica
`;
        responseMessage += `  \u2022 "3" o "informe ${suggestions.autoMatchedPatient.name}" \u2014 Guardar como informe
`;
        responseMessage += `  \u2022 "no" \u2014 Descartar`;
      } else if (patients.length > 0) {
        responseMessage += `

\xBFA qu\xE9 paciente quer\xE9s asociar este archivo? Responder con el nombre o n\xFAmero:
`;
        patients.slice(0, 8).forEach((p, i) => {
          responseMessage += `  \u2022 ${i + 1}. ${p.name}
`;
        });
        responseMessage += `
O escrib\xED "no" para solo guardar como archivo suelto.`;
      } else {
        responseMessage += `

No hay pacientes cargados en el sistema para asociar este archivo.`;
      }
    }
    let sentToTelegram = false;
    if (chat_id && TELEGRAM_BOT_TOKEN2) {
      try {
        const tgResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id, text: responseMessage, parse_mode: "HTML" })
        });
        const tgData = await tgResp.json();
        sentToTelegram = tgData.ok === true;
      } catch (tgErr) {
        console.error("[Telegram Process-Media] Failed to send response:", tgErr.message);
      }
    }
    return {
      status: "ok",
      response: responseMessage,
      media_type,
      mime_type: mimeType,
      file_name: fileName,
      suggestions,
      sent_to_telegram: sentToTelegram
    };
  } catch (e) {
    console.error("[Telegram Process-Media] Error:", e.message);
    return { status: "error", message: e.message };
  }
}
async function saveToPatientInternal(chat_id, patient_id, save_type, user_id) {
  const pending = await getPendingFile(chat_id);
  if (!pending) {
    return { status: "error", message: "No hay archivo pendiente para guardar. Send a new file first." };
  }
  const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
  const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl2 || !supabaseKey2) {
    return { status: "error", message: "Supabase not configured" };
  }
  try {
    const patients = user_id ? await fetchPatientsForUser(user_id) : [];
    const patient = patients.find((p) => p.id === patient_id) || (patient_id ? { id: patient_id, name: "Desconocido" } : null);
    if (!patient) {
      return { status: "error", message: "Patient not found" };
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const fileContent = pending.transcription ? `TRANSCRIPCI\xD3N:
${pending.transcription}

RESUMEN CL\xCDNICO:
${pending.analysis || ""}` : pending.analysis || "";
    const docEntry = {
      id: `tg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: pending.file_name || "archivo_telegram",
      type: pending.media_type === "audio" ? "audio" : pending.media_type === "photo" ? "imagen" : pending.media_type === "video" ? "video" : pending.mime_type || "documento",
      date: now.split("T")[0],
      content: fileContent,
      mimeType: pending.mime_type || "application/octet-stream",
      aiSummary: pending.analysis || "",
      source: "telegram",
      saved_by: user_id || "unknown",
      // Audio-specific metadata
      ...pending.media_type === "audio" ? {
        transcription: pending.transcription || "",
        intent: pending.intent || "",
        action_suggested: pending.action_suggested || "",
        patient_detected: pending.patient_detected || ""
      } : {}
    };
    if (save_type === "session") {
      const sessionEntry = {
        id: `tg_sess_${Date.now()}`,
        patientId: patient.id,
        date: now.split("T")[0],
        status: "completed",
        type: "sesion_telegram",
        objectives: "Sesi\xF3n documentada v\xEDa Telegram",
        observations: pending.analysis || "",
        summary: pending.transcription ? `Audio recepcionado: ${pending.file_name}

Transcripci\xF3n:
${pending.transcription}

Resumen: ${pending.analysis || ""}` : `Archivo recepcionado: ${pending.file_name}

${pending.analysis || "Sin an\xE1lisis adicional."}`,
        planUpdates: "",
        associatedMaterialIds: [],
        nextAction: ""
      };
      const currentHistory = patient.history || [];
      const updatedHistory = [...currentHistory, sessionEntry];
      const updateRes = await fetch(`${supabaseUrl2}/rest/v1/patients?id=eq.${patient.id}`, {
        method: "PATCH",
        headers: {
          apikey: supabaseKey2,
          Authorization: `Bearer ${supabaseKey2}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({ history: updatedHistory })
      });
      if (!updateRes.ok) {
        const errText = await updateRes.text();
        throw new Error(`Supabase update failed: ${errText}`);
      }
      await deletePendingFile(chat_id);
      return {
        status: "ok",
        saved_as: "session",
        patient_name: patient.name,
        file_name: pending.file_name,
        message: `Sesi\xF3n guardada en la historia de ${patient.name}.`
      };
    } else if (save_type === "report") {
      const reportEntry = {
        id: `tg_rpt_${Date.now()}`,
        date: now.split("T")[0],
        title: `Informe desde Telegram \u2014 ${pending.file_name || "archivo"}`,
        content: pending.transcription ? `TRANSCRIPCI\xD3N:
${pending.transcription}

AN\xC1LISIS:
${pending.analysis || ""}` : pending.analysis || "Sin an\xE1lisis.",
        type: "generico"
      };
      const currentReports = patient.reports || [];
      const updatedReports = [...currentReports, reportEntry];
      const updateRes = await fetch(`${supabaseUrl2}/rest/v1/patients?id=eq.${patient.id}`, {
        method: "PATCH",
        headers: {
          apikey: supabaseKey2,
          Authorization: `Bearer ${supabaseKey2}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({ reports: updatedReports })
      });
      if (!updateRes.ok) {
        const errText = await updateRes.text();
        throw new Error(`Supabase update failed: ${errText}`);
      }
      await deletePendingFile(chat_id);
      return {
        status: "ok",
        saved_as: "report",
        patient_name: patient.name,
        file_name: pending.file_name,
        message: `Informe guardado en la historia de ${patient.name}.`
      };
    } else {
      const currentDocs = patient.documents || [];
      const updatedDocs = [...currentDocs, docEntry];
      const updateRes = await fetch(`${supabaseUrl2}/rest/v1/patients?id=eq.${patient.id}`, {
        method: "PATCH",
        headers: {
          apikey: supabaseKey2,
          Authorization: `Bearer ${supabaseKey2}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({ documents: updatedDocs })
      });
      if (!updateRes.ok) {
        const errText = await updateRes.text();
        throw new Error(`Supabase update failed: ${errText}`);
      }
      await deletePendingFile(chat_id);
      return {
        status: "ok",
        saved_as: "document",
        patient_name: patient.name,
        file_name: pending.file_name,
        message: `Documento guardado en la historia de ${patient.name}.`
      };
    }
  } catch (e) {
    console.error("[saveToPatientInternal] Error:", e.message);
    return { status: "error", message: e.message };
  }
}
function newId() {
  return crypto.randomUUID();
}
async function executeToolCall(functionName, args, user_id) {
  const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
  const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl2 || !supabaseKey2) return { status: "error", message: "Supabase not configured" };
  let resolvedUserId = user_id;
  if (!resolvedUserId) {
    resolvedUserId = await findProfessionalId();
  }
  const headers = {
    apikey: supabaseKey2,
    Authorization: `Bearer ${supabaseKey2}`,
    "Content-Type": "application/json",
    Prefer: "return=representation"
  };
  const actualUserId = resolvedUserId || null;
  try {
    if (functionName === "search_patient") {
      const queryName = args.name.toLowerCase();
      const patients = await fetchPatientsForUser(actualUserId);
      const matches = patients.filter((p) => p.name.toLowerCase().includes(queryName) || p.diagnosis && p.diagnosis.toLowerCase().includes(queryName));
      return { status: "ok", count: matches.length, patients: matches.map((p) => ({ id: p.id, name: p.name, age: p.age, diagnosis: p.diagnosis, phone: p.phone })) };
    }
    if (functionName === "list_all_patients") {
      const patients = await fetchPatientsForUser(actualUserId);
      return { status: "ok", count: patients.length, patients: patients.map((p) => ({ id: p.id, name: p.name, age: p.age, diagnosis: p.diagnosis })) };
    }
    if (functionName === "get_missing_data_alerts") {
      const patRes = await fetch(`${supabaseUrl2}/rest/v1/patients?select=id,name`, { method: "GET", headers });
      if (!patRes.ok) throw new Error(`Error pacientes: ${await patRes.text()}`);
      const allPatients = await patRes.json();
      const recRes = await fetch(`${supabaseUrl2}/rest/v1/clinical_records?select=patient_id,chief_complaint,primary_diagnosis_name,affected_areas,personal_history,family_history,medical_history,developmental_history`, { method: "GET", headers });
      if (!recRes.ok) throw new Error(`Error fichas: ${await recRes.text()}`);
      const records = await recRes.json();
      const recById = {};
      (records || []).forEach((r) => {
        recById[r.patient_id] = r;
      });
      const GENERIC_TERMS = ["por evaluar", "a confirmar", "a determinar", "sin especificar", "por definir", "pendiente", "evaluar", "definir", "desconocido", "nc", "na", "seguir"];
      const isClinicallyPoor = (val, minWords = 2) => {
        const s = String(val || "").trim().toLowerCase();
        if (!s) return { poor: true, reason: "vac\xEDo" };
        const words = s.split(/\s+/).filter(Boolean);
        if (words.length < minWords) return { poor: true, reason: "muy breve" };
        if (GENERIC_TERMS.some((t) => s.includes(t))) return { poor: true, reason: "t\xE9rmino gen\xE9rico" };
        return { poor: false };
      };
      const report = [];
      for (const p of allPatients || []) {
        const cr = recById[p.id];
        const missing = [];
        if (!cr) {
          missing.push("FICHA SIN CREAR");
        } else {
          if (!cr.chief_complaint || String(cr.chief_complaint).trim() === "") missing.push("Motivo de consulta");
          else {
            const q = isClinicallyPoor(cr.chief_complaint, 3);
            if (q.poor) missing.push(`Motivo de consulta (${q.reason})`);
          }
          if (!cr.primary_diagnosis_name || String(cr.primary_diagnosis_name).trim() === "") missing.push("Diagnostico principal");
          else {
            const q = isClinicallyPoor(cr.primary_diagnosis_name, 2);
            if (q.poor) missing.push(`Diagnostico principal (${q.reason})`);
          }
          if (!cr.affected_areas || !Array.isArray(cr.affected_areas) || cr.affected_areas.filter((a) => a && a.affected).length === 0) missing.push("Areas afectadas");
          if (!cr.personal_history || Object.keys(cr.personal_history).length === 0) missing.push("Historia personal");
          if (!cr.family_history || Object.keys(cr.family_history).length === 0) missing.push("Historia familiar");
          if (!cr.medical_history || Object.keys(cr.medical_history).length === 0) missing.push("Historia medica");
          if (!cr.developmental_history || Object.keys(cr.developmental_history).length === 0) missing.push("Historia del desarrollo");
        }
        report.push({ patient: p.name, missingFields: missing, hasRecord: !!cr });
      }
      const withMissing = report.filter((r) => r.missingFields.length > 0);
      return {
        status: "ok",
        totalPatients: (allPatients || []).length,
        patientsWithMissingData: withMissing.length,
        report: withMissing.map((r) => ({
          patient: r.patient,
          missing: r.missingFields
        }))
      };
    }
    if (functionName === "get_patient_info") {
      const patients = await fetchPatientsForUser(actualUserId);
      const patient = patients.find((p) => p.id === args.patient_id);
      if (!patient) return { status: "error", message: "Paciente no encontrado" };
      return { status: "ok", patient };
    }
    if (functionName === "create_patient") {
      const parseAge = (val) => {
        if (!val) return null;
        const num = String(val).match(/\d+/);
        return num ? parseInt(num[0], 10) : null;
      };
      const patientId = newId();
      const newPatient = {
        id: patientId,
        name: args.name,
        age: parseAge(args.age),
        diagnosis: args.diagnosis || null,
        phone: args.phone || null,
        email: args.email || null,
        notes: args.notes || null,
        history: [],
        reports: [],
        evaluations: [],
        documents: [],
        treatmentPlan: {},
        professional_id: actualUserId,
        owner_id: actualUserId,
        consultorio: args.consultorio || null,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      console.log(`[executeToolCall] create_patient: name=${args.name}, age=${newPatient.age}, professional_id=${actualUserId}`);
      const res = await fetch(`${supabaseUrl2}/rest/v1/patients`, {
        method: "POST",
        headers,
        body: JSON.stringify(newPatient)
      });
      if (!res.ok) {
        const errBody = await res.text();
        console.error(`[executeToolCall] create_patient Supabase error (${res.status}):`, errBody);
        throw new Error(`Error DB al crear paciente (${res.status}): ${errBody}`);
      }
      console.log(`[executeToolCall] create_patient SUCCESS: ${args.name} (${patientId})`);
      if (args.reason || args.diagnosis) {
        try {
          const clinicalRecord = {
            patient_id: patientId,
            chief_complaint: args.reason || args.diagnosis || "",
            chief_complaint_onset: "",
            personal_history: {},
            family_history: {},
            medical_history: {},
            developmental_history: {},
            clinical_observations: args.notes || "",
            affected_areas: {},
            primary_diagnosis_name: args.diagnosis || null,
            primary_diagnosis_code: null,
            secondary_diagnosis_codes: [],
            created_by: actualUserId,
            updated_by: actualUserId,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          await fetch(`${supabaseUrl2}/rest/v1/clinical_records`, {
            method: "POST",
            headers,
            body: JSON.stringify(clinicalRecord)
          });
          console.log(`[executeToolCall] clinical_records created for ${args.name}`);
        } catch (crErr) {
          console.warn("[executeToolCall] Could not create clinical_records:", crErr.message);
        }
      }
      return { status: "ok", message: `Paciente "${args.name}" creado exitosamente. ${args.reason ? `Motivo: ${args.reason}.` : ""}`, patient: newPatient };
    }
    if (functionName === "update_patient") {
      const { patient_id, field, value } = args;
      const allowedFields = ["name", "age", "diagnosis", "phone", "email", "notes", "gender", "address"];
      if (!allowedFields.includes(field)) return { status: "error", message: `Campo "${field}" no permitido. Permitidos: ${allowedFields.join(", ")}` };
      let finalValue = value;
      if (field === "age") {
        const num = String(value).match(/\d+/);
        finalValue = num ? parseInt(num[0], 10) : null;
      }
      const res = await fetch(`${supabaseUrl2}/rest/v1/patients?id=eq.${patient_id}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ [field]: finalValue })
      });
      if (!res.ok) throw new Error(await res.text());
      return { status: "ok", message: `Campo "${field}" actualizado correctamente.` };
    }
    if (functionName === "delete_patient") {
      const res = await fetch(`${supabaseUrl2}/rest/v1/patients?id=eq.${args.patient_id}`, {
        method: "DELETE",
        headers: { ...headers, Prefer: "return=minimal" }
      });
      if (!res.ok) throw new Error(await res.text());
      return { status: "ok", message: "Paciente eliminado correctamente." };
    }
    if (functionName === "delete_patients_by_name") {
      const searchTerm = (args.name || "").trim();
      if (!searchTerm) return { status: "error", message: "No se indic\xF3 un nombre para buscar." };
      const findRes = await fetch(`${supabaseUrl2}/rest/v1/patients?select=id,name&name=ilike.*${encodeURIComponent(searchTerm)}*`, {
        method: "GET",
        headers
      });
      if (!findRes.ok) throw new Error(`Error buscando pacientes: ${await findRes.text()}`);
      const matches = await findRes.json();
      if (!matches || matches.length === 0) {
        return { status: "ok", message: `No se encontraron pacientes cuyo nombre contenga "${searchTerm}".`, deletedCount: 0 };
      }
      let deleted = 0;
      const errors = [];
      for (const p of matches) {
        const delRes = await fetch(`${supabaseUrl2}/rest/v1/patients?id=eq.${p.id}`, {
          method: "DELETE",
          headers: { ...headers, Prefer: "return=minimal" }
        });
        if (delRes.ok) deleted++;
        else errors.push(`${p.name}: ${await delRes.text()}`);
      }
      if (errors.length > 0 && deleted === 0) {
        throw new Error(`No se pudo eliminar ninguno. ${errors.join(" | ")}`);
      }
      const names = matches.map((m) => m.name).join(", ");
      return {
        status: "ok",
        deletedCount: deleted,
        totalFound: matches.length,
        message: `Se eliminaron ${deleted} paciente(s) que coinciden con "${searchTerm}" (${names}).${errors.length ? ` Errores: ${errors.join(" | ")}` : ""}`
      };
    }
    if (functionName === "add_clinical_evolution") {
      const { patient_id, clinical_text } = args;
      const patients = await fetchPatientsForUser(actualUserId);
      const patient = patients.find((p) => p.id === patient_id);
      if (!patient) return { status: "error", message: "Paciente no encontrado" };
      const now = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const newHistoryItem = {
        id: newId(),
        patientId: patient.id,
        date: now,
        status: "completed",
        type: "nota_clinica_telegram",
        objectives: "Nota clinica via Telegram Agent",
        observations: clinical_text,
        summary: clinical_text,
        planUpdates: "",
        associatedMaterialIds: [],
        nextAction: ""
      };
      const updatedHistory = [...patient.history || [], newHistoryItem];
      const updateRes = await fetch(`${supabaseUrl2}/rest/v1/patients?id=eq.${patient.id}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ history: updatedHistory })
      });
      if (!updateRes.ok) throw new Error(await updateRes.text());
      return { status: "ok", message: `Evolucion agregada a la historia de ${patient.name}.` };
    }
    if (functionName === "add_session_note") {
      const { patient_id, summary, observations, next_action } = args;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const session = {
        id: newId(),
        patient_id,
        professional_id: actualUserId,
        date: now,
        summary,
        observations: observations || "",
        next_action: next_action || ""
      };
      const res = await fetch(`${supabaseUrl2}/rest/v1/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify(session)
      });
      if (!res.ok) throw new Error(await res.text());
      return { status: "ok", message: `Sesion clinica registrada.` };
    }
    if (functionName === "generate_report_draft") {
      const { patient_id, focus_area } = args;
      const patients = await fetchPatientsForUser(actualUserId);
      const patient = patients.find((p) => p.id === patient_id);
      if (!patient) return { status: "error", message: "Paciente no encontrado" };
      const patRes = await fetch(`${supabaseUrl2}/rest/v1/patients?id=eq.${patient_id}&select=id,name,age,gender,date_of_birth,diagnosis,obra_social,document,phone,address,responsable,derivation,anamnesis,notes,treatment_plan,evaluations,history,reports`, { method: "GET", headers });
      const patRows = await patRes.json();
      const fullPatient = Array.isArray(patRows) && patRows[0];
      if (!fullPatient) return { status: "error", message: "Paciente no encontrado en detalle" };
      let ficha = null;
      try {
        const recRes = await fetch(`${supabaseUrl2}/rest/v1/clinical_records?patient_id=eq.${patient_id}&select=*`, { method: "GET", headers });
        const recRows = await recRes.json();
        ficha = Array.isArray(recRows) && recRows[0];
      } catch {
      }
      const evalList = Array.isArray(fullPatient.evaluations) ? fullPatient.evaluations : [];
      const historyList = Array.isArray(fullPatient.history) ? fullPatient.history : [];
      let evaluationLine = evalList.length > 0 ? evalList.map((ev) => {
        const pct = ev.maxScore > 0 ? Math.round(ev.score / ev.maxScore * 100) : 0;
        const lvl = pct >= 80 ? "ADECUADO" : pct >= 60 ? "LEVE" : pct >= 40 ? "MODERADO" : "SEVERO";
        return `\u2022 ${ev.testName || "Evaluaci\xF3n"}: ${ev.score}/${ev.maxScore} (${pct}%) \u2014 ${lvl}`;
      }).join("\n") : `\u2022 No hay evaluaciones estandarizadas cargadas a\xFAn.`;
      let sessionLine = historyList.length > 0 ? historyList.slice(0, 3).map((s, i) => {
        const d = s.date ? new Date(s.date).toLocaleDateString("es-AR") : "sin fecha";
        return `  Sesi\xF3n ${i + 1} (${d}): ${s.summary || s.observations || "Sin resumen"}`;
      }).join("\n") : "  Sin sesiones registradas a\xFAn.";
      const diag = fullPatient.diagnosis || ficha?.primary_diagnosis_name || patient.diagnosis || "No especificado";
      const ageStr = fullPatient.age ? `${fullPatient.age} a\xF1os` : "edad no informada";
      const systemPrompt = `Sos un fonoaudi\xF3logo matriculado (CFPBA) experto en redacci\xF3n de informes cl\xEDnicos para la Provincia de Buenos Aires. Marco legal: Ley 15.052 CFPBA, CIE-11. Diagn\xF3stico funcional NO m\xE9dico. Diferenciar "refiere" (tercero) de "se observa" (hallazgo). Toque personal obligatorio. Estructura: Motivo -> Antecedentes -> Evaluaci\xF3n -> Impresi\xF3n Diagn\xF3stica -> Pron\xF3stico -> Objetivos -> Recomendaciones. Us\xE1 \xFAnicamente datos reales. Si falta un dato, marc\xE1 "[Dato pendiente: X]". NO inventes. Respond\xE9 SOLO el informe (HTML simple: <p>, <strong>, <ul>, <li>).`;
      const dataPrompt = `Paciente: ${fullPatient.name || "N/D"}, ${ageStr}, g\xE9nero: ${fullPatient.gender || "N/D"}.
Diagn\xF3stico funcional actual: ${diag}.
\xC1rea de enfoque del informe: ${focus_area || "general"}.
Obra social: ${fullPatient.obra_social || "No informada"}.
Motivo / anamnesis: ${typeof fullPatient.anamnesis === "string" ? fullPatient.anamnesis.substring(0, 800) : ficha?.chief_complaint || "No registrado"}.
Evaluaciones estandarizadas:
${evaluationLine}
Historial de sesiones:
${sessionLine}
Observaciones cl\xEDnicas: ${fullPatient.notes || ficha?.notes || "Sin observaciones registradas"}.
Plan de tratamiento: ${fullPatient.treatmentPlan?.general || patient.treatment_plan || "Sin plan cargado"}.`;
      let draft = null;
      try {
        const groqKey = process.env.GROQ_API_KEY;
        if (groqKey) {
          const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
            body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: dataPrompt }], temperature: 0.4, max_tokens: 4096 })
          });
          if (groqResp.ok) {
            const gd = await groqResp.json();
            draft = gd.choices?.[0]?.message?.content || "";
          }
        }
        if (!draft && process.env.GOOGLE_API_KEY) {
          const genResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}

${dataPrompt}` }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 4096 } })
          });
          if (genResp.ok) {
            const gj = await genResp.json();
            draft = gj.candidates?.[0]?.content?.parts?.[0]?.text || "";
          }
        }
      } catch (llmErr) {
        console.warn("[generate_report_draft] LLM failed, using enhanced fallback:", llmErr?.message || String(llmErr));
      }
      if (!draft) {
        draft = `# INFORME CL\xCDNICO${fullPatient.name ? ` - ${fullPatient.name}` : ""}
${diag ? `Diagn\xF3stico funcional: ${diag}` : "Diagn\xF3stico: No especificado"}
Edad: ${ageStr}
\xC1rea de enfoque: ${focus_area || "general"}

## Evaluaci\xF3n
${evaluationLine}

## Historial de sesiones
${sessionLine}

## Observaciones
${fullPatient.notes || ficha?.notes || "Sin observaciones registradas"}

[Este borrador se gener\xF3 con los datos reales de la ficha. Completar campos marcados [Dato pendiente] antes de aprobar.]`;
      }
      const reportEntry = {
        id: newId(),
        date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        title: `Informe (${focus_area || "general"}) - ${fullPatient.name || "paciente"}`,
        content: draft,
        type: "generado_ia",
        patient_id
      };
      const updatedReports = [...Array.isArray(fullPatient.reports) ? fullPatient.reports : [], reportEntry];
      await fetch(`${supabaseUrl2}/rest/v1/patients?id=eq.${patient_id}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ reports: updatedReports })
      }).catch((e) => console.warn("[generate_report_draft] save failed:", e.message));
      return { status: "ok", draft, message: `Borrador de informe generado para ${fullPatient.name || "el paciente"} con datos reales (${evalList.length} evaluaciones, ${historyList.length} sesiones).` };
    }
    if (functionName === "list_reports") {
      const patients = await fetchPatientsForUser(actualUserId);
      const patient = patients.find((p) => p.id === args.patient_id);
      if (!patient) return { status: "error", message: "Paciente no encontrado" };
      return { status: "ok", count: (patient.reports || []).length, reports: patient.reports || [] };
    }
    if (functionName === "get_agenda") {
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const dateFilter = args.date || today;
      const res = await fetch(`${supabaseUrl2}/rest/v1/appointments?date=eq.${dateFilter}&type=neq.recordatorio&order=time.asc`, {
        method: "GET",
        headers
      });
      if (!res.ok) throw new Error(await res.text());
      const appointments = await res.json();
      return { status: "ok", date: dateFilter, count: appointments.length, appointments };
    }
    if (functionName === "get_upcoming_appointments") {
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
      const res = await fetch(`${supabaseUrl2}/rest/v1/appointments?date=gte.${today}&date=lte.${nextWeek}&order=date.asc,time.asc`, {
        method: "GET",
        headers
      });
      if (!res.ok) throw new Error(await res.text());
      const appointments = await res.json();
      return { status: "ok", count: appointments.length, appointments };
    }
    if (functionName === "create_appointment") {
      const { patient_name, date, time, type } = args;
      const appointment = {
        id: newId(),
        patient_name,
        date,
        time,
        type: type || "consulta",
        status: "programado",
        professional_id: actualUserId
      };
      const res = await fetch(`${supabaseUrl2}/rest/v1/appointments`, {
        method: "POST",
        headers,
        body: JSON.stringify(appointment)
      });
      if (!res.ok) throw new Error(await res.text());
      return { status: "ok", message: `Turno creado para ${patient_name} el ${date} a las ${time}.` };
    }
    if (functionName === "update_appointment") {
      const { appointment_id, field, value } = args;
      const allowedFields = ["date", "time", "status", "type"];
      if (!allowedFields.includes(field)) return { status: "error", message: `Campo "${field}" no permitido.` };
      const res = await fetch(`${supabaseUrl2}/rest/v1/appointments?id=eq.${appointment_id}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ [field]: value })
      });
      if (!res.ok) throw new Error(await res.text());
      return { status: "ok", message: `Turno actualizado.` };
    }
    if (functionName === "cancel_appointment") {
      const res = await fetch(`${supabaseUrl2}/rest/v1/appointments?id=eq.${args.appointment_id}`, {
        method: "DELETE",
        headers: { ...headers, Prefer: "return=minimal" }
      });
      if (!res.ok) throw new Error(await res.text());
      return { status: "ok", message: "Turno cancelado." };
    }
    if (functionName === "reschedule_appointment") {
      const { appointment_id, new_date, new_time } = args;
      if (!appointment_id || !new_date) {
        return { status: "error", message: "Requiere appointment_id y new_date" };
      }
      try {
        const getRes = await fetch(`${supabaseUrl2}/rest/v1/appointments?id=eq.${appointment_id}&select=id,patient_name,date,time,type,status,notes,google_event_id`, {
          headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}` }
        });
        const rows = await getRes.json();
        const row = Array.isArray(rows) && rows[0];
        if (!row) return { status: "error", message: "Turno no encontrado" };
        const updated = {
          date: new_date,
          time: new_time || (row.time || "09:00")
        };
        if (row.type === "recordatorio") updated.type = "recordatorio";
        const patchRes = await fetch(`${supabaseUrl2}/rest/v1/appointments?id=eq.${appointment_id}`, {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=representation" },
          body: JSON.stringify(updated)
        });
        const patchData = await patchRes.json();
        if (!patchRes.ok) throw new Error(typeof patchData === "string" ? patchData : patchData?.message || "update failed");
        const updatedRow = Array.isArray(patchData) ? patchData[0] : row;
        let calendarSynced = false;
        let calendarError = null;
        if (updatedRow.google_event_id) {
          try {
            let accessToken = null;
            const { data: gauthRows } = await fetch(`${supabaseUrl2}/rest/v1/google_auth?select=access_token,refresh_token,expires_at&limit=1`, {
              headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}` }
            }).then((r) => r.json()).then((d) => ({ data: Array.isArray(d) ? d : [] })).catch(() => ({ data: [] }));
            const gauth = gauthRows[0];
            if (gauth && gauth.access_token) {
              accessToken = gauth.access_token;
              const expiresAt = gauth.expires_at ? new Date(gauth.expires_at).getTime() : 0;
              if (Date.now() >= expiresAt - 5 * 60 * 1e3 && gauth.refresh_token) {
                try {
                  const rf = await fetch(`${process.env.BACKEND_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")}/api/google/refresh-token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refresh_token: gauth.refresh_token })
                  });
                  if (rf.ok) {
                    const rd = await rf.json();
                    accessToken = rd.access_token || accessToken;
                  }
                } catch {
                }
              }
              const startISO = `${new_date}T${new_time || (row.time || "09:00")}:00`;
              const calRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${updatedRow.google_event_id}`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({ start: { dateTime: startISO, timeZone: "America/Argentina/Buenos_Aires" } })
              });
              if (calRes.ok) calendarSynced = true;
              else calendarError = `Google Calendar HTTP ${calRes.status}`;
            }
          } catch (ce) {
            calendarError = ce?.message || String(ce);
          }
        }
        try {
          const tgMsg = `\u{1F4C5} <b>Turno reprogramado</b>
<a href="https://fonoaudio-pro.app/ver/cita/${appointment_id}">${row.patient_name || "Paciente"}</a> \u2192 ${new_date}${new_time ? ` ${new_time}` : ""}.`;
          await sendTelegramMessage(
            process.env.TELEGRAM_CHAT_ID || "8706264359",
            tgMsg,
            /* parseHtml */
            true
          );
        } catch {
        }
        const msg = calendarSynced ? `\u2705 Turno de ${row.patient_name} reprogramado a ${new_date}${new_time ? ` a las ${new_time}` : ""} (sincronizado con Google Calendar).` : `\u2705 Turno de ${row.patient_name || "el paciente"} reprogramado a ${new_date}${new_time ? ` a las ${new_time}` : ""} en el sistema.${calendarError ? ` (Google Calendar: ${calendarError})` : ""}`;
        return { status: "ok", message: msg, appointment: updatedRow };
      } catch (e) {
        return { status: "error", message: e?.message || String(e) };
      }
    }
    if (functionName === "move_appointment_room") {
      const { appointment_id, room_name } = args;
      if (!appointment_id || !room_name) return { status: "error", message: "Requiere appointment_id y room_name" };
      try {
        const getRes = await fetch(`${supabaseUrl2}/rest/v1/appointments?id=eq.${appointment_id}&select=id,patient_name,date,time,type,roomid,google_event_id`, {
          headers: { apikey: `Authorization: ${supabaseKey2}` }
        });
        const rows = await getRes.json();
        const row = Array.isArray(rows) && rows[0];
        if (!row) return { status: "error", message: "Turno no encontrado" };
        const pr = await fetch(`${supabaseUrl2}/rest/v1/appointments?id=eq.${appointment_id}`, {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=representation" },
          body: JSON.stringify({ roomid: room_name })
        });
        const pd = await pr.json();
        if (!pr.ok) throw new Error(typeof pd === "string" ? pd : pd?.message || "update failed");
        const updatedRow = Array.isArray(pd) ? pd[0] : { ...row, roomid: room_name };
        try {
          const tg = "Turno movido a " + room_name + " para " + (row.patient_name || "paciente");
          await sendTelegramMessage(process.env.TELEGRAM_CHAT_ID || "8706264359", tg, true);
        } catch (e) {
        }
        return { status: "ok", message: "Turno de " + (row.patient_name || "el paciente") + " movido al consultorio " + room_name + ".", appointment: updatedRow };
      } catch (e) {
        return { status: "error", message: e?.message || String(e) };
      }
    }
    if (functionName === "set_reminder") {
      const { message: message2, date, time } = args;
      const reminderTime = time || "09:00";
      let createdInCalendar = false;
      let calendarError = null;
      try {
        const { data: gauthRows } = await fetch(`${supabaseUrl2}/rest/v1/google_auth?select=user_id,access_token,refresh_token,expires_at&limit=1`, {
          method: "GET",
          headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}` }
        }).then((r) => r.json()).then((d) => ({ data: Array.isArray(d) ? d : [] })).catch(() => ({ data: [] }));
        const gauth = gauthRows[0];
        if (gauth && gauth.access_token) {
          let accessToken = gauth.access_token;
          const expiresAt = gauth.expires_at ? new Date(gauth.expires_at).getTime() : 0;
          if (Date.now() >= expiresAt - 5 * 60 * 1e3 && gauth.refresh_token) {
            try {
              const rf = await fetch(`${process.env.BACKEND_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")}/api/google/refresh-token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: gauth.refresh_token })
              });
              if (rf.ok) {
                const rd = await rf.json();
                accessToken = rd.access_token || accessToken;
              }
            } catch {
            }
          }
          const startISO = `${date}T${reminderTime}:00`;
          const endISO = `${date}T${(() => {
            const [h, m] = reminderTime.split(":").map(Number);
            const e = new Date(0, 0, 0, h, m + 15);
            return `${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`;
          })()}:00`;
          const calRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              summary: `\u{1F514} Recordatorio FonoAudio-Pro: ${message2}`,
              description: "Recordatorio aut\xF3nomo creado por el asistente FonoAudio-Pro.",
              start: { dateTime: startISO, timeZone: "America/Argentina/Buenos_Aires" },
              end: { dateTime: endISO, timeZone: "America/Argentina/Buenos_Aires" },
              reminders: { useDefault: true }
            })
          });
          if (calRes.ok) createdInCalendar = true;
          else calendarError = `Google Calendar HTTP ${calRes.status}`;
        } else {
          calendarError = "No Google token found";
        }
      } catch (ce) {
        calendarError = ce?.message || String(ce);
      }
      try {
        await fetch(`${supabaseUrl2}/rest/v1/appointments`, {
          method: "POST",
          headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({
            patient_name: `\u{1F514} ${message2 || "Recordatorio FonoAudio-Pro"}`,
            date,
            time: reminderTime,
            type: "recordatorio",
            status: "pending",
            notes: "Recordatorio aut\xF3nomo solicitado por el profesional v\xEDa asistente.",
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          })
        });
      } catch {
      }
      const parts = [];
      if (createdInCalendar) parts.push("qued\xF3 anotado en tu Google Calendar");
      else if (calendarError) parts.push(`(no pude sincronizar con Google Calendar: ${calendarError}; pod\xE9s conectar la cuenta en Ajustes)`);
      parts.push("y te lo voy a avisar por Telegram a la hora indicada");
      const where = createdInCalendar ? "En tu Google Calendar y" : "Y";
      return { status: "ok", message: `Listo. ${where} te aviso el ${date} a las ${reminderTime} por Telegram.${createdInCalendar ? "" : " El recordatorio qued\xF3 guardado en el sistema aunque no se pudo enlazar a Google Calendar."}` };
    }
    if (functionName === "add_evaluation") {
      const { patient_id, test_name, result, area } = args;
      const patients = await fetchPatientsForUser(actualUserId);
      const patient = patients.find((p) => p.id === patient_id);
      if (!patient) return { status: "error", message: "Paciente no encontrado" };
      const evaluation = {
        id: newId(),
        test_name,
        result,
        area: area || "general",
        date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
      };
      const updatedEvals = [...patient.evaluations || [], evaluation];
      const res = await fetch(`${supabaseUrl2}/rest/v1/patients?id=eq.${patient.id}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ evaluations: updatedEvals })
      });
      if (!res.ok) throw new Error(await res.text());
      return { status: "ok", message: `Evaluacion "${test_name}" agregada a ${patient.name}.` };
    }
    if (functionName === "update_treatment_plan") {
      const { patient_id, plan_text, action, section } = args;
      const patients = await fetchPatientsForUser(actualUserId);
      const patient = patients.find((p) => p.id === patient_id);
      if (!patient) return { status: "error", message: "Paciente no encontrado" };
      const existingPlan = patient.treatmentPlan || {};
      const existingSummary = existingPlan.summary || "";
      let finalSummary = plan_text;
      if ((action === "update" || action === "merge") && existingSummary && plan_text) {
        if (section && section !== "null") {
          const sectionRegex = new RegExp(`(\u2550+\\s*${section.toUpperCase()}[\\s\\S]*?)(?=\u2550+\\s*[A-Z]|$)`, "i");
          if (sectionRegex.test(existingSummary)) {
            finalSummary = existingSummary.replace(sectionRegex, `
${plan_text}
`);
          } else {
            finalSummary = existingSummary + `

\u2550\u2550 ${section.toUpperCase()} \u2550\u2550
${plan_text}`;
          }
        } else {
          const isAppend = plan_text.toLowerCase().startsWith("agregar") || plan_text.toLowerCase().startsWith("a\xF1adir") || plan_text.toLowerCase().startsWith("aggiornar") || plan_text.toLowerCase().startsWith("modificar");
          if (isAppend) {
            finalSummary = existingSummary + "\n\n" + plan_text.replace(/^(agregar|añadir|aggiornar|modificar)\s*/i, "");
          } else {
            finalSummary = plan_text;
          }
        }
      }
      const plan = {
        ...existingPlan,
        lastUpdate: (/* @__PURE__ */ new Date()).toISOString(),
        summary: finalSummary,
        history: [
          ...existingPlan.history || [],
          { date: (/* @__PURE__ */ new Date()).toISOString(), text: plan_text, action: action || "create", previousSummary: action === "update" ? existingSummary : void 0 }
        ]
      };
      const res = await fetch(`${supabaseUrl2}/rest/v1/patients?id=eq.${patient.id}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ treatmentPlan: plan })
      });
      if (!res.ok) throw new Error(await res.text());
      return { status: "ok", message: `Plan de tratamiento de ${patient.name} actualizado. ${action === "update" ? "Se preserv\xF3 el contenido existente." : "Plan creado."}` };
    }
    if (functionName === "search_knowledge") {
      const res = await fetch(`${supabaseUrl2}/rest/v1/assistant_knowledge?or=(title.ilike.%${args.query}%,content.ilike.%${args.query}%)&limit=5`, {
        method: "GET",
        headers
      });
      if (!res.ok) return { status: "ok", count: 0, results: [] };
      const results = await res.json();
      return { status: "ok", count: results.length, results };
    }
    if (functionName === "add_knowledge") {
      const { title, content, category } = args;
      const entry = {
        id: newId(),
        title,
        content,
        category: category || "general",
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      const res = await fetch(`${supabaseUrl2}/rest/v1/assistant_knowledge`, {
        method: "POST",
        headers,
        body: JSON.stringify(entry)
      });
      if (!res.ok) throw new Error(await res.text());
      return { status: "ok", message: `Entrada "${title}" agregada a la base de conocimiento.` };
    }
    if (functionName === "list_materials") {
      let url = `${supabaseUrl2}/rest/v1/materials?limit=20&order=created_at.desc`;
      if (args.category) url += `&category=eq.${args.category}`;
      const res = await fetch(url, { method: "GET", headers });
      if (!res.ok) return { status: "ok", count: 0, materials: [] };
      const materials = await res.json();
      return { status: "ok", count: materials.length, materials: materials.map((m) => ({ id: m.id, title: m.title, category: m.category, type: m.type })) };
    }
    if (functionName === "search_materials") {
      const res = await fetch(`${supabaseUrl2}/rest/v1/materials?or=(title.ilike.%${args.query}%,tags.ilike.%${args.query}%)&limit=10`, {
        method: "GET",
        headers
      });
      if (!res.ok) return { status: "ok", count: 0, materials: [] };
      const materials = await res.json();
      return { status: "ok", count: materials.length, materials: materials.map((m) => ({ id: m.id, title: m.title, category: m.category, url: m.url })) };
    }
    if (functionName === "get_statistics") {
      const patients = await fetchPatientsForUser(actualUserId);
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const aptRes = await fetch(`${supabaseUrl2}/rest/v1/appointments?date=eq.${today}`, { method: "GET", headers });
      const todayApts = aptRes.ok ? await aptRes.json() : [];
      const diagCounts = {};
      patients.forEach((p) => {
        const d = p.diagnosis || "Sin diagnostico";
        diagCounts[d] = (diagCounts[d] || 0) + 1;
      });
      return {
        status: "ok",
        total_patients: patients.length,
        today_appointments: todayApts.length,
        diagnoses_breakdown: diagCounts
      };
    }
    if (functionName === "check_missing_data") {
      const patients = await fetchPatientsForUser(actualUserId);
      const missing = patients.filter((p) => !p.phone || !p.diagnosis || !p.age || !p.email);
      return {
        status: "ok",
        count: missing.length,
        patients: missing.map((p) => ({
          id: p.id,
          name: p.name,
          missing: [
            !p.phone && "telefono",
            !p.diagnosis && "diagnostico",
            !p.age && "edad",
            !p.email && "email"
          ].filter(Boolean)
        }))
      };
    }
    if (functionName === "notebook_list") {
      try {
        const backendUrl = process.env.BACKEND_URL || (process.env.VERCEL === "1" ? "" : "http://localhost:3001");
        const res = await fetch(`${backendUrl}/api/notebooklm/notebooks?limit=10`);
        const data = await res.json();
        const notebooks = Array.isArray(data) ? data : data.notebooks || [];
        return { status: "ok", count: notebooks.length, notebooks: notebooks.map((n) => ({ id: n.id, title: n.title })) };
      } catch (e) {
        return { status: "ok", count: 0, notebooks: [], note: "NotebookLM no disponible" };
      }
    }
    if (functionName === "notebook_ask") {
      try {
        const backendUrl = process.env.BACKEND_URL || (process.env.VERCEL === "1" ? "" : "http://localhost:3001");
        const res = await fetch(`${backendUrl}/api/notebooklm/notebooks/${args.notebook_id}/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: args.question })
        });
        const data = await res.json();
        return { status: "ok", answer: data.answer || "Sin respuesta disponible." };
      } catch (e) {
        return { status: "error", message: "NotebookLM no disponible" };
      }
    }
    return { status: "error", message: `Herramienta desconocida: ${functionName}` };
  } catch (e) {
    console.error(`[executeToolCall] Error in ${functionName}:`, e.message);
    return { status: "error", message: e.message };
  }
}
async function handleDirectCommand(lowerMsg, originalMsg, user_id) {
  const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
  const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl2 || !supabaseKey2) return null;
  let resolvedUserId = user_id;
  if (!resolvedUserId) {
    resolvedUserId = await findProfessionalId();
  }
  const resolvedUserIdFinal = resolvedUserId || null;
  const headers = { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${supabaseKey2}`, "Content-Type": "application/json", Prefer: "return=representation" };
  if (lowerMsg.match(/(cre[aá]|nuevo|alta)\s+(un\s+)?paciente/)) {
    const nameMatch = originalMsg.match(/(?:llamado?|nombre:?|name:?)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/i) || originalMsg.match(/paciente\s+(?:llamado?|nombre:?)?\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/i);
    const ageMatch = originalMsg.match(/(\d+)\s*(?:años|año|years?)/i);
    const reasonMatch = originalMsg.match(/(?:motivo|raz[oó]n|cause|por)\s*:?\s*(.+?)(?:\.|$)/i) || originalMsg.match(/(?:refiere|refieren|presenta|diagn[oó]stico)\s+(.+?)(?:\.|$)/i);
    const diagnosisMatch = originalMsg.match(/(?:diagn[oó]stico|dx|diagnostico)\s*:?\s*(.+?)(?:\.|$)/i);
    if (!nameMatch) return null;
    const name = nameMatch[1].trim();
    const age = ageMatch ? parseInt(ageMatch[1]) : null;
    const reason = reasonMatch ? reasonMatch[1].trim() : null;
    const diagnosis = diagnosisMatch ? diagnosisMatch[1].trim() : null;
    try {
      const patientId = newId();
      const newPatient = {
        id: patientId,
        name,
        age,
        diagnosis,
        reason,
        phone: null,
        email: null,
        notes: reason || null,
        history: [],
        reports: [],
        evaluations: [],
        documents: [],
        treatmentPlan: {},
        professional_id: resolvedUserIdFinal,
        owner_id: resolvedUserIdFinal,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      const res = await fetch(`${supabaseUrl2}/rest/v1/patients`, {
        method: "POST",
        headers,
        body: JSON.stringify(newPatient)
      });
      if (!res.ok) throw new Error(await res.text());
      if (reason || diagnosis) {
        try {
          await fetch(`${supabaseUrl2}/rest/v1/clinical_records`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              patient_id: patientId,
              chief_complaint: reason || diagnosis || "",
              chief_complaint_onset: "",
              personal_history: {},
              family_history: {},
              medical_history: {},
              developmental_history: {},
              clinical_observations: "",
              affected_areas: {},
              primary_diagnosis_name: diagnosis || null,
              primary_diagnosis_code: null,
              secondary_diagnosis_codes: [],
              created_by: resolvedUserIdFinal,
              updated_by: resolvedUserIdFinal,
              created_at: (/* @__PURE__ */ new Date()).toISOString(),
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            })
          });
        } catch (e) {
          console.warn("[Direct] clinical_records:", e.message);
        }
      }
      return `\u2705 Paciente *${name}* creado exitosamente.${age ? ` Edad: ${age} a\xF1os.` : ""}${reason ? ` Motivo: ${reason}.` : ""}`;
    } catch (e) {
      console.error("[Direct] create_patient error:", e.message);
      return `\u274C No pude crear al paciente ${name}: ${e.message}`;
    }
  }
  if (lowerMsg.match(/(mostr[aá]|list[aá]|ver|cu[aá]les|qui[eé]nes).*pacientes/) || lowerMsg.match(/pacientes.*(?:tengo|hay|activos)/)) {
    try {
      const res = await fetch(`${supabaseUrl2}/rest/v1/patients?select=id,name,age,diagnosis,phone&limit=20`, { headers });
      if (!res.ok) throw new Error(await res.text());
      const patients = await res.json();
      if (patients.length === 0) return "\u{1F4CB} No ten\xE9s pacientes registrados.";
      const list = patients.map((p, i) => `${i + 1}. *${p.name}* \u2014 ${p.age || "?"} a\xF1os, ${p.diagnosis || "sin diagn\xF3stico"}`).join("\n");
      return `\u{1F4CB} *Tus pacientes (${patients.length})*:
${list}`;
    } catch (e) {
      return `\u274C Error al buscar pacientes: ${e.message}`;
    }
  }
  if (lowerMsg.match(/(agenda|turnos?|cit[ae]s?).*(hoy|actual)/) || lowerMsg.match(/hoy.*(agenda|turnos?|cit[ae]s?)/)) {
    try {
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const res = await fetch(`${supabaseUrl2}/rest/v1/appointments?date=eq.${today}&type=neq.recordatorio&order=time.asc`, { headers });
      if (!res.ok) throw new Error(await res.text());
      const apts = await res.json();
      if (apts.length === 0) return "\u{1F4C5} No ten\xE9s turnos para hoy.";
      const list = apts.map((a) => `${a.time} hs \u2014 ${a.patient_name} (${a.status || "pendiente"})`).join("\n");
      return `\u{1F4C5} *Turnos de hoy*:
${list}`;
    } catch (e) {
      return `\u274C Error al buscar agenda: ${e.message}`;
    }
  }
  return null;
}
async function processTextInternal(message_text, chat_id, user_id, aiModel2, protocol = "https", host = "fonoaudio-pro-ai.vercel.app", aiModelFallback2 = null) {
  const TELEGRAM_BOT_TOKEN2 = process.env.TELEGRAM_BOT_TOKEN;
  let resolvedUserId = user_id;
  if (!resolvedUserId) {
    resolvedUserId = await findProfessionalId();
  }
  if (wantsStopVoice(message_text)) {
    setVoiceMode(chat_id, false);
    if (chat_id && TELEGRAM_BOT_TOKEN2) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text: 'Modo voz desactivado. Ahora respondo solo con texto. Para reactivar, dec\xED "modo voz" o "audio".' })
      }).catch(() => {
      });
    }
    return { status: "ok", response: "Modo voz desactivado", sent_to_telegram: true };
  }
  if (wantsVoice(message_text)) {
    setVoiceMode(chat_id, true);
  }
  try {
    const pending = chat_id ? await getPendingFile(chat_id) : null;
    const lowerText = message_text.trim().toLowerCase();
    if (pending) {
      let actionType = null;
      let targetPatient = null;
      const discardPatterns = ["no", "descartar", "cancelar", "ninguno", "nada"];
      const docPatterns = ["1", "documento", "doc", "guardalo", "guardar", "guardar como documento"];
      const sessionPatterns = ["2", "sesi\xF3n", "sesion", "sesi\xF3n cl\xEDnica", "sesion clinica"];
      const reportPatterns = ["3", "informe", "reporte", "evaluaci\xF3n", "evaluacion"];
      if (discardPatterns.some((p) => lowerText === p || lowerText.startsWith(p))) {
        await deletePendingFile(chat_id);
        const discardMsg = "Archivo descartado. Si necesit\xE1s guardarlo despu\xE9s, mand\xE1 el archivo de nuevo.";
        if (chat_id && TELEGRAM_BOT_TOKEN2) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id, text: discardMsg })
          }).catch(() => {
          });
        }
        return { status: "ok", response: discardMsg, action: "discard", sent_to_telegram: true };
      }
      if (sessionPatterns.some((p) => lowerText.includes(p))) actionType = "session";
      else if (reportPatterns.some((p) => lowerText.includes(p))) actionType = "report";
      else if (docPatterns.some((p) => lowerText.includes(p)) || /^\d+$/.test(lowerText)) actionType = "document";
      if (actionType) {
        const patients = pending.patients || [];
        let matchedPatient = null;
        const textNoAction = lowerText.replace(/guardalo|guardar|documento|doc|sesión|sesion|informe|reporte|evaluación|evaluacion|como|en|a|el|la|los|las|del|al/g, "").trim();
        if (/^\d+$/.test(textNoAction) && parseInt(textNoAction) > 0 && parseInt(textNoAction) <= patients.length) {
          matchedPatient = patients[parseInt(textNoAction) - 1];
        }
        if (!matchedPatient && textNoAction.length > 1) {
          for (const p of patients) {
            const nameLower = p.name.toLowerCase();
            if (textNoAction.includes(nameLower) || nameLower.includes(textNoAction) || textNoAction.includes(nameLower.split(" ")[0])) {
              matchedPatient = p;
              break;
            }
          }
        }
        if (matchedPatient) {
          try {
            const saveData = await saveToPatientInternal(
              chat_id,
              matchedPatient.id,
              actionType,
              user_id
            );
            if (saveData.status === "ok") {
              const confirmMsg = `\u2705 ${saveData.message}
Tipo: ${actionType === "session" ? "Sesi\xF3n cl\xEDnica" : actionType === "report" ? "Informe" : "Documento"}
Archivo: ${saveData.file_name}`;
              if (chat_id && TELEGRAM_BOT_TOKEN2) {
                await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id, text: confirmMsg })
                }).catch(() => {
                });
              }
              return { status: "ok", response: confirmMsg, action: "saved", saved_to: matchedPatient.name, sent_to_telegram: true };
            } else {
              throw new Error(saveData.message || "Save failed");
            }
          } catch (saveErr) {
            const errMsg = `Error al guardar: ${saveErr.message}. Intent\xE1 de nuevo.`;
            if (chat_id && TELEGRAM_BOT_TOKEN2) {
              await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id, text: errMsg })
              }).catch(() => {
              });
            }
            return { status: "ok", response: errMsg, action: "error", sent_to_telegram: true };
          }
        } else if (actionType && patients.length > 0) {
          const retryMsg = `No identifiqu\xE9 a qu\xE9 paciente. Respond\xE9 con el nombre o n\xFAmero:
${patients.map((p, i) => `  ${i + 1}. ${p.name}`).join("\n")}
O escrib\xED "no" para cancelar.`;
          if (chat_id && TELEGRAM_BOT_TOKEN2) {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id, text: retryMsg })
            }).catch(() => {
            });
          }
          return { status: "ok", response: retryMsg, action: "retry_patient", sent_to_telegram: true };
        }
      }
    }
  } catch (step0Err) {
    console.error("[Telegram Process-Text] STEP 0 error:", step0Err);
  }
  const now = /* @__PURE__ */ new Date();
  const optionsAR = { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hour12: false };
  const dateOptionsAR = { timeZone: "America/Argentina/Buenos_Aires", weekday: "long", year: "numeric", month: "long", day: "numeric" };
  const currentTime = now.toLocaleTimeString("es-AR", optionsAR);
  const currentDate = now.toLocaleDateString("es-AR", dateOptionsAR);
  const currentHour = parseInt(now.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", hour12: false }));
  const currentMinute = parseInt(now.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", minute: "2-digit", hour12: false }));
  const currentMinutesSinceMidnight = currentHour * 60 + currentMinute;
  let pendingFileContext = "";
  if (chat_id && await hasPendingFile(chat_id)) {
    const pf = await getPendingFile(chat_id);
    pendingFileContext = `

ARCHIVO PENDIENTE: El usuario tiene un archivo sin resolver: "${pf.file_name}" (${pf.media_type}).
El usuario podr\xEDa estar respondiendo a la pregunta sobre qu\xE9 hacer con ese archivo.
Si el usuario menciona un paciente, un tipo de acci\xF3n (guardar, sesion, informe) o un n\xFAmero, interpretalo como una respuesta a ese archivo.`;
  }
  try {
    let clinicalContext = "";
    if (resolvedUserId) {
      try {
        const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
        const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        if (supabaseUrl2 && supabaseKey2) {
          const patientsRes = await fetch(`${supabaseUrl2}/rest/v1/patients?select=id,name,diagnosis,age,notes,phone&limit=200`, {
            headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}` }
          });
          const patients = await patientsRes.json();
          const today = now.toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
          const appsRes = await fetch(`${supabaseUrl2}/rest/v1/appointments?date=eq.${today}&type=neq.recordatorio&select=id,patient_name,date,time,status,type,duration,notes&order=time`, {
            headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}` }
          });
          const appointments = await appsRes.json();
          const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1e3);
          const weekFromNowStr = weekFromNow.toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
          const upcomingRes = await fetch(`${supabaseUrl2}/rest/v1/appointments?date=gt=${today}&date=lte=${weekFromNowStr}&type=neq.recordatorio&select=id,patient_name,date,time,status,type&order=date&limit=10`, {
            headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}` }
          });
          const upcoming = await upcomingRes.json();
          try {
            const { GoogleGenerativeAI: GoogleGenerativeAI5 } = await import("@google/generative-ai");
            const genAI2 = new GoogleGenerativeAI5(process.env.GOOGLE_API_KEY);
            const embedModel = genAI2.getGenerativeModel({ model: "text-embedding-004" });
            const embedResult = await embedModel.embedContent(message_text.slice(0, 1e3));
            const queryEmbedding = embedResult.embedding.values;
            const semanticRes = await fetch(`${supabaseUrl2}/rest/v1/rpc/match_source_embeddings`, {
              method: "POST",
              headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                query_embedding: queryEmbedding,
                match_threshold: 0.3,
                match_count: 5
              })
            });
            if (semanticRes.ok) {
              const semanticDocs = await semanticRes.json();
              if (semanticDocs && semanticDocs.length > 0) {
                clinicalContext += `

\u2550\u2550\u2550 ESTUDIOS/AN\xC1LISIS EXTERNOS RELEVANTES \u2550\u2550\u2550
`;
                clinicalContext += semanticDocs.map((d) => `- [${d.source_title}] (relevancia: ${(d.similarity * 100).toFixed(0)}%): ${d.content.slice(0, 400)}...`).join("\n");
              }
            }
          } catch (e) {
            console.warn("[API Context] Semantic search failed:", e.message);
          }
          if (patients.length > 0) {
            clinicalContext += `
PACIENTES ACTIVOS (${patients.length}):
`;
            clinicalContext += patients.map((p) => `- ${p.name}: ${p.diagnosis || "Sin diagn\xF3stico"}, ${p.age || "?"} a\xF1os${p.phone ? `, tel: ${p.phone}` : ""}`).join("\n");
          }
          if (appointments.length > 0) {
            clinicalContext += `

AGENDA DE HOY (${appointments.length} citas) \u2014 HOY ES ${currentDate}:
`;
            clinicalContext += appointments.map((a) => {
              const [aH, aM] = (a.time || "00:00").split(":").map(Number);
              const apptMinutes = aH * 60 + aM;
              const diffMin = apptMinutes - currentMinutesSinceMidnight;
              let timing = "";
              if (diffMin < -60) timing = "\u23F0 YA PAS\xD3";
              else if (diffMin < 0) timing = "\u26A1 EN CURSO";
              else if (diffMin <= 30) timing = "\u25B6\uFE0F PR\xD3XIMA (en " + diffMin + " min)";
              else timing = "\u{1F550} A\xDAN NO LLEGA";
              return `- ${a.time} hs: ${a.patient_name} \u2014 ${a.status || "pending"}, ${a.type || "consulta"} \u2014 ${timing} [ID: ${a.id}]`;
            }).join("\n");
          } else {
            clinicalContext += `

AGENDA DE HOY: Sin citas programadas para hoy.`;
          }
          if (upcoming.length > 0) {
            clinicalContext += `

PR\xD3XIMOS 7 D\xCDAS:
`;
            clinicalContext += upcoming.map((a) => `- ${a.date} ${a.time} hs: ${a.patient_name} [ID: ${a.id}]`).join("\\n");
          }
          const lowerMsgForMissing = message_text.toLowerCase();
          const isMissingQuery = ["faltante", "faltan", "falta", "incomplet", "incompleta", "incompleto", "alertas de datos", "datos faltan", "que le falta", "que falta", "pendientes de cargar", "sin cargar"].some((kw) => lowerMsgForMissing.includes(kw));
          if (isMissingQuery) {
            try {
              const allPatRes = await fetch(`${supabaseUrl2}/rest/v1/patients?select=id,name`, { headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}` } });
              const allPatients = await allPatRes.json();
              const recRes = await fetch(`${supabaseUrl2}/rest/v1/clinical_records?select=patient_id,chief_complaint,primary_diagnosis_name,affected_areas,personal_history,family_history,medical_history,developmental_history`, { headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}` } });
              const records = await recRes.json();
              const recById = {};
              (records || []).forEach((r) => {
                recById[r.patient_id] = r;
              });
              const missingLines = [];
              for (const p of allPatients || []) {
                const cr = recById[p.id];
                const missing = [];
                if (!cr) missing.push("FICHA SIN CREAR");
                else {
                  if (!cr.chief_complaint || String(cr.chief_complaint).trim() === "") missing.push("Motivo de consulta");
                  if (!cr.primary_diagnosis_name || String(cr.primary_diagnosis_name).trim() === "") missing.push("Diagnostico principal");
                  if (!cr.affected_areas || !Array.isArray(cr.affected_areas) || cr.affected_areas.filter((a) => a && a.affected).length === 0) missing.push("Areas afectadas");
                  if (!cr.personal_history || Object.keys(cr.personal_history).length === 0) missing.push("Historia personal");
                  if (!cr.family_history || Object.keys(cr.family_history).length === 0) missing.push("Historia familiar");
                  if (!cr.medical_history || Object.keys(cr.medical_history).length === 0) missing.push("Historia medica");
                  if (!cr.developmental_history || Object.keys(cr.developmental_history).length === 0) missing.push("Historia del desarrollo");
                }
                if (missing.length > 0) missingLines.push(`- ${p.name}: FALTAN [${missing.join(", ")}]`);
              }
              if (missingLines.length > 0) {
                clinicalContext += `

\u2550\u2550\u2550 REPORTE DE DATOS FALTANTES (REAL, DESDE LA BASE) \u2550\u2550\u2550
${missingLines.join("\n")}
(Mencion\xE1 TODOS estos pacientes y sus campos faltantes en tu respuesta. No inventes ni omitas ninguno.)`;
              } else {
                clinicalContext += `

\u2550\u2550\u2550 REPORTE DE DATOS FALTANTES \u2550\u2550\u2550
No hay pacientes con datos faltantes. Todas las fichas est\xE1n completas.`;
              }
            } catch (missErr) {
              console.warn("[Telegram] Missing-data preload failed:", missErr.message);
            }
          }
        }
      } catch (ctxErr) {
        console.warn("[Telegram Process-Text] Could not fetch clinical context:", ctxErr.message);
      }
    }
    let notebookLmContext = "";
    const clinicalKeywords = ["tratamiento", "evidencia", "estudio", "investigaci\xF3n", "paper", "art\xEDculo", "protocolo", "gu\xEDa cl\xEDnica", "revision", "terapia", "disfon\xEDa", "audiolog\xEDa", "fonoaudiolog\xEDa", "degluci\xF3n", "habla", "lenguaje", "voz"];
    const isClinicalQuery = clinicalKeywords.some((kw) => message_text.toLowerCase().includes(kw));
    if (isClinicalQuery) {
      try {
        const backendUrl = process.env.BACKEND_URL || (process.env.VERCEL === "1" ? "" : "http://localhost:3001");
        const nbRes = await fetch(`${backendUrl}/api/notebooklm/notebooks?limit=1`);
        const nbData = await nbRes.json();
        const nbList = Array.isArray(nbData) ? nbData : nbData.notebooks || [];
        if (nbList.length > 0) {
          const askRes = await fetch(`${backendUrl}/api/notebooklm/notebooks/${nbList[0].id}/ask`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: message_text })
          });
          const askData = await askRes.json();
          if (askData.answer) {
            notebookLmContext = `

\u2550\u2550\u2550 EVIDENCIA DE NOTEBOOKLM \u2550\u2550\u2550
${askData.answer}
Us\xE1 esta informaci\xF3n para fundamentar tu respuesta.`;
          }
        }
      } catch (nbErr) {
        console.warn("[Telegram] NotebookLM query failed:", nbErr.message);
      }
    }
    const clinicalPrompt = `Sos FonoAudio, el asistente clinico autonomo de FonoAudio Pro AI. SOS UN AGENTE COMPLETO. Expertos en fonoaudiologia.

\u2550\u2550\u2550 MANDATO CL\xCDNICO-LEGAL (Provincia de Bs As) \u2550\u2550\u2550
1. Diagn\xF3stico Funcional: NUNCA uses diagn\xF3sticos m\xE9dicos (nosol\xF3gicos). Usa solo terminolog\xEDa funcional fonoaudiol\xF3gica (CIE-11, etc).
2. Diferenciaci\xF3n Epistemol\xF3gica: Separa siempre: "La madre refiere..." (dato anamn\xE9sico) de "Se observa..." (dato cl\xEDnico objetivo).
3. Auditor\xEDa de Seguridad: Verifica siempre: Firma, matr\xEDcula (CFPBA), fecha y estructura formal.
4. Toque Personal (Elena Zegarra): Debes incluir conducta, motivaciones y ejemplos concretos del habla del paciente. Si no tienes estos datos, NO inventes, PREG\xDANTALE al usuario antes de generar el reporte final.

\u2550\u2550\u2550 RAZONAMIENTO CL\xCDNICO (CRITICO) \u2550\u2550\u2550
ANTES de generar cualquier secci\xF3n, PENS\xC1:
- \xBFTengo datos objetivos o solo referencias de terceros?
- \xBFHe incluido ejemplos del habla del peque?
- \xBFCumple con la estructura de las plantillas oficiales?

\u2550\u2550\u2550 CONTEXTO CL\xCDNICO \u2550\u2550\u2550
${clinicalContext || "\nNo hay contexto disponible."}
${pendingFileContext}
${notebookLmContext}

\u2550\u2550\u2550 MENSAJE DEL USUARIO \u2550\u2550\u2550
${message_text}

PENS\xC1 paso a paso y EJECUTA la accion correcta. Si necesitas info previa, buscala primero con las tools.

\u2550\u2550\u2550 AVISOS Y RECORDATORIOS 24/7 (CRITICO) \u2550\u2550\u2550
SOS un asistente AUTONOMO que ENVIA mensajes por Telegram al profesional en cualquier momento, incluyendo alertas autom\xE1ticas.
- Ten\xE9s un cron que todos los d\xEDas a las 8:00 AM env\xEDa el resumen matutino (turnos del d\xEDa + fichas incompletas).
- Si el usuario pide "av\xEDsame", "recordame", "no se me olvide", "decitne ma\xF1ana", o cualquier alerta futura: DEC\xCDS QUE S\xCD y EJECUT\xC1S la tool set_reminder con la fecha/hora/mensaje indicados. Confirm\xE1s que lo vas a avisar.
- NUNCA digas "no puedo enviar alertas", "soy solo un asistente virtual", "no tengo capacidad" ni nada que niegue tus capacidades de aviso. Esas frases son FALSAS: s\xED pod\xE9s y lo hac\xE9s.`;
    let aiResponse = "";
    let sentToTelegram = false;
    if (!aiModel2) {
      console.warn("[Process-Text] AI model not available, using Supabase fallback...");
      const fallback = await getTextFallbackFromSupabase(message_text, resolvedUserId);
      aiResponse = fallback || `No pude generar una respuesta con IA (servicio no disponible).`;
    } else {
      let toolCallSucceeded = false;
      let quotaExhausted = false;
      const modelsToTry = [...GEMINI_MODEL_CHAIN];
      for (const model2 of modelsToTry) {
        if (toolCallSucceeded || quotaExhausted) break;
        const maxRetries = model2 === modelsToTry[0] ? 2 : 1;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            console.log(`[Gemini Tools] Trying ${model2} (attempt ${attempt + 1}/${maxRetries + 1})`);
            const tempModel = model2 !== modelsToTry[0] ? aiModel2 : aiModel2;
            const response = await aiModel2.generateContent({
              contents: [{ role: "user", parts: [{ text: clinicalPrompt }] }],
              tools: [{ functionDeclarations: clinicalTools }]
            });
            const candidate = response.response?.candidates?.[0];
            const functionCalls = candidate?.content?.parts?.filter((p) => p.functionCall) || [];
            if (functionCalls.length > 0) {
              const fc = functionCalls[0].functionCall;
              console.log(`[Gemini Tool Call] Executing ${fc.name} with args:`, fc.args);
              const toolResult = await executeToolCall(fc.name, fc.args, resolvedUserId);
              const secondResponse = await aiModel2.generateContent({
                contents: [
                  { role: "user", parts: [{ text: clinicalPrompt }] },
                  { role: "model", parts: candidate.content.parts },
                  {
                    role: "function",
                    parts: [{
                      functionResponse: {
                        name: fc.name,
                        response: toolResult
                      }
                    }]
                  }
                ]
              });
              aiResponse = secondResponse.response?.text() || `Acci\xF3n ${fc.name} ejecutada con \xE9xito. Resultado: ${JSON.stringify(toolResult)}`;
              toolCallSucceeded = true;
              console.log(`[Gemini Tools] ${model2} succeeded on attempt ${attempt + 1}`);
              break;
            } else {
              aiResponse = response.response?.text() || "Sin respuesta de IA.";
              toolCallSucceeded = true;
              break;
            }
          } catch (e) {
            const errMsg = e?.message || "";
            const isQuota = errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("Too Many Requests");
            if (isQuota) {
              console.warn(`[Gemini Tools] ${model2} QUOTA EXHAUSTED \u2014 skipping all Gemini models`);
              quotaExhausted = true;
              break;
            }
            if (isRetryableError(e) && attempt < maxRetries) {
              const delay = backoffDelay(attempt);
              console.warn(`[Gemini Tools] ${model2} attempt ${attempt + 1} failed (${e.message?.slice(0, 60)}). Retrying in ${delay}ms...`);
              await new Promise((r) => setTimeout(r, delay));
            } else {
              console.warn(`[Gemini Tools] ${model2} FAILED: ${e.message?.slice(0, 80)}`);
              break;
            }
          }
        }
      }
      if (!toolCallSucceeded && aiModelFallback2) {
        console.warn("[Gemini Tools] Primary key exhausted. Trying fallback model (key #2)...");
        try {
          const response = await aiModelFallback2.generateContent({
            contents: [{ role: "user", parts: [{ text: clinicalPrompt }] }],
            tools: [{ functionDeclarations: clinicalTools }]
          });
          const candidate = response.response?.candidates?.[0];
          const functionCalls = candidate?.content?.parts?.filter((p) => p.functionCall) || [];
          if (functionCalls.length > 0) {
            const fc = functionCalls[0].functionCall;
            console.log(`[Gemini Fallback] Executing ${fc.name} with args:`, fc.args);
            const toolResult = await executeToolCall(fc.name, fc.args, resolvedUserId);
            const secondResponse = await aiModelFallback2.generateContent({
              contents: [
                { role: "user", parts: [{ text: clinicalPrompt }] },
                { role: "model", parts: candidate.content.parts },
                { role: "function", parts: [{ functionResponse: { name: fc.name, response: toolResult } }] }
              ]
            });
            aiResponse = secondResponse.response?.text() || `Acci\xF3n ${fc.name} ejecutada. Resultado: ${JSON.stringify(toolResult)}`;
            toolCallSucceeded = true;
          } else {
            aiResponse = response.response?.text() || "";
            if (aiResponse) toolCallSucceeded = true;
          }
        } catch (fbErr) {
          console.warn("[Gemini Fallback] Also failed:", fbErr.message?.slice(0, 80));
        }
      }
      if (!toolCallSucceeded) {
        console.warn("[Gemini Tools] All models failed. Trying Groq with function calling...");
        const groqResult = await callGroqWithTools(clinicalPrompt, clinicalTools, resolvedUserId);
        if (groqResult.ok) {
          aiResponse = groqResult.text;
          toolCallSucceeded = true;
        } else {
          console.warn("[Groq Tools] Failed. Trying direct command parsing...");
          const lowerMsg = message_text.toLowerCase();
          const directResult = await handleDirectCommand(lowerMsg, message_text, resolvedUserId);
          if (directResult) {
            aiResponse = directResult;
          } else {
            const textPrompt = `Sos FonoAudio, asistente clinico autonomo de FonoAudio Pro AI. Respond\xE9 en espanol argentino rioplatense. S\xE9 conciso y profesional. El usuario pidi\xF3: ${message_text}

${clinicalContext ? "Contexto clinico:\n" + clinicalContext : ""}`;
            const groqTextResult = await callGroqFallback(textPrompt);
            aiResponse = groqTextResult.ok ? groqTextResult.text : `Ocurri\xF3 un error temporal con el servicio de IA. Por favor intent\xE1 de nuevo en unos segundos.`;
          }
        }
      }
    }
    const reminderKeywords = ["avisa", "recorda", "recuerda", "no se me olvide", "decime", "decime ma\xF1ana", "avisame", "acordate", "alert"];
    const wantsReminder = reminderKeywords.some((k) => message_text.toLowerCase().includes(k));
    const modelDenied = /no (tengo|puedo|tiene).*(capacidad|enviar|recordator|alerta)|soy solo un asistente|no puedo enviar/i.test(aiResponse);
    const alreadySet = /recordatorio programado|te lo voy a avisar|te aviso/i.test(aiResponse);
    if (wantsReminder && !alreadySet) {
      try {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1e3);
        const tomorrowStr = tomorrow.toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
        let rDate = tomorrowStr;
        const dateMatch = message_text.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) rDate = dateMatch[1];
        let rTime = "09:00";
        const timeMatch = message_text.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) rTime = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
        else {
          const hMatch = message_text.match(/a las (\d{1,2})/i);
          if (hMatch) rTime = `${hMatch[1].padStart(2, "0")}:00`;
        }
        const reminderMsg = `Recordatorio: ${message_text.replace(/^.*?\b(avisa|recorda|recuerda|decime|acordate)\w*\s*/i, "").trim() || "Tiene una alerta de FonoAudio-Pro."}`;
        const setRes = await executeToolCall("set_reminder", { message: reminderMsg, date: rDate, time: rTime }, resolvedUserId);
        if (setRes?.status === "ok") {
          aiResponse = `\xA1Hecho! Te aviso el ${rDate} a las ${rTime} por Telegram. Anotado en tu recordatorio autom\xE1tico. \xBFNecesit\xE1s que vincule esto a alg\xFAn paciente o turno?`;
        }
      } catch (remErr) {
        console.warn("[Autonomous Reminder] Failed:", remErr.message);
      }
    }
    const cleanResponse = stripVoiceMarkers(aiResponse);
    sentToTelegram = await sendTelegramMessage(chat_id, cleanResponse);
    if (sentToTelegram && shouldSendVoice(chat_id, message_text, aiResponse) && cleanResponse && cleanResponse.length > 10) {
      const voiceText = cleanResponse.replace(/[*_`~#]/g, "").replace(/\n{3,}/g, "\n\n").substring(0, 3e3);
      const voiceSent = await sendTelegramVoice(chat_id, voiceText).catch((err) => {
        console.error("[processTextInternal] Voice send error:", err.message);
        return false;
      });
      if (!voiceSent) {
        console.warn("[processTextInternal] Voice response failed, text was still sent");
      }
    }
    return {
      status: "ok",
      response: cleanResponse,
      sent_to_telegram: sentToTelegram
    };
  } catch (e) {
    console.error("[Telegram Process-Text] Error:", e.message);
    return { status: "error", message: e.message };
  }
}
async function autoSetupWebhook(req) {
  const TELEGRAM_BOT_TOKEN2 = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN2) return;
  const host = req.get("host") || "fonoaudio-pro-ai.vercel.app";
  if (host.includes("localhost") || host.includes("127.0.0.1")) return;
  const protocol = "https";
  const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl })
    });
    const d = await res.json();
    console.log("[Telegram Webhook] Auto-registration result:", d);
  } catch (e) {
    console.warn("[Telegram Webhook] Auto-registration failed:", e.message);
  }
}
async function findProfessionalId() {
  const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
  const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl2 || !supabaseKey2) {
    console.warn("[findProfessionalId] Supabase not configured");
    return null;
  }
  try {
    const res = await fetch(`${supabaseUrl2}/rest/v1/profiles?select=id&limit=1`, {
      headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${supabaseKey2}` }
    });
    if (res.ok) {
      const rows = await res.json();
      if (rows && rows.length > 0) {
        return rows[0].id;
      }
    }
    try {
      const authRes = await fetch(`${supabaseUrl2}/auth/v1/admin/users?per_page=1`, {
        headers: {
          apikey: process.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${supabaseKey2}`
        }
      });
      if (authRes.ok) {
        const authData = await authRes.json();
        const users = Array.isArray(authData) ? authData : authData.users || [];
        if (users.length > 0) {
          return users[0].id;
        }
      }
    } catch (authErr) {
      console.warn("[findProfessionalId] Auth fallback failed:", authErr.message);
    }
    if (process.env.DEFAULT_PROFESSIONAL_ID) {
      console.log("[findProfessionalId] Using DEFAULT_PROFESSIONAL_ID env var");
      return process.env.DEFAULT_PROFESSIONAL_ID;
    }
    try {
      const patientRes = await fetch(`${supabaseUrl2}/rest/v1/patients?select=owner_id&limit=1`, {
        headers: {
          apikey: process.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${supabaseKey2}`
        }
      });
      if (patientRes.ok) {
        const patients = await patientRes.json();
        if (patients && patients.length > 0 && patients[0].owner_id) {
          console.log("[findProfessionalId] Using owner_id from patients table as fallback");
          return patients[0].owner_id;
        }
      }
    } catch (pErr) {
      console.warn("[findProfessionalId] Patient fallback failed:", pErr.message);
    }
    console.warn("[findProfessionalId] No professional ID found after all fallbacks");
    return null;
  } catch (e) {
    console.error("[findProfessionalId] Exception:", e.message);
    return null;
  }
}
var import_express3, import_supabase_js3, _googleService, globalErrorLog, globalDebugLog, MAX_LOG_ENTRIES, router3, voiceModeChats, VOICE_MODE_DURATION_MS, VOICE_KEYWORDS, VOICE_STOP_KEYWORDS, GEMINI_MODEL_CHAIN, GROQ_API_URL, pendingQueueMemory, clinicalTools, api_default;
var init_api = __esm({
  "routes/api.js"() {
    import_express3 = __toESM(require("express"), 1);
    import_supabase_js3 = require("@supabase/supabase-js");
    init_notebooklmService();
    init_clinicalPlanningService();
    init_distributionService();
    init_notebooklm();
    init_tts();
    _googleService = null;
    globalErrorLog = [];
    globalDebugLog = [];
    MAX_LOG_ENTRIES = 50;
    router3 = import_express3.default.Router();
    voiceModeChats = /* @__PURE__ */ new Map();
    VOICE_MODE_DURATION_MS = 30 * 60 * 1e3;
    VOICE_KEYWORDS = [
      "decime en voz",
      "decime con voz",
      "habl\xE1",
      "hablame",
      "hablame en voz",
      "modo voz",
      "modo audio",
      "activ\xE1 voz",
      "activar voz",
      "activa voz",
      "respond\xE9 con audio",
      "responde con audio",
      "respuesta de audio",
      "decime en audio",
      "audio por favor",
      "quiero escuchar",
      "escucharte",
      "decime aloud",
      "voz por favor",
      "audio",
      "jarvis",
      "hermes",
      "modo jarvis"
    ];
    VOICE_STOP_KEYWORDS = [
      "modo texto",
      "solo texto",
      "desactiv\xE1 voz",
      "desactivar voz",
      "desactiva voz",
      "para voz",
      "stop voz",
      "silencio",
      "modo silencio"
    ];
    router3.post("/admin/role", async (req, res) => {
      try {
        const { userId, role } = req.body;
        if (!userId || !role) {
          return res.status(400).json({ status: "error", message: "userId y role son requeridos" });
        }
        const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
        const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl2 || !supabaseKey2) {
          return res.status(500).json({ status: "error", message: "Supabase no configurado en backend" });
        }
        const supabase2 = (0, import_supabase_js3.createClient)(supabaseUrl2, supabaseKey2);
        const { error } = await supabase2.from("profiles").update({ role, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", userId);
        if (error) {
          console.error("[Admin Role Update Error]:", error.message);
          return res.status(500).json({ status: "error", message: error.message });
        }
        res.json({ status: "ok", role });
      } catch (e) {
        console.error("[Admin Role Endpoint Error]:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    GEMINI_MODEL_CHAIN = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash"
    ];
    GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
    pendingQueueMemory = [];
    router3.post("/process", async (req, res) => {
      try {
        res.json(await callAI(req, "Act\xFAa como un asistente cl\xEDnico inteligente para fonoaudiolog\xEDa. Procesa esta petici\xF3n: "));
      } catch (e) {
        console.error("[Process] Error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router3.post("/guides/generate-home-guide-draft", async (req, res) => {
      const { patientId, patientName, lastSessionSummary, diagnosis, age } = req.body;
      try {
        const prompt = `Act\xFAa como un experto fonoaudi\xF3logo. Genera una Gu\xEDa de Hogar para el paciente ${patientName} (${age} a\xF1os), diagn\xF3stico: ${diagnosis}. 
        ${lastSessionSummary ? `Resumen de la \xFAltima sesi\xF3n: ${lastSessionSummary}.` : "No hay resumen de sesi\xF3n previo."}
        
        Responde SOLO con markdown plano. NO uses JSON ni objetos. Usa este formato exacto:

Gu\xEDa de Hogar para ${patientName}

## Objetivo Principal
(un p\xE1rrafo claro)

## Actividades Sugeridas
### Actividad 1: [nombre]
- C\xF3mo hacerlo: ...
- Objetivo: ...

### Actividad 2: [nombre]
- C\xF3mo hacerlo: ...
- Objetivo: ...

## Se\xF1ales de Alerta
- se\xF1al 1
- se\xF1al 2

## Recomendaciones Generales
- recomendaci\xF3n 1
- recomendaci\xF3n 2

## Materiales Necesarios
- material 1
- material 2`;
        const result = await callAI(req, prompt);
        if (result.status === "ok") {
          let raw = result.response || "";
          raw = raw.replace(/^```[\s\S]*?\n([\s\S]*?)\n```$/gm, "$1").trim();
          let title = `Gu\xEDa de Hogar - ${patientName}`;
          let content = raw;
          try {
            const jsonData = JSON.parse(raw);
            if (jsonData.title || jsonData.content || jsonData.blocks) {
              title = jsonData.title || title;
              if (Array.isArray(jsonData.content)) {
                content = jsonData.content.map((block) => {
                  if (block.block_title && block.block_content) {
                    const blockContent = Array.isArray(block.block_content) ? block.block_content.map((activity) => {
                      if (activity.activity_title && activity.instructions) {
                        return `### ${activity.activity_title}

${activity.instructions.join("\n\n")}`;
                      }
                      return typeof activity === "string" ? activity : JSON.stringify(activity);
                    }).join("\n\n") : block.block_content;
                    return `## ${block.block_title}

${blockContent}`;
                  }
                  return typeof block === "string" ? block : JSON.stringify(block);
                }).join("\n\n");
              } else if (typeof jsonData.content === "string") {
                content = jsonData.content;
              }
              if (jsonData.materials && Array.isArray(jsonData.materials)) {
                content += "\n\n## Materiales Necesarios\n\n" + jsonData.materials.map((m) => `- ${m}`).join("\n");
              }
            }
          } catch (e) {
            const lines = raw.split("\n").filter((l) => l.trim());
            title = (lines[0] || "").replace(/^#+\s*/, "").trim() || title;
            const contentStart = raw.indexOf("\n", raw.indexOf(lines[0] || ""));
            content = contentStart > 0 ? raw.substring(contentStart).trim() : raw;
          }
          res.json({ status: "ok", draft: { title, content, materialIds: [] } });
        } else {
          res.status(500).json(result);
        }
      } catch (error) {
        console.error("[Home Guide Route] Error:", error);
        res.status(500).json({ status: "error", message: error.message });
      }
    });
    router3.post("/google/refresh-token", async (req, res) => {
      const { refresh_token } = req.body;
      if (!refresh_token) {
        return res.status(400).json({ status: "error", message: "refresh_token is required" });
      }
      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token,
            grant_type: "refresh_token"
          })
        });
        if (!response.ok) {
          const errorData = await response.json();
          console.error("[Google Refresh] Token refresh failed:", errorData);
          return res.status(401).json({ status: "error", message: "Token refresh failed", details: errorData });
        }
        const data = await response.json();
        const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1e3).toISOString();
        console.log("[Google Refresh] Token refreshed successfully");
        res.json({
          status: "ok",
          access_token: data.access_token,
          expires_at: expiresAt
        });
      } catch (error) {
        console.error("[Google Refresh] Error:", error);
        res.status(500).json({ status: "error", message: error.message });
      }
    });
    router3.post("/google/meet", async (req, res) => {
      const { patientName, date, time, reason, durationMinutes = 30 } = req.body;
      try {
        const gs = await googleService();
        const result = await gs.createGoogleMeetEvent({
          patientName,
          date,
          time,
          durationMinutes,
          description: reason || "Teleatenci\xF3n Fonoaudiol\xF3gica"
        });
        if (result.status === "ok") {
          res.json(result);
        } else {
          res.status(500).json(result);
        }
      } catch (error) {
        console.error("[Google Meet Route] Error:", error);
        res.status(500).json({ status: "error", message: error.message });
      }
    });
    router3.post("/google/calendar/sync", async (req, res) => {
      try {
        const gs = await googleService();
        const result = await gs.syncGoogleCalendar();
        res.json(result);
      } catch (error) {
        console.error("[Google Calendar Sync Route] Error:", error);
        res.status(500).json({ status: "error", message: error.message });
      }
    });
    router3.post("/google/drive/sync", async (req, res) => {
      const { folderId } = req.body;
      try {
        const gs = await googleService();
        const result = await gs.syncDriveToMaterials(folderId);
        res.json(result);
      } catch (error) {
        console.error("[Google Drive Sync Route] Error:", error);
        res.status(500).json({ status: "error", message: error.message });
      }
    });
    router3.post("/resend_last_material", async (req, res) => {
      const { patientId } = req.body;
      try {
        const result = await distributionService_default.resendLastMaterial(patientId);
        if (result.status === "ok") {
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
      }
    });
    router3.post("/schedule_reminder", async (req, res) => {
      try {
        const result = await distributionService_default.scheduleReminder(req.body);
        if (result.status === "ok") {
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
      }
    });
    router3.use("/notebooklm", notebooklm_default);
    router3.post("/clinical-planning/:patientId", async (req, res) => {
      try {
        const { patientId } = req.params;
        const result = await clinicalPlanningService_default.generateAnalysis(patientId);
        res.json(result);
      } catch (e) {
        console.error("[ClinicalPlanning] Error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router3.post("/notebooklm", async (req, res) => {
      const { query } = req.body;
      try {
        const aiModel2 = req.app?.locals?.aiModel;
        if (!aiModel2) {
          return res.status(503).json({ status: "error", message: "Servicio de IA no disponible. Configur\xE1 GOOGLE_API_KEY para activar NotebookLM.", hint: "ai_unavailable" });
        }
        const result = await aiModel2.generateContent(`Busc\xE1 informaci\xF3n relevante sobre: "${query}". Respond\xE9 en formato JSON con array de objetos {title, content}.`);
        const text = result.response?.text?.() || "[]";
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const results = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        res.json({ status: "ok", response: results, total: results.length });
      } catch (e) {
        console.error("[NotebookLM Search] Error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router3.post("/research", async (req, res) => {
      const { query } = req.body;
      try {
        const aiModel2 = req.app?.locals?.aiModel;
        if (!aiModel2) {
          return res.status(503).json({ status: "error", message: "Servicio de IA no disponible. Configur\xE1 GOOGLE_API_KEY para activar investigaci\xF3n.", hint: "ai_unavailable" });
        }
        const result = await aiModel2.generateContent(`Investig\xE1 evidencia cient\xEDfica sobre: "${query}". Respond\xE9 en formato JSON con array de objetos {title, journal, year, summary}.`);
        const text = result.response?.text?.() || "[]";
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const evidence = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        res.json({ status: "ok", response: evidence, query });
      } catch (e) {
        console.error("[Research] Error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router3.post("/clinical_summary", async (req, res) => {
      const { patientName, history, diagnosis } = req.body;
      try {
        const aiModel2 = req.app?.locals?.aiModel;
        if (!aiModel2) {
          return res.status(503).json({ status: "error", message: "Servicio de IA no disponible. Configur\xE1 GOOGLE_API_KEY para generar res\xFAmenes cl\xEDnicos.", hint: "ai_unavailable" });
        }
        const prompt = `Gener\xE1 un resumen cl\xEDnico fonoaudiol\xF3gico profesional para el paciente ${patientName}.
Diagn\xF3stico: ${diagnosis || "No especificado"}
Historial: ${history || "Sin historial detallado."}
Inclu\xED: diagn\xF3stico, evoluci\xF3n, objetivos alcanzados, pr\xF3ximos pasos y plan de tratamiento.`;
        const result = await aiModel2.generateContent(prompt);
        const summary = result.response?.text?.() || "No se pudo generar el resumen.";
        res.json({ status: "ok", response: summary });
      } catch (e) {
        console.error("[Clinical Summary] Error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router3.post("/reports/ai-generate", async (req, res) => {
      try {
        const { action, patient, reportType, guideSections, section, prompt, existingContent, tone } = req.body;
        const aiModel2 = req.app?.locals?.aiModel;
        const fallbackModel = req.app?.locals?.fallbackAiModel;
        const primaryModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        const runAiPrompt = async (systemPrompt, userPrompt) => {
          const parts = [{ text: `${systemPrompt}

${userPrompt}` }];
          let result = await callGeminiResilient(parts, aiModel2, primaryModel);
          if (result.ok && result.text) return result.text;
          if (fallbackModel) {
            result = await callGeminiResilient(parts, fallbackModel, "gemini-2.0-flash");
            if (result.ok && result.text) return result.text;
          }
          const groqResult = await callGroqFallback(`${systemPrompt}

${userPrompt}`);
          if (groqResult.ok && groqResult.text) return groqResult.text;
          throw new Error(result.error?.message || "Error al comunicarse con la IA");
        };
        const legalFramework = `
\u2550\u2550\u2550 MARCO LEGAL Y NORMATIVO (Provincia de Buenos Aires - Ley 15.052) \u2550\u2550\u2550
- Diagn\xF3stico DEBE ser funcional, NO m\xE9dico (usar CIE-11 fonoaudiol\xF3gico).
- Diferenciar SIEMPRE: "La madre refiere..." (dato anamn\xE9sico) vs. "Se observa/Se evidencia..." (hallazgo cl\xEDnico).
- Membrete, firma, aclaraci\xF3n y matr\xEDcula CFPBA son obligatorios.
- Toque personal: conducta observada, motivaciones, ejemplos reales del habla del paciente.
`;
        const buildPatientContext = (p, repType) => {
          if (!p) return "Sin datos de paciente";
          const parts = [];
          parts.push(`PACIENTE: ${p.name || "Paciente"}, ${p.age || "N/I"} a\xF1os.`);
          if (p.document) parts.push(`DNI: ${p.document}`);
          if (p.responsable) parts.push(`Responsable: ${p.responsable}`);
          if (p.obra_social) parts.push(`Obra Social: ${p.obra_social}`);
          if (p.diagnosis) parts.push(`Diagn\xF3stico actual: ${p.diagnosis}`);
          if (p.notes) parts.push(`Observaciones: ${p.notes}`);
          if (p.anamnesis) {
            parts.push(`ANAMNESIS:`);
            if (typeof p.anamnesis === "string") parts.push(p.anamnesis.substring(0, 1500));
            else if (p.anamnesis.sections) {
              Object.entries(p.anamnesis.sections).forEach(([k, v]) => {
                parts.push(` - ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
              });
            } else {
              parts.push(JSON.stringify(p.anamnesis).substring(0, 1500));
            }
          }
          if (p.evaluations && p.evaluations.length > 0) {
            parts.push(`EVALUACIONES ESTANDARIZADAS:`);
            p.evaluations.forEach((ev) => {
              const pct = ev.maxScore > 0 ? Math.round(ev.score / ev.maxScore * 100) : 0;
              parts.push(` - ${ev.testName}: ${ev.score}/${ev.maxScore} (${pct}%) ${ev.notes ? `[${ev.notes}]` : ""}`);
            });
          }
          if (p.history && p.history.length > 0) {
            parts.push(`HISTORIAL DE SESIONES (${p.history.length} sesiones):`);
            p.history.slice(0, 5).forEach((s) => {
              parts.push(` - ${s.date} [${s.status}]: ${s.summary || ""} ${s.observations || ""}`);
            });
          }
          if (p.treatmentPlan) {
            parts.push(`PLAN DE TRATAMIENTO:`);
            if (p.treatmentPlan.general) parts.push(` Objetivo General: ${p.treatmentPlan.general}`);
            if (p.treatmentPlan.strategies) parts.push(` Estrategias: ${p.treatmentPlan.strategies}`);
          }
          return parts.join("\n");
        };
        const patientCtx = buildPatientContext(patient, reportType);
        if (action === "generateFullReport") {
          const sectionList = guideSections ? guideSections.map((s, i) => `${i + 1}. KEY: "${s.id}" \u2014 T\xEDtulo: "${s.title}" \u2014 Explicaci\xF3n: ${s.description || ""}`).join("\n") : `1. KEY: "info_general"
2. KEY: "motivo_consulta"
3. KEY: "comportamiento"
4. KEY: "dba"
5. KEY: "expresivo_morfosintaxis"
6. KEY: "expresivo_semantica"
7. KEY: "impresion_diagnostica"
8. KEY: "pronostico"
9. KEY: "objetivos"
10. KEY: "recomendaciones"`;
          const sysPrompt = `Sos un fonoaudi\xF3logo matriculado (CFPBA) experto en redacci\xF3n de informes cl\xEDnicos para la Provincia de Buenos Aires.
Gener\xE1 un informe fonoaudiol\xF3gico COMPLETO tipo "${reportType || "Valoraci\xF3n"}" en formato JSON.

${legalFramework}

DATOS CL\xCDNICOS DEL PACIENTE:
${patientCtx}

SECCIONES DEL INFORME (Us\xE1 EXACTAMENTE estas keys en el JSON retornado):
${sectionList}

REGLAS DE SALIDA:
1. Respond\xE9 \xDANICAMENTE con un objeto JSON v\xE1lido donde las claves sean EXACTAMENTE los IDs/KEYs especificados arriba.
2. Cada valor debe ser un string con HTML v\xE1lido (<p>, <strong>, <em>, <ul>, <li>, <table>).
3. SIEMPRE basar la redacci\xF3n en las evaluaciones y datos reales del paciente.
4. Si falta un dato espec\xEDfico para una secci\xF3n, redact\xE1 una descripci\xF3n cl\xEDnica profesional esperable o sugerida acorde al nivel de severidad del paciente.`;
          const rawText = await runAiPrompt(sysPrompt, `Generar informe completo tipo "${reportType}" para ${patient?.name || "el paciente"}.`);
          let parsed = {};
          try {
            const cleaned = rawText.replace(/```json/gi, "").replace(/```/gi, "").trim();
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
          } catch (e) {
            console.warn("[AI Report Server] JSON parse failed, returning raw text inside contenido key:", e.message);
            parsed = { contenido: rawText };
          }
          return res.json({ status: "ok", data: parsed });
        } else if (action === "generateSectionText") {
          const sysPrompt = `Sos un fonoaudi\xF3logo matriculado (CFPBA) experto.
Gener\xE1 el texto para la secci\xF3n "${section || "General"}" de un informe fonoaudiol\xF3gico.

${legalFramework}

DATOS DEL PACIENTE:
${patientCtx}

${existingContent ? `CONTENIDO ACTUAL A MEJORAR/EXPANDIR:
${existingContent}
` : ""}

INSTRUCCI\xD3N: ${prompt || "Generar redacci\xF3n cl\xEDnica adecuada."}
Respond\xE9 SOLO con el contenido HTML (<p>, <strong>, <ul>, <li>).`;
          const text = await runAiPrompt(sysPrompt, `Generar secci\xF3n ${section}`);
          return res.json({ status: "ok", text });
        } else if (action === "suggestBlocks") {
          const sysPrompt = `Sos un fonoaudi\xF3logo matriculado.
Gener\xE1 3 a 4 bloques/p\xE1rrafos sugeridos alternativos para la secci\xF3n "${section}".
Us\xE1 datos del paciente: ${patientCtx}
Respond\xE9 con un array JSON de strings HTML: ["<p>...</p>", "<p>...</p>"]`;
          const raw = await runAiPrompt(sysPrompt, `Sugerir bloques para ${section}`);
          let blocks = [];
          try {
            const cleaned = raw.replace(/```json/gi, "").replace(/```/gi, "").trim();
            const match = cleaned.match(/\[[\s\S]*\]/);
            blocks = JSON.parse(match ? match[0] : cleaned);
          } catch {
            blocks = [raw];
          }
          return res.json({ status: "ok", blocks });
        } else if (action === "improve" || action === "improveText") {
          const sysPrompt = `Mejor\xE1 este texto cl\xEDnico fonoaudiol\xF3gico preservando datos y marco legal PBA:
${legalFramework}
DATOS PACIENTE: ${patientCtx}
Respond\xE9 SOLO con el texto mejorado en HTML.`;
          const text = await runAiPrompt(sysPrompt, prompt || existingContent);
          return res.json({ status: "ok", text });
        } else if (action === "suggestDiagnosis") {
          const sysPrompt = `Sos un fonoaudi\xF3logo experto en diagn\xF3stico funcional CIE-11 (Ley PBA 15.052).
Bas\xE1ndote en los datos del paciente y sus evaluaciones:
${patientCtx}

Suger\xED un diagn\xF3stico funcional fonoaudiol\xF3gico completo, fundamentaci\xF3n y severidad. NO us\xE1 diagn\xF3sticos m\xE9dicos.
Respond\xE9 en formato HTML.`;
          const text = await runAiPrompt(sysPrompt, `Sugerir diagn\xF3stico funcional para ${patient?.name}`);
          return res.json({ status: "ok", text });
        } else {
          const sysPrompt = `Sos un fonoaudi\xF3logo experto. Proces\xE1 esta solicitud para el paciente:
${patientCtx}`;
          const text = await runAiPrompt(sysPrompt, prompt || "Procesar solicitud.");
          return res.json({ status: "ok", text });
        }
      } catch (err) {
        console.error("[AI Report Server] Error:", err);
        return res.status(500).json({ status: "error", message: err.message || "Error en servidor de IA" });
      }
    });
    router3.get("/telegram/diagnose", async (req, res) => {
      await autoSetupWebhook(req);
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const chatId2 = process.env.TELEGRAM_CHAT_ID;
      const result = {
        tokenSet: !!token,
        tokenLength: token ? token.length : 0,
        tokenPreview: token ? token.substring(0, 10) + "..." : "MISSING",
        chatIdSet: !!chatId2,
        chatIdValue: chatId2 || "MISSING",
        googleApiKeySet: !!process.env.GOOGLE_API_KEY,
        groqApiKeySet: !!process.env.GROQ_API_KEY,
        supabaseUrlSet: !!process.env.VITE_SUPABASE_URL,
        supabaseKeySet: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY),
        aiModelType: req.app.locals.aiModel ? req.app.locals.aiModel.constructor?.name || "initialized" : "null",
        apiTest: null,
        webhookInfo: null,
        updatesTest: null
      };
      if (token) {
        try {
          const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
          const d = await r.json();
          result.apiTest = d.ok ? `Bot: @${d.result.username} (${d.result.first_name})` : `ERROR: ${d.description}`;
          const whRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
          result.webhookInfo = await whRes.json();
          const updRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=5`);
          result.updatesTest = await updRes.json();
        } catch (e) {
          result.apiTest = `FETCH ERROR: ${e.message}`;
        }
      }
      result.errorLog = getErrorLog();
      result.debugLog = getDebugLog();
      res.json(result);
    });
    router3.get("/telegram/logs", (req, res) => {
      res.json({ debugLog: getDebugLog(), errorLog: getErrorLog() });
    });
    router3.get("/telegram/clear-logs", (req, res) => {
      clearLog();
      res.json({ status: "ok", message: "Logs cleared" });
    });
    router3.get("/telegram/env-check", (req, res) => {
      const aiModel2 = req.app.locals.aiModel;
      res.json({
        env: {
          TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
          TELEGRAM_CHAT_ID: !!process.env.TELEGRAM_CHAT_ID,
          GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
          GROQ_API_KEY: !!process.env.GROQ_API_KEY,
          VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY),
          GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.5-flash"
        },
        aiModel: {
          isNull: !aiModel2,
          type: aiModel2 ? aiModel2.constructor?.name || "initialized" : "null"
        },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    });
    router3.get("/telegram/missing-data", async (req, res) => {
      try {
        const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
        const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl2 || !supabaseKey2) {
          return res.status(500).json({ status: "error", message: "Supabase env not configured" });
        }
        const { createClient: createClient8 } = await import("@supabase/supabase-js");
        const sb = createClient8(supabaseUrl2, supabaseKey2);
        const { data: patients } = await sb.from("patients").select("id, name");
        const { data: records } = await sb.from("clinical_records").select(
          "patient_id, chief_complaint, primary_diagnosis_name, affected_areas, personal_history, family_history, medical_history, developmental_history"
        );
        const recById = {};
        (records || []).forEach((r) => {
          recById[r.patient_id] = r;
        });
        const incomplete = [];
        for (const p of patients || []) {
          const cr = recById[p.id];
          const missing = [];
          if (!cr) missing.push("SIN_FICHA");
          else {
            if (!cr.chief_complaint || String(cr.chief_complaint).trim() === "") missing.push("chief_complaint");
            if (!cr.primary_diagnosis_name || String(cr.primary_diagnosis_name).trim() === "") missing.push("diag");
            if (!cr.affected_areas || !Array.isArray(cr.affected_areas) || cr.affected_areas.filter((a) => a && a.affected).length === 0) missing.push("areas");
            if (!cr.personal_history || Object.keys(cr.personal_history).length === 0) missing.push("personal");
            if (!cr.family_history || Object.keys(cr.family_history).length === 0) missing.push("family");
            if (!cr.medical_history || Object.keys(cr.medical_history).length === 0) missing.push("medical");
            if (!cr.developmental_history || Object.keys(cr.developmental_history).length === 0) missing.push("developmental");
          }
          if (missing.length > 0) incomplete.push({ name: p.name, missing });
        }
        res.json({
          status: "ok",
          totalPatients: (patients || []).length,
          incompleteCount: incomplete.length,
          sample: incomplete.slice(0, 10)
        });
      } catch (e) {
        res.status(500).json({ status: "error", message: e?.message || String(e) });
      }
    });
    router3.get("/followup/missing-data", async (req, res) => {
      try {
        const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
        const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl2 || !supabaseKey2) {
          return res.status(500).json({ status: "error", message: "Supabase env not configured" });
        }
        const { createClient: createClient8 } = await import("@supabase/supabase-js");
        const sb = createClient8(supabaseUrl2, supabaseKey2);
        const { data: patients, error: patErr } = await sb.from("patients").select("id, name");
        if (patErr) throw patErr;
        const { data: records, error: recErr } = await sb.from("clinical_records").select(
          "patient_id, chief_complaint, primary_diagnosis_name, affected_areas, personal_history, family_history, medical_history, developmental_history"
        );
        if (recErr) throw recErr;
        const recById = {};
        (records || []).forEach((r) => {
          recById[r.patient_id] = r;
        });
        const results = [];
        for (const p of patients || []) {
          const cr = recById[p.id];
          const missing = [];
          if (!cr) missing.push("Ficha cl\xEDnica sin crear");
          else {
            if (!cr.chief_complaint || String(cr.chief_complaint).trim() === "") missing.push("Motivo de consulta (chief_complaint)");
            if (!cr.primary_diagnosis_name || String(cr.primary_diagnosis_name).trim() === "") missing.push("Diagn\xF3stico principal");
            if (!cr.affected_areas || !Array.isArray(cr.affected_areas) || cr.affected_areas.filter((a) => a && a.affected).length === 0) missing.push("\xC1reas afectadas");
            if (!cr.personal_history || Object.keys(cr.personal_history).length === 0) missing.push("Historia personal");
            if (!cr.family_history || Object.keys(cr.family_history).length === 0) missing.push("Historia familiar");
            if (!cr.medical_history || Object.keys(cr.medical_history).length === 0) missing.push("Historia m\xE9dica");
            if (!cr.developmental_history || Object.keys(cr.developmental_history).length === 0) missing.push("Historia del desarrollo");
          }
          if (missing.length > 0) {
            results.push({
              patientId: p.id,
              patientName: p.name,
              missing
            });
          }
        }
        res.json({ status: "ok", totalPatients: (patients || []).length, incompleteCount: results.length, results });
      } catch (e) {
        res.status(500).json({ status: "error", message: e?.message || String(e) });
      }
    });
    router3.get("/telegram/morning-briefing", async (req, res) => {
      try {
        const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
        const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        const { createClient: createClient8 } = await import("@supabase/supabase-js");
        const sb = createClient8(supabaseUrl2, supabaseKey2);
        let chatId2 = req.query.chatId || process.env.TELEGRAM_CHAT_ID;
        if (!chatId2) {
          const { data: chatRows } = await sb.from("telegram_pending_queue").select("chat_id").eq("direction", "incoming").order("updated_at", { ascending: false }).limit(1);
          if (chatRows && chatRows.length > 0) chatId2 = chatRows[0].chat_id;
        }
        if (!chatId2) return res.status(400).json({ status: "error", message: "chatId requerido (query param, env TELEGRAM_CHAT_ID o interacci\xF3n previa del usuario)" });
        const today = (/* @__PURE__ */ new Date()).toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
        const { data: apps, error: appErr } = await sb.from("appointments").select("patient_name, time, status, type").eq("date", today).order("time", { ascending: true });
        if (appErr) throw appErr;
        const { data: patients } = await sb.from("patients").select("id, name");
        const { data: records } = await sb.from("clinical_records").select(
          "patient_id, chief_complaint, primary_diagnosis_name, affected_areas, personal_history, family_history, medical_history, developmental_history"
        );
        const recById = {};
        (records || []).forEach((r) => {
          recById[r.patient_id] = r;
        });
        const incomplete = [];
        for (const p of patients || []) {
          const cr = recById[p.id];
          const missing = [];
          if (!cr) missing.push("Ficha sin crear");
          else {
            if (!cr.chief_complaint || String(cr.chief_complaint).trim() === "") missing.push("Motivo de consulta");
            if (!cr.primary_diagnosis_name || String(cr.primary_diagnosis_name).trim() === "") missing.push("Diagn\xF3stico");
            if (!cr.affected_areas || !Array.isArray(cr.affected_areas) || cr.affected_areas.filter((a) => a && a.affected).length === 0) missing.push("\xC1reas afectadas");
            if (!cr.personal_history || Object.keys(cr.personal_history).length === 0) missing.push("Historia personal");
            if (!cr.family_history || Object.keys(cr.family_history).length === 0) missing.push("Historia familiar");
            if (!cr.medical_history || Object.keys(cr.medical_history).length === 0) missing.push("Historia m\xE9dica");
            if (!cr.developmental_history || Object.keys(cr.developmental_history).length === 0) missing.push("Historia desarrollo");
          }
          if (missing.length > 0) incomplete.push({ name: p.name, missing });
        }
        const parts = [];
        parts.push("\u{1F305} <b>Briefing matutino</b>");
        parts.push(`<b>${today}</b>`);
        if ((apps || []).length > 0) {
          parts.push("\n\u{1F4C5} <b>Sesiones de hoy:</b>");
          parts.push((apps || []).map((a) => `\u2022 ${a.time || "??:??"} hs \u2014 ${a.patient_name}${a.type ? ` (${a.type})` : ""}`).join("\n"));
        } else {
          parts.push("\n\u{1F4C5} Sin sesiones programadas para hoy.");
        }
        const pending = incomplete.filter((i) => (apps || []).some((a) => a.patient_name === i.name));
        if (pending.length > 0) {
          parts.push("\n\u26A0\uFE0F <b>Pacientes de hoy con ficha incompleta:</b>");
          parts.push(pending.map((i) => `\u2022 ${i.name}: falta [${i.missing.join(", ")}]`).join("\n"));
        }
        if (incomplete.length > 0) {
          parts.push(`
\u{1F4CB} Total fichas incompletas en la cl\xEDnica: ${incomplete.length}.`);
        } else {
          parts.push("\n\u2705 Todas las fichas est\xE1n completas.");
        }
        const message2 = parts.join("\n");
        const sent = await sendTelegramMessage(chatId2, message2, "HTML");
        res.json({ status: "ok", sent, appointmentsToday: (apps || []).length, incompleteCount: incomplete.length, message: message2 });
      } catch (e) {
        res.status(500).json({ status: "error", message: e?.message || String(e) });
      }
    });
    router3.post("/telegram/send", async (req, res) => {
      console.log(`[Telegram] chatId: ${chatId}, media: ${photo ? "photo" : video ? "video" : audio ? "audio" : voice ? "voice" : document ? "document" : "text"}, msgLen: ${message?.length || 0}`);
      if (!TELEGRAM_BOT_TOKEN) {
        return res.status(500).json({ status: "error", message: "TELEGRAM_BOT_TOKEN not configured." });
      }
      if (!chatId) {
        return res.status(400).json({ status: "error", message: "No chatId provided." });
      }
      const numericChatId = Number(chatId);
      if (isNaN(numericChatId)) {
        return res.status(400).json({ status: "error", message: `chatId "${chatId}" is not a valid number.` });
      }
      const captionText = caption || message || "";
      let sentMessages = [];
      try {
        if (photo) {
          const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: numericChatId, photo, caption: captionText || void 0, parse_mode: parse_mode || void 0 })
          });
          const d = await r.json();
          if (d.ok) sentMessages.push("photo");
          else throw new Error(d.description);
        }
        if (video) {
          const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: numericChatId, video, caption: captionText || void 0, parse_mode: parse_mode || void 0 })
          });
          const d = await r.json();
          if (d.ok) sentMessages.push("video");
          else throw new Error(d.description);
        }
        if (audio) {
          const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAudio`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: numericChatId, audio, caption: captionText || void 0, title: captionText || void 0 })
          });
          const d = await r.json();
          if (d.ok) sentMessages.push("audio");
          else throw new Error(d.description);
        }
        if (voice) {
          const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVoice`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: numericChatId, voice, caption: captionText || void 0 })
          });
          const d = await r.json();
          if (d.ok) sentMessages.push("voice");
          else throw new Error(d.description);
        }
        if (document) {
          const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: numericChatId, document, caption: captionText || void 0 })
          });
          const d = await r.json();
          if (d.ok) sentMessages.push("document");
          else throw new Error(d.description);
        }
        if (fileUrl && !document) {
          const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: numericChatId, document: fileUrl, caption: captionText || void 0 })
          });
          const d = await r.json();
          if (d.ok) sentMessages.push("file");
          else throw new Error(d.description);
        }
        if (message && !photo && !video && !audio && !voice && !document && !fileUrl) {
          const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: numericChatId, text: message, parse_mode: parse_mode || void 0 })
          });
          const d = await r.json();
          if (d.ok) sentMessages.push("text");
          else throw new Error(d.description);
        }
        res.json({ status: "ok", sent: sentMessages });
      } catch (e) {
        console.error("Telegram Send Error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router3.post("/alerts/check-and-send", async (req, res) => {
      const { patients } = req.body;
      const TELEGRAM_BOT_TOKEN2 = process.env.TELEGRAM_BOT_TOKEN;
      const CLINICIAN_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
      if (!TELEGRAM_BOT_TOKEN2 || !CLINICIAN_CHAT_ID) {
        return res.status(500).json({ status: "error", message: "TELEGRAM configuration incomplete (TOKEN or CHAT_ID)" });
      }
      let notifiedCount = 0;
      try {
        for (const p of patients) {
          const criticalAlerts = [...p.alerts || []];
          if (p.consentSigned === false) criticalAlerts.push("Falta Consentimiento Informado");
          if (criticalAlerts.length > 0) {
            const message2 = `\u26A0\uFE0F *Alerta Cl\xEDnica* \u26A0\uFE0F

*Paciente:* ${p.name}
*Alertas:* ${criticalAlerts.join(", ")}`;
            const textRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: CLINICIAN_CHAT_ID, text: message2, parse_mode: "HTML" })
            });
            if (textRes.ok) notifiedCount++;
          }
        }
        res.json({ status: "ok", notifiedCount });
      } catch (e) {
        console.error("Alerts Check Error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router3.post("/obsidian/save", async (req, res) => {
      const { path: path5, content, title } = req.body;
      const OBSIDIAN_API_KEY = process.env.OBSIDIAN_API_KEY;
      const OBSIDIAN_URL = process.env.OBSIDIAN_URL || "http://127.0.0.1:27123";
      if (process.env.VERCEL === "1") {
        console.warn("[Obsidian] Disabled on Vercel \u2014 localhost-only integration");
        return res.status(200).json({
          status: "degraded",
          message: "Obsidian integration not available in serverless environment",
          fallback: "Content available in clinical history"
        });
      }
      if (!OBSIDIAN_API_KEY) {
        return res.status(500).json({ status: "error", message: "OBSIDIAN_API_KEY not configured" });
      }
      try {
        let targetPath = path5.endsWith(".md") ? path5 : `${path5}.md`;
        if (title && !targetPath.includes(title)) {
          targetPath = targetPath.endsWith("/") ? `${targetPath}${title}.md` : `${targetPath}/${title}.md`;
        }
        const resObs = await fetch(`${OBSIDIAN_URL}/vault/${targetPath}`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${OBSIDIAN_API_KEY}`,
            "Content-Type": "text/markdown"
          },
          body: content
        });
        if (resObs.ok) {
          res.json({ status: "ok", path: targetPath });
        } else {
          const errData = await resObs.json().catch(() => ({}));
          throw new Error(errData.message || `Obsidian API error: ${resObs.status}`);
        }
      } catch (e) {
        console.error("Obsidian Save Error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router3.get("/patients/:patientId/distributions", async (req, res) => {
      const { patientId } = req.params;
      try {
        const history = await distributionService_default.getPatientDistributionHistory(patientId);
        res.json(history);
      } catch (error) {
        console.error("[Get History Error]:", error);
        res.status(500).json({ status: "error", message: error.message });
      }
    });
    router3.post("/distributions/:distributionId/retry", async (req, res) => {
      const { distributionId } = req.params;
      try {
        const result = await distributionService_default.retryDistribution(distributionId);
        res.json(result);
      } catch (error) {
        console.error("[Retry Distribution Error]:", error);
        res.status(500).json({ status: "error", message: error.message });
      }
    });
    router3.get("/telegram/poll", async (req, res) => {
      try {
        const TELEGRAM_BOT_TOKEN2 = process.env.TELEGRAM_BOT_TOKEN;
        if (!TELEGRAM_BOT_TOKEN2) {
          return res.status(200).json({ ok: true, result: [] });
        }
        const offset = req.query.offset || "0";
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/getUpdates?offset=${offset}&timeout=3`);
        if (!response.ok) {
          return res.status(200).json({ ok: true, result: [] });
        }
        const data = await response.json();
        res.status(200).json(data);
      } catch (e) {
        console.error("[Telegram Poll] Error:", e.message);
        res.status(200).json({ ok: true, result: [] });
      }
    });
    router3.get("/telegram/file/:fileId", async (req, res) => {
      const TELEGRAM_BOT_TOKEN2 = process.env.TELEGRAM_BOT_TOKEN;
      if (!TELEGRAM_BOT_TOKEN2) {
        return res.json({ ok: false, description: "TELEGRAM_BOT_TOKEN not configured" });
      }
      try {
        const { fileId } = req.params;
        const fileInfoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/getFile?file_id=${fileId}`);
        const fileInfo = await fileInfoRes.json();
        if (!fileInfo.ok) {
          return res.json({ ok: false, description: "Telegram getFile failed" });
        }
        const fileUrl2 = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN2}/${fileInfo.result.file_path}`;
        const fileRes = await fetch(fileUrl2);
        if (!fileRes.ok) {
          return res.json({ ok: false, description: "Failed to download file" });
        }
        const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
        res.setHeader("Content-Type", contentType);
        const buffer = await fileRes.arrayBuffer();
        res.send(Buffer.from(buffer));
      } catch (e) {
        res.json({ ok: false, description: e.message });
      }
    });
    router3.post("/telegram/process-media", async (req, res) => {
      const { file_id, media_type, message_text, chat_id, user_id } = req.body;
      const aiModel2 = req.app.locals.aiModel;
      try {
        const result = await processMediaInternal(file_id, media_type, message_text, chat_id, user_id, aiModel2);
        if (result.status === "ok") {
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router3.post("/telegram/save-to-patient", async (req, res) => {
      const { chat_id, patient_id, save_type, user_id } = req.body;
      try {
        const result = await saveToPatientInternal(chat_id, patient_id, save_type, user_id);
        if (result.status === "ok") {
          res.json(result);
        } else {
          res.status(result.status === "error" ? 400 : 500).json(result);
        }
      } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router3.get("/telegram/pending-file/:chatId", async (req, res) => {
      try {
        const pending = await getPendingFile(req.params.chatId);
        if (!pending) {
          return res.json({ status: "ok", pending: null });
        }
        res.json({ status: "ok", pending });
      } catch (e) {
        console.error("[Telegram] pending-file error:", e);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    clinicalTools = [
      // ─── PATIENT MANAGEMENT ───
      {
        name: "search_patient",
        description: "Busca un paciente por nombre o diagnostico en la base de datos.",
        parameters: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING", description: "Nombre o diagnostico del paciente." }
          },
          required: ["name"]
        }
      },
      {
        name: "get_missing_data_alerts",
        description: 'Analiza TODOS los pacientes de la clinica y devuelve un reporte de que campos de la ficha cl\xEDnica faltan en cada uno (diagnostico, areas afectadas, historias, etc.) y qu\xE9 pacientes no tienen ficha creada. Usar SIEMPRE que el usuario pregunte por "datos faltantes", "faltantes", "alertas de datos", "que le falta a la ficha", "pacientes incompletos", o cualquier pregunta sobre informacion incompleta. Devuelve la lista completa y exacta, no inventes.',
        parameters: { type: "OBJECT", properties: {} }
      },
      {
        name: "list_all_patients",
        description: "Lista todos los pacientes del profesional con sus datos basicos.",
        parameters: { type: "OBJECT", properties: {} }
      },
      {
        name: "get_patient_info",
        description: "Obtiene informacion completa de un paciente por ID.",
        parameters: {
          type: "OBJECT",
          properties: {
            patient_id: { type: "STRING", description: "ID del paciente." }
          },
          required: ["patient_id"]
        }
      },
      {
        name: "create_patient",
        description: "Crea un nuevo paciente en la base de datos. Si el usuario indica un motivo de consulta o motivo de derivacion, guardalo en el campo reason.",
        parameters: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING", description: "Nombre completo del paciente." },
            age: { type: "STRING", description: "Edad del paciente." },
            diagnosis: { type: "STRING", description: "Diagnostico principal si se conoce." },
            reason: { type: "STRING", description: 'Motivo de consulta o derivacion. Ej: "Madre refiere tartamudez".' },
            phone: { type: "STRING", description: "Telefono de contacto." },
            email: { type: "STRING", description: "Email del paciente o responsable." },
            notes: { type: "STRING", description: "Notas adicionales." }
          },
          required: ["name"]
        }
      },
      {
        name: "update_patient",
        description: "Actualiza un campo de un paciente existente.",
        parameters: {
          type: "OBJECT",
          properties: {
            patient_id: { type: "STRING", description: "ID del paciente." },
            field: { type: "STRING", description: "Campo a actualizar: name, age, diagnosis, phone, email, notes, gender, address." },
            value: { type: "STRING", description: "Nuevo valor del campo." }
          },
          required: ["patient_id", "field", "value"]
        }
      },
      {
        name: "delete_patient",
        description: 'Elimina UN paciente espec\xEDfico de la base de datos usando su ID. Us\xE1 este tool SOLO cuando ya tengas el ID del paciente. Si el usuario pide eliminar "todos los que se llaman X" o eliminar por nombre, us\xE1 delete_patients_by_name en su lugar.',
        parameters: {
          type: "OBJECT",
          properties: {
            patient_id: { type: "STRING", description: "ID del paciente a eliminar." }
          },
          required: ["patient_id"]
        }
      },
      {
        name: "delete_patients_by_name",
        description: 'Busca y ELIMINA TODOS los pacientes cuyo nombre coincida (case-insensitive, coincide parcial) con el texto indicado. Usar cuando el usuario pida "elimina todos los pacientes que se llamen X", "borra los pacientes pruebita", o cualquier eliminaci\xF3n por nombre en lugar de por ID. Es una operaci\xF3n destructiva: se eliminan paciente, su ficha cl\xEDnica (clinical_records) y registros relacionados en cascada.',
        parameters: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING", description: 'Texto o nombre a buscar y eliminar. Ej: "pruebita 123".' }
          },
          required: ["name"]
        }
      },
      // ─── CLINICAL NOTES & EVOLUTION ───
      {
        name: "add_clinical_evolution",
        description: "Agrega una nota clinica o entrada de evolucion a la historia del paciente.",
        parameters: {
          type: "OBJECT",
          properties: {
            patient_id: { type: "STRING", description: "ID del paciente." },
            clinical_text: { type: "STRING", description: "Texto de la nota clinica o evolucion." }
          },
          required: ["patient_id", "clinical_text"]
        }
      },
      {
        name: "add_session_note",
        description: "Agrega una nota de sesion clinica con resumen y observaciones.",
        parameters: {
          type: "OBJECT",
          properties: {
            patient_id: { type: "STRING", description: "ID del paciente." },
            summary: { type: "STRING", description: "Resumen de la sesion." },
            observations: { type: "STRING", description: "Observaciones clinicas." },
            next_action: { type: "STRING", description: "Proxima accion o tarea." }
          },
          required: ["patient_id", "summary"]
        }
      },
      // ─── REPORTS ───
      {
        name: "generate_report_draft",
        description: "Genera un borrador de informe clinico para un paciente.",
        parameters: {
          type: "OBJECT",
          properties: {
            patient_id: { type: "STRING", description: "ID del paciente." },
            focus_area: { type: "STRING", description: "Area fonoaudiologica: lenguaje, fonacion, deglucion, audologia, motricidad, cognicion." }
          },
          required: ["patient_id", "focus_area"]
        }
      },
      {
        name: "list_reports",
        description: "Lista los informes existentes de un paciente.",
        parameters: {
          type: "OBJECT",
          properties: {
            patient_id: { type: "STRING", description: "ID del paciente." }
          },
          required: ["patient_id"]
        }
      },
      // ─── APPOINTMENTS ───
      {
        name: "get_agenda",
        description: "Consulta la agenda de turnos. Puede filtrar por fecha.",
        parameters: {
          type: "OBJECT",
          properties: {
            date: { type: "STRING", description: "Fecha en formato YYYY-MM-DD. Si se omite, muestra la agenda de hoy." }
          }
        }
      },
      {
        name: "create_appointment",
        description: "Crea un nuevo turno/cita para un paciente.",
        parameters: {
          type: "OBJECT",
          properties: {
            patient_name: { type: "STRING", description: "Nombre del paciente." },
            date: { type: "STRING", description: "Fecha YYYY-MM-DD." },
            time: { type: "STRING", description: "Hora HH:MM." },
            type: { type: "STRING", description: "Tipo de turno: consulta, control, evaluacion, sesion." }
          },
          required: ["patient_name", "date", "time"]
        }
      },
      {
        name: "update_appointment",
        description: "Modifica un turno existente.",
        parameters: {
          type: "OBJECT",
          properties: {
            appointment_id: { type: "STRING", description: "ID del turno." },
            field: { type: "STRING", description: "Campo a modificar: date, time, status, type." },
            value: { type: "STRING", description: "Nuevo valor." }
          },
          required: ["appointment_id", "field", "value"]
        }
      },
      {
        name: "set_reminder",
        description: 'Programa un recordatorio/aviso que se enviara al profesional por Telegram a la fecha y hora indicadas. Usalo SIEMPRE que el usuario pida "av\xEDsame", "recordame", "no se me olvide" o cualquier alerta futura. Confirm\xE1 al usuario que lo vas a avisar.',
        parameters: {
          type: "OBJECT",
          properties: {
            message: { type: "STRING", description: 'Texto del recordatorio a enviar. Ej: "Revisar ficha de Mart\xEDn L\xF3pez".' },
            date: { type: "STRING", description: "Fecha del aviso en YYYY-MM-DD." },
            time: { type: "STRING", description: "Hora del aviso en HH:MM (formato 24h)." }
          },
          required: ["message", "date", "time"]
        }
      },
      {
        name: "cancel_appointment",
        description: "Cancela o elimina un turno.",
        parameters: {
          type: "OBJECT",
          properties: {
            appointment_id: { type: "STRING", description: "ID del turno a cancelar." }
          },
          required: ["appointment_id"]
        }
      },
      {
        name: "reschedule_appointment",
        description: "Reprograma un turno existente a otra fecha y/o hora. Actualiza Supabase y sincroniza con Google Calendar. Solicit\xE1 confirmaci\xF3n sobre la nueva fecha/hora si hay dudas.",
        parameters: {
          type: "OBJECT",
          properties: {
            appointment_id: { type: "STRING", description: "ID del turno a reprogramar." },
            new_date: { type: "STRING", description: "Nueva fecha en YYYY-MM-DD." },
            new_time: { type: "STRING", description: "Nueva hora en HH:MM (24h). Si no se indica, conserva la hora original." }
          },
          required: ["appointment_id", "new_date"]
        }
      },
      {
        name: "move_appointment_room",
        description: "Mueve un turno a otro consultorio/sala (roomid). Si el turno est\xE1 sincronizado a Google Calendar, actualiza el campo location del evento. Solicit\xE1 confirmation sobre el consultorio destino.",
        parameters: {
          type: "OBJECT",
          properties: {
            appointment_id: { type: "STRING", description: "ID del turno a mover." },
            room_name: { type: "STRING", description: "Nombre del consultorio/sala destino." }
          },
          required: ["appointment_id", "room_name"]
        }
      },
      // ─── EVALUATIONS ───
      {
        name: "add_evaluation",
        description: "Agrega una evaluacion o test estandarizado al paciente.",
        parameters: {
          type: "OBJECT",
          properties: {
            patient_id: { type: "STRING", description: "ID del paciente." },
            test_name: { type: "STRING", description: "Nombre del test o evaluacion." },
            result: { type: "STRING", description: "Resultado de la evaluacion." },
            area: { type: "STRING", description: "Area evaluada: lenguaje, fonacion, deglucion, audologia, motricidad, cognicion." }
          },
          required: ["patient_id", "test_name", "result"]
        }
      },
      // ─── TREATMENT PLAN ───
      {
        name: "update_treatment_plan",
        description: 'Actualiza el plan de tratamiento de un paciente. IMPORTANTE: Si el paciente ya tiene un plan, este tool MERGEA (conserva lo existente y agrega/modifica solo lo que se pide). Si el usuario dice "modificar" o "agregar", le\xE9 el plan actual primero y PRESERV\xC1 todo lo existente, cambiando SOLO lo solicitado.',
        parameters: {
          type: "OBJECT",
          properties: {
            patient_id: { type: "STRING", description: "ID del paciente." },
            plan_text: { type: "STRING", description: "Texto COMPLETO del plan de tratamiento. Si es una modificacion, inclui TODO el plan existente mas los cambios. NUNCA borres contenido existente." },
            action: { type: "STRING", description: 'Si es "create" crea nuevo. Si es "update" o "merge" modifica el existente preservando lo que no se cambia.' },
            section: { type: "STRING", description: "Que parte se modifica: general, objetivos, estrategias, frecuencia, observaciones, o null para plan completo." }
          },
          required: ["patient_id", "plan_text"]
        }
      },
      // ─── KNOWLEDGE BASE ───
      {
        name: "search_knowledge",
        description: "Busca en la base de conocimiento clinica (articulos, protocolos, evidencia).",
        parameters: {
          type: "OBJECT",
          properties: {
            query: { type: "STRING", description: "Termino de busqueda clinica." }
          },
          required: ["query"]
        }
      },
      {
        name: "add_knowledge",
        description: "Agrega un articulo o entrada a la base de conocimiento.",
        parameters: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING", description: "Titulo del articulo o recurso." },
            content: { type: "STRING", description: "Contenido o resumen del articulo." },
            category: { type: "STRING", description: "Categoria: lenguaje, fonacion, deglucion, audologia, general." }
          },
          required: ["title", "content"]
        }
      },
      // ─── MATERIALS ───
      {
        name: "list_materials",
        description: "Lista los materiales terapeuticos disponibles.",
        parameters: {
          type: "OBJECT",
          properties: {
            category: { type: "STRING", description: "Filtrar por categoria." }
          }
        }
      },
      {
        name: "search_materials",
        description: "Busca materiales por titulo o tags.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: { type: "STRING", description: "Termino de busqueda." }
          },
          required: ["query"]
        }
      },
      // ─── STATISTICS ───
      {
        name: "get_statistics",
        description: "Obtiene estadisticas del consultorio: cantidad de pacientes, turnos, informes.",
        parameters: { type: "OBJECT", properties: {} }
      },
      {
        name: "check_missing_data",
        description: "Identifica pacientes con datos incompletos (sin telefono, sin diagnostico, etc).",
        parameters: { type: "OBJECT", properties: {} }
      },
      // ─── NOTEBOOKLM ───
      {
        name: "notebook_list",
        description: "Lista los notebooks clinicos disponibles en NotebookLM.",
        parameters: { type: "OBJECT", properties: {} }
      },
      {
        name: "notebook_ask",
        description: "Hace una pregunta clinica a un notebook de NotebookLM.",
        parameters: {
          type: "OBJECT",
          properties: {
            notebook_id: { type: "STRING", description: "ID del notebook." },
            question: { type: "STRING", description: "Pregunta clinica a investigar." }
          },
          required: ["notebook_id", "question"]
        }
      },
      // ─── FOLLOW-UP ───
      {
        name: "get_upcoming_appointments",
        description: "Lista los proximos turnos de los proximos 7 dias.",
        parameters: { type: "OBJECT", properties: {} }
      }
    ];
    router3.post("/telegram/process-text", async (req, res) => {
      const { message_text, chat_id, user_id } = req.body;
      const aiModel2 = req.app.locals.aiModel;
      const aiModelFallback2 = req.app.locals.aiModelFallback;
      const protocol = req.headers && (req.headers["x-forwarded-proto"] || req.headers["x-original-protocol"]) || "https";
      const host = req.headers && req.headers["x-forwarded-host"] || req.get("host") || "fonoaudio-pro-app.vercel.app";
      try {
        const result = await processTextInternal(message_text, chat_id, user_id, aiModel2, protocol, host, aiModelFallback2);
        res.json(result);
      } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router3.get("/telegram/pending-queue", async (req, res) => {
      const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
      const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl2 || !supabaseKey2) {
        return res.json({ status: "ok", items: pendingQueueMemory, source: "memory" });
      }
      try {
        const res2 = await fetch(`${supabaseUrl2}/rest/v1/telegram_pending_queue?status=eq.pending&order=created_at.desc&limit=50`, {
          headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}` }
        });
        if (!res2.ok) {
          return res.json({ status: "ok", items: pendingQueueMemory, source: "memory" });
        }
        const items = await res2.json();
        return res.json({ status: "ok", items, source: "supabase" });
      } catch {
        return res.json({ status: "ok", items: pendingQueueMemory, source: "memory" });
      }
    });
    router3.post("/telegram/process-pending", async (req, res) => {
      const { item_id, user_id } = req.body;
      const aiModel2 = req.app.locals.aiModel;
      const aiModelFallback2 = req.app.locals.aiModelFallback;
      let item = pendingQueueMemory.find((i) => i.id === item_id);
      if (!item) {
        const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
        const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        if (supabaseUrl2 && supabaseKey2) {
          const res2 = await fetch(`${supabaseUrl2}/rest/v1/telegram_pending_queue?id=eq.${item_id}`, {
            headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}` }
          });
          if (res2.ok) {
            const items = await res2.json();
            item = items[0];
          }
        }
      }
      if (!item) {
        return res.status(404).json({ status: "error", message: "Item not found" });
      }
      if (!item.file_id) {
        return res.status(400).json({ status: "error", message: "No file_id to process" });
      }
      try {
        const TELEGRAM_BOT_TOKEN2 = process.env.TELEGRAM_BOT_TOKEN;
        const fileInfoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/getFile?file_id=${item.file_id}`);
        const fileInfo = await fileInfoRes.json();
        if (!fileInfo.ok) {
          return res.status(400).json({ status: "error", message: "File no longer available on Telegram" });
        }
        const fileUrl2 = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN2}/${fileInfo.result.file_path}`;
        const fileRes = await fetch(fileUrl2);
        const fileBuffer = await fileRes.arrayBuffer();
        const base64Data = Buffer.from(fileBuffer).toString("base64");
        const ext = fileInfo.result.file_path.split(".").pop()?.toLowerCase() || "";
        const mimeMap = {
          "jpg": "image/jpeg",
          "jpeg": "image/jpeg",
          "png": "image/png",
          "mp3": "audio/mpeg",
          "ogg": "audio/ogg",
          "wav": "audio/wav",
          "m4a": "audio/mp4",
          "mp4": "video/mp4",
          "pdf": "application/pdf"
        };
        const mimeType = mimeMap[ext] || item.mime_type || "application/octet-stream";
        const parts = [{ text: `Analiz\xE1 este archivo cl\xEDnicamente: ${item.file_name}. MIME: ${mimeType}` }];
        if (mimeType.startsWith("image/") || mimeType.startsWith("audio/") || mimeType === "application/pdf") {
          parts.push({ inlineData: { mimeType, data: base64Data } });
        }
        const geminiResult = await callGeminiResilient(parts, aiModel2, GEMINI_MODEL_CHAIN[0]);
        if (geminiResult.ok) {
          const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
          const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
          if (supabaseUrl2 && supabaseKey2) {
            await fetch(`${supabaseUrl2}/rest/v1/telegram_pending_queue?id=eq.${item.id}`, {
              method: "PATCH",
              headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}`, "Content-Type": "application/json" },
              body: JSON.stringify({ status: "processed", partial_analysis: geminiResult.text })
            });
          }
          const idx = pendingQueueMemory.findIndex((i) => i.id === item.id);
          if (idx >= 0) pendingQueueMemory.splice(idx, 1);
          if (item.chat_id) {
            await sendTelegramMessage(item.chat_id, `\u2705 Archivo procesado: ${item.file_name}

${geminiResult.text.slice(0, 500)}`);
          }
          return res.json({ status: "ok", analysis: geminiResult.text });
        } else {
          return res.status(503).json({ status: "error", message: "AI still unavailable. Item remains in queue." });
        }
      } catch (e) {
        return res.status(500).json({ status: "error", message: e.message });
      }
    });
    router3.post("/google/calendar/create-event", async (req, res) => {
      const { access_token, summary, description, start, end, colorId } = req.body;
      if (!access_token) {
        return res.status(400).json({ status: "error", message: "access_token is required" });
      }
      try {
        const eventBody = {
          summary: summary || "Cita - FonoAudio Pro AI",
          description: description || "",
          start: { dateTime: start, timeZone: "America/Argentina/Buenos_Aires" },
          end: { dateTime: end, timeZone: "America/Argentina/Buenos_Aires" }
        };
        if (colorId) eventBody.colorId = colorId;
        const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${access_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(eventBody)
        });
        const data = await response.json();
        if (!response.ok) {
          console.error("[Google Calendar Create] API error:", data);
          return res.status(response.status).json({ status: "error", message: data.error?.message || "Failed to create event", details: data });
        }
        res.json({ status: "ok", event_id: data.id, html_link: data.htmlLink });
      } catch (e) {
        console.error("[Google Calendar Create] Error:", e.message);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router3.post("/google/calendar/list-events", async (req, res) => {
      const { access_token, time_min, time_max, max_results } = req.body;
      if (!access_token) {
        return res.status(400).json({ status: "error", message: "access_token is required" });
      }
      try {
        const params = new URLSearchParams({
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: String(max_results || 50)
        });
        if (time_min) params.set("timeMin", time_min);
        if (time_max) params.set("timeMax", time_max);
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
          headers: { "Authorization": `Bearer ${access_token}` }
        });
        const data = await response.json();
        if (!response.ok) {
          return res.status(response.status).json({ status: "error", message: data.error?.message || "Failed to list events" });
        }
        const events = (data.items || []).map((ev) => ({
          id: ev.id,
          summary: ev.summary,
          description: ev.description,
          start: ev.start?.dateTime || ev.start?.date,
          end: ev.end?.dateTime || ev.end?.date,
          status: ev.status,
          html_link: ev.htmlLink,
          colorId: ev.colorId
        }));
        res.json({ status: "ok", events, total: events.length });
      } catch (e) {
        console.error("[Google Calendar List] Error:", e.message);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router3.get("/worker/check-reminders", async (req, res) => {
      const TELEGRAM_BOT_TOKEN2 = process.env.TELEGRAM_BOT_TOKEN;
      const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
      const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
      const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl2 || !supabaseKey2) {
        return res.json({ status: "skip", message: "Supabase not configured" });
      }
      try {
        const supabase2 = (0, import_supabase_js3.createClient)(supabaseUrl2, supabaseKey2);
        const now = /* @__PURE__ */ new Date();
        const today = now.toISOString().split("T")[0];
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        const { data: appointments, error } = await supabase2.from("appointments").select("*").eq("status", "pending").eq("date", today);
        if (error) throw error;
        if (!appointments || appointments.length === 0) {
          return res.json({ status: "ok", sent: 0, message: "No pending appointments today" });
        }
        let sentCount = 0;
        for (const appt of appointments) {
          if (!appt.time) continue;
          const [aH, aM] = appt.time.split(":").map(Number);
          const diffMin = aH * 60 + aM - (currentHour * 60 + currentMin);
          if (appt.type === "recordatorio") {
            if (diffMin >= 0 && diffMin <= 15) {
              const reminderMsg = `\u{1F514} *Recordatorio FonoAudio-Pro*

\u{1F4CC} ${appt.patient_name || "Recordatorio"}
\u{1F550} Hora: ${appt.time} hs

_FonoAudio Pro AI - Asistente Cl\xEDnico_`;
              const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: Number(CHAT_ID), text: reminderMsg, parse_mode: "Markdown" })
              });
              const d = await r.json();
              if (d.ok) {
                sentCount++;
                await supabase2.from("appointments").update({ status: "completed" }).eq("id", appt.id);
              } else console.warn("[Worker] Failed to send reminder:", d.description);
            }
          } else {
            if (diffMin > 0 && diffMin <= 30) {
              const reminderMsg = `\u{1F514} *Recordatorio de Cita*

\u{1F464} Paciente: ${appt.patient_name || "Sin nombre"}
\u{1F550} Hora: ${appt.time} hs
\u{1F4CB} Tipo: ${appt.type || "Consulta"}
\u{1F4DD} Notas: ${appt.notes || "Sin notas"}

_FonoAudio Pro - Te faltan ${diffMin} minutos_`;
              const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: Number(CHAT_ID), text: reminderMsg, parse_mode: "Markdown" })
              });
              const d = await r.json();
              if (d.ok) sentCount++;
              else console.warn("[Worker] Failed to send reminder:", d.description);
            }
          }
        }
        res.json({ status: "ok", sent: sentCount, total: appointments.length });
      } catch (e) {
        console.error("[Worker] Error:", e.message);
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router3.get("/worker/daily-summary", async (req, res) => {
      const TELEGRAM_BOT_TOKEN2 = process.env.TELEGRAM_BOT_TOKEN;
      const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
      const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
      const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl2 || !supabaseKey2) {
        return res.json({ status: "skip", message: "Supabase not configured" });
      }
      try {
        const supabase2 = (0, import_supabase_js3.createClient)(supabaseUrl2, supabaseKey2);
        const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        const { data: appointments } = await supabase2.from("appointments").select("*").eq("date", today);
        const { data: patients } = await supabase2.from("patients").select("id, name, diagnosis, alerts");
        const pending = (appointments || []).filter((a) => a.status === "pending");
        const completed = (appointments || []).filter((a) => a.status === "completed");
        const criticalPatients = (patients || []).filter((p) => p.alerts && p.alerts.length > 0);
        const summary = `\u{1F4CA} *Resumen del D\xEDa*

\u{1F4C5} Citas hoy: ${appointments?.length || 0}
\u2705 Completadas: ${completed.length}
\u23F3 Pendientes: ${pending.length}
\u{1F465} Pacientes totales: ${patients?.length || 0}
\u26A0\uFE0F Pacientes con alertas: ${criticalPatients.length}${pending.length > 0 ? "\n\nPr\xF3ximas citas:\n" + pending.map((a) => `\u2022 ${a.time} hs - ${a.patient_name}`).join("\n") : ""}`;
        const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: Number(CHAT_ID), text: summary, parse_mode: "Markdown" })
        });
        const d = await r.json();
        await autoSetupWebhook(req);
        res.json({ status: d.ok ? "ok" : "error", message: d.description });
      } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router3.post("/telegram/webhook", async (req, res) => {
      try {
        const update = req.body;
        if (!update || !update.message && !update.edited_message) {
          return res.json({ ok: true });
        }
        const msg = update.message || update.edited_message;
        const chat_id = msg.chat?.id;
        if (!chat_id) return res.json({ ok: true });
        try {
          const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
          const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
          if (supabaseUrl2 && supabaseKey2) {
            await fetch(`${supabaseUrl2}/rest/v1/telegram_pending_queue?chat_id=eq.${chat_id}`, {
              method: "DELETE",
              headers: { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}` }
            });
            await fetch(`${supabaseUrl2}/rest/v1/telegram_pending_queue`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}` },
              body: JSON.stringify({ chat_id: String(chat_id), direction: "incoming", status: "chat_registered", updated_at: (/* @__PURE__ */ new Date()).toISOString() })
            });
          }
        } catch (e) {
          console.warn("[Webhook] Could not persist chat_id:", e?.message);
        }
        const aiModel2 = req.app.locals.aiModel;
        const aiModelFallback2 = req.app.locals.aiModelFallback;
        const user_id = await findProfessionalId();
        const message_text = msg.text || msg.caption || "";
        const hasMedia = !!(msg.photo || msg.audio || msg.video || msg.document || msg.voice);
        console.log(`[Telegram Webhook] Update received. chatId: ${chat_id}, textLen: ${message_text.length}, hasMedia: ${hasMedia}, aiModel: ${aiModel2 ? "SET" : "NULL"}, user_id: ${user_id || "none"}`);
        if (!user_id) {
          console.error("[Telegram Webhook] No professional ID found. Bot may not work correctly.");
        }
        if (hasMedia) {
          let file_id = "";
          let media_type = "document";
          if (msg.photo) {
            file_id = msg.photo[msg.photo.length - 1]?.file_id || "";
            media_type = "photo";
          } else if (msg.audio) {
            file_id = msg.audio.file_id;
            media_type = "audio";
          } else if (msg.voice) {
            file_id = msg.voice.file_id;
            media_type = "voice";
          } else if (msg.video) {
            file_id = msg.video.file_id;
            media_type = "video";
          } else if (msg.document) {
            file_id = msg.document.file_id;
            media_type = "document";
          }
          logDebug("Telegram Webhook", `Media detected. type: ${media_type}, file_id: ${file_id ? file_id.substring(0, 20) + "..." : "EMPTY"}, chat_id: ${chat_id}`);
          if (file_id) {
            try {
              const mediaResult = await processMediaInternal(file_id, media_type, message_text, chat_id, user_id, aiModel2);
              logDebug("Telegram Webhook", `processMediaInternal result: status=${mediaResult?.status}, type=${mediaResult?.type}, sent_to_telegram=${mediaResult?.sent_to_telegram}`);
              if (mediaResult?.status === "error" || mediaResult?.error) {
                logError("Telegram Webhook processMediaInternal", new Error(mediaResult?.message || mediaResult?.error));
              }
            } catch (mediaErr) {
              logError("Telegram Webhook processMediaInternal", mediaErr);
              if (chat_id && process.env.TELEGRAM_BOT_TOKEN) {
                try {
                  const TELEGRAM_BOT_TOKEN2 = process.env.TELEGRAM_BOT_TOKEN;
                  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id, text: `Error procesando el archivo: ${mediaErr.message}` })
                  });
                } catch (tgErr) {
                  logError("Telegram Webhook notify user", tgErr);
                }
              }
            }
          } else {
            logDebug("Telegram Webhook", `file_id is empty for media type: ${media_type}`);
            if (chat_id && process.env.TELEGRAM_BOT_TOKEN) {
              try {
                const TELEGRAM_BOT_TOKEN2 = process.env.TELEGRAM_BOT_TOKEN;
                await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id, text: "No pude descargar el archivo. Intent\xE1 enviarlo de nuevo." })
                });
              } catch (tgErr) {
                logError("Telegram Webhook notify user", tgErr);
              }
            }
          }
        } else if (message_text) {
          logDebug("Telegram Webhook", `Text message received, routing to processTextInternal`);
          await processTextInternal(message_text, chat_id, user_id, aiModel2, void 0, void 0, aiModelFallback2);
        }
        res.json({ ok: true });
      } catch (e) {
        logError("Telegram Webhook outer catch", e);
        try {
          const msg = req.body?.message;
          const chat_id = msg?.chat?.id;
          if (chat_id && process.env.TELEGRAM_BOT_TOKEN) {
            const TELEGRAM_BOT_TOKEN2 = process.env.TELEGRAM_BOT_TOKEN;
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id, text: `Ocurri\xF3 un error inesperado. Prob\xE1 de nuevo o escrib\xED por texto.` })
            });
          }
        } catch (notifyErr) {
          logError("Telegram Webhook final fallback notify", notifyErr);
        }
        res.status(200).json({ ok: true, error: e.message });
      }
    });
    router3.get("/telegram/setup-webhook", async (req, res) => {
      const TELEGRAM_BOT_TOKEN2 = process.env.TELEGRAM_BOT_TOKEN;
      if (!TELEGRAM_BOT_TOKEN2) {
        return res.status(400).json({ status: "error", message: "TELEGRAM_BOT_TOKEN is not configured in environment." });
      }
      const host = req.get("host") || "fonoaudio-pro-ai.vercel.app";
      const protocol = "https";
      const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;
      try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN2}/setWebhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: webhookUrl })
        });
        const data = await response.json();
        res.json({
          status: data.ok ? "ok" : "error",
          message: data.ok ? `Webhook set successfully to ${webhookUrl}` : `Failed to set webhook: ${data.description}`,
          details: data
        });
      } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    router3.post("/appointments/reschedule", async (req, res) => {
      const { appointment_id, new_date, new_time } = req.body || {};
      if (!appointment_id || !new_date) {
        return res.status(400).json({ status: "error", message: "appointment_id y new_date requeridos" });
      }
      const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
      const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      const headers = { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}`, "Content-Type": "application/json" };
      try {
        const getRes = await fetch(`${supabaseUrl2}/rest/v1/appointments?id=eq.${appointment_id}&select=id,patient_name,date,time,type,google_event_id`, {
          headers
        });
        const rows = await getRes.json();
        const row = Array.isArray(rows) && rows[0];
        if (!row) return res.status(404).json({ status: "error", message: "Turno no encontrado" });
        const updated = { date: new_date, time: new_time || (row.time || "09:00") };
        const patchRes = await fetch(`${supabaseUrl2}/rest/v1/appointments?id=eq.${appointment_id}`, {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=representation" },
          body: JSON.stringify(updated)
        });
        const patchData = await patchRes.json();
        if (!patchRes.ok) throw new Error(typeof patchData === "string" ? patchData : patchData?.message || "update failed");
        const updatedRow = Array.isArray(patchData) ? patchData[0] : row;
        let calendarSynced = false;
        let calendarError = null;
        if (updatedRow.google_event_id) {
          try {
            let accessToken = null;
            const { data: gauthRows } = await fetch(`${supabaseUrl2}/rest/v1/google_auth?select=access_token,refresh_token,expires_at&limit=1`, {
              headers
            }).then((r) => r.json()).then((d) => ({ data: Array.isArray(d) ? d : [] })).catch(() => ({ data: [] }));
            const gauth = gauthRows[0];
            if (gauth && gauth.access_token) {
              accessToken = gauth.access_token;
              const expiresAt = gauth.expires_at ? new Date(gauth.expires_at).getTime() : 0;
              if (Date.now() >= expiresAt - 5 * 60 * 1e3 && gauth.refresh_token) {
                try {
                  const rf = await fetch(`${process.env.BACKEND_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")}/api/google/refresh-token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refresh_token: gauth.refresh_token })
                  });
                  if (rf.ok) {
                    const rd = await rf.json();
                    accessToken = rd.access_token || accessToken;
                  }
                } catch {
                }
              }
              const startISO = `${new_date}T${new_time || (row.time || "09:00")}:00`;
              const calRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${updatedRow.google_event_id}`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({ start: { dateTime: startISO, timeZone: "America/Argentina/Buenos_Aires" } })
              });
              if (calRes.ok) calendarSynced = true;
              else calendarError = `Google Calendar HTTP ${calRes.status}`;
            }
          } catch (ce) {
            calendarError = ce?.message || String(ce);
          }
        }
        try {
          const tgMsg = `\u{1F4C5} <b>Turno reprogramado</b> \u2014 ${row.patient_name || "Paciente"} \u2192 ${new_date}${new_time ? ` ${new_time}` : ""}.`;
          await sendTelegramMessage(
            process.env.TELEGRAM_CHAT_ID || "8706264359",
            tgMsg,
            /* parseHtml */
            true
          );
        } catch {
        }
        res.json({
          status: "ok",
          message: calendarSynced ? `Turno de ${row.patient_name} reprogramado a ${new_date}${new_time ? ` a las ${new_time}` : ""} (sincronizado con Google Calendar).` : `Turno reprogramado en el sistema.${calendarError ? ` (Google Calendar: ${calendarError})` : ""}`,
          appointment: updatedRow,
          calendarSynced
        });
      } catch (e) {
        res.status(500).json({ status: "error", message: e?.message || String(e) });
      }
    });
    router3.post("/notifications/save-subscription", async (req, res) => {
      const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
      const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      const headers = { apikey: `Authorization: ${supabaseKey2}`, "Content-Type": "application/json" };
      try {
        const sub = req.body;
        if (!sub || !sub.endpoint) {
          return res.status(400).json({ status: "error", message: "subscription inv\xE1lida" });
        }
        const payload = { endpoint: sub.endpoint, keys: sub.keys || {}, expiration_time: sub.expirationTime, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
        const r = await fetch(`${supabaseUrl2}/rest/v1/push_subscriptions`, {
          method: "POST",
          headers: { ...headers, Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify(payload)
        });
        if (!r.ok) {
          const t = await r.text().catch(() => "");
          console.error("[save-subscription] error:", r.status, t);
        }
        return res.json({ status: "ok", message: "Suscripci\xF3n guardada" });
      } catch (e) {
        console.error("[save-subscription] error:", e?.message);
        return res.status(500).json({ status: "error", message: e?.message || String(e) });
      }
    });
    router3.post("/appointments/move-room", async (req, res) => {
      const { appointment_id, room_name } = req.body || {};
      if (!appointment_id || !room_name) return res.status(400).json({ status: "error", message: "appointment_id y room_name requeridos" });
      const supabaseUrl2 = process.env.VITE_SUPABASE_URL;
      const supabaseKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl2 || !supabaseKey2) return res.status(500).json({ status: "error", message: "Configuracion Supabase incompleta" });
      const H = { apikey: supabaseKey2, Authorization: `Bearer ${supabaseKey2}`, "Content-Type": "application/json" };
      try {
        const getRes = await fetch(`${supabaseUrl2}/rest/v1/appointments?id=eq.${appointment_id}&select=id,patient_name,date,time,roomid,google_event_id`, { headers: H });
        const rows = await getRes.json();
        const row = Array.isArray(rows) && rows[0];
        if (!row) return res.status(404).json({ status: "error", message: "Turno no encontrado" });
        const pr = await fetch(`${supabaseUrl2}/rest/v1/appointments?id=eq.${appointment_id}`, { method: "PATCH", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify({ roomid: room_name }) });
        let pd;
        try {
          pd = await pr.json();
        } catch {
          pd = await pr.text().catch(() => "");
        }
        if (!pr.ok) throw new Error(typeof pd === "string" ? pd : pd?.message || "update failed");
        const updatedRow = Array.isArray(pd) ? pd[0] : { ...row, roomid: room_name };
        let calendarSynced = false;
        if (row.google_event_id) {
          try {
            const ga = new googleService();
            await ga.refreshIfNeeded();
            await ga.patchEvent(row.google_event_id, { location: room_name });
            calendarSynced = true;
          } catch (e) {
            console.error("[move-room] Calendar sync error:", e.message);
          }
        }
        try {
          const tgToken = process.env.TELEGRAM_BOT_TOKEN;
          const tgChat = process.env.TELEGRAM_CHAT_ID;
          if (tgToken && tgChat) {
            await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: Number(tgChat), text: `Turno de ${row.patient_name || "paciente"} (${row.date} ${row.time}) movido al consultorio ${room_name}.` })
            });
          }
        } catch (e) {
        }
        return res.json({ status: "success", message: `Turno movido al consultorio ${room_name}`, appointment: updatedRow, calendarSynced });
      } catch (e) {
        console.error("[move-room] error:", e?.message);
        return res.status(500).json({ status: "error", message: e?.message || String(e) });
      }
    });
    api_default = router3;
  }
});

// routes/ocr.js
var import_express4, router4, ocr_default;
var init_ocr = __esm({
  "routes/ocr.js"() {
    import_express4 = __toESM(require("express"), 1);
    router4 = import_express4.default.Router();
    router4.post("/", async (req, res) => {
      try {
        const { imageBase64, mimeType, docType } = req.body;
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
          return res.status(400).json({ status: "error", message: "GOOGLE_API_KEY no configurada" });
        }
        let prompt = "Extrae todo el texto de esta imagen de forma precisa. Responde SOLO con el texto extra\xEDdo.";
        if (docType === "anamnesis") {
          prompt = `Analiza este documento de anamnesis cl\xEDnica. Extrae la informaci\xF3n en formato JSON:
{
  "reasonForConsultation": "",
  "personalHistory": "",
  "medicalHistory": "",
  "familyHistory": "",
  "observations": ""
}
Si alg\xFAn campo no est\xE1 presente, d\xE9jalo vac\xEDo. Responde SOLO con el JSON.`;
        } else if (docType === "evaluation") {
          prompt = `Analiza esta evaluaci\xF3n cl\xEDnica. Extrae en formato JSON:
{
  "testName": "",
  "date": "",
  "score": 0,
  "maxScore": 0,
  "interpretation": "",
  "observations": ""
}
Responde SOLO con el JSON.`;
        }
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: prompt },
                { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } }
              ]
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
          })
        });
        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        res.json({ status: "ok", text, raw: data });
      } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
      }
    });
    ocr_default = router4;
  }
});

// utils/supabaseClient.js
var import_supabase_js4, env, supabaseUrl, supabaseKey, SUPABASE_URL, SUPABASE_KEY, supabase;
var init_supabaseClient = __esm({
  "utils/supabaseClient.js"() {
    import_supabase_js4 = require("@supabase/supabase-js");
    env = process.env;
    supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
    supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("placeholder")) {
      console.warn("[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not configured. Using placeholder - some features will not work.");
    }
    SUPABASE_URL = supabaseUrl || "https://placeholder.supabase.co";
    SUPABASE_KEY = supabaseKey || "placeholder-key";
    supabase = (0, import_supabase_js4.createClient)(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        flowType: "pkce",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
  }
});

// server/services/ingestionService.js
var pdf, import_generative_ai2, CHUNK_SIZE, CHUNK_OVERLAP, IngestionService, ingestionService_default;
var init_ingestionService = __esm({
  "server/services/ingestionService.js"() {
    pdf = __toESM(require("pdf-parse"), 1);
    init_supabaseClient();
    import_generative_ai2 = require("@google/generative-ai");
    CHUNK_SIZE = 1e3;
    CHUNK_OVERLAP = 200;
    IngestionService = class {
      constructor() {
        this.genAI = new import_generative_ai2.GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        this.embeddingModel = this.genAI.getGenerativeModel({ model: "text-embedding-004" });
      }
      /**
       * Procesa imágenes (estudios) usando OCR de Gemini
       */
      async ingestImage(buffer, metadata) {
        const { title, patient_id, tags } = metadata;
        const imagePart = {
          inlineData: {
            data: buffer.toString("base64"),
            mimeType: "image/jpeg"
            // Deberíamos detectar el tipo real
          }
        };
        const prompt = "Act\xFAa como un fonoaudi\xF3logo experto. Realiza un OCR preciso de este estudio cl\xEDnico y extrae los datos m\xE1s relevantes: qu\xE9 estudio es, fecha, hallazgos clave, diagn\xF3stico sugerido y cualquier dato relevante para la historia cl\xEDnica del paciente.";
        const result = await this.model.generateContent([prompt, imagePart]);
        const extractedText = result.response.text();
        return await this.ingestText(extractedText, { ...metadata, title: `OCR: ${title}` });
      }
      /**
       * Procesa un buffer de PDF y lo ingesta en el Clinical Source Engine
       */
      async ingestPdf(buffer, metadata) {
        const { title, category, source_url, patient_id, tags } = metadata;
        const data = await pdf(buffer);
        const fullText = data.text;
        const pageCount = data.numpages;
        const chunks = this.createChunks(fullText);
        const { data: source, error: sourceError } = await supabase.from("clinical_sources").insert({
          title,
          category,
          source_url,
          validated_by: "System Ingestion",
          page_count: pageCount
        }).select().single();
        if (sourceError) throw new Error(`Error al crear fuente cl\xEDnica: ${sourceError.message}`);
        const ingestionResults = [];
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embeddingResult = await this.generateEmbedding(chunk.text);
          const { error: embedError } = await supabase.from("source_embeddings").insert({
            source_id: source.id,
            content: chunk.text,
            embedding: embeddingResult,
            page_number: chunk.page,
            section_title: chunk.section || "General",
            patient_id: patient_id || null,
            tags: tags || [],
            confidence_score: 1
          });
          if (embedError) console.error(`Error al guardar chunk ${i}:`, embedError);
          else ingestionResults.push(i);
        }
        return {
          sourceId: source.id,
          chunksIngested: ingestionResults.length,
          totalPages: pageCount
        };
      }
      /**
       * Ingesta texto directo (para pruebas y manual)
       */
      async ingestText(text, metadata) {
        const { title, category, source_url, patient_id, tags } = metadata;
        const { data: source, error: sourceError } = await supabase.from("clinical_sources").insert({
          title,
          category,
          source_url,
          validated_by: "System Text Ingestion",
          page_count: 1
        }).select().single();
        if (sourceError) throw new Error(`Error al crear fuente cl\xEDnica: ${sourceError.message}`);
        const chunks = this.createChunks(text);
        const ingestionResults = [];
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embeddingResult = await this.generateEmbedding(chunk.text);
          const { error: embedError } = await supabase.from("source_embeddings").insert({
            source_id: source.id,
            content: chunk.text,
            embedding: embeddingResult,
            page_number: 1,
            section_title: "General",
            patient_id: patient_id || null,
            tags: tags || [],
            confidence_score: 1
          });
          if (embedError) console.error(`Error al guardar chunk ${i}:`, embedError);
          else ingestionResults.push(i);
        }
        return {
          sourceId: source.id,
          chunksIngested: ingestionResults.length,
          totalPages: 1
        };
      }
      /**
       * Divide el texto en fragmentos con solapamiento (overlap)
       */
      createChunks(text) {
        const chunks = [];
        let start = 0;
        while (start < text.length) {
          const end = Math.min(start + CHUNK_SIZE, text.length);
          const chunkText = text.substring(start, end);
          chunks.push({
            text: chunkText.trim(),
            start,
            end,
            page: 1
          });
          start += CHUNK_SIZE - CHUNK_OVERLAP;
        }
        return chunks.filter((c) => c.text.length > 10);
      }
      /**
       * Genera embedding usando Gemini
       */
      async generateEmbedding(text) {
        try {
          const result = await this.embeddingModel.embedContent(text);
          return result.embedding.values;
        } catch (error) {
          console.error("Error generando embedding:", error);
          throw error;
        }
      }
    };
    ingestionService_default = new IngestionService();
  }
});

// routes/clinical.js
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return (0, import_supabase_js5.createClient)(url, key);
}
var import_express5, import_supabase_js5, import_generative_ai3, router5, clinical_default;
var init_clinical = __esm({
  "routes/clinical.js"() {
    import_express5 = __toESM(require("express"), 1);
    import_supabase_js5 = require("@supabase/supabase-js");
    init_ingestionService();
    import_generative_ai3 = require("@google/generative-ai");
    router5 = import_express5.default.Router();
    router5.post("/ingest", async (req, res) => {
      try {
        const { fileBase64, fileName, fileType, metadata } = req.body;
        if (!fileBase64 || !fileName) {
          return res.status(400).json({ error: "Faltan datos requeridos (fileBase64 o fileName)" });
        }
        const buffer = Buffer.from(fileBase64, "base64");
        const result = await ingestionService_default.ingestPdf(buffer, {
          title: metadata?.title || fileName,
          category: metadata?.category || "general",
          source_url: metadata?.source_url || "",
          patient_id: metadata?.patient_id || null,
          tags: metadata?.tags || []
        });
        res.json({ status: "ok", ...result });
      } catch (error) {
        console.error("[Clinical Ingest Error]:", error);
        res.status(500).json({ error: error.message });
      }
    });
    router5.post("/ingest-text", async (req, res) => {
      try {
        const { text, metadata } = req.body;
        if (!text) {
          return res.status(400).json({ error: "El texto es requerido" });
        }
        const result = await ingestionService_default.ingestText(text, {
          title: metadata?.title || "Documento de Texto",
          category: metadata?.category || "general",
          source_url: metadata?.source_url || "",
          patient_id: metadata?.patient_id || null,
          tags: metadata?.tags || []
        });
        res.json({ status: "ok", ...result });
      } catch (error) {
        console.error("[Clinical Ingest Text Error]:", error);
        res.status(500).json({ error: error.message });
      }
    });
    router5.post("/ingest-image", async (req, res) => {
      try {
        const { fileBase64, fileName, metadata } = req.body;
        if (!fileBase64 || !fileName) {
          return res.status(400).json({ error: "Faltan datos requeridos (fileBase64 o fileName)" });
        }
        const buffer = Buffer.from(fileBase64, "base64");
        const result = await ingestionService_default.ingestImage(buffer, {
          title: metadata?.title || fileName,
          category: metadata?.category || "estudio-clinico",
          patient_id: metadata?.patient_id || null,
          tags: metadata?.tags || ["ocr", "estudio-externo"]
        });
        res.json({ status: "ok", ...result });
      } catch (error) {
        console.error("[Clinical Ingest Image Error]:", error);
        res.status(500).json({ error: error.message });
      }
    });
    router5.get("/history", async (req, res) => {
      try {
        const url = process.env.VITE_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        if (!url || !key) return res.status(500).json({ error: "Missing env vars", url: !!url, key: !!key });
        const supabase2 = (0, import_supabase_js5.createClient)(url, key);
        const { data, error } = await supabase2.from("clinical_history_records").select("*").limit(10);
        if (error) throw error;
        res.json({ status: "ok", history: data || [] });
      } catch (error) {
        console.error("[Clinical History Error]:", error);
        res.status(500).json({ error: error.message, stack: error.stack });
      }
    });
    router5.post("/retrieve", async (req, res) => {
      const { query, patientId } = req.body;
      if (!query) return res.status(400).json({ error: "Query es requerido" });
      try {
        const genAI2 = new import_generative_ai3.GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const model2 = genAI2.getGenerativeModel({ model: "text-embedding-004" });
        const embedResult = await model2.embedContent(query);
        const queryEmbedding = embedResult.embedding.values;
        const supabase2 = getSupabase();
        if (!supabase2) throw new Error("Supabase not configured");
        const { data, error } = await supabase2.rpc("match_source_embeddings", {
          query_embedding: queryEmbedding,
          match_threshold: 0.4,
          match_count: 5
        });
        if (error) throw error;
        const context = (data || []).map((d) => ({
          text: d.content,
          score: d.similarity,
          source: d.source_title,
          page: d.page_number
        }));
        res.json({ context });
      } catch (error) {
        console.error("[Clinical Retrieval Error]:", error);
        res.status(500).json({ error: error.message });
      }
    });
    router5.post("/patient-sync", async (req, res) => {
      try {
        const patientData = req.body;
        if (!patientData || !patientData.id) {
          return res.status(400).json({ error: "Datos de paciente o ID requeridos" });
        }
        const supabase2 = getSupabase();
        if (!supabase2) throw new Error("Supabase no configurado en backend");
        const { data, error } = await supabase2.from("patients").upsert([patientData], { onConflict: "id" });
        if (error) throw error;
        res.json({ status: "ok", patient: patientData });
      } catch (error) {
        console.error("[Patient Sync Error]:", error);
        res.status(500).json({ error: error.message });
      }
    });
    clinical_default = router5;
  }
});

// routes/communication.js
function getSupabase2() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return (0, import_supabase_js6.createClient)(url, key);
}
async function getGoogleAccessToken(userId) {
  const supabase2 = getSupabase2();
  if (!supabase2 || !userId) return null;
  const { data } = await supabase2.from("google_auth").select("access_token, refresh_token, expires_at").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) > /* @__PURE__ */ new Date()) {
    return data.access_token;
  }
  if (data.refresh_token) {
    try {
      const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: data.refresh_token,
          grant_type: "refresh_token"
        })
      });
      if (resp.ok) {
        const tokenData = await resp.json();
        const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1e3).toISOString();
        await supabase2.from("google_auth").update({ access_token: tokenData.access_token, expires_at: expiresAt }).eq("user_id", userId);
        return tokenData.access_token;
      }
    } catch (e) {
      console.error("[Communication] Token refresh failed:", e.message);
    }
  }
  return null;
}
async function correlatePatient(senderEmail, senderName) {
  const supabase2 = getSupabase2();
  if (!supabase2) return null;
  if (senderEmail) {
    const { data } = await supabase2.from("patients").select("id, name, email, phone, diagnosis, age").ilike("email", senderEmail).limit(1).maybeSingle();
    if (data) return { id: data.id, name: data.name, email: data.email, phone: data.phone, diagnosis: data.diagnosis, age: data.age, match_type: "email" };
  }
  if (senderName) {
    const firstName = senderName.split(" ")[0].toLowerCase();
    const { data } = await supabase2.from("patients").select("id, name, email, phone, diagnosis, age").ilike("name", `%${firstName}%`).limit(1).maybeSingle();
    if (data) return { id: data.id, name: data.name, email: data.email, phone: data.phone, diagnosis: data.diagnosis, age: data.age, match_type: "name" };
  }
  return null;
}
var import_express6, import_supabase_js6, router6, communication_default;
var init_communication = __esm({
  "routes/communication.js"() {
    import_express6 = __toESM(require("express"), 1);
    import_supabase_js6 = require("@supabase/supabase-js");
    router6 = import_express6.default.Router();
    router6.get("/gmail/messages", async (req, res) => {
      const { userId, query = "in:inbox", pageToken, maxResults = 20 } = req.query;
      try {
        const accessToken = await getGoogleAccessToken(userId);
        if (!accessToken) {
          return res.json({ status: "ok", messages: [], nextPageToken: null, total: 0, hint: "Google not connected" });
        }
        const params = new URLSearchParams({
          q: query,
          maxResults: maxResults.toString()
        });
        if (pageToken) params.set("pageToken", pageToken);
        const listResp = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages?${params}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        );
        if (!listResp.ok) {
          return res.json({ status: "ok", messages: [], nextPageToken: null, total: 0 });
        }
        const listData = await listResp.json();
        const messages = listData.messages || [];
        const detailed = await Promise.all(
          messages.slice(0, 20).map(async (msg) => {
            const detailResp = await fetch(
              `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (!detailResp.ok) return null;
            const detail = await detailResp.json();
            const headers = detail.payload?.headers || [];
            const getHeader = (name) => headers.find((h) => h.name === name)?.value || "";
            return {
              id: detail.id,
              threadId: detail.threadId,
              subject: getHeader("Subject"),
              from: getHeader("From"),
              date: getHeader("Date"),
              snippet: detail.snippet || "",
              labelIds: detail.labelIds || [],
              isRead: !(detail.labelIds || []).includes("UNREAD")
            };
          })
        );
        res.json({
          status: "ok",
          messages: detailed.filter(Boolean),
          nextPageToken: listData.nextPageToken || null,
          total: listData.resultSizeEstimate || detailed.length
        });
      } catch (error) {
        console.error("[Gmail List] Error:", error.message);
        res.status(500).json({ status: "error", message: error.message });
      }
    });
    router6.get("/gmail/messages/:id", async (req, res) => {
      const { userId } = req.query;
      const { id } = req.params;
      try {
        let decodeBodyData = function(data2) {
          if (!data2) return "";
          try {
            const normalized = data2.replace(/-/g, "+").replace(/_/g, "/");
            return Buffer.from(normalized, "base64").toString("utf-8");
          } catch {
            try {
              return Buffer.from(data2, "base64url").toString("utf-8");
            } catch {
              return "";
            }
          }
        }, extractBody = function(part) {
          if (part.body?.data) {
            const decoded = decodeBodyData(part.body.data);
            if (part.mimeType === "text/html" && !bodyHtml) {
              bodyHtml = decoded;
            } else if (part.mimeType === "text/plain" && !body) {
              body = decoded;
            }
            return;
          }
          if (part.parts) {
            for (const p of part.parts) {
              extractBody(p);
            }
          }
        };
        const accessToken = await getGoogleAccessToken(userId);
        if (!accessToken) {
          return res.status(401).json({ status: "error", message: "Google token not available" });
        }
        const resp = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          return res.status(resp.status).json({ status: "error", message: err.error?.message || "Gmail API error" });
        }
        const data = await resp.json();
        const headers = data.payload?.headers || [];
        const getHeader = (name) => headers.find((h) => h.name === name)?.value || "";
        let body = "";
        let bodyHtml = "";
        extractBody(data.payload);
        const fromHeader = getHeader("From");
        const emailMatch = fromHeader.match(/<(.+?)>/);
        const senderEmail = emailMatch ? emailMatch[1] : fromHeader;
        const senderName = emailMatch ? fromHeader.replace(/<.*>/, "").trim() : fromHeader;
        const patient = await correlatePatient(senderEmail, senderName);
        res.json({
          status: "ok",
          message: {
            id: data.id,
            threadId: data.threadId,
            subject: getHeader("Subject"),
            from: getHeader("From"),
            to: getHeader("To"),
            date: getHeader("Date"),
            body,
            bodyHtml,
            snippet: data.snippet || "",
            labelIds: data.labelIds || [],
            isRead: !(data.labelIds || []).includes("UNREAD")
          },
          patient
        });
      } catch (error) {
        console.error("[Gmail Detail] Error:", error.message);
        res.status(500).json({ status: "error", message: error.message });
      }
    });
    router6.post("/gmail/messages", async (req, res) => {
      const { userId, to, subject, body } = req.body;
      try {
        const accessToken = await getGoogleAccessToken(userId);
        if (!accessToken) {
          return res.status(401).json({ status: "error", message: "Google token not available" });
        }
        const email = [
          `To: ${to}`,
          `Subject: ${subject}`,
          "Content-Type: text/plain; charset=utf-8",
          "",
          body
        ].join("\r\n");
        const encodedEmail = Buffer.from(email).toString("base64url");
        const resp = await fetch(
          "https://www.googleapis.com/gmail/v1/users/me/messages/send",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ raw: encodedEmail })
          }
        );
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          return res.status(resp.status).json({ status: "error", message: err.error?.message || "Gmail send error" });
        }
        const data = await resp.json();
        const supabase2 = getSupabase2();
        if (supabase2) {
          const patient = await correlatePatient(to, null);
          let threadId = null;
          if (patient) {
            const { data: existingThread } = await supabase2.from("message_threads").select("id").eq("patient_id", patient.id).eq("channel", "gmail").limit(1).maybeSingle();
            if (existingThread) {
              threadId = existingThread.id;
              await supabase2.from("message_threads").update({ last_message_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", threadId);
            } else {
              const { data: newThread } = await supabase2.from("message_threads").insert({
                patient_id: patient.id,
                channel: "gmail",
                subject
              }).select("id").single();
              threadId = newThread?.id;
            }
          }
          await supabase2.from("message_messages").insert({
            thread_id: threadId,
            channel: "gmail",
            direction: "outbound",
            sender_name: "Yo",
            sender_email: "",
            content: body,
            external_id: data.id
          });
        }
        res.json({ status: "ok", messageId: data.id });
      } catch (error) {
        console.error("[Gmail Send] Error:", error.message);
        res.status(500).json({ status: "error", message: error.message });
      }
    });
    router6.put("/gmail/messages/:id/read", async (req, res) => {
      const { userId } = req.body;
      const { id } = req.params;
      try {
        const accessToken = await getGoogleAccessToken(userId);
        if (!accessToken) {
          return res.status(401).json({ status: "error", message: "Google token not available" });
        }
        const resp = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${id}/modify`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ removeLabelIds: ["UNREAD"] })
          }
        );
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          return res.status(resp.status).json({ status: "error", message: err.error?.message });
        }
        res.json({ status: "ok" });
      } catch (error) {
        console.error("[Gmail Read] Error:", error.message);
        res.status(500).json({ status: "error", message: error.message });
      }
    });
    router6.get("/channels", (req, res) => {
      res.json({
        status: "ok",
        channels: [
          { id: "gmail", name: "Gmail", active: true },
          { id: "telegram", name: "Telegram", active: !!process.env.TELEGRAM_BOT_TOKEN },
          { id: "whatsapp", name: "WhatsApp", active: false }
        ]
      });
    });
    router6.get("/threads", async (req, res) => {
      const { channel, patient_id, page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      try {
        const supabase2 = getSupabase2();
        if (!supabase2) {
          return res.status(500).json({ status: "error", message: "Supabase not configured" });
        }
        let query = supabase2.from("message_threads").select("*, patients!inner(id, name, email)", { count: "exact" }).order("last_message_at", { ascending: false }).range(offset, offset + parseInt(limit) - 1);
        if (channel) query = query.eq("channel", channel);
        if (patient_id) query = query.eq("patient_id", patient_id);
        const { data, error, count } = await query;
        if (error) throw error;
        res.json({ status: "ok", threads: data || [], total: count || 0 });
      } catch (error) {
        console.error("[Threads List] Error:", error.message);
        res.status(500).json({ status: "error", message: error.message });
      }
    });
    router6.get("/templates", async (req, res) => {
      try {
        const supabase2 = getSupabase2();
        if (!supabase2) return res.json({ status: "ok", templates: [] });
        const { data, error } = await supabase2.from("email_templates").select("*").order("name", { ascending: true });
        if (error) throw error;
        res.json({ status: "ok", templates: data || [] });
      } catch (error) {
        console.error("[Templates List] Error:", error.message);
        res.status(500).json({ status: "error", message: error.message });
      }
    });
    router6.post("/templates", async (req, res) => {
      const { name, category, subject_template, body_template, variables } = req.body;
      try {
        const supabase2 = getSupabase2();
        if (!supabase2) return res.status(500).json({ status: "error", message: "Supabase not configured" });
        const { data, error } = await supabase2.from("email_templates").insert({ name, category, subject_template, body_template, variables: variables || [] }).select("id").single();
        if (error) throw error;
        res.json({ status: "ok", id: data.id });
      } catch (error) {
        console.error("[Template Create] Error:", error.message);
        res.status(500).json({ status: "error", message: error.message });
      }
    });
    router6.delete("/templates/:id", async (req, res) => {
      try {
        const supabase2 = getSupabase2();
        if (!supabase2) return res.status(500).json({ status: "error", message: "Supabase not configured" });
        const { error } = await supabase2.from("email_templates").delete().eq("id", req.params.id);
        if (error) throw error;
        res.json({ status: "ok" });
      } catch (error) {
        console.error("[Template Delete] Error:", error.message);
        res.status(500).json({ status: "error", message: error.message });
      }
    });
    router6.post("/correlate", async (req, res) => {
      const { email, name } = req.body;
      try {
        const patient = await correlatePatient(email, name);
        if (patient) {
          res.json({ status: "ok", patient });
        } else {
          res.json({ status: "ok", patient: null, message: "No matching patient found" });
        }
      } catch (error) {
        console.error("[Correlate] Error:", error.message);
        res.status(500).json({ status: "error", message: error.message });
      }
    });
    communication_default = router6;
  }
});

// routes/workJournal.js
function getSupabase3() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return (0, import_supabase_js7.createClient)(url, key);
}
var import_express7, import_supabase_js7, router7, workJournal_default;
var init_workJournal = __esm({
  "routes/workJournal.js"() {
    import_express7 = __toESM(require("express"), 1);
    import_supabase_js7 = require("@supabase/supabase-js");
    router7 = import_express7.default.Router();
    router7.get("/", async (req, res) => {
      const { days = "30", patient_id, event_type, page = "1", limit = "50" } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      try {
        const supabase2 = getSupabase3();
        if (!supabase2) {
          return res.status(500).json({ status: "error", message: "Supabase not configured" });
        }
        let query = supabase2.from("v_work_journal").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(offset, offset + parseInt(limit) - 1);
        if (days && days !== "all") {
          const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1e3).toISOString();
          query = query.gte("created_at", since);
        }
        if (patient_id) {
          query = query.eq("patient_id", patient_id);
        }
        if (event_type) {
          query = query.eq("event_type", event_type);
        }
        const { data, error, count } = await query;
        if (error) throw error;
        const stats = {
          total: count || 0,
          today: 0,
          thisWeek: 0,
          byType: {}
        };
        const todayStart = /* @__PURE__ */ new Date();
        todayStart.setHours(0, 0, 0, 0);
        const weekStart = /* @__PURE__ */ new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        for (const event of data || []) {
          if (new Date(event.created_at) >= todayStart) {
            stats.today++;
          }
          if (new Date(event.created_at) >= weekStart) {
            stats.thisWeek++;
          }
          stats.byType[event.event_type] = (stats.byType[event.event_type] || 0) + 1;
        }
        res.json({ status: "ok", events: data || [], stats, page: parseInt(page), limit: parseInt(limit) });
      } catch (error) {
        res.json({ status: "ok", events: [], stats: { total: 0, today: 0, thisWeek: 0, byType: {} }, page: 1, limit: 50 });
      }
    });
    router7.get("/stats", async (req, res) => {
      try {
        const supabase2 = getSupabase3();
        if (!supabase2) {
          return res.status(500).json({ status: "error", message: "Supabase not configured" });
        }
        const { data, error } = await supabase2.from("v_work_journal").select("event_type, created_at");
        if (error) throw error;
        const todayStart = /* @__PURE__ */ new Date();
        todayStart.setHours(0, 0, 0, 0);
        const weekStart = /* @__PURE__ */ new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        const stats = {
          total: data?.length || 0,
          today: 0,
          thisWeek: 0,
          byType: {}
        };
        for (const event of data || []) {
          const ts = new Date(event.created_at);
          if (ts >= todayStart) stats.today++;
          if (ts >= weekStart) stats.thisWeek++;
          stats.byType[event.event_type] = (stats.byType[event.event_type] || 0) + 1;
        }
        res.json({ status: "ok", stats });
      } catch (error) {
        console.error("[WorkJournal Stats] Error:", error.message);
        res.status(500).json({ status: "error", message: error.message });
      }
    });
    workJournal_default = router7;
  }
});

// fonoaudio-server.js
var fonoaudio_server_exports = {};
__export(fonoaudio_server_exports, {
  app: () => app
});
async function startRemindersEngine() {
  console.log("[Reminders Engine] Started (non-blocking, errors logged)");
  setInterval(async () => {
    if (isProcessingReminders) return;
    isProcessingReminders = true;
    try {
      const result = await distributionService_default.processPendingReminders();
      if (result.status === "ok" && result.processed > 0) {
        console.log(`[Reminders Engine] Processed ${result.processed} reminders`);
      }
    } catch (error) {
    } finally {
      isProcessingReminders = false;
    }
  }, 6e4);
}
async function warmupModel() {
  try {
    const p = (0, import_child_process.spawn)(PIPER_COMMAND, [
      "-m",
      VOICE_MODEL_PATH,
      "-f",
      "temp/warmup.wav",
      "--noise-scale",
      "0.6",
      "--noise-w-scale",
      "0.8",
      "--length-scale",
      "0.7"
    ]);
    p.stdin.write("Hola");
    p.stdin.end();
    await new Promise((resolve, reject) => {
      p.on("close", resolve);
      p.on("error", reject);
    });
    console.log("[Piper] Modelo pre-cargado");
  } catch (e) {
    console.error("[Piper] Warmup error:", e.message);
  }
}
function startBackgroundWorker() {
  setInterval(async () => {
    if (isWorkerRunning) return;
    isWorkerRunning = true;
    try {
      const res = await fetch(`http://localhost:${PORT}/api/worker/check-reminders`);
      const data = await res.json();
      if (data.sent > 0) {
        console.log(`[Worker] Sent ${data.sent} appointment reminders`);
      }
    } catch (e) {
      console.error("[Worker] Background worker error:", e.message);
    } finally {
      isWorkerRunning = false;
    }
  }, 9e5);
  setInterval(async () => {
    const now = /* @__PURE__ */ new Date();
    const hour = parseInt(now.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", hour12: false }));
    const min = parseInt(now.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", minute: "2-digit", hour12: false }));
    if (hour === 8 && min === 0) {
      try {
        await fetch(`http://localhost:${PORT}/api/worker/daily-summary`);
        console.log("[Worker] Daily summary sent");
      } catch (e) {
      }
    }
  }, 6e4);
}
var import_generative_ai4, import_config2, import_express8, import_child_process, import_fs, import_path2, import_cors, app, aiModel, aiModelFallback, PORT, PEXELS_API_KEY, isProcessingReminders, PIXABAY_API_KEY, ICONSCOUT_CLIENT_ID, ICONSCOUT_CLIENT_SECRET, isWorkerRunning;
var init_fonoaudio_server = __esm({
  "fonoaudio-server.js"() {
    import_generative_ai4 = require("@google/generative-ai");
    import_config2 = require("dotenv/config");
    import_express8 = __toESM(require("express"), 1);
    import_child_process = require("child_process");
    import_fs = __toESM(require("fs"), 1);
    import_path2 = __toESM(require("path"), 1);
    import_cors = __toESM(require("cors"), 1);
    init_serverConfig();
    init_distributionService();
    init_tts();
    init_api();
    init_ocr();
    init_clinical();
    init_communication();
    init_workJournal();
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      try {
        const envPath = import_path2.default.resolve(process.cwd(), ".env");
        const envContent = import_fs.default.readFileSync(envPath, "utf8");
        for (const line of envContent.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx === -1) continue;
          const key = trimmed.substring(0, eqIdx).trim();
          const val = trimmed.substring(eqIdx + 1).trim();
          if (!process.env[key]) process.env[key] = val;
        }
        console.log("[Env] Manual .env load complete. TELEGRAM_BOT_TOKEN:", process.env.TELEGRAM_BOT_TOKEN ? "SET" : "MISSING");
      } catch (e) {
        console.error("[Env] Failed to load .env manually:", e.message);
      }
    }
    console.log("[FonoAudio] Server module loaded - build 2026-08-13-v2");
    app = (0, import_express8.default)();
    app.set("trust proxy", true);
    app.use(import_express8.default.json({ limit: "50mb" }));
    app.use((0, import_cors.default)());
    aiModel = null;
    aiModelFallback = null;
    try {
      const apiKey = process.env.GOOGLE_API_KEY;
      if (apiKey) {
        const genAI2 = new import_generative_ai4.GoogleGenerativeAI(apiKey);
        aiModel = genAI2.getGenerativeModel({ model: "gemini-2.5-flash" });
        console.log("[Gemini] Model initialized successfully (key: ..." + apiKey.slice(-4) + ")");
      } else {
        console.warn("[Gemini] GOOGLE_API_KEY not set \u2014 AI features will use fallbacks");
      }
      const fallbackKey = process.env.GOOGLE_API_KEY_2 || process.env.GOOGLE_API_KEY_FALLBACK;
      if (fallbackKey && fallbackKey !== apiKey) {
        const genAIFallback = new import_generative_ai4.GoogleGenerativeAI(fallbackKey);
        aiModelFallback = genAIFallback.getGenerativeModel({ model: "gemini-2.5-flash" });
        console.log("[Gemini] Fallback model initialized (key: ..." + fallbackKey.slice(-4) + ")");
      }
    } catch (e) {
      console.error("[Gemini] Failed to initialize:", e.message);
    }
    PORT = process.env.PORT || 3001;
    app.locals.aiModel = aiModel;
    app.locals.aiModelFallback = aiModelFallback;
    PEXELS_API_KEY = process.env.PEXELS_API_KEY || "";
    isProcessingReminders = false;
    app.get("/api/images/proxy", async (req, res) => {
      const { url } = req.query;
      if (!url) return res.status(400).json({ error: "Missing url parameter" });
      try {
        const resp = await fetch(url, {
          signal: AbortSignal.timeout(15e3),
          headers: { "User-Agent": "FonoAudioPro/1.0" }
        });
        if (!resp.ok) return res.status(resp.status).json({ error: `Upstream ${resp.status}` });
        const contentType = resp.headers.get("content-type") || "image/jpeg";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.setHeader("Access-Control-Allow-Origin", "*");
        const buffer = Buffer.from(await resp.arrayBuffer());
        res.send(buffer);
      } catch (e) {
        console.error("[Proxy] Failed:", e.message);
        res.status(502).json({ error: "Failed to proxy image", detail: e.message });
      }
    });
    app.get("/api/images/search", async (req, res) => {
      const { q, per_page = 20, page = 1 } = req.query;
      if (!q) return res.status(400).json({ error: 'Missing query parameter "q"' });
      if (!PEXELS_API_KEY) return res.status(503).json({ error: "PEXELS_API_KEY not configured", hint: "Add PEXELS_API_KEY to .env" });
      try {
        const resp = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${per_page}&page=${page}`, {
          headers: { Authorization: PEXELS_API_KEY },
          signal: AbortSignal.timeout(1e4)
        });
        if (!resp.ok) {
          const text = await resp.text();
          return res.status(resp.status).json({ error: `Pexels API error: ${resp.status}`, detail: text });
        }
        const data = await resp.json();
        const results = (data.photos || []).map((p) => ({
          url: p.src.medium,
          thumb: p.src.small,
          alt: p.alt || q,
          photographer: p.photographer,
          photographer_url: p.photographer_url,
          pexels_url: p.url
        }));
        res.json({ results, total: data.total_results || 0 });
      } catch (e) {
        console.error("[Pexels] Search error:", e.message);
        res.status(500).json({ error: "Failed to search images", detail: e.message });
      }
    });
    app.get("/api/images/openverse", async (req, res) => {
      const { q, per_page = 20, page = 1 } = req.query;
      if (!q) return res.status(400).json({ error: 'Missing query parameter "q"' });
      try {
        const resp = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&per_page=${per_page}&page=${page}`, {
          headers: { "User-Agent": "FonoAudioPro/1.0 (clinical-app)" },
          signal: AbortSignal.timeout(1e4)
        });
        if (!resp.ok) {
          const text = await resp.text();
          return res.status(resp.status).json({ error: `Openverse API error: ${resp.status}`, detail: text });
        }
        const data = await resp.json();
        const results = (data.results || []).map((p) => ({
          url: p.image || p.thumbnail,
          thumb: p.thumbnail || p.image,
          alt: p.title || q,
          creator: p.creator || "Unknown",
          license: p.license || "unknown",
          license_version: p.license_version || "",
          source_url: p.foreign_landing_url || p.source || "",
          provider: "openverse"
        }));
        res.json({ results, total: data.result_count || 0 });
      } catch (e) {
        console.error("[Openverse] Search error:", e.message);
        res.status(500).json({ error: "Failed to search Openverse", detail: e.message });
      }
    });
    app.get("/api/images/undraw", async (req, res) => {
      const { q, per_page = 20 } = req.query;
      if (!q) return res.status(400).json({ error: 'Missing query parameter "q"' });
      try {
        const resp = await fetch(`https://raw.githubusercontent.com/ondras/undraw/refs/heads/master/README.md`, {
          signal: AbortSignal.timeout(1e4)
        });
        const illustrations = [
          "doctor",
          "therapy",
          "education",
          "children",
          "family",
          "health",
          "communication",
          "learning",
          "reading",
          "writing",
          "art",
          "design",
          "technology",
          "science",
          "nature",
          "animal",
          "food",
          "sport",
          "music",
          "travel"
        ];
        const matches = illustrations.filter((i) => i.toLowerCase().includes(q.toLowerCase()));
        const results = matches.slice(0, parseInt(per_page)).map((term) => ({
          url: `https://undraw.co/api/illustrations/${term}`,
          thumb: `https://undraw.co/api/illustrations/${term}`,
          alt: `unDraw: ${term}`,
          creator: "Katerina Limpitsouni",
          license: "MIT",
          source_url: `https://undraw.co/illustrations`,
          provider: "undraw"
        }));
        res.json({ results, total: results.length, note: "unDraw illustrations - visit undraw.co for full collection" });
      } catch (e) {
        console.error("[unDraw] Search error:", e.message);
        res.status(500).json({ error: "Failed to search unDraw", detail: e.message });
      }
    });
    PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || "";
    app.get("/api/images/pixabay", async (req, res) => {
      const { q, per_page = 20, page = 1, category = "illustration" } = req.query;
      if (!q) return res.status(400).json({ error: 'Missing query parameter "q"' });
      if (!PIXABAY_API_KEY) return res.status(503).json({ error: "PIXABAY_API_KEY not configured", hint: "Add PIXABAY_API_KEY to .env. Get free key at https://pixabay.com/api/docs/" });
      try {
        const resp = await fetch(`https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(q)}&image_type=illustration&per_page=${per_page}&page=${page}&min_width=100&min_height=100`, {
          signal: AbortSignal.timeout(1e4)
        });
        if (!resp.ok) {
          const text = await resp.text();
          return res.status(resp.status).json({ error: `Pixabay API error: ${resp.status}`, detail: text });
        }
        const data = await resp.json();
        const results = (data.hits || []).map((h) => ({
          url: h.webformatURL,
          thumb: h.previewURL,
          alt: h.tags || q,
          creator: h.user || "Pixabay",
          license: "Pixabay License",
          source_url: `https://pixabay.com/users/${h.user}-${h.user_id}/`,
          provider: "pixabay"
        }));
        res.json({ results, total: data.totalHits || 0 });
      } catch (e) {
        console.error("[Pixabay] Search error:", e.message);
        res.status(500).json({ error: "Failed to search Pixabay", detail: e.message });
      }
    });
    ICONSCOUT_CLIENT_ID = process.env.ICONSCOUT_CLIENT_ID || "";
    ICONSCOUT_CLIENT_SECRET = process.env.ICONSCOUT_CLIENT_SECRET || "";
    app.get("/api/images/iconscout", async (req, res) => {
      const { q, per_page = 20, asset = "illustration" } = req.query;
      if (!q) return res.status(400).json({ error: 'Missing query parameter "q"' });
      if (!ICONSCOUT_CLIENT_ID) return res.status(503).json({ error: "ICONSCOUT_CLIENT_ID not configured", hint: "Add ICONSCOUT_CLIENT_ID to .env" });
      try {
        const resp = await fetch(`https://api.iconscout.com/v3/search?query=${encodeURIComponent(q)}&asset=${asset}&page=1&per_page=${per_page}`, {
          headers: { "Client-ID": ICONSCOUT_CLIENT_ID },
          signal: AbortSignal.timeout(1e4)
        });
        if (!resp.ok) {
          const text = await resp.text();
          return res.status(resp.status).json({ error: `IconScout API error: ${resp.status}`, detail: text });
        }
        const data = await resp.json();
        const items = data.response?.items?.data || data.response?.items || data.response || [];
        const total = data.response?.items?.total || data.meta?.total || items.length;
        const results = (Array.isArray(items) ? items : []).map((item) => ({
          url: item.urls?.thumb || item.urls?.png || "",
          thumb: item.urls?.thumb || item.urls?.png || "",
          alt: item.name || item.slug || q,
          creator: "IconScout",
          license: "IconScout License",
          source_url: `https://iconscout.com/illustrations/${item.slug || item.id}`,
          provider: "iconscout",
          format: item.asset === "lottie" ? "lottie" : "png"
        }));
        res.json({ results, total });
      } catch (e) {
        console.error("[IconScout] Search error:", e.message);
        res.status(500).json({ error: "Failed to search IconScout", detail: e.message });
      }
    });
    app.get("/api/images/libreclipart", async (req, res) => {
      const { q, per_page = 20 } = req.query;
      if (!q) return res.status(400).json({ error: 'Missing query parameter "q"' });
      try {
        const resp = await fetch(`https://libreclipart.org/api/v1/search?q=${encodeURIComponent(q)}&limit=${per_page}`, {
          headers: { "User-Agent": "FonoAudioPro/1.0" },
          signal: AbortSignal.timeout(1e4)
        });
        if (!resp.ok) {
          return res.json({ results: [], total: 0, note: "LibreClipart API may be unavailable. Try Openverse instead." });
        }
        const data = await resp.json();
        const results = (data.images || data.results || []).map((img) => ({
          url: img.url || img.image_url || "",
          thumb: img.thumbnail_url || img.url || img.image_url || "",
          alt: img.title || img.name || q,
          creator: img.author || "Unknown",
          license: "CC0",
          source_url: img.page_url || "",
          provider: "libreclipart"
        }));
        res.json({ results, total: data.total || results.length });
      } catch (e) {
        console.error("[LibreClipart] Search error:", e.message);
        res.json({ results: [], total: 0, note: "LibreClipart unavailable: " + e.message });
      }
    });
    app.get("/api/health", (_req, res) => {
      res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    });
    app.use("/api/tts", tts_default);
    app.use("/api/ocr", ocr_default);
    app.use("/api/clinical", clinical_default);
    app.use("/api/communication", communication_default);
    app.use("/api/work-journal", workJournal_default);
    app.use("/api", api_default);
    process.on("unhandledRejection", (reason) => {
      console.error("[Server] Unhandled rejection (non-fatal):", reason?.message || reason);
    });
    process.on("uncaughtException", (err) => {
      console.error("[Server] Uncaught exception (non-fatal):", err.message);
    });
    isWorkerRunning = false;
    if (import_fs.default.existsSync(PIPER_COMMAND) && import_fs.default.existsSync(VOICE_MODEL_PATH)) {
      warmupModel();
    }
    app.use((err, req, res, next) => {
      console.error("[Global Error Handler] Caught error:", err.stack || err.message);
      res.status(200).json({ ok: false, status: "error", error: err.message, stack: err.stack, hint: "Error caught. See server logs." });
    });
    if (process.env.VERCEL !== "1") {
      startRemindersEngine();
      startBackgroundWorker();
    }
    if (process.env.VERCEL !== "1") {
      app.listen(PORT, () => {
        console.log(`
\u{1F9E0} FonoAudio Server running on http://localhost:${PORT}`);
      });
    }
  }
});

// api/index.js
var index_exports = {};
__export(index_exports, {
  default: () => handler
});
module.exports = __toCommonJS(index_exports);
if (typeof globalThis.DOMMatrix === "undefined") {
  class DOMMatrix {
    constructor(init) {
      this.a = 1;
      this.b = 0;
      this.c = 0;
      this.d = 1;
      this.e = 0;
      this.f = 0;
    }
  }
  globalThis.DOMMatrix = DOMMatrix;
}
if (typeof globalThis.DOMPoint === "undefined") {
  globalThis.DOMPoint = class DOMPoint {
    constructor(x = 0, y = 0, z = 0, w = 1) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.w = w;
    }
  };
}
if (typeof globalThis.DOMRect === "undefined") {
  globalThis.DOMRect = class DOMRect {
    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
    }
  };
}
var cachedApp;
async function handler(req, res) {
  try {
    if (!cachedApp) {
      const module2 = await Promise.resolve().then(() => (init_fonoaudio_server(), fonoaudio_server_exports));
      cachedApp = module2.app;
    }
    if (req.method === "POST") {
      try {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const bodyBuffer = Buffer.concat(chunks);
        const bodyStr = bodyBuffer.toString("utf8");
        req.body = bodyStr ? JSON.parse(bodyStr) : {};
      } catch (e) {
        req.body = {};
      }
    } else {
      req.body = {};
    }
    req.app = cachedApp;
    cachedApp(req, res);
  } catch (err) {
    console.error("[Vercel Handler] Unhandled error:", err.stack || err.message);
    res.status(200).json({ ok: false, status: "error", error: err.message, stack: err.stack?.split("\n").slice(0, 5).join("\n"), method: req.method, url: req.url });
  }
}
