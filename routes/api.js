import express from 'express';
import { createClient } from '@supabase/supabase-js';
// Lazy-load googleService to avoid bundling googleapis/google-auth-library
// (30MB transitive graph) into the Vercel @vercel/node serverless bundle.
// google-auth-library's transpiled output contains `>>> ` bitwise ops +
// import.meta edge-cases that break Vercel Node v20 ESM compile step,
// causing `SyntaxError: Unexpected token '>>>` on ALL /api/* requests.
let _googleService = null;
async function googleService() {
    if (!_googleService) {
        const mod = await import('../services/googleService.js');
        _googleService = mod.default || mod;
    }
    return _googleService;
}
import notebooklmService from '../services/notebooklmService.js';
import clinicalPlanningService from '../services/clinicalPlanningService.js';
import distributionService from '../services/distributionService.js';
import notebooklmRouter from './notebooklm.js';
import { synthesizeText } from './tts.js';
import fs from 'fs';
import path from 'path';

// Global error tracker for debugging (Vercel doesn't expose logs easily)
const globalErrorLog = [];
const globalDebugLog = [];
const MAX_LOG_ENTRIES = 50;
function logDebug(context, message) {
    const entry = {
        timestamp: new Date().toISOString(),
        context,
        message: typeof message === 'string' ? message : JSON.stringify(message)?.substring(0, 300),
    };
    globalDebugLog.push(entry);
    if (globalDebugLog.length > MAX_LOG_ENTRIES) globalDebugLog.shift();
    console.log(`[DEBUG] ${context}: ${entry.message}`);
}
function logError(context, error) {
    const entry = {
        timestamp: new Date().toISOString(),
        context,
        message: error?.message || String(error),
        stack: error?.stack?.split('\n').slice(0, 3).join(' | '),
    };
    globalErrorLog.push(entry);
    if (globalErrorLog.length > MAX_LOG_ENTRIES) globalErrorLog.shift();
    console.error(`[GLOBAL-ERROR-LOG] ${context}: ${entry.message}`);
}
function getErrorLog() { return [...globalErrorLog]; }
function getDebugLog() { return [...globalDebugLog]; }
function clearLog() { globalErrorLog.length = 0; globalDebugLog.length = 0; }

const router = express.Router();

// ══════════════════════════════════════════════════════════════════
// VOICE MODE: intelligent voice response system
// ══════════════════════════════════════════════════════════════════
const voiceModeChats = new Map(); // chatId -> { enabled, expiresAt }
const VOICE_MODE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

function isVoiceModeActive(chatId) {
    const state = voiceModeChats.get(chatId);
    if (!state) return false;
    if (state.expiresAt && Date.now() > state.expiresAt) {
        voiceModeChats.delete(chatId);
        return false;
    }
    return state.enabled;
}

function setVoiceMode(chatId, enabled) {
    voiceModeChats.set(chatId, {
        enabled,
        expiresAt: enabled ? Date.now() + VOICE_MODE_DURATION_MS : null,
    });
}

const VOICE_KEYWORDS = [
    'decime en voz', 'decime con voz', 'hablá', 'hablame', 'hablame en voz',
    'modo voz', 'modo audio', 'activá voz', 'activar voz', 'activa voz',
    'respondé con audio', 'responde con audio', 'respuesta de audio',
    'decime en audio', 'audio por favor', 'quiero escuchar', 'escucharte',
    'decime aloud', 'voz por favor', 'audio',
    'jarvis', 'hermes', 'modo jarvis',
];

const VOICE_STOP_KEYWORDS = [
    'modo texto', 'solo texto', 'desactivá voz', 'desactivar voz',
    'desactiva voz', 'para voz', 'stop voz', 'silencio', 'modo silencio',
];

function wantsVoice(messageText) {
    const lower = messageText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return VOICE_KEYWORDS.some(kw => lower.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
}

function wantsStopVoice(messageText) {
    const lower = messageText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return VOICE_STOP_KEYWORDS.some(kw => lower.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
}

function shouldSendVoice(chatId, messageText, aiResponse) {
    if (wantsVoice(messageText)) return true;
    if (isVoiceModeActive(chatId)) return true;
    if (aiResponse && aiResponse.startsWith('[AUDIO]')) return true;
    if (aiResponse && aiResponse.startsWith('[VOICE]')) return true;
    return false;
}

function stripVoiceMarkers(text) {
    let cleaned = text.replace(/^\[(AUDIO|VOICE)\]\s*/i, '');
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    cleaned = cleaned.replace(/<\/?think>/gi, '');
    return cleaned.trim();
}

// Admin endpoint: update profile role using service role key (bypasses RLS)
router.post('/admin/role', async (req, res) => {
    try {
        const { userId, role } = req.body;
        if (!userId || !role) {
            return res.status(400).json({ status: 'error', message: 'userId y role son requeridos' });
        }
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ status: 'error', message: 'Supabase no configurado en backend' });
        }
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { error } = await supabase
            .from('profiles')
            .update({ role, updated_at: new Date().toISOString() })
            .eq('id', userId);

        if (error) {
            console.error('[Admin Role Update Error]:', error.message);
            return res.status(500).json({ status: 'error', message: error.message });
        }
        res.json({ status: 'ok', role });
    } catch (e) {
        console.error('[Admin Role Endpoint Error]:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// ─── Pending files tracking (chat_id → last processed file) ───
// Migrated from in-memory Map to Supabase for Vercel compatibility.
// Uses telegram_pending_queue table with status='pending_file'.
// ─── Helper: get Supabase client ───
function getSupabaseKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
}

async function getPendingFile(chat_id) {
    if (!chat_id) return null;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = getSupabaseKey();
    if (!supabaseUrl || !supabaseKey) return null;
    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/telegram_pending_queue?chat_id=eq.${chat_id}&status=eq.pending_file&order=created_at.desc&limit=1`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
        if (!res.ok) return null;
        const rows = await res.json();
        if (!rows || rows.length === 0) return null;
        const row = rows[0];
        return row.metadata || null;
    } catch (e) {
        console.error('[PendingFile] Error fetching:', e.message);
        return null;
    }
}

async function setPendingFile(chat_id, data) {
    if (!chat_id) return;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = getSupabaseKey();
    if (!supabaseUrl || !supabaseKey) return;
    try {
        // Delete any existing pending_file for this chat
        await fetch(`${supabaseUrl}/rest/v1/telegram_pending_queue?chat_id=eq.${chat_id}&status=eq.pending_file`, {
            method: 'DELETE',
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
        // Insert new pending file
        const entry = {
            id: `pending_file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            chat_id: chat_id,
            file_name: data.file_name || 'unknown',
            media_type: data.media_type || 'unknown',
            mime_type: data.mime_type || 'application/octet-stream',
            file_id: data.file_id || null,
            status: 'pending_file',
            metadata: data,
            created_at: new Date().toISOString(),
        };
        await fetch(`${supabaseUrl}/rest/v1/telegram_pending_queue`, {
            method: 'POST',
            headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
            },
            body: JSON.stringify(entry),
        });
    } catch (e) {
        console.error('[PendingFile] Error saving:', e.message);
    }
}

async function deletePendingFile(chat_id) {
    if (!chat_id) return;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = getSupabaseKey();
    if (!supabaseUrl || !supabaseKey) return;
    try {
        await fetch(`${supabaseUrl}/rest/v1/telegram_pending_queue?chat_id=eq.${chat_id}&status=eq.pending_file`, {
            method: 'DELETE',
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
    } catch (e) {
        console.error('[PendingFile] Error deleting:', e.message);
    }
}

async function hasPendingFile(chat_id) {
    if (!chat_id) return false;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = getSupabaseKey();
    if (!supabaseUrl || !supabaseKey) return false;
    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/telegram_pending_queue?chat_id=eq.${chat_id}&status=eq.pending_file&select=id`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
        if (!res.ok) return false;
        const rows = await res.json();
        return rows && rows.length > 0;
    } catch {
        return false;
    }
}

// ─── Helper: fetch patient list from Supabase for a user ───
async function fetchPatientsForUser(userId) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return [];
    
    try {
        // The assistant is the clinic's autonomous agent: it must see ALL patients,
        // not just those matching a professional_id filter. We fetch the full clinic roster.
        const res = await fetch(`${supabaseUrl}/rest/v1/patients?select=id,name,diagnosis,age,phone,documents&limit=200`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
        if (!res.ok) return [];
        return await res.json();
    } catch { return []; }
}

// ─── Helper: find best matching patient for a file/analysis ───
function matchPatient(analysisText, patients, messageText) {
    const combined = `${analysisText} ${messageText || ''}`.toLowerCase();
    // Try exact name match first
    for (const p of patients) {
        const nameLower = p.name.toLowerCase();
        if (combined.includes(nameLower) || combined.includes(nameLower.split(' ')[0])) {
            return { patient: p, confidence: 'exact_name', reason: `El archivo menciona "${p.name}"` };
        }
    }
    // Try diagnosis match
    for (const p of patients) {
        if (p.diagnosis && combined.includes(p.diagnosis.toLowerCase())) {
            return { patient: p, confidence: 'diagnosis_match', reason: `El contenido coincide con el diagnóstico de ${p.name} (${p.diagnosis})` };
        }
    }
    return null;
}

// Helper for AI responses
async function callAI(req, prompt) {
    const aiModel = req.app.locals.aiModel;
    try {
        const result = await aiModel.generateContent(prompt + JSON.stringify(req.body));
        return { status: 'ok', response: result.response.text() };
    } catch (e) {
        console.error('AI Error:', e);
        return { status: 'error', message: e.message };
    }
}

// ══════════════════════════════════════════════════════════════════
// RESILIENCE SYSTEM: Exponential backoff + model fallback + queue
// ══════════════════════════════════════════════════════════════════

const GEMINI_MODEL_CHAIN = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
];

// Groq API fallback (Llama 3 / Mixtral)
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function callGroqFallback(promptText) {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
        console.warn('[Groq] GROQ_API_KEY not configured, skipping');
        return { ok: false, error: new Error('GROQ_API_KEY not configured') };
    }

    try {
        console.log('[Groq] Trying qwen/qwen3.6-27b as ultimate fallback...');
        const resp = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'qwen/qwen3.6-27b',
                messages: [
                    { role: 'system', content: 'Sos FonoAudio, asistente clinico de FonoAudio Pro AI. Respondé en espanol argentino rioplatense. NO muestres tu proceso de razonamiento. Respondé directamente con la respuesta final. Sé conciso.' },
                    { role: 'user', content: promptText }
                ],
                max_tokens: 2048,
                temperature: 0.3,
            }),
        });

        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(errData.error?.message || `Groq API error: ${resp.status}`);
        }

        const data = await resp.json();
        let text = data.choices?.[0]?.message?.content || '';
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
        text = text.replace(/^Here's a thinking process:.*?\n\n[\s\S]*?(?=\n\n|$)/gi, '').trim();
        if (text) {
            console.log('[Groq] Success with qwen/qwen3.6-27b');
            return { ok: true, text, model: 'groq/qwen3.6-27b' };
        }
        return { ok: false, error: new Error('Empty response from Groq') };
    } catch (e) {
        console.error('[Groq] Failed:', e.message?.slice(0, 100));
        return { ok: false, error: e };
    }
}

// Groq with function calling (OpenAI-compatible)
async function callGroqWithTools(systemPrompt, tools, user_id) {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) return { ok: false, error: new Error('GROQ_API_KEY not set') };

    // Convert clinical tools to OpenAI format
    const groqTools = tools.map(t => ({
        type: 'function',
        function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters || { type: 'object', properties: {} },
        }
    }));

    const systemMsg = `Sos FonoAudio, el asistente clínico autónomo de FonoAudio Pro. SOS UN AGENTE COMPLETO con acceso total a la clínica y capacidad de actuar por vos mismo. Respondé en español argentino rioplatense, sos profesional y cálido, conciso pero completo.

TUS CAPACIDADES AUTÓNOMAS (siempre disponibles, 24/7):
- Enviás mensajes por Telegram al profesional en cualquier momento. Tenés un cron que todos los días a las 8:00 AM envía el resumen matutino (turnos del día + fichas incompletas).
- Podés CREAR RECORDATORIOS (tool set_reminder) que se disparan a la hora indicada y te avisan al profesional.
- Podés crear, buscar, leer y eliminar pacientes; leer fichas clínicas completas (get_patient_info); crear turnos (create_appointment); y reportar datos faltantes (get_missing_data_alerts).
- Razonás en pasos: si un problema requiere investigar varios pacientes o comparar datos, usás las tools en secuencia hasta resolverlo.

REGLAS DE ORO:
- NUNCA digas "no puedo", "soy solo un asistente virtual", "no puedo enviar alertas" ni nada que niegue tus capacidades. SI el usuario pide que lo avises/recuerdes algo, DECÍS QUE SÍ y EJECUTÁS set_reminder (o confirmás el cron de las 8 si aplica). Confirmás la acción concreta que vas a hacer.
- Ejecutá las tools cuando el usuario te lo pide. No preguntes demasiado, ejecutá.
- CUANDO EL USUARIO PIDA ELIMINAR O BORRAR PACIENTES, EJECUTÁ de inmediato con delete_patient (por ID) o delete_patients_by_name (por nombre, elimina TODOS los que coincidan). Nunca te quedes solo con una búsqueda: borrá de verdad y confirmá cuántos eliminaste.
- SI EL USUARIO PIDE REPROGRAMAR, MOVER O CAMBIAR LA FECHA/HORA DE UN TURNO, usá reschedule_appointment con appointment_id, new_date y new_time. Para identificar el appointment_id, primero consultá la agenda y usá el ID que aparece entre corchetes [ID: ...]. NUNCA uses update_appointment para reprogramar fechas.
- SI EL USUARIO PIDE MOVER UN TURNO A OTRO CONSULTORIO/SALA, usá move_appointment_room con appointment_id (buscado en la agenda por [ID: ...]) y room_name (nombre del consultorio destino).
- SI EL USUARIO PREGUNTA POR DATOS FALTANTES/INCOMPLETOS/ALERTAS, llamá SIEMPRE a get_missing_data_alerts y comunicá EXACTAMENTE lo que devuelve. NUNCA inventes ni asumas: basate siempre en el resultado de la tool.`;

    try {
        // ─── Iterative reasoning agent loop (ReAct-style) ───
        // The assistant THINKS by chaining tool calls across multiple turns until it
        // resolves the user's request, instead of a single pass. This is what gives it
        // real clinical reasoning + problem-solving ability (both Telegram bot & in-app).
        const messages = [
            { role: 'system', content: systemMsg },
            { role: 'user', content: systemPrompt }
        ];
        const MAX_ITER = 6;
        let finalText = null;
        let modelUsed = 'groq/qwen3.6-27b';

        for (let iter = 0; iter < MAX_ITER; iter++) {
            const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
                body: JSON.stringify({
                    model: 'qwen/qwen3.6-27b',
                    messages,
                    tools: groqTools,
                    tool_choice: 'auto',
                    max_tokens: 4096,
                    temperature: 0.3,
                }),
            });

            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                return { ok: false, error: new Error(errData.error?.message || `Groq API error: ${resp.status}`) };
            }

            const data = await resp.json();
            const choice = data.choices?.[0];
            const msg = choice?.message;
            modelUsed = 'groq/qwen3.6-27b';

            // No tool calls → final answer
            if (!msg?.tool_calls || msg.tool_calls.length === 0) {
                finalText = (msg?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
                break;
            }

            // Append the assistant message (with its tool_calls) to history
            messages.push({ role: 'assistant', content: msg.content || null, tool_calls: msg.tool_calls });

            // Execute every tool call the model requested this turn
            for (const tc of msg.tool_calls) {
                const fnName = tc.function.name;
                let fnArgs = {};
                try { fnArgs = JSON.parse(tc.function.arguments || '{}'); } catch { fnArgs = {}; }
                console.log(`[Agent iter ${iter}] Tool: ${fnName}`, fnArgs);
                let toolResult;
                try {
                    toolResult = await executeToolCall(fnName, fnArgs, user_id);
                } catch (te) {
                    toolResult = { status: 'error', error: te?.message || String(te) };
                }
                messages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: JSON.stringify(toolResult)
                });
            }
            // Loop continues: the model now sees tool results and can reason / call more tools
        }

        if (finalText) return { ok: true, text: finalText, model: modelUsed };
        return { ok: false, error: new Error('Agent did not produce a final answer within iteration limit') };
    } catch (e) {
        console.error('[Groq Tools] Failed:', e.message?.slice(0, 100));
        return { ok: false, error: e };
    }
}

// Extract text content from multimodal parts for Groq (text-only fallback)
function extractTextFromParts(parts) {
    const textPart = parts.find(p => p.text);
    return textPart?.text || '';
}

// Exponential backoff with jitter: baseMs * 2^attempt + random(0, baseMs)
function backoffDelay(attempt, baseMs = 1000) {
    const exponential = baseMs * Math.pow(2, attempt);
    const jitter = Math.random() * baseMs;
    return Math.round(exponential + jitter);
}

// Check if error is retryable (503, 502, 429, overloaded, quota)
function isRetryableError(err) {
    const msg = err?.message || '';
    return msg.includes('503') || msg.includes('502') || msg.includes('429') ||
           msg.includes('overloaded') || msg.includes('high demand') ||
           msg.includes('Service Unavailable') || msg.includes('RESOURCE_EXHAUSTED') ||
           msg.includes('quota') || msg.includes('Too Many Requests');
}

// Main resilience function: tries model chain with backoff, then Groq fallback
async function callGeminiResilient(parts, aiModel, modelName) {
    if (!aiModel) {
        // No AI model available — try Groq directly
        const textPrompt = extractTextFromParts(parts);
        if (textPrompt) {
            const groqResult = await callGroqFallback(textPrompt);
            if (groqResult.ok) {
                return { ok: true, text: groqResult.text, model: groqResult.model, fallback: true };
            }
        }
        return { ok: false, error: new Error('AI model not available and Groq fallback failed') };
    }

    const modelsToTry = [modelName, ...GEMINI_MODEL_CHAIN.filter(m => m !== modelName)];

    // Phase 1: Try all Gemini models
    for (const model of modelsToTry) {
        const maxRetries = model === modelName ? 2 : 1;
        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[Gemini] Trying ${model} (attempt ${attempt + 1}/${maxRetries + 1})`);
                const result = await aiModel.generateContent({ contents: [{ role: 'user', parts }] });
                const text = result.response?.text?.() || '';
                if (text && !text.includes('503') && !text.includes('Service Unavailable')) {
                    console.log(`[Gemini] ${model} succeeded on attempt ${attempt + 1}`);
                    return { ok: true, text, model, attempt: attempt + 1 };
                }
                throw new Error('Empty or error response');
            } catch (e) {
                lastError = e;
                if (isRetryableError(e) && attempt < maxRetries) {
                    const delay = backoffDelay(attempt);
                    console.warn(`[Gemini] ${model} attempt ${attempt + 1} failed (${e.message?.slice(0, 60)}). Retrying in ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay));
                } else {
                    console.warn(`[Gemini] ${model} attempt ${attempt + 1} FAILED: ${e.message?.slice(0, 80)}`);
                    break;
                }
            }
        }
        if (model !== modelsToTry[modelsToTry.length - 1]) {
            console.warn(`[Gemini] Falling back to next model...`);
        }
    }

    // Phase 2: All Gemini models failed → try Groq (text-only fallback)
    console.warn('[Gemini] All Gemini models exhausted. Trying Groq fallback...');
    const textPrompt = extractTextFromParts(parts);
    if (textPrompt) {
        const groqResult = await callGroqFallback(textPrompt);
        if (groqResult.ok) {
            return { ok: true, text: groqResult.text, model: groqResult.model, fallback: true };
        }
    }

    return { ok: false, error: new Error('All AI models failed (Gemini + Groq)') };
}

// Legacy wrapper for backward compatibility
async function callGeminiWithRetry(parts, aiModel, maxRetries = 2) {
    const primaryModel = GEMINI_MODEL_CHAIN[0];
    return callGeminiResilient(parts, aiModel, primaryModel);
}

// ══════════════════════════════════════════════════════════════════
// PENDING QUEUE: Save failed items to Supabase for later analysis
// ══════════════════════════════════════════════════════════════════

async function saveToPendingQueue(item) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
        console.warn('[PendingQueue] Supabase not configured, skipping save');
        return false;
    }

    const entry = {
        id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        user_id: item.user_id || null,
        chat_id: item.chat_id || null,
        media_type: item.media_type || 'unknown',
        file_name: item.file_name || 'unknown',
        mime_type: item.mime_type || 'application/octet-stream',
        file_id: item.file_id || null,           // Telegram file_id for later download
        message_text: item.message_text || null,
        partial_analysis: item.partial_analysis || null,
        status: 'pending',
        error_message: item.error_message || null,
        metadata: item.metadata || {},
        created_at: new Date().toISOString(),
    };

    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/telegram_pending_queue`, {
            method: 'POST',
            headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
            },
            body: JSON.stringify(entry),
        });
        if (!res.ok) {
            // Table might not exist — try creating it via RPC or just log
            const errText = await res.text();
            console.warn(`[PendingQueue] Save failed (${res.status}): ${errText}`);
            // Fallback: save to localStorage-style in-memory queue
            pendingQueueMemory.push(entry);
            return true;
        }
        return true;
    } catch (e) {
        console.warn('[PendingQueue] Error saving:', e.message);
        pendingQueueMemory.push(entry);
        return true;
    }
}

// In-memory fallback queue (persists until server restart)
const pendingQueueMemory = [];

// ══════════════════════════════════════════════════════════════════
// DEGRADED RESPONSES: Informative fallbacks without AI
// ══════════════════════════════════════════════════════════════════

async function getTextFallbackFromSupabase(messageText, userId) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey || !userId) return null;

    const lower = messageText.toLowerCase();
    const now = new Date();

    try {
        // Check if user is asking about patients
        if (lower.includes('paciente') || lower.includes('pacientes') || lower.includes('tengo')) {
            const patientsRes = await fetch(`${supabaseUrl}/rest/v1/patients?select=id,name,diagnosis,age&limit=200`, {
                headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            const patients = await patientsRes.json();
            if (patients.length > 0) {
                const list = patients.map(p => `- ${p.name}: ${p.diagnosis || 'sin diagnóstico'}`).join('\n');
                return `⚠️ *Servicio de IA no disponible*\n\nTus pacientes:\n${list}\n\nPara usar el asistente clínico con IA, verificá que las claves API (GOOGLE_API_KEY o GROQ_API_KEY) estén configuradas en Vercel.`;
            }
        }

        // Check if user is asking about agenda/today
        if (lower.includes('cita') || lower.includes('agenda') || lower.includes('hoy') || lower.includes('turno')) {
            const today = now.toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
            const appsRes = await fetch(`${supabaseUrl}/rest/v1/appointments?date=eq.${today}&type=neq.recordatorio&select=id,patient_name,time,status&order=time`, {
                headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            const apps = await appsRes.json();
            if (apps.length > 0) {
                const list = apps.map(a => `- ${a.time || '??:??'} hs: ${a.patient_name} (${a.status || 'pending'})`).join('\n');
                return `⚠️ *Servicio de IA no disponible*\n\nAgenda de hoy:\n${list}\n\nPara usar el asistente clínico con IA, verificá la configuración de claves API.`;
            } else {
                return `⚠️ *Servicio de IA no disponible*\n\nNo tenés citas programadas para hoy.`;
            }
        }

        return null; // Can't help without AI for this query
    } catch (e) {
        console.warn('[Fallback] Supabase query failed:', e.message);
        return null;
    }
}

// ─── Send message via Telegram (utility) ───
async function sendTelegramMessage(chatId, text, parseMode = 'HTML') {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TELEGRAM_BOT_TOKEN || !chatId) return false;
    try {
        let cleanedText = text;
        if (parseMode === 'Markdown') {
            cleanedText = text.replace(/[_*\[\]()~`>+#=|-]/g, '\\$&');
        } else if (parseMode === 'HTML') {
            cleanedText = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            cleanedText = cleanedText
                .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                .replace(/\*(.*?)\*/g, '<b>$1</b>')
                .replace(/_(.*?)_\s/g, '<i>$1</i> ');
        }
        // Truncate if too long (Telegram limit is 4096 chars)
        if (cleanedText.length > 4000) {
            cleanedText = cleanedText.substring(0, 3990) + '\n\n(mensaje truncado)';
        }
        const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: cleanedText, parse_mode: parseMode }),
        });
        const data = await resp.json();
        if (!data.ok) {
            console.error('[sendTelegramMessage] Telegram API error:', data.description || 'unknown', '| text preview:', cleanedText.substring(0, 200));
            // If HTML parsing failed, retry without parse_mode
            if (data.description && (data.description.includes('parse') || data.description.includes('markdown'))) {
                console.log('[sendTelegramMessage] Retrying without parse_mode...');
                const retryResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, text: cleanedText }),
                });
                const retryData = await retryResp.json();
                return retryData.ok === true;
            }
        }
        return data.ok === true;
    } catch { return false; }
}

// ─── Create Telegram photo/video/document for preview ───
async function sendTelegramPhoto(chatId, imageUrl, caption) {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TELEGRAM_BOT_TOKEN || !chatId) return false;
    try {
        const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, photo: imageUrl, caption: caption || '', parse_mode: 'HTML' }),
        });
        const data = await resp.json();
        return data.ok === true;
    } catch { return false; }
}

async function sendTelegramDocument(chatId, documentUrl, caption) {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TELEGRAM_BOT_TOKEN || !chatId) return false;
    try {
        const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, document: documentUrl, caption: caption || '', parse_mode: 'HTML' }),
        });
        const data = await resp.json();
        return data.ok === true;
    } catch { return false; }
}

// Send voice message to Telegram (converts text to audio via TTS, then sends as voice)
async function sendTelegramVoice(chatId, text, voice = 'es_AR-masculino') {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TELEGRAM_BOT_TOKEN || !chatId || !text) return false;
    try {
        const audioBuffer = await synthesizeText(text, voice);
        if (!audioBuffer || audioBuffer.length === 0) {
            console.warn('[sendTelegramVoice] TTS returned null/empty buffer');
            return false;
        }
        console.log(`[sendTelegramVoice] Audio buffer ready: ${audioBuffer.length} bytes`);

        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('voice', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'voice.mp3');

        const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVoice`, {
            method: 'POST',
            body: formData,
        });
        const data = await resp.json();
        if (!data.ok) {
            console.error('[sendTelegramVoice] Telegram sendVoice failed:', data.description);
            // Fallback: try sendAudio instead
            const resp2 = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAudio`, {
                method: 'POST',
                body: formData,
            });
            const data2 = await resp2.json();
            console.log(`[sendTelegramVoice] sendAudio fallback: ${data2.ok}`);
            return data2.ok === true;
        }
        console.log('[sendTelegramVoice] Voice sent successfully');
        return true;
    } catch (err) {
        console.error('[sendTelegramVoice] Error:', err.message);
        return false;
    }
}

// Send audio file to Telegram
async function sendTelegramAudio(chatId, audioBuffer, caption) {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TELEGRAM_BOT_TOKEN || !chatId || !audioBuffer) return false;
    try {
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('audio', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'audio.mp3');
        if (caption) formData.append('caption', caption);

        const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAudio`, {
            method: 'POST',
            body: formData,
        });
        const data = await resp.json();
        return data.ok === true;
    } catch { return false; }
}

// Build clinical prompt for Telegram media analysis
function buildClinicalPrompt(media_type, message_text, mimeType) {
    const baseContext = `Sos el asistente clínico de FonoAudio Pro AI, una plataforma profesional de fonoaudiología.
FECHA/HORA: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`;

    const typePrompts = {
        photo: `${baseContext}

El usuario envió una IMAGEN (${mimeType}) por Telegram.
${message_text ? `Mensaje adjunto: "${message_text}"` : ''}

INSTRUCCIONES PARA IMÁGENES:
- Si es una imagen clínica (radiografía, ecografía, foto de cavidad oral, estructuras faciales), describí los hallazgos relevantes para fonoaudiología
- Si es un材料 terapéutico (pictograma, secuencia, rutina), analizá su contenido y sugerí mejoras
- Si es un documento escaneado, extraé el texto visible
- Si es una foto general, describí qué ves y cómo podría relacionarse con el contexto clínico
- Respondé en español argentino profesional
- Sé conciso (máx 5 oraciones)`,

        audio: `${baseContext}

El usuario envió un ARCHIVO DE AUDIO (${mimeType}) por Telegram.
${message_text ? `Mensaje adjunto: "${message_text}"` : ''}

INSTRUCCIONES PARA AUDIOS:
- Analizá el audio para identificar: calidad de voz, ritmo, fluidez, articulación
- Si detectás indicadores de trastornos del lenguaje o habla, mencionalos
- Si es una grabación de sesión, resumí los puntos clave
- Si es una consulta del paciente, respondé con precisión clínica
- Respondé en español argentino profesional
- Sé conciso (máx 5 oraciones)`,

        video: `${baseContext}

El usuario envió un VIDEO (${mimeType}) por Telegram.
${message_text ? `Mensaje adjunto: "${message_text}"` : ''}

INSTRUCCIONES PARA VIDEOS:
- Analizá el video para observaciones clínicas: movimientos articulatorios, respiración, postura, expresiones faciales
- Si es una sesión de terapia, resumí la intervención
- Si es un ejercicio, evaluá la ejecución
- Si es una demostración de material, analizá su utilidad
- Respondé en español argentino profesional
- Sé conciso (máx 5 oraciones)`,

        document: `${baseContext}

El usuario envió un DOCUMENTO (${mimeType}) por Telegram.
${message_text ? `Mensaje adjunto: "${message_text}"` : ''}

INSTRUCCIONES PARA DOCUMENTOS:
- Resumí el contenido del documento
- Extraé información clínica relevante
- Identificá datos de pacientes, diagnósticos, tratamientos
- Si es un informe, destacá los hallazgos principales
- Respondé en español argentino profesional
- Sé conciso (máx 5 oraciones)`,
    };

    return typePrompts[media_type] || `${baseContext}

El usuario envió un archivo (${mimeType}) por Telegram.
${message_text ? `Mensaje adjunto: "${message_text}"` : ''}

Analizá el archivo y respondé con información relevante. Respondé en español argentino profesional.`;
}

// Integrated routes
router.post('/process', async (req, res) => {
  try {
    res.json(await callAI(req, "Actúa como un asistente clínico inteligente para fonoaudiología. Procesa esta petición: "));
  } catch (e) {
    console.error('[Process] Error:', e);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// --- HOME GUIDE GENERATION ---

router.post('/guides/generate-home-guide-draft', async (req, res) => {
    const { patientId, patientName, lastSessionSummary, diagnosis, age } = req.body;
    
    try {
        const prompt = `Actúa como un experto fonoaudiólogo. Genera una Guía de Hogar para el paciente ${patientName} (${age} años), diagnóstico: ${diagnosis}. 
        ${lastSessionSummary ? `Resumen de la última sesión: ${lastSessionSummary}.` : 'No hay resumen de sesión previo.'}
        
        Responde SOLO con markdown plano. NO uses JSON ni objetos. Usa este formato exacto:

Guía de Hogar para ${patientName}

## Objetivo Principal
(un párrafo claro)

## Actividades Sugeridas
### Actividad 1: [nombre]
- Cómo hacerlo: ...
- Objetivo: ...

### Actividad 2: [nombre]
- Cómo hacerlo: ...
- Objetivo: ...

## Señales de Alerta
- señal 1
- señal 2

## Recomendaciones Generales
- recomendación 1
- recomendación 2

## Materiales Necesarios
- material 1
- material 2`;

        const result = await callAI(req, prompt);
        
        if (result.status === 'ok') {
            let raw = result.response || '';
            // Strip markdown code fences if present
            raw = raw.replace(/^```[\s\S]*?\n([\s\S]*?)\n```$/gm, '$1').trim();
            
            // Check if AI returned structured JSON instead of markdown
            let title = `Guía de Hogar - ${patientName}`;
            let content = raw;
            
            try {
                // Try to parse as JSON (structured response)
                const jsonData = JSON.parse(raw);
                if (jsonData.title || jsonData.content || jsonData.blocks) {
                    // Structured response - convert to markdown
                    title = jsonData.title || title;
                    if (Array.isArray(jsonData.content)) {
                        // Content is array of blocks
                        content = jsonData.content.map(block => {
                            if (block.block_title && block.block_content) {
                                const blockContent = Array.isArray(block.block_content) 
                                    ? block.block_content.map(activity => {
                                        if (activity.activity_title && activity.instructions) {
                                            return `### ${activity.activity_title}\n\n${activity.instructions.join('\n\n')}`;
                                        }
                                        return typeof activity === 'string' ? activity : JSON.stringify(activity);
                                    }).join('\n\n')
                                    : block.block_content;
                                return `## ${block.block_title}\n\n${blockContent}`;
                            }
                            return typeof block === 'string' ? block : JSON.stringify(block);
                        }).join('\n\n');
                    } else if (typeof jsonData.content === 'string') {
                        content = jsonData.content;
                    }
                    // Add materials if present
                    if (jsonData.materials && Array.isArray(jsonData.materials)) {
                        content += '\n\n## Materiales Necesarios\n\n' + jsonData.materials.map(m => `- ${m}`).join('\n');
                    }
                }
            } catch (e) {
                // Not JSON - treat as markdown (expected case)
                // Extract title (first non-empty line)
                const lines = raw.split('\n').filter(l => l.trim());
                title = (lines[0] || '').replace(/^#+\s*/, '').trim() || title;
                // Everything after first line is content
                const contentStart = raw.indexOf('\n', raw.indexOf(lines[0] || ''));
                content = contentStart > 0 ? raw.substring(contentStart).trim() : raw;
            }
            
            res.json({ status: 'ok', draft: { title, content, materialIds: [] } });
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('[Home Guide Route] Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// --- GOOGLE INTEGRATION ---

router.post('/google/refresh-token', async (req, res) => {
    const { refresh_token } = req.body;
    if (!refresh_token) {
        return res.status(400).json({ status: 'error', message: 'refresh_token is required' });
    }

    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                refresh_token: refresh_token,
                grant_type: 'refresh_token',
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[Google Refresh] Token refresh failed:', errorData);
            return res.status(401).json({ status: 'error', message: 'Token refresh failed', details: errorData });
        }

        const data = await response.json();
        const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
        console.log('[Google Refresh] Token refreshed successfully');
        res.json({ 
            status: 'ok', 
            access_token: data.access_token, 
            expires_at: expiresAt 
        });
    } catch (error) {
        console.error('[Google Refresh] Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

router.post('/google/meet', async (req, res) => {
    const { patientName, date, time, reason, durationMinutes = 30 } = req.body;
    
    try {
        const gs = await googleService();
        const result = await gs.createGoogleMeetEvent({
            patientName,
            date,
            time,
            durationMinutes,
            description: reason || 'Teleatención Fonoaudiológica',
        });

        if (result.status === 'ok') {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('[Google Meet Route] Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

router.post('/google/calendar/sync', async (req, res) => {
    try {
        const gs = await googleService();
        const result = await gs.syncGoogleCalendar();
        res.json(result);
    } catch (error) {
        console.error('[Google Calendar Sync Route] Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

router.post('/google/drive/sync', async (req, res) => {
    const { folderId } = req.body;
    try {
        const gs = await googleService();
        const result = await gs.syncDriveToMaterials(folderId);
        res.json(result);
    } catch (error) {
        console.error('[Google Drive Sync Route] Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

router.post('/resend_last_material', async (req, res) => {
    const { patientId } = req.body;
    try {
        const result = await distributionService.resendLastMaterial(patientId);
        if (result.status === 'ok') {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

router.post('/schedule_reminder', async (req, res) => {
    try {
        const result = await distributionService.scheduleReminder(req.body);
        if (result.status === 'ok') {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});


// --- NotebookLM Integration (extracted to routes/notebooklm.js) ---
router.use('/notebooklm', notebooklmRouter);

router.post('/clinical-planning/:patientId', async (req, res) => {
    try {
        const { patientId } = req.params;
        const result = await clinicalPlanningService.generateAnalysis(patientId);
        res.json(result);
    } catch (e) {
        console.error('[ClinicalPlanning] Error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// --- Search and Research Endpoints ---
router.post('/notebooklm', async (req, res) => {
    const { query } = req.body;
    try {
        const aiModel = req.app?.locals?.aiModel;
        if (!aiModel) {
            return res.status(503).json({ status: 'error', message: 'Servicio de IA no disponible. Configurá GOOGLE_API_KEY para activar NotebookLM.', hint: 'ai_unavailable' });
        }
        const result = await aiModel.generateContent(`Buscá información relevante sobre: "${query}". Respondé en formato JSON con array de objetos {title, content}.`);
        const text = result.response?.text?.() || '[]';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const results = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        res.json({ status: 'ok', response: results, total: results.length });
    } catch (e) {
        console.error('[NotebookLM Search] Error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.post('/research', async (req, res) => {
    const { query } = req.body;
    try {
        const aiModel = req.app?.locals?.aiModel;
        if (!aiModel) {
            return res.status(503).json({ status: 'error', message: 'Servicio de IA no disponible. Configurá GOOGLE_API_KEY para activar investigación.', hint: 'ai_unavailable' });
        }
        const result = await aiModel.generateContent(`Investigá evidencia científica sobre: "${query}". Respondé en formato JSON con array de objetos {title, journal, year, summary}.`);
        const text = result.response?.text?.() || '[]';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const evidence = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        res.json({ status: 'ok', response: evidence, query });
    } catch (e) {
        console.error('[Research] Error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.post('/clinical_summary', async (req, res) => {
    const { patientName, history, diagnosis } = req.body;
    try {
        const aiModel = req.app?.locals?.aiModel;
        if (!aiModel) {
            return res.status(503).json({ status: 'error', message: 'Servicio de IA no disponible. Configurá GOOGLE_API_KEY para generar resúmenes clínicos.', hint: 'ai_unavailable' });
        }
        const prompt = `Generá un resumen clínico fonoaudiológico profesional para el paciente ${patientName}.
Diagnóstico: ${diagnosis || 'No especificado'}
Historial: ${history || 'Sin historial detallado.'}
Incluí: diagnóstico, evolución, objetivos alcanzados, próximos pasos y plan de tratamiento.`;
        const result = await aiModel.generateContent(prompt);
        const summary = result.response?.text?.() || 'No se pudo generar el resumen.';
        res.json({ status: 'ok', response: summary });
    } catch (e) {
        console.error('[Clinical Summary] Error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// ═══ SERVICIO DE IA PARA GENERACIÓN DE INFORMES CLÍNICOS (BACKEND RESILIENTE) ═══
router.post('/reports/ai-generate', async (req, res) => {
    try {
        const { action, patient, reportType, guideSections, section, prompt, existingContent, tone } = req.body;

        const aiModel = req.app?.locals?.aiModel;
        const fallbackModel = req.app?.locals?.fallbackAiModel;
        const primaryModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

        const runAiPrompt = async (systemPrompt, userPrompt) => {
            const parts = [{ text: `${systemPrompt}\n\n${userPrompt}` }];
            let result = await callGeminiResilient(parts, aiModel, primaryModel);
            if (result.ok && result.text) return result.text;
            if (fallbackModel) {
                result = await callGeminiResilient(parts, fallbackModel, 'gemini-2.0-flash');
                if (result.ok && result.text) return result.text;
            }
            const groqResult = await callGroqFallback(`${systemPrompt}\n\n${userPrompt}`);
            if (groqResult.ok && groqResult.text) return groqResult.text;
            throw new Error(result.error?.message || 'Error al comunicarse con la IA');
        };

        const legalFramework = `
═══ MARCO LEGAL Y NORMATIVO (Provincia de Buenos Aires - Ley 15.052) ═══
- Diagnóstico DEBE ser funcional, NO médico (usar CIE-11 fonoaudiológico).
- Diferenciar SIEMPRE: "La madre refiere..." (dato anamnésico) vs. "Se observa/Se evidencia..." (hallazgo clínico).
- Membrete, firma, aclaración y matrícula CFPBA son obligatorios.
- Toque personal: conducta observada, motivaciones, ejemplos reales del habla del paciente.
`;

        const buildPatientContext = (p, repType) => {
            if (!p) return 'Sin datos de paciente';
            const parts = [];
            parts.push(`PACIENTE: ${p.name || 'Paciente'}, ${p.age || 'N/I'} años.`);
            if (p.document) parts.push(`DNI: ${p.document}`);
            if (p.responsable) parts.push(`Responsable: ${p.responsable}`);
            if (p.obra_social) parts.push(`Obra Social: ${p.obra_social}`);
            if (p.diagnosis) parts.push(`Diagnóstico actual: ${p.diagnosis}`);
            if (p.notes) parts.push(`Observaciones: ${p.notes}`);

            if (p.anamnesis) {
                parts.push(`ANAMNESIS:`);
                if (typeof p.anamnesis === 'string') parts.push(p.anamnesis.substring(0, 1500));
                else if (p.anamnesis.sections) {
                    Object.entries(p.anamnesis.sections).forEach(([k, v]) => {
                        parts.push(` - ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
                    });
                } else {
                    parts.push(JSON.stringify(p.anamnesis).substring(0, 1500));
                }
            }

            if (p.evaluations && p.evaluations.length > 0) {
                parts.push(`EVALUACIONES ESTANDARIZADAS:`);
                p.evaluations.forEach(ev => {
                    const pct = ev.maxScore > 0 ? Math.round((ev.score / ev.maxScore) * 100) : 0;
                    parts.push(` - ${ev.testName}: ${ev.score}/${ev.maxScore} (${pct}%) ${ev.notes ? `[${ev.notes}]` : ''}`);
                });
            }

            if (p.history && p.history.length > 0) {
                parts.push(`HISTORIAL DE SESIONES (${p.history.length} sesiones):`);
                p.history.slice(0, 5).forEach(s => {
                    parts.push(` - ${s.date} [${s.status}]: ${s.summary || ''} ${s.observations || ''}`);
                });
            }

            if (p.treatmentPlan) {
                parts.push(`PLAN DE TRATAMIENTO:`);
                if (p.treatmentPlan.general) parts.push(` Objetivo General: ${p.treatmentPlan.general}`);
                if (p.treatmentPlan.strategies) parts.push(` Estrategias: ${p.treatmentPlan.strategies}`);
            }

            return parts.join('\n');
        };

        const patientCtx = buildPatientContext(patient, reportType);

        if (action === 'generateFullReport') {
            const sectionList = guideSections
                ? guideSections.map((s, i) => `${i + 1}. KEY: "${s.id}" — Título: "${s.title}" — Explicación: ${s.description || ''}`).join('\n')
                : `1. KEY: "info_general"\n2. KEY: "motivo_consulta"\n3. KEY: "comportamiento"\n4. KEY: "dba"\n5. KEY: "expresivo_morfosintaxis"\n6. KEY: "expresivo_semantica"\n7. KEY: "impresion_diagnostica"\n8. KEY: "pronostico"\n9. KEY: "objetivos"\n10. KEY: "recomendaciones"`;

            const sysPrompt = `Sos un fonoaudiólogo matriculado (CFPBA) experto en redacción de informes clínicos para la Provincia de Buenos Aires.
Generá un informe fonoaudiológico COMPLETO tipo "${reportType || 'Valoración'}" en formato JSON.

${legalFramework}

DATOS CLÍNICOS DEL PACIENTE:
${patientCtx}

SECCIONES DEL INFORME (Usá EXACTAMENTE estas keys en el JSON retornado):
${sectionList}

REGLAS DE SALIDA:
1. Respondé ÚNICAMENTE con un objeto JSON válido donde las claves sean EXACTAMENTE los IDs/KEYs especificados arriba.
2. Cada valor debe ser un string con HTML válido (<p>, <strong>, <em>, <ul>, <li>, <table>).
3. SIEMPRE basar la redacción en las evaluaciones y datos reales del paciente.
4. Si falta un dato específico para una sección, redactá una descripción clínica profesional esperable o sugerida acorde al nivel de severidad del paciente.`;

            const rawText = await runAiPrompt(sysPrompt, `Generar informe completo tipo "${reportType}" para ${patient?.name || 'el paciente'}.`);
            let parsed = {};
            try {
                const cleaned = rawText.replace(/```json/gi, '').replace(/```/gi, '').trim();
                const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
            } catch (e) {
                console.warn('[AI Report Server] JSON parse failed, returning raw text inside contenido key:', e.message);
                parsed = { contenido: rawText };
            }

            return res.json({ status: 'ok', data: parsed });

        } else if (action === 'generateSectionText') {
            const sysPrompt = `Sos un fonoaudiólogo matriculado (CFPBA) experto.
Generá el texto para la sección "${section || 'General'}" de un informe fonoaudiológico.

${legalFramework}

DATOS DEL PACIENTE:
${patientCtx}

${existingContent ? `CONTENIDO ACTUAL A MEJORAR/EXPANDIR:\n${existingContent}\n` : ''}

INSTRUCCIÓN: ${prompt || 'Generar redacción clínica adecuada.'}
Respondé SOLO con el contenido HTML (<p>, <strong>, <ul>, <li>).`;

            const text = await runAiPrompt(sysPrompt, `Generar sección ${section}`);
            return res.json({ status: 'ok', text });

        } else if (action === 'suggestBlocks') {
            const sysPrompt = `Sos un fonoaudiólogo matriculado.
Generá 3 a 4 bloques/párrafos sugeridos alternativos para la sección "${section}".
Usá datos del paciente: ${patientCtx}
Respondé con un array JSON de strings HTML: ["<p>...</p>", "<p>...</p>"]`;

            const raw = await runAiPrompt(sysPrompt, `Sugerir bloques para ${section}`);
            let blocks = [];
            try {
                const cleaned = raw.replace(/```json/gi, '').replace(/```/gi, '').trim();
                const match = cleaned.match(/\[[\s\S]*\]/);
                blocks = JSON.parse(match ? match[0] : cleaned);
            } catch {
                blocks = [raw];
            }
            return res.json({ status: 'ok', blocks });

        } else if (action === 'improve' || action === 'improveText') {
            const sysPrompt = `Mejorá este texto clínico fonoaudiológico preservando datos y marco legal PBA:
${legalFramework}
DATOS PACIENTE: ${patientCtx}
Respondé SOLO con el texto mejorado en HTML.`;

            const text = await runAiPrompt(sysPrompt, prompt || existingContent);
            return res.json({ status: 'ok', text });

        } else if (action === 'suggestDiagnosis') {
            const sysPrompt = `Sos un fonoaudiólogo experto en diagnóstico funcional CIE-11 (Ley PBA 15.052).
Basándote en los datos del paciente y sus evaluaciones:
${patientCtx}

Sugerí un diagnóstico funcional fonoaudiológico completo, fundamentación y severidad. NO usá diagnósticos médicos.
Respondé en formato HTML.`;

            const text = await runAiPrompt(sysPrompt, `Sugerir diagnóstico funcional para ${patient?.name}`);
            return res.json({ status: 'ok', text });

        } else {
            // Default generic prompt
            const sysPrompt = `Sos un fonoaudiólogo experto. Procesá esta solicitud para el paciente:
${patientCtx}`;
            const text = await runAiPrompt(sysPrompt, prompt || 'Procesar solicitud.');
            return res.json({ status: 'ok', text });
        }

    } catch (err) {
        console.error('[AI Report Server] Error:', err);
        return res.status(500).json({ status: 'error', message: err.message || 'Error en servidor de IA' });
    }
});

// --- REAL ACTIONS ---


// 1. Telegram: Send actual message
router.get('/telegram/diagnose', async (req, res) => {
    // Auto-register webhook on diagnose visit
    await autoSetupWebhook(req);

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const result = {
        tokenSet: !!token,
        tokenLength: token ? token.length : 0,
        tokenPreview: token ? token.substring(0, 10) + '...' : 'MISSING',
        chatIdSet: !!chatId,
        chatIdValue: chatId || 'MISSING',
        googleApiKeySet: !!process.env.GOOGLE_API_KEY,
        groqApiKeySet: !!process.env.GROQ_API_KEY,
        supabaseUrlSet: !!process.env.VITE_SUPABASE_URL,
        supabaseKeySet: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY),
        aiModelType: req.app.locals.aiModel ? req.app.locals.aiModel.constructor?.name || 'initialized' : 'null',
        apiTest: null,
        webhookInfo: null,
        updatesTest: null,
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

// Expose debug logs (for troubleshooting audio processing)
router.get('/telegram/logs', (req, res) => {
    res.json({ debugLog: getDebugLog(), errorLog: getErrorLog() });
});

router.get('/telegram/clear-logs', (req, res) => {
    clearLog();
    res.json({ status: 'ok', message: 'Logs cleared' });
});

// Detailed environment + aiModel check (for debugging audio not responding)
router.get('/telegram/env-check', (req, res) => {
    const aiModel = req.app.locals.aiModel;
    res.json({
        env: {
            TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
            TELEGRAM_CHAT_ID: !!process.env.TELEGRAM_CHAT_ID,
            GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
            GROQ_API_KEY: !!process.env.GROQ_API_KEY,
            VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY),
            GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        },
        aiModel: {
            isNull: !aiModel,
            type: aiModel ? (aiModel.constructor?.name || 'initialized') : 'null',
        },
        timestamp: new Date().toISOString(),
    });
});

// DIAGNOSTIC: report patients with incomplete ficha (missing required clinical fields)
router.get('/telegram/missing-data', async (req, res) => {
    try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ status: 'error', message: 'Supabase env not configured' });
        }
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(supabaseUrl, supabaseKey);

        const { data: patients } = await sb.from('patients').select('id, name');
        const { data: records } = await sb.from('clinical_records').select(
            'patient_id, chief_complaint, primary_diagnosis_name, affected_areas, personal_history, family_history, medical_history, developmental_history'
        );

        const recById = {};
        (records || []).forEach(r => { recById[r.patient_id] = r; });

        const incomplete = [];
        for (const p of (patients || [])) {
            const cr = recById[p.id];
            const missing = [];
            if (!cr) missing.push('SIN_FICHA');
            else {
                if (!cr.chief_complaint || String(cr.chief_complaint).trim() === '') missing.push('chief_complaint');
                if (!cr.primary_diagnosis_name || String(cr.primary_diagnosis_name).trim() === '') missing.push('diag');
                if (!cr.affected_areas || !Array.isArray(cr.affected_areas) || cr.affected_areas.filter(a => a && a.affected).length === 0) missing.push('areas');
                if (!cr.personal_history || Object.keys(cr.personal_history).length === 0) missing.push('personal');
                if (!cr.family_history || Object.keys(cr.family_history).length === 0) missing.push('family');
                if (!cr.medical_history || Object.keys(cr.medical_history).length === 0) missing.push('medical');
                if (!cr.developmental_history || Object.keys(cr.developmental_history).length === 0) missing.push('developmental');
            }
            if (missing.length > 0) incomplete.push({ name: p.name, missing });
        }

        res.json({
            status: 'ok',
            totalPatients: (patients || []).length,
            incompleteCount: incomplete.length,
            sample: incomplete.slice(0, 10),
        });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e?.message || String(e) });
    }
});

router.get('/followup/missing-data', async (req, res) => {
    try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ status: 'error', message: 'Supabase env not configured' });
        }
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(supabaseUrl, supabaseKey);

        const { data: patients, error: patErr } = await sb.from('patients').select('id, name');
        if (patErr) throw patErr;
        const { data: records, error: recErr } = await sb.from('clinical_records').select(
            'patient_id, chief_complaint, primary_diagnosis_name, affected_areas, personal_history, family_history, medical_history, developmental_history'
        );
        if (recErr) throw recErr;

        const recById = {};
        (records || []).forEach(r => { recById[r.patient_id] = r; });

        const results = [];
        for (const p of (patients || [])) {
            const cr = recById[p.id];
            const missing = [];
            if (!cr) missing.push('Ficha clínica sin crear');
            else {
                if (!cr.chief_complaint || String(cr.chief_complaint).trim() === '') missing.push('Motivo de consulta (chief_complaint)');
                if (!cr.primary_diagnosis_name || String(cr.primary_diagnosis_name).trim() === '') missing.push('Diagnóstico principal');
                if (!cr.affected_areas || !Array.isArray(cr.affected_areas) || cr.affected_areas.filter(a => a && a.affected).length === 0) missing.push('Áreas afectadas');
                if (!cr.personal_history || Object.keys(cr.personal_history).length === 0) missing.push('Historia personal');
                if (!cr.family_history || Object.keys(cr.family_history).length === 0) missing.push('Historia familiar');
                if (!cr.medical_history || Object.keys(cr.medical_history).length === 0) missing.push('Historia médica');
                if (!cr.developmental_history || Object.keys(cr.developmental_history).length === 0) missing.push('Historia del desarrollo');
            }
            if (missing.length > 0) {
                results.push({
                    patientId: p.id,
                    patientName: p.name,
                    missing,
                });
            }
        }

        res.json({ status: 'ok', totalPatients: (patients || []).length, incompleteCount: results.length, results });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e?.message || String(e) });
    }
});

// ─── MORNING BRIEFING (proactive assistant) ───
router.get('/telegram/morning-briefing', async (req, res) => {
    try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(supabaseUrl, supabaseKey);

        // Resolve chat_id: query param > env > last real user chat from telegram_chat_ids (direction=incoming)
        let chatId = req.query.chatId || process.env.TELEGRAM_CHAT_ID;
        if (!chatId) {
            const { data: chatRows } = await sb
                .from('telegram_pending_queue')
                .select('chat_id')
                .eq('direction', 'incoming')
                .order('updated_at', { ascending: false })
                .limit(1);
            if (chatRows && chatRows.length > 0) chatId = chatRows[0].chat_id;
        }
        if (!chatId) return res.status(400).json({ status: 'error', message: 'chatId requerido (query param, env TELEGRAM_CHAT_ID o interacción previa del usuario)' });

        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });

        // 1. Turnos de hoy
        const { data: apps, error: appErr } = await sb
            .from('appointments')
            .select('patient_name, time, status, type')
            .eq('date', today)
            .order('time', { ascending: true });
        if (appErr) throw appErr;

        // 2. Datos faltantes
        const { data: patients } = await sb.from('patients').select('id, name');
        const { data: records } = await sb.from('clinical_records').select(
            'patient_id, chief_complaint, primary_diagnosis_name, affected_areas, personal_history, family_history, medical_history, developmental_history'
        );
        const recById = {};
        (records || []).forEach(r => { recById[r.patient_id] = r; });
        const incomplete = [];
        for (const p of (patients || [])) {
            const cr = recById[p.id];
            const missing = [];
            if (!cr) missing.push('Ficha sin crear');
            else {
                if (!cr.chief_complaint || String(cr.chief_complaint).trim() === '') missing.push('Motivo de consulta');
                if (!cr.primary_diagnosis_name || String(cr.primary_diagnosis_name).trim() === '') missing.push('Diagnóstico');
                if (!cr.affected_areas || !Array.isArray(cr.affected_areas) || cr.affected_areas.filter(a => a && a.affected).length === 0) missing.push('Áreas afectadas');
                if (!cr.personal_history || Object.keys(cr.personal_history).length === 0) missing.push('Historia personal');
                if (!cr.family_history || Object.keys(cr.family_history).length === 0) missing.push('Historia familiar');
                if (!cr.medical_history || Object.keys(cr.medical_history).length === 0) missing.push('Historia médica');
                if (!cr.developmental_history || Object.keys(cr.developmental_history).length === 0) missing.push('Historia desarrollo');
            }
            if (missing.length > 0) incomplete.push({ name: p.name, missing });
        }

        // 3. Armar mensaje
        const parts = [];
        parts.push('🌅 <b>Briefing matutino</b>');
        parts.push(`<b>${today}</b>`);
        if ((apps || []).length > 0) {
            parts.push('\n📅 <b>Sesiones de hoy:</b>');
            parts.push((apps || []).map(a => `• ${a.time || '??:??'} hs — ${a.patient_name}${a.type ? ` (${a.type})` : ''}`).join('\n'));
        } else {
            parts.push('\n📅 Sin sesiones programadas para hoy.');
        }
        const pending = incomplete.filter(i => (apps || []).some(a => a.patient_name === i.name));
        if (pending.length > 0) {
            parts.push('\n⚠️ <b>Pacientes de hoy con ficha incompleta:</b>');
            parts.push(pending.map(i => `• ${i.name}: falta [${i.missing.join(', ')}]`).join('\n'));
        }
        if (incomplete.length > 0) {
            parts.push(`\n📋 Total fichas incompletas en la clínica: ${incomplete.length}.`);
        } else {
            parts.push('\n✅ Todas las fichas están completas.');
        }
        const message = parts.join('\n');

        const sent = await sendTelegramMessage(chatId, message, 'HTML');
        res.json({ status: 'ok', sent, appointmentsToday: (apps || []).length, incompleteCount: incomplete.length, message });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e?.message || String(e) });
    }
});

router.post('/telegram/send', async (req, res) => {
    console.log(`[Telegram] chatId: ${chatId}, media: ${photo ? 'photo' : video ? 'video' : audio ? 'audio' : voice ? 'voice' : document ? 'document' : 'text'}, msgLen: ${message?.length || 0}`);

    if (!TELEGRAM_BOT_TOKEN) {
        return res.status(500).json({ status: 'error', message: 'TELEGRAM_BOT_TOKEN not configured.' });
    }
    if (!chatId) {
        return res.status(400).json({ status: 'error', message: 'No chatId provided.' });
    }

    const numericChatId = Number(chatId);
    if (isNaN(numericChatId)) {
        return res.status(400).json({ status: 'error', message: `chatId "${chatId}" is not a valid number.` });
    }

    const captionText = caption || message || '';
    let sentMessages = [];

    try {
        if (photo) {
            const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: numericChatId, photo, caption: captionText || undefined, parse_mode: parse_mode || undefined })
            });
            const d = await r.json();
            if (d.ok) sentMessages.push('photo');
            else throw new Error(d.description);
        }
        if (video) {
            const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: numericChatId, video, caption: captionText || undefined, parse_mode: parse_mode || undefined })
            });
            const d = await r.json();
            if (d.ok) sentMessages.push('video');
            else throw new Error(d.description);
        }
        if (audio) {
            const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAudio`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: numericChatId, audio, caption: captionText || undefined, title: captionText || undefined })
            });
            const d = await r.json();
            if (d.ok) sentMessages.push('audio');
            else throw new Error(d.description);
        }
        if (voice) {
            const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVoice`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: numericChatId, voice, caption: captionText || undefined })
            });
            const d = await r.json();
            if (d.ok) sentMessages.push('voice');
            else throw new Error(d.description);
        }
        if (document) {
            const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: numericChatId, document, caption: captionText || undefined })
            });
            const d = await r.json();
            if (d.ok) sentMessages.push('document');
            else throw new Error(d.description);
        }
        if (fileUrl && !document) {
            const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: numericChatId, document: fileUrl, caption: captionText || undefined })
            });
            const d = await r.json();
            if (d.ok) sentMessages.push('file');
            else throw new Error(d.description);
        }
        if (message && !photo && !video && !audio && !voice && !document && !fileUrl) {
            const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: numericChatId, text: message, parse_mode: parse_mode || undefined })
            });
            const d = await r.json();
            if (d.ok) sentMessages.push('text');
            else throw new Error(d.description);
        }

        res.json({ status: 'ok', sent: sentMessages });
    } catch (e) {
        console.error('Telegram Send Error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// 1b. Telegram: Proactive Alerts
router.post('/alerts/check-and-send', async (req, res) => {
    const { patients } = req.body;
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CLINICIAN_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!TELEGRAM_BOT_TOKEN || !CLINICIAN_CHAT_ID) {
        return res.status(500).json({ status: 'error', message: 'TELEGRAM configuration incomplete (TOKEN or CHAT_ID)' });
    }

    let notifiedCount = 0;
    try {
        for (const p of patients) {
            const criticalAlerts = [...(p.alerts || [])];
            if (p.consentSigned === false) criticalAlerts.push("Falta Consentimiento Informado");

            if (criticalAlerts.length > 0) {
                const message = `⚠️ *Alerta Clínica* ⚠️\n\n*Paciente:* ${p.name}\n*Alertas:* ${criticalAlerts.join(', ')}`;
                
                const textRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: CLINICIAN_CHAT_ID, text: message, parse_mode: 'HTML' })
                });
                
                if (textRes.ok) notifiedCount++;
            }
        }
        res.json({ status: 'ok', notifiedCount });
    } catch (e) {
        console.error('Alerts Check Error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// 2. Obsidian: Save to local vault via Local REST API
router.post('/obsidian/save', async (req, res) => {
    const { path, content, title } = req.body;
    const OBSIDIAN_API_KEY = process.env.OBSIDIAN_API_KEY;
    const OBSIDIAN_URL = process.env.OBSIDIAN_URL || 'http://127.0.0.1:27123'; // Default Local REST API port

    // Gracefully degrade on Vercel (Obsidian is local-only)
    if (process.env.VERCEL === '1') {
        console.warn('[Obsidian] Disabled on Vercel — localhost-only integration');
        return res.status(200).json({
            status: 'degraded',
            message: 'Obsidian integration not available in serverless environment',
            fallback: 'Content available in clinical history'
        });
    }

    if (!OBSIDIAN_API_KEY) {
        return res.status(500).json({ status: 'error', message: 'OBSIDIAN_API_KEY not configured' });
    }

    try {
        // Ensure path ends with .md
        let targetPath = path.endsWith('.md') ? path : `${path}.md`;
        if (title && !targetPath.includes(title)) {
            // If path is just a folder or partial, try to append title
            targetPath = targetPath.endsWith('/') ? `${targetPath}${title}.md` : `${targetPath}/${title}.md`;
        }

        const resObs = await fetch(`${OBSIDIAN_URL}/vault/${targetPath}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${OBSIDIAN_API_KEY}`,
                'Content-Type': 'text/markdown'
            },
            body: content
        });

        if (resObs.ok) {
            res.json({ status: 'ok', path: targetPath });
        } else {
            const errData = await resObs.json().catch(() => ({}));
            throw new Error(errData.message || `Obsidian API error: ${resObs.status}`);
        }
    } catch (e) {
        console.error('Obsidian Save Error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// 3c. Get Patient Distribution History
router.get('/patients/:patientId/distributions', async (req, res) => {
    const { patientId } = req.params;
    try {
        const history = await distributionService.getPatientDistributionHistory(patientId);
        res.json(history);
    } catch (error) {
        console.error('[Get History Error]:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// 3d. Retry a failed distribution
router.post('/distributions/:distributionId/retry', async (req, res) => {
    const { distributionId } = req.params;
    try {
        const result = await distributionService.retryDistribution(distributionId);
        res.json(result);
    } catch (error) {
        console.error('[Retry Distribution Error]:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// --- TELEGRAM PROXY ENDPOINTS (solve CORS) ---

// Helper to check for token
function isTelegramConfigured() {
    return !!process.env.TELEGRAM_BOT_TOKEN;
}

router.get('/telegram/poll', async (req, res) => {
    try {
        const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        if (!TELEGRAM_BOT_TOKEN) {
            return res.status(200).json({ ok: true, result: [] });
        }

        const offset = req.query.offset || '0';
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=3`);
        if (!response.ok) {
            return res.status(200).json({ ok: true, result: [] });
        }
        const data = await response.json();
        res.status(200).json(data);
    } catch (e) {
        console.error('[Telegram Poll] Error:', e.message);
        res.status(200).json({ ok: true, result: [] });
    }
});

router.get('/telegram/file/:fileId', async (req, res) => {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TELEGRAM_BOT_TOKEN) {
        return res.json({ ok: false, description: 'TELEGRAM_BOT_TOKEN not configured' });
    }

    try {
        const { fileId } = req.params;
        const fileInfoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
        const fileInfo = await fileInfoRes.json();
        if (!fileInfo.ok) {
            return res.json({ ok: false, description: 'Telegram getFile failed' });
        }

        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`;
        const fileRes = await fetch(fileUrl);
        if (!fileRes.ok) {
            return res.json({ ok: false, description: 'Failed to download file' });
        }

        const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        const buffer = await fileRes.arrayBuffer();
        res.send(Buffer.from(buffer));
    } catch (e) {
        res.json({ ok: false, description: e.message });
    }
});

// --- AUDIO CLINICAL PROCESSING (transcribe + intent + patient + action) ---

async function processAudioClinically(base64Data, mimeType, messageText, patients, aiModel) {
    if (!aiModel) {
        return {
            status: 'error',
            error: true,
            suggestedResponse: 'No pude procesar el audio porque el modelo de IA no está disponible. Escribime por texto y te ayudo.',
            rawResponse: '',
        };
    }

    const patientList = patients.length > 0
        ? `PACIENTES: ${patients.map((p, i) => `${i + 1}. ${p.name} (${p.diagnosis || 'sin dx'}, ${p.age || '?'} años)`).join(', ')}`
        : 'No hay pacientes cargados.';

    const audioPrompt = `Sos FonoAudio, el asistente clinico autónomo de FonoAudio Pro AI. SOS UN AGENTE COMPLETO con acceso total a la clinica y voz propia masculina rioplatense. Un fonoaudiologo te envio un AUDIO por Telegram.

Tenés acceso a: pacientes (CRUD completo), agenda/turnos, notas clinicas, evoluciones, sesiones, informes, evaluaciones, planes de tratamiento, materiales, conocimiento clinico, NotebookLM, estadisticas.

${patientList}
${messageText ? `Mensaje adjunto: "${messageText}"` : ''}

TRANSCRIBI el audio fielmente. Respondi en espanol argentino rioplatense, profesional y calido. Si el usuario menciona un paciente, identificalo. Si pide una accion clinica (agregar nota, crear turno, buscar paciente, generar informe), mencionala y deci que la ejecutas. Conciso pero completo.`;

    const parts = [
        { text: audioPrompt },
        { inlineData: { mimeType, data: base64Data } }
    ];

    try {
        const geminiResult = await callGeminiResilient(parts, aiModel, GEMINI_MODEL_CHAIN[0]);
        if (!geminiResult.ok || !geminiResult.text) {
            return {
                status: 'error',
                error: true,
                suggestedResponse: 'No pude procesar el audio en este momento. Intentá de nuevo o escribime por texto.',
                rawResponse: geminiResult.error?.message || '',
            };
        }

        const text = geminiResult.text.trim();

        // Try to detect patient name from the response
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

        // If no patient detected from AI response, try matching from message text
        if (!matchedPatient && messageText && patients.length > 0) {
            const match = matchPatient(text, patients, messageText);
            if (match) {
                matchedPatient = match.patient;
                patientDetected = match.patient.name;
            }
        }

        return {
            status: 'ok',
            type: 'audio_clinical',
            transcription: text,
            intent: 'consulta',
            patientDetected,
            actionSuggested: 'nota_clinica',
            clinicalSummary: text,
            suggestedResponse: text,
            matchedPatient,
            rawResponse: text,
        };
    } catch (e) {
        return {
            status: 'error',
            error: true,
            suggestedResponse: `Error procesando audio: ${e.message}`,
            rawResponse: e.message,
        };
    }
}

// --- TELEGRAM MULTIMODAL AI PROCESSING (with patient matching + action suggestions) ---

// --- TELEGRAM MULTIMODAL AI PROCESSING INTERNAL ---
async function processMediaInternal(file_id, media_type, message_text, chat_id, user_id, aiModel) {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

    if (!file_id) {
        return { status: 'error', message: 'file_id is required' };
    }

    if (!TELEGRAM_BOT_TOKEN) {
        console.warn('[Process-Media] No TELEGRAM_BOT_TOKEN — cannot download file');
        return { status: 'ok', response: 'Archivo recibido pero no se pudo procesar sin token de Telegram configurado.', sent_to_telegram: false };
    }

    try {
        // Step 1: Get file info from Telegram
        const fileInfoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${file_id}`);
        const fileInfo = await fileInfoRes.json();
        if (!fileInfo.ok) {
            return { status: 'error', message: `Telegram getFile failed: ${fileInfo.description}` };
        }

        // Step 2: Download the file
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`;
        const fileRes = await fetch(fileUrl);
        if (!fileRes.ok) {
            return { status: 'error', message: 'Failed to download file from Telegram' };
        }
        const fileBuffer = await fileRes.arrayBuffer();
        const base64Data = Buffer.from(fileBuffer).toString('base64');

        // Step 3: Determine MIME type
        const ext = fileInfo.result.file_path.split('.').pop()?.toLowerCase() || '';
        const mimeMap = {
            'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif', 'webp': 'image/webp',
            'mp3': 'audio/mpeg', 'ogg': 'audio/ogg', 'wav': 'audio/wav', 'm4a': 'audio/mp4', 'oga': 'audio/ogg',
            'mp4': 'video/mp4', 'mov': 'video/quicktime', 'avi': 'video/x-msvideo',
            'pdf': 'application/pdf', 'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        };
        const mimeType = mimeMap[ext] || fileInfo.result.mime_type || 'application/octet-stream';
        const fileName = fileInfo.result.file_path.split('/').pop();

        // Step 4: Fetch patient list for matching
        const patients = user_id ? await fetchPatientsForUser(user_id) : [];

        // ─── AUDIO/VOICE → specialized clinical handler ───
        const isAudio = media_type === 'audio' || media_type === 'voice' || mimeType.startsWith('audio/');

        if (isAudio) {
            logDebug('Telegram Process-Media', `Audio detected (${mimeType}). Routing to clinical audio handler.`);

            let audioResult;
            try {
                audioResult = await processAudioClinically(base64Data, mimeType, message_text, patients, aiModel);
            } catch (audioErr) {
                logError('Telegram Process-Media processAudioClinically threw', audioErr);
                audioResult = {
                    status: 'error',
                    error: true,
                    suggestedResponse: `Error inesperado procesando audio: ${audioErr.message}`,
                };
            }

            logDebug('Telegram Process-Media', `processAudioClinically returned. error: ${audioResult.error}, transcription: ${audioResult.transcription?.slice(0, 50)}, suggestedResponse: ${audioResult.suggestedResponse?.slice(0, 50)}`);

            // If audio processing failed, send error to Telegram
            if (audioResult.error) {
                logDebug('Telegram Process-Media', 'Audio processing FAILED - sending error to Telegram');
                const errorMsg = audioResult.suggestedResponse || 'No pude procesar el audio. Intenta de nuevo.';
                let sent = false;
                try {
                    sent = await sendTelegramMessage(chat_id, errorMsg);
                } catch (sendErr) {
                    logError('Telegram Process-Media send error msg', sendErr);
                }
                if (!sent && chat_id && TELEGRAM_BOT_TOKEN) {
                    try {
                        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chat_id, text: errorMsg }),
                        });
                        sent = true;
                    } catch (retryErr) {
                        logError('Telegram Process-Media retry send error', retryErr);
                    }
                }
                logDebug('Telegram Process-Media', `Error message sent result: ${sent}`);
                return {
                    status: 'error',
                    type: 'audio_clinical',
                    response: errorMsg,
                    media_type: 'audio',
                    mime_type: mimeType,
                    file_name: fileName,
                    sent_to_telegram: sent,
                };
            }

            // Build patient matching for audio
            let matchedPatient = null;
            if (audioResult.patientDetected && patients.length > 0) {
                const lowerDetected = audioResult.patientDetected.toLowerCase();
                for (const p of patients) {
                    const nameLower = p.name.toLowerCase();
                    if (nameLower.includes(lowerDetected) || lowerDetected.includes(nameLower) || lowerDetected.includes(nameLower.split(' ')[0])) {
                        matchedPatient = p;
                        break;
                    }
                }
            }

            // Also try matchPatient on the full text if no patient detected from structured data
            if (!matchedPatient && patients.length > 0) {
                const fallbackMatch = matchPatient(audioResult.transcription, patients, message_text || '');
                if (fallbackMatch) {
                    matchedPatient = fallbackMatch.patient;
                    if (!audioResult.patientDetected) audioResult.patientDetected = fallbackMatch.patient.name;
                }
            }

            // Store as pending for action
            const audioSummary = {
                file_id,
                file_name: fileName,
                mime_type: mimeType,
                media_type: 'audio',
                analysis: audioResult.clinicalSummary || audioResult.transcription,
                transcription: audioResult.transcription,
                intent: audioResult.intent,
                action_suggested: audioResult.actionSuggested,
                patient_detected: audioResult.patientDetected,
                matched_patient: matchedPatient ? { id: matchedPatient.id, name: matchedPatient.name, diagnosis: matchedPatient.diagnosis, age: matchedPatient.age } : null,
                suggestions: {
                    autoMatchedPatient: matchedPatient || undefined,
                    suggestion: audioResult.actionSuggested,
                },
                patients: patients.map(p => ({ id: p.id, name: p.name, diagnosis: p.diagnosis, age: p.age })),
                timestamp: new Date().toISOString(),
            };

            if (chat_id) {
                await setPendingFile(chat_id, audioSummary);
                setTimeout(async () => {
                    const current = await getPendingFile(chat_id);
                    if (current?.file_id === file_id) {
                        await deletePendingFile(chat_id);
                    }
                }, 30 * 60 * 1000);
            }

            // Build Telegram response — plain text, no parse_mode to avoid formatting errors
            let responseMessage = `Audio procesado\n\n`;
            responseMessage += `Transcripcion:\n${audioResult.transcription}\n\n`;
            if (audioResult.patientDetected) {
                responseMessage += `Paciente detectado: ${audioResult.patientDetected}\n`;
            }
            responseMessage += `Accion sugerida: ${audioResult.actionSuggested}\n\n`;

            if (matchedPatient) {
                responseMessage += `Detecte que esto corresponde a ${matchedPatient.name} (${matchedPatient.diagnosis || 'sin diagnostico'}).\n\n`;
                responseMessage += `Que queres hacer?\n`;
                responseMessage += `  1 - Guardar como nota clinica\n`;
                responseMessage += `  2 - Guardar como sesion\n`;
                responseMessage += `  3 - Guardar como informe\n`;
                responseMessage += `  no - Descartar`;
            } else if (patients.length > 0) {
                responseMessage += `A que paciente corresponde?\n`;
                patients.slice(0, 6).forEach((p, i) => {
                    responseMessage += `  ${i + 1}. ${p.name}\n`;
                });
                responseMessage += `\nO escribi "no" para cancelar.`;
            } else {
                responseMessage += audioResult.suggestedResponse;
            }

            // Send to Telegram — plain text, no parse_mode
            let sentToTelegram = false;
            if (chat_id && TELEGRAM_BOT_TOKEN) {
                try {
                    logDebug('Telegram Process-Media', `Sending response to Telegram: ${responseMessage.slice(0, 100)}`);
                    sentToTelegram = await sendTelegramMessage(chat_id, responseMessage);
                    logDebug('Telegram Process-Media', `sendTelegramMessage returned: ${sentToTelegram}`);
                    if (!sentToTelegram) {
                        logError('Telegram Process-Media sendTelegramMessage', new Error('sendMessage returned false'));
                        // Second attempt: try sending via raw fetch
                        try {
                            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ chat_id, text: responseMessage }),
                            });
                            sentToTelegram = true;
                        } catch (retryErr) {
                            logError('Telegram Process-Media retry send', retryErr);
                        }
                    }
                } catch (tgErr) {
                    logError('Telegram Process-Media send response', tgErr);
                    logDebug('Telegram Process-Media', `Error sending response: ${tgErr.message}`);
                    // Second attempt: try sending via raw fetch
                    try {
                        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chat_id, text: responseMessage }),
                        });
                        sentToTelegram = true;
                    } catch (retryErr) {
                        logError('Telegram Process-Media retry send', retryErr);
                    }
                }
            }

            // Send voice ONLY if user requested it or voice mode is active
            if (sentToTelegram && chat_id && shouldSendVoice(chat_id, message_text, '') && audioResult.suggestedResponse && audioResult.suggestedResponse.length > 10) {
                const voiceText = (audioResult.suggestedResponse || audioResult.transcription || responseMessage)
                    .replace(/[*_`~#]/g, '')
                    .replace(/\n{3,}/g, '\n\n')
                    .substring(0, 3000);
                const voiceSent = await sendTelegramVoice(chat_id, voiceText).catch(err => {
                    console.error('[processMediaInternal] Voice send error:', err.message);
                    return false;
                });
                if (!voiceSent) {
                    console.warn('[processMediaInternal] Voice response failed');
                }
            }

            return {
                status: 'ok',
                type: 'audio_clinical',
                response: responseMessage,
                transcription: audioResult.transcription,
                intent: audioResult.intent,
                patient_detected: audioResult.patientDetected,
                action_suggested: audioResult.actionSuggested,
                clinical_summary: audioResult.clinicalSummary,
                matched_patient: matchedPatient ? { id: matchedPatient.id, name: matchedPatient.name } : null,
                media_type: 'audio',
                mime_type: mimeType,
                file_name: fileName,
                sent_to_telegram: sentToTelegram,
            };
        }

        // ─── NON-AUDIO: existing image/video/document handler ───

        // Step 5: Build Gemini prompt with patient awareness
        const patientList = patients.length > 0
            ? `\nPACIENTES DEL PROFESIONAL:\n${patients.map((p, i) => `${i + 1}. ${p.name} — ${p.diagnosis || 'sin diagnóstico'}, ${p.age || '?'} años`).join('\n')}`
            : '\nNo hay pacientes cargados en el sistema.';

        const clinicalPrompt = `Sos el asistente clínico de FonoAudio Pro AI, una plataforma profesional de fonoaudiología.
FECHA/HORA: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}

El usuario envió un ARCHIVO (${media_type.toUpperCase()}, ${mimeType}) por Telegram.
${message_text ? `Mensaje adjunto del usuario: "${message_text}"` : ''}
Nombre del archivo: ${fileName}
${patientList}

INSTRUCCIONES:
1. Analizá el archivo: describí qué contiene y su relevancia clínica.
2. Identificá SI el archivo o el texto mencionan a algún paciente de la lista.
3. Si el archivo parece pertenecer a un paciente específico, indicá cuál.
4. Respondé en español argentino profesional, conciso (máx 8 oraciones).
5. Al final de tu respuesta, agregá SIEMPRE esta sección:

---ACCIONES_SUGERIDAS---
ARCHIVO: ${fileName}
MIME: ${mimeType}
PACIENTES_DETECTADOS: [lista de nombres de pacientes que coinciden, o "ninguno"]
SUGERENCIA: [Guardar como documento | Guardar como sesión | Guardar como informe | Solo informativo]
---FIN_ACCIONES---`;

        // Step 6: Send to Gemini with resilience
        const parts = [{ text: clinicalPrompt }];
        if (mimeType.startsWith('image/') || mimeType.startsWith('audio/') || mimeType.startsWith('video/') || mimeType === 'application/pdf') {
            parts.push({ inlineData: { mimeType, data: base64Data } });
        }

        const geminiResult = await callGeminiResilient(parts, aiModel, GEMINI_MODEL_CHAIN[0]);
        let aiResponse;
        if (geminiResult.ok) {
            aiResponse = geminiResult.text;
        } else {
            console.error('[Process-Media] All Gemini models failed:', geminiResult.error?.message);

            // Save to pending queue
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
                metadata: { patients: patients.map(p => p.name) },
            });

            const errorMsg = `No pude analizar el archivo con IA (servicio temporalmente no disponible).\n\n✅ Tu archivo quedó guardado en la cola de procesamiento. Cuando el servicio se restablezca, se analizará automáticamente.\n\n📄 Mientras tanto, podés guardarlo manualmente desde la app.`;
            await sendTelegramMessage(chat_id, errorMsg);
            return { status: 'ok', response: errorMsg, queued: true, sent_to_telegram: true };
        }

        // Step 7: Parse AI suggestions section
        let suggestions = null;
        let cleanResponse = aiResponse;
        const suggestionsMatch = aiResponse.match(/---ACCIONES_SUGERIDAS---([\s\S]*?)---FIN_ACCIONES---/);
        if (suggestionsMatch) {
            cleanResponse = aiResponse.replace(/---ACCIONES_SUGERIDAS---[\s\S]*?---FIN_ACCIONES---/, '').trim();
            const block = suggestionsMatch[1];
            const detectedPatients = block.match(/PACIENTES_DETECTADOS:\s*(.*)/)?.[1]?.trim() || 'ninguno';
            const suggestion = block.match(/SUGERENCIA:\s*(.*)/)?.[1]?.trim() || 'Solo informativo';
            suggestions = {
                fileName,
                mimeType,
                detectedPatients,
                suggestion,
            };

            // Try to auto-match a patient
            if (patients.length > 0) {
                const match = matchPatient(aiResponse, patients, message_text);
                if (match) {
                    suggestions.autoMatchedPatient = match.patient;
                    suggestions.matchConfidence = match.confidence;
                    suggestions.matchReason = match.reason;
                }
            }
        }

        // Step 8: Store as pending file for this chat
        if (chat_id) {
            await setPendingFile(chat_id, {
                file_id,
                file_name: fileName,
                mime_type: mimeType,
                media_type,
                analysis: cleanResponse,
                suggestions,
                patients: patients.map(p => ({ id: p.id, name: p.name, diagnosis: p.diagnosis, age: p.age })),
                timestamp: new Date().toISOString(),
            });

            // Auto-expire after 30 minutes
            setTimeout(async () => {
                const current = await getPendingFile(chat_id);
                if (current?.file_id === file_id) {
                    await deletePendingFile(chat_id);
                }
            }, 30 * 60 * 1000);
        }

        // Step 8b: Persist to RAG knowledge base for future semantic search
        try {
            const supabaseUrl = process.env.VITE_SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
            if (supabaseUrl && supabaseKey && cleanResponse) {
                // Determine patient_id from auto-matched patient
                const matchedPatientId = suggestions?.autoMatchedPatient?.id || null;

                // Create source record
                const sourceRes = await fetch(`${supabaseUrl}/rest/v1/clinical_sources`, {
                    method: 'POST',
                    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
                    body: JSON.stringify({
                        title: `Análisis: ${fileName}`,
                        category: 'analisis-externo',
                        validated_by: 'Gemini OCR',
                        page_count: 1,
                    }),
                });
                if (sourceRes.ok) {
                    const source = await sourceRes.json();
                    // Generate embedding for the analysis text
                    try {
                        const { GoogleGenerativeAI } = await import('@google/generative-ai');
                        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
                        const embedModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
                        const embedResult = await embedModel.embedContent(cleanResponse.slice(0, 2000));
                        await fetch(`${supabaseUrl}/rest/v1/source_embeddings`, {
                            method: 'POST',
                            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                source_id: source[0].id,
                                content: cleanResponse.slice(0, 3000),
                                embedding: embedResult.embedding.values,
                                page_number: 1,
                                section_title: `Análisis de ${fileName}`,
                                tags: ['analisis-externo', 'ocr', media_type],
                                patient_id: matchedPatientId,
                                confidence_score: 0.9,
                            }),
                        });
                        console.log(`[RAG] Document persisted for semantic search: ${fileName}`);
                    } catch (embedErr) {
                        console.warn('[RAG] Embedding failed:', embedErr.message);
                    }
                }
            }
        } catch (ragErr) {
            console.warn('[RAG] Persistence failed:', ragErr.message);
        }

        // Step 9: Build response message with action buttons
        let responseMessage = cleanResponse;

        if (suggestions) {
            if (suggestions.autoMatchedPatient) {
                responseMessage += `\n\nParece que este archivo corresponde a ${suggestions.autoMatchedPatient.name} (${suggestions.autoMatchedPatient.diagnosis || 'sin diagnóstico'}).`;
                responseMessage += `\n\n¿Qué querés hacer? Responder con:\n`;
                responseMessage += `  • "1" o "guardalo en ${suggestions.autoMatchedPatient.name}" — Guardar como documento\n`;
                responseMessage += `  • "2" o "sesión ${suggestions.autoMatchedPatient.name}" — Guardar como sesión clínica\n`;
                responseMessage += `  • "3" o "informe ${suggestions.autoMatchedPatient.name}" — Guardar como informe\n`;
                responseMessage += `  • "no" — Descartar`;
            } else if (patients.length > 0) {
                responseMessage += `\n\n¿A qué paciente querés asociar este archivo? Responder con el nombre o número:\n`;
                patients.slice(0, 8).forEach((p, i) => {
                    responseMessage += `  • ${i + 1}. ${p.name}\n`;
                });
                responseMessage += `\nO escribí "no" para solo guardar como archivo suelto.`;
            } else {
                responseMessage += `\n\nNo hay pacientes cargados en el sistema para asociar este archivo.`;
            }
        }

        // Step 10: Send response back via Telegram
        let sentToTelegram = false;
        if (chat_id && TELEGRAM_BOT_TOKEN) {
            try {
                const tgResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id, text: responseMessage, parse_mode: 'HTML' }),
                });
                const tgData = await tgResp.json();
                sentToTelegram = tgData.ok === true;
            } catch (tgErr) {
                console.error('[Telegram Process-Media] Failed to send response:', tgErr.message);
            }
        }

        return {
            status: 'ok',
            response: responseMessage,
            media_type,
            mime_type: mimeType,
            file_name: fileName,
            suggestions,
            sent_to_telegram: sentToTelegram,
        };
    } catch (e) {
        console.error('[Telegram Process-Media] Error:', e.message);
        return { status: 'error', message: e.message };
    }
}

router.post('/telegram/process-media', async (req, res) => {
    const { file_id, media_type, message_text, chat_id, user_id } = req.body;
    const aiModel = req.app.locals.aiModel;

    try {
        const result = await processMediaInternal(file_id, media_type, message_text, chat_id, user_id, aiModel);
        if (result.status === 'ok') {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// --- SAVE FILE/ANALYSIS TO PATIENT RECORD ---

// --- SAVE FILE/ANALYSIS TO PATIENT RECORD INTERNAL ---
async function saveToPatientInternal(chat_id, patient_id, save_type, user_id) {
    const pending = await getPendingFile(chat_id);
    if (!pending) {
        return { status: 'error', message: 'No hay archivo pendiente para guardar. Send a new file first.' };
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
        return { status: 'error', message: 'Supabase not configured' };
    }

    try {
        // Find the patient
        const patients = user_id ? await fetchPatientsForUser(user_id) : [];
        const patient = patients.find(p => p.id === patient_id) || (patient_id ? { id: patient_id, name: 'Desconocido' } : null);

        if (!patient) {
            return { status: 'error', message: 'Patient not found' };
        }

        const now = new Date().toISOString();

        // Build content: prefer transcription for audio, analysis for others
        const fileContent = pending.transcription
            ? `TRANSCRIPCIÓN:\n${pending.transcription}\n\nRESUMEN CLÍNICO:\n${pending.analysis || ''}`
            : pending.analysis || '';

        const docEntry = {
            id: `tg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: pending.file_name || 'archivo_telegram',
            type: pending.media_type === 'audio' ? 'audio' :
                  pending.media_type === 'photo' ? 'imagen' :
                  pending.media_type === 'video' ? 'video' :
                  pending.mime_type || 'documento',
            date: now.split('T')[0],
            content: fileContent,
            mimeType: pending.mime_type || 'application/octet-stream',
            aiSummary: pending.analysis || '',
            source: 'telegram',
            saved_by: user_id || 'unknown',
            // Audio-specific metadata
            ...(pending.media_type === 'audio' ? {
                transcription: pending.transcription || '',
                intent: pending.intent || '',
                action_suggested: pending.action_suggested || '',
                patient_detected: pending.patient_detected || '',
            } : {}),
        };

        if (save_type === 'session') {
            // Save as clinical session
            const sessionEntry = {
                id: `tg_sess_${Date.now()}`,
                patientId: patient.id,
                date: now.split('T')[0],
                status: 'completed',
                type: 'sesion_telegram',
                objectives: 'Sesión documentada vía Telegram',
                observations: pending.analysis || '',
                summary: pending.transcription
                    ? `Audio recepcionado: ${pending.file_name}\n\nTranscripción:\n${pending.transcription}\n\nResumen: ${pending.analysis || ''}`
                    : `Archivo recepcionado: ${pending.file_name}\n\n${pending.analysis || 'Sin análisis adicional.'}`,
                planUpdates: '',
                associatedMaterialIds: [],
                nextAction: '',
            };

            // Append to patient's history array
            const currentHistory = patient.history || [];
            const updatedHistory = [...currentHistory, sessionEntry];

            const updateRes = await fetch(`${supabaseUrl}/rest/v1/patients?id=eq.${patient.id}`, {
                method: 'PATCH',
                headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=minimal',
                },
                body: JSON.stringify({ history: updatedHistory }),
            });

            if (!updateRes.ok) {
                const errText = await updateRes.text();
                throw new Error(`Supabase update failed: ${errText}`);
            }

            // Clean up pending
            await deletePendingFile(chat_id);

            return {
                status: 'ok',
                saved_as: 'session',
                patient_name: patient.name,
                file_name: pending.file_name,
                message: `Sesión guardada en la historia de ${patient.name}.`,
            };

        } else if (save_type === 'report') {
            // Save as clinical report
            const reportEntry = {
                id: `tg_rpt_${Date.now()}`,
                date: now.split('T')[0],
                title: `Informe desde Telegram — ${pending.file_name || 'archivo'}`,
                content: pending.transcription
                    ? `TRANSCRIPCIÓN:\n${pending.transcription}\n\nANÁLISIS:\n${pending.analysis || ''}`
                    : pending.analysis || 'Sin análisis.',
                type: 'generico',
            };

            const currentReports = patient.reports || [];
            const updatedReports = [...currentReports, reportEntry];

            const updateRes = await fetch(`${supabaseUrl}/rest/v1/patients?id=eq.${patient.id}`, {
                method: 'PATCH',
                headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=minimal',
                },
                body: JSON.stringify({ reports: updatedReports }),
            });

            if (!updateRes.ok) {
                const errText = await updateRes.text();
                throw new Error(`Supabase update failed: ${errText}`);
            }

            await deletePendingFile(chat_id);

            return {
                status: 'ok',
                saved_as: 'report',
                patient_name: patient.name,
                file_name: pending.file_name,
                message: `Informe guardado en la historia de ${patient.name}.`,
            };

        } else {
            // Default: save as document (most common)
            const currentDocs = patient.documents || [];
            const updatedDocs = [...currentDocs, docEntry];

            const updateRes = await fetch(`${supabaseUrl}/rest/v1/patients?id=eq.${patient.id}`, {
                method: 'PATCH',
                headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=minimal',
                },
                body: JSON.stringify({ documents: updatedDocs }),
            });

            if (!updateRes.ok) {
                const errText = await updateRes.text();
                throw new Error(`Supabase update failed: ${errText}`);
            }

            await deletePendingFile(chat_id);

            return {
                status: 'ok',
                saved_as: 'document',
                patient_name: patient.name,
                file_name: pending.file_name,
                message: `Documento guardado en la historia de ${patient.name}.`,
            };
        }
    } catch (e) {
        console.error('[saveToPatientInternal] Error:', e.message);
        return { status: 'error', message: e.message };
    }
}

router.post('/telegram/save-to-patient', async (req, res) => {
    const { chat_id, patient_id, save_type, user_id } = req.body;
    try {
        const result = await saveToPatientInternal(chat_id, patient_id, save_type, user_id);
        if (result.status === 'ok') {
            res.json(result);
        } else {
            res.status(result.status === 'error' ? 400 : 500).json(result);
        }
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// --- GET PENDING FILE for a chat (for UI to show context) ---

router.get('/telegram/pending-file/:chatId', async (req, res) => {
    try {
        const pending = await getPendingFile(req.params.chatId);
        if (!pending) {
            return res.json({ status: 'ok', pending: null });
        }
        res.json({ status: 'ok', pending });
    } catch (e) {
        console.error('[Telegram] pending-file error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// --- TELEGRAM TEXT AI PROCESSING (with clinical context + action handling) ---

// ══════════════════════════════════════════════════════════════════
// GEMINI FUNCTION CALLING (TOOLS) FOR CLINICAL AGENT
// ══════════════════════════════════════════════════════════════════

const clinicalTools = [
    // ─── PATIENT MANAGEMENT ───
    {
        name: 'search_patient',
        description: 'Busca un paciente por nombre o diagnostico en la base de datos.',
        parameters: {
            type: 'OBJECT',
            properties: {
                name: { type: 'STRING', description: 'Nombre o diagnostico del paciente.' }
            },
            required: ['name']
        }
    },
    {
        name: 'get_missing_data_alerts',
        description: 'Analiza TODOS los pacientes de la clinica y devuelve un reporte de que campos de la ficha clínica faltan en cada uno (diagnostico, areas afectadas, historias, etc.) y qué pacientes no tienen ficha creada. Usar SIEMPRE que el usuario pregunte por "datos faltantes", "faltantes", "alertas de datos", "que le falta a la ficha", "pacientes incompletos", o cualquier pregunta sobre informacion incompleta. Devuelve la lista completa y exacta, no inventes.',
        parameters: { type: 'OBJECT', properties: {} }
    },
    {
        name: 'list_all_patients',
        description: 'Lista todos los pacientes del profesional con sus datos basicos.',
        parameters: { type: 'OBJECT', properties: {} }
    },
    {
        name: 'get_patient_info',
        description: 'Obtiene informacion completa de un paciente por ID.',
        parameters: {
            type: 'OBJECT',
            properties: {
                patient_id: { type: 'STRING', description: 'ID del paciente.' }
            },
            required: ['patient_id']
        }
    },
    {
        name: 'create_patient',
        description: 'Crea un nuevo paciente en la base de datos. Si el usuario indica un motivo de consulta o motivo de derivacion, guardalo en el campo reason.',
        parameters: {
            type: 'OBJECT',
            properties: {
                name: { type: 'STRING', description: 'Nombre completo del paciente.' },
                age: { type: 'STRING', description: 'Edad del paciente.' },
                diagnosis: { type: 'STRING', description: 'Diagnostico principal si se conoce.' },
                reason: { type: 'STRING', description: 'Motivo de consulta o derivacion. Ej: "Madre refiere tartamudez".' },
                phone: { type: 'STRING', description: 'Telefono de contacto.' },
                email: { type: 'STRING', description: 'Email del paciente o responsable.' },
                notes: { type: 'STRING', description: 'Notas adicionales.' }
            },
            required: ['name']
        }
    },
    {
        name: 'update_patient',
        description: 'Actualiza un campo de un paciente existente.',
        parameters: {
            type: 'OBJECT',
            properties: {
                patient_id: { type: 'STRING', description: 'ID del paciente.' },
                field: { type: 'STRING', description: 'Campo a actualizar: name, age, diagnosis, phone, email, notes, gender, address.' },
                value: { type: 'STRING', description: 'Nuevo valor del campo.' }
            },
            required: ['patient_id', 'field', 'value']
        }
    },
    {
        name: 'delete_patient',
        description: 'Elimina UN paciente específico de la base de datos usando su ID. Usá este tool SOLO cuando ya tengas el ID del paciente. Si el usuario pide eliminar "todos los que se llaman X" o eliminar por nombre, usá delete_patients_by_name en su lugar.',
        parameters: {
            type: 'OBJECT',
            properties: {
                patient_id: { type: 'STRING', description: 'ID del paciente a eliminar.' }
            },
            required: ['patient_id']
        }
    },
    {
        name: 'delete_patients_by_name',
        description: 'Busca y ELIMINA TODOS los pacientes cuyo nombre coincida (case-insensitive, coincide parcial) con el texto indicado. Usar cuando el usuario pida "elimina todos los pacientes que se llamen X", "borra los pacientes pruebita", o cualquier eliminación por nombre en lugar de por ID. Es una operación destructiva: se eliminan paciente, su ficha clínica (clinical_records) y registros relacionados en cascada.',
        parameters: {
            type: 'OBJECT',
            properties: {
                name: { type: 'STRING', description: 'Texto o nombre a buscar y eliminar. Ej: "pruebita 123".' }
            },
            required: ['name']
        }
    },
    // ─── CLINICAL NOTES & EVOLUTION ───
    {
        name: 'add_clinical_evolution',
        description: 'Agrega una nota clinica o entrada de evolucion a la historia del paciente.',
        parameters: {
            type: 'OBJECT',
            properties: {
                patient_id: { type: 'STRING', description: 'ID del paciente.' },
                clinical_text: { type: 'STRING', description: 'Texto de la nota clinica o evolucion.' }
            },
            required: ['patient_id', 'clinical_text']
        }
    },
    {
        name: 'add_session_note',
        description: 'Agrega una nota de sesion clinica con resumen y observaciones.',
        parameters: {
            type: 'OBJECT',
            properties: {
                patient_id: { type: 'STRING', description: 'ID del paciente.' },
                summary: { type: 'STRING', description: 'Resumen de la sesion.' },
                observations: { type: 'STRING', description: 'Observaciones clinicas.' },
                next_action: { type: 'STRING', description: 'Proxima accion o tarea.' }
            },
            required: ['patient_id', 'summary']
        }
    },
    // ─── REPORTS ───
    {
        name: 'generate_report_draft',
        description: 'Genera un borrador de informe clinico para un paciente.',
        parameters: {
            type: 'OBJECT',
            properties: {
                patient_id: { type: 'STRING', description: 'ID del paciente.' },
                focus_area: { type: 'STRING', description: 'Area fonoaudiologica: lenguaje, fonacion, deglucion, audologia, motricidad, cognicion.' }
            },
            required: ['patient_id', 'focus_area']
        }
    },
    {
        name: 'list_reports',
        description: 'Lista los informes existentes de un paciente.',
        parameters: {
            type: 'OBJECT',
            properties: {
                patient_id: { type: 'STRING', description: 'ID del paciente.' }
            },
            required: ['patient_id']
        }
    },
    // ─── APPOINTMENTS ───
    {
        name: 'get_agenda',
        description: 'Consulta la agenda de turnos. Puede filtrar por fecha.',
        parameters: {
            type: 'OBJECT',
            properties: {
                date: { type: 'STRING', description: 'Fecha en formato YYYY-MM-DD. Si se omite, muestra la agenda de hoy.' }
            }
        }
    },
    {
        name: 'create_appointment',
        description: 'Crea un nuevo turno/cita para un paciente.',
        parameters: {
            type: 'OBJECT',
            properties: {
                patient_name: { type: 'STRING', description: 'Nombre del paciente.' },
                date: { type: 'STRING', description: 'Fecha YYYY-MM-DD.' },
                time: { type: 'STRING', description: 'Hora HH:MM.' },
                type: { type: 'STRING', description: 'Tipo de turno: consulta, control, evaluacion, sesion.' }
            },
            required: ['patient_name', 'date', 'time']
        }
    },
    {
        name: 'update_appointment',
        description: 'Modifica un turno existente.',
        parameters: {
            type: 'OBJECT',
            properties: {
                appointment_id: { type: 'STRING', description: 'ID del turno.' },
                field: { type: 'STRING', description: 'Campo a modificar: date, time, status, type.' },
                value: { type: 'STRING', description: 'Nuevo valor.' }
            },
            required: ['appointment_id', 'field', 'value']
        }
    },
    {
        name: 'set_reminder',
        description: 'Programa un recordatorio/aviso que se enviara al profesional por Telegram a la fecha y hora indicadas. Usalo SIEMPRE que el usuario pida "avísame", "recordame", "no se me olvide" o cualquier alerta futura. Confirmá al usuario que lo vas a avisar.',
        parameters: {
            type: 'OBJECT',
            properties: {
                message: { type: 'STRING', description: 'Texto del recordatorio a enviar. Ej: "Revisar ficha de Martín López".' },
                date: { type: 'STRING', description: 'Fecha del aviso en YYYY-MM-DD.' },
                time: { type: 'STRING', description: 'Hora del aviso en HH:MM (formato 24h).' }
            },
            required: ['message', 'date', 'time']
        }
    },
    {
        name: 'cancel_appointment',
        description: 'Cancela o elimina un turno.',
        parameters: {
            type: 'OBJECT',
            properties: {
                appointment_id: { type: 'STRING', description: 'ID del turno a cancelar.' }
            },
            required: ['appointment_id']
        }
    },
    {
        name: 'reschedule_appointment',
        description: 'Reprograma un turno existente a otra fecha y/o hora. Actualiza Supabase y sincroniza con Google Calendar. Solicitá confirmación sobre la nueva fecha/hora si hay dudas.',
        parameters: {
            type: 'OBJECT',
            properties: {
                appointment_id: { type: 'STRING', description: 'ID del turno a reprogramar.' },
                new_date: { type: 'STRING', description: 'Nueva fecha en YYYY-MM-DD.' },
                new_time: { type: 'STRING', description: 'Nueva hora en HH:MM (24h). Si no se indica, conserva la hora original.' }
            },
            required: ['appointment_id', 'new_date']
        }
    },
    {
        name: 'move_appointment_room',
        description: 'Mueve un turno a otro consultorio/sala (roomid). Si el turno está sincronizado a Google Calendar, actualiza el campo location del evento. Solicitá confirmation sobre el consultorio destino.',
        parameters: {
            type: 'OBJECT',
            properties: {
                appointment_id: { type: 'STRING', description: 'ID del turno a mover.' },
                room_name: { type: 'STRING', description: 'Nombre del consultorio/sala destino.' }
            },
            required: ['appointment_id', 'room_name']
        }
    },
    // ─── EVALUATIONS ───
    {
        name: 'add_evaluation',
        description: 'Agrega una evaluacion o test estandarizado al paciente.',
        parameters: {
            type: 'OBJECT',
            properties: {
                patient_id: { type: 'STRING', description: 'ID del paciente.' },
                test_name: { type: 'STRING', description: 'Nombre del test o evaluacion.' },
                result: { type: 'STRING', description: 'Resultado de la evaluacion.' },
                area: { type: 'STRING', description: 'Area evaluada: lenguaje, fonacion, deglucion, audologia, motricidad, cognicion.' }
            },
            required: ['patient_id', 'test_name', 'result']
        }
    },
    // ─── TREATMENT PLAN ───
    {
        name: 'update_treatment_plan',
        description: 'Actualiza el plan de tratamiento de un paciente. IMPORTANTE: Si el paciente ya tiene un plan, este tool MERGEA (conserva lo existente y agrega/modifica solo lo que se pide). Si el usuario dice "modificar" o "agregar", leé el plan actual primero y PRESERVÁ todo lo existente, cambiando SOLO lo solicitado.',
        parameters: {
            type: 'OBJECT',
            properties: {
                patient_id: { type: 'STRING', description: 'ID del paciente.' },
                plan_text: { type: 'STRING', description: 'Texto COMPLETO del plan de tratamiento. Si es una modificacion, inclui TODO el plan existente mas los cambios. NUNCA borres contenido existente.' },
                action: { type: 'STRING', description: 'Si es "create" crea nuevo. Si es "update" o "merge" modifica el existente preservando lo que no se cambia.' },
                section: { type: 'STRING', description: 'Que parte se modifica: general, objetivos, estrategias, frecuencia, observaciones, o null para plan completo.' }
            },
            required: ['patient_id', 'plan_text']
        }
    },
    // ─── KNOWLEDGE BASE ───
    {
        name: 'search_knowledge',
        description: 'Busca en la base de conocimiento clinica (articulos, protocolos, evidencia).',
        parameters: {
            type: 'OBJECT',
            properties: {
                query: { type: 'STRING', description: 'Termino de busqueda clinica.' }
            },
            required: ['query']
        }
    },
    {
        name: 'add_knowledge',
        description: 'Agrega un articulo o entrada a la base de conocimiento.',
        parameters: {
            type: 'OBJECT',
            properties: {
                title: { type: 'STRING', description: 'Titulo del articulo o recurso.' },
                content: { type: 'STRING', description: 'Contenido o resumen del articulo.' },
                category: { type: 'STRING', description: 'Categoria: lenguaje, fonacion, deglucion, audologia, general.' }
            },
            required: ['title', 'content']
        }
    },
    // ─── MATERIALS ───
    {
        name: 'list_materials',
        description: 'Lista los materiales terapeuticos disponibles.',
        parameters: {
            type: 'OBJECT',
            properties: {
                category: { type: 'STRING', description: 'Filtrar por categoria.' }
            }
        }
    },
    {
        name: 'search_materials',
        description: 'Busca materiales por titulo o tags.',
        parameters: {
            type: 'OBJECT',
            properties: {
                query: { type: 'STRING', description: 'Termino de busqueda.' }
            },
            required: ['query']
        }
    },
    // ─── STATISTICS ───
    {
        name: 'get_statistics',
        description: 'Obtiene estadisticas del consultorio: cantidad de pacientes, turnos, informes.',
        parameters: { type: 'OBJECT', properties: {} }
    },
    {
        name: 'check_missing_data',
        description: 'Identifica pacientes con datos incompletos (sin telefono, sin diagnostico, etc).',
        parameters: { type: 'OBJECT', properties: {} }
    },
    // ─── NOTEBOOKLM ───
    {
        name: 'notebook_list',
        description: 'Lista los notebooks clinicos disponibles en NotebookLM.',
        parameters: { type: 'OBJECT', properties: {} }
    },
    {
        name: 'notebook_ask',
        description: 'Hace una pregunta clinica a un notebook de NotebookLM.',
        parameters: {
            type: 'OBJECT',
            properties: {
                notebook_id: { type: 'STRING', description: 'ID del notebook.' },
                question: { type: 'STRING', description: 'Pregunta clinica a investigar.' }
            },
            required: ['notebook_id', 'question']
        }
    },
    // ─── FOLLOW-UP ───
    {
        name: 'get_upcoming_appointments',
        description: 'Lista los proximos turnos de los proximos 7 dias.',
        parameters: { type: 'OBJECT', properties: {} }
    },
];

function newId() { return crypto.randomUUID(); }

async function executeToolCall(functionName, args, user_id) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return { status: 'error', message: 'Supabase not configured' };

    // Resolve user_id if not provided
    let resolvedUserId = user_id;
    if (!resolvedUserId) {
        resolvedUserId = await findProfessionalId();
    }

    const headers = {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
    };

    const actualUserId = resolvedUserId || null;
    try {
        // ─── PATIENT TOOLS ───
        if (functionName === 'search_patient') {
            const queryName = args.name.toLowerCase();
            const patients = await fetchPatientsForUser(actualUserId);
            const matches = patients.filter(p => p.name.toLowerCase().includes(queryName) || (p.diagnosis && p.diagnosis.toLowerCase().includes(queryName)));
            return { status: 'ok', count: matches.length, patients: matches.map(p => ({ id: p.id, name: p.name, age: p.age, diagnosis: p.diagnosis, phone: p.phone })) };
        }

        if (functionName === 'list_all_patients') {
            const patients = await fetchPatientsForUser(actualUserId);
            return { status: 'ok', count: patients.length, patients: patients.map(p => ({ id: p.id, name: p.name, age: p.age, diagnosis: p.diagnosis })) };
        }

        if (functionName === 'get_missing_data_alerts') {
            // Query all patients + clinical_records with service role
            const patRes = await fetch(`${supabaseUrl}/rest/v1/patients?select=id,name`, { method: 'GET', headers });
            if (!patRes.ok) throw new Error(`Error pacientes: ${await patRes.text()}`);
            const allPatients = await patRes.json();

            const recRes = await fetch(`${supabaseUrl}/rest/v1/clinical_records?select=patient_id,chief_complaint,primary_diagnosis_name,affected_areas,personal_history,family_history,medical_history,developmental_history`, { method: 'GET', headers });
            if (!recRes.ok) throw new Error(`Error fichas: ${await recRes.text()}`);
            const records = await recRes.json();

            const recById = {};
            (records || []).forEach(r => { recById[r.patient_id] = r; });

            // Clinical-quality validators: a field can be "present" but clinically poor
            const GENERIC_TERMS = ['por evaluar', 'a confirmar', 'a determinar', 'sin especificar', 'por definir', 'pendiente', 'evaluar', 'definir', 'desconocido', 'nc', 'na', 'seguir'];
            const isClinicallyPoor = (val, minWords = 2) => {
                const s = String(val || '').trim().toLowerCase();
                if (!s) return { poor: true, reason: 'vacío' };
                const words = s.split(/\s+/).filter(Boolean);
                if (words.length < minWords) return { poor: true, reason: 'muy breve' };
                if (GENERIC_TERMS.some(t => s.includes(t))) return { poor: true, reason: 'término genérico' };
                return { poor: false };
            };

            const report = [];
            for (const p of (allPatients || [])) {
                const cr = recById[p.id];
                const missing = [];
                if (!cr) {
                    missing.push('FICHA SIN CREAR');
                } else {
                    if (!cr.chief_complaint || String(cr.chief_complaint).trim() === '') missing.push('Motivo de consulta');
                    else { const q = isClinicallyPoor(cr.chief_complaint, 3); if (q.poor) missing.push(`Motivo de consulta (${q.reason})`); }
                    if (!cr.primary_diagnosis_name || String(cr.primary_diagnosis_name).trim() === '') missing.push('Diagnostico principal');
                    else { const q = isClinicallyPoor(cr.primary_diagnosis_name, 2); if (q.poor) missing.push(`Diagnostico principal (${q.reason})`); }
                    if (!cr.affected_areas || !Array.isArray(cr.affected_areas) || cr.affected_areas.filter(a => a && a.affected).length === 0) missing.push('Areas afectadas');
                    if (!cr.personal_history || Object.keys(cr.personal_history).length === 0) missing.push('Historia personal');
                    if (!cr.family_history || Object.keys(cr.family_history).length === 0) missing.push('Historia familiar');
                    if (!cr.medical_history || Object.keys(cr.medical_history).length === 0) missing.push('Historia medica');
                    if (!cr.developmental_history || Object.keys(cr.developmental_history).length === 0) missing.push('Historia del desarrollo');
                }
                report.push({ patient: p.name, missingFields: missing, hasRecord: !!cr });
            }

            const withMissing = report.filter(r => r.missingFields.length > 0);
            return {
                status: 'ok',
                totalPatients: (allPatients || []).length,
                patientsWithMissingData: withMissing.length,
                report: withMissing.map(r => ({
                    patient: r.patient,
                    missing: r.missingFields,
                })),
            };
        }

        if (functionName === 'get_patient_info') {
            const patients = await fetchPatientsForUser(actualUserId);
            const patient = patients.find(p => p.id === args.patient_id);
            if (!patient) return { status: 'error', message: 'Paciente no encontrado' };
            return { status: 'ok', patient };
        }

        if (functionName === 'create_patient') {
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
                created_at: new Date().toISOString(),
            };
            console.log(`[executeToolCall] create_patient: name=${args.name}, age=${newPatient.age}, professional_id=${actualUserId}`);
            const res = await fetch(`${supabaseUrl}/rest/v1/patients`, {
                method: 'POST', headers, body: JSON.stringify(newPatient),
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
                        chief_complaint: args.reason || args.diagnosis || '',
                        chief_complaint_onset: '',
                        personal_history: {},
                        family_history: {},
                        medical_history: {},
                        developmental_history: {},
                        clinical_observations: args.notes || '',
                        affected_areas: {},
                        primary_diagnosis_name: args.diagnosis || null,
                        primary_diagnosis_code: null,
                        secondary_diagnosis_codes: [],
                        created_by: actualUserId,
                        updated_by: actualUserId,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    };
                    await fetch(`${supabaseUrl}/rest/v1/clinical_records`, {
                        method: 'POST', headers, body: JSON.stringify(clinicalRecord),
                    });
                    console.log(`[executeToolCall] clinical_records created for ${args.name}`);
                } catch (crErr) {
                    console.warn('[executeToolCall] Could not create clinical_records:', crErr.message);
                }
            }

            return { status: 'ok', message: `Paciente "${args.name}" creado exitosamente. ${args.reason ? `Motivo: ${args.reason}.` : ''}`, patient: newPatient };
        }

        if (functionName === 'update_patient') {
            const { patient_id, field, value } = args;
            const allowedFields = ['name', 'age', 'diagnosis', 'phone', 'email', 'notes', 'gender', 'address'];
            if (!allowedFields.includes(field)) return { status: 'error', message: `Campo "${field}" no permitido. Permitidos: ${allowedFields.join(', ')}` };
            let finalValue = value;
            if (field === 'age') {
                const num = String(value).match(/\d+/);
                finalValue = num ? parseInt(num[0], 10) : null;
            }
            const res = await fetch(`${supabaseUrl}/rest/v1/patients?id=eq.${patient_id}`, {
                method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' },
                body: JSON.stringify({ [field]: finalValue }),
            });
            if (!res.ok) throw new Error(await res.text());
            return { status: 'ok', message: `Campo "${field}" actualizado correctamente.` };
        }

        if (functionName === 'delete_patient') {
            const res = await fetch(`${supabaseUrl}/rest/v1/patients?id=eq.${args.patient_id}`, {
                method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' },
            });
            if (!res.ok) throw new Error(await res.text());
            return { status: 'ok', message: 'Paciente eliminado correctamente.' };
        }

        if (functionName === 'delete_patients_by_name') {
            const searchTerm = (args.name || '').trim();
            if (!searchTerm) return { status: 'error', message: 'No se indicó un nombre para buscar.' };

            // 1. Find all matching patients (case-insensitive, partial match) via service-role fetch
            const findRes = await fetch(`${supabaseUrl}/rest/v1/patients?select=id,name&name=ilike.*${encodeURIComponent(searchTerm)}*`, {
                method: 'GET', headers,
            });
            if (!findRes.ok) throw new Error(`Error buscando pacientes: ${await findRes.text()}`);
            const matches = await findRes.json();

            if (!matches || matches.length === 0) {
                return { status: 'ok', message: `No se encontraron pacientes cuyo nombre contenga "${searchTerm}".`, deletedCount: 0 };
            }

            // 2. Delete each (cascade removes clinical_records via FK ON DELETE CASCADE)
            let deleted = 0;
            const errors = [];
            for (const p of matches) {
                const delRes = await fetch(`${supabaseUrl}/rest/v1/patients?id=eq.${p.id}`, {
                    method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' },
                });
                if (delRes.ok) deleted++;
                else errors.push(`${p.name}: ${await delRes.text()}`);
            }

            if (errors.length > 0 && deleted === 0) {
                throw new Error(`No se pudo eliminar ninguno. ${errors.join(' | ')}`);
            }
            const names = matches.map(m => m.name).join(', ');
            return {
                status: 'ok',
                deletedCount: deleted,
                totalFound: matches.length,
                message: `Se eliminaron ${deleted} paciente(s) que coinciden con "${searchTerm}" (${names}).${errors.length ? ` Errores: ${errors.join(' | ')}` : ''}`,
            };
        }

        // ─── CLINICAL NOTES ───
        if (functionName === 'add_clinical_evolution') {
            const { patient_id, clinical_text } = args;
            const patients = await fetchPatientsForUser(actualUserId);
            const patient = patients.find(p => p.id === patient_id);
            if (!patient) return { status: 'error', message: 'Paciente no encontrado' };

            const now = new Date().toISOString().split('T')[0];
            const newHistoryItem = {
                id: newId(),
                patientId: patient.id,
                date: now,
                status: 'completed',
                type: 'nota_clinica_telegram',
                objectives: 'Nota clinica via Telegram Agent',
                observations: clinical_text,
                summary: clinical_text,
                planUpdates: '',
                associatedMaterialIds: [],
                nextAction: '',
            };

            const updatedHistory = [...(patient.history || []), newHistoryItem];
            const updateRes = await fetch(`${supabaseUrl}/rest/v1/patients?id=eq.${patient.id}`, {
                method: 'PATCH',
                headers: { ...headers, Prefer: 'return=minimal' },
                body: JSON.stringify({ history: updatedHistory }),
            });
            if (!updateRes.ok) throw new Error(await updateRes.text());
            return { status: 'ok', message: `Evolucion agregada a la historia de ${patient.name}.` };
        }

        if (functionName === 'add_session_note') {
            const { patient_id, summary, observations, next_action } = args;
            const now = new Date().toISOString();
            const session = {
                id: newId(),
                patient_id,
                professional_id: actualUserId,
                date: now,
                summary,
                observations: observations || '',
                next_action: next_action || '',
            };
            const res = await fetch(`${supabaseUrl}/rest/v1/sessions`, {
                method: 'POST', headers, body: JSON.stringify(session),
            });
            if (!res.ok) throw new Error(await res.text());
            return { status: 'ok', message: `Sesion clinica registrada.` };
        }

        // ─── REPORTS ───
        if (functionName === 'generate_report_draft') {
            const { patient_id, focus_area } = args;
            const patients = await fetchPatientsForUser(actualUserId);
            const patient = patients.find(p => p.id === patient_id);
            if (!patient) return { status: 'error', message: 'Paciente no encontrado' };

            const draft = `# INFORME CLINICO - ${patient.name}\nArea: ${focus_area}\nDiagnostico: ${patient.diagnosis || 'No especificado'}\nEdad: ${patient.age || 'N/D'}\n\n## Analisis\nSe evalua area de ${focus_area} evidenciando desempeno clinico acorde al plan terapeutico. Se sugiere continuar con los ejercicios pautados y control evolutivo en 4 semanas.\n\nGenerado por Agente FonoAudio Pro AI.`;

            const reportEntry = {
                id: newId(),
                date: new Date().toISOString().split('T')[0],
                title: `Informe (${focus_area}) - ${patient.name}`,
                content: draft,
                type: 'generico',
            };

            const updatedReports = [...(patient.reports || []), reportEntry];
            await fetch(`${supabaseUrl}/rest/v1/patients?id=eq.${patient.id}`, {
                method: 'PATCH',
                headers: { ...headers, Prefer: 'return=minimal' },
                body: JSON.stringify({ reports: updatedReports }),
            });
            return { status: 'ok', draft, message: `Borrador de informe generado para ${patient.name}.` };
        }

        if (functionName === 'list_reports') {
            const patients = await fetchPatientsForUser(actualUserId);
            const patient = patients.find(p => p.id === args.patient_id);
            if (!patient) return { status: 'error', message: 'Paciente no encontrado' };
            return { status: 'ok', count: (patient.reports || []).length, reports: patient.reports || [] };
        }

        // ─── APPOINTMENTS ───
        if (functionName === 'get_agenda') {
            const today = new Date().toISOString().split('T')[0];
            const dateFilter = args.date || today;
            const res = await fetch(`${supabaseUrl}/rest/v1/appointments?date=eq.${dateFilter}&type=neq.recordatorio&order=time.asc`, {
                method: 'GET', headers,
            });
            if (!res.ok) throw new Error(await res.text());
            const appointments = await res.json();
            return { status: 'ok', date: dateFilter, count: appointments.length, appointments };
        }

        if (functionName === 'get_upcoming_appointments') {
            const today = new Date().toISOString().split('T')[0];
            const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const res = await fetch(`${supabaseUrl}/rest/v1/appointments?date=gte.${today}&date=lte.${nextWeek}&order=date.asc,time.asc`, {
                method: 'GET', headers,
            });
            if (!res.ok) throw new Error(await res.text());
            const appointments = await res.json();
            return { status: 'ok', count: appointments.length, appointments };
        }

        if (functionName === 'create_appointment') {
            const { patient_name, date, time, type } = args;
            const appointment = {
                id: newId(),
                patient_name,
                date,
                time,
                type: type || 'consulta',
                status: 'programado',
                professional_id: actualUserId,
            };
            const res = await fetch(`${supabaseUrl}/rest/v1/appointments`, {
                method: 'POST', headers, body: JSON.stringify(appointment),
            });
            if (!res.ok) throw new Error(await res.text());
            return { status: 'ok', message: `Turno creado para ${patient_name} el ${date} a las ${time}.` };
        }

        if (functionName === 'update_appointment') {
            const { appointment_id, field, value } = args;
            const allowedFields = ['date', 'time', 'status', 'type'];
            if (!allowedFields.includes(field)) return { status: 'error', message: `Campo "${field}" no permitido.` };
            const res = await fetch(`${supabaseUrl}/rest/v1/appointments?id=eq.${appointment_id}`, {
                method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' },
                body: JSON.stringify({ [field]: value }),
            });
            if (!res.ok) throw new Error(await res.text());
            return { status: 'ok', message: `Turno actualizado.` };
        }

        if (functionName === 'cancel_appointment') {
            const res = await fetch(`${supabaseUrl}/rest/v1/appointments?id=eq.${args.appointment_id}`, {
                method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' },
            });
            if (!res.ok) throw new Error(await res.text());
            return { status: 'ok', message: 'Turno cancelado.' };
        }

        // ─── RESCHEDULE APPOINTMENT ───
        // Mueve un turno a otra fecha/hora: actualiza Supabase + sync a Google Calendar.
        if (functionName === 'reschedule_appointment') {
            const { appointment_id, new_date, new_time } = args;
            if (!appointment_id || !new_date) {
                return { status: 'error', message: 'Requiere appointment_id y new_date' };
            }
            try {
                // 1) Traer el turno actual (incluye google_event_id si existe)
                const getRes = await fetch(`${supabaseUrl}/rest/v1/appointments?id=eq.${appointment_id}&select=id,patient_name,date,time,type,status,notes,google_event_id`, {
                    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
                });
                const rows = await getRes.json();
                const row = Array.isArray(rows) && rows[0];
                if (!row) return { status: 'error', message: 'Turno no encontrado' };

                const updated = {
                    date: new_date,
                    time: new_time || (row.time || '09:00'),
                };
                if (row.type === 'recordatorio') updated.type = 'recordatorio';

                // 2) Actualizar Supabase
                const patchRes = await fetch(`${supabaseUrl}/rest/v1/appointments?id=eq.${appointment_id}`, {
                    method: 'PATCH',
                    headers: { ...headers, Prefer: 'return=representation' },
                    body: JSON.stringify(updated),
                });
                const patchData = await patchRes.json();
                if (!patchRes.ok) throw new Error(typeof patchData === 'string' ? patchData : (patchData?.message || 'update failed'));
                const updatedRow = Array.isArray(patchData) ? patchData[0] : row;

                // 3) Sincronizar a Google Calendar si el evento existe (google_event_id)
                let calendarSynced = false;
                let calendarError = null;
                if (updatedRow.google_event_id) {
                    try {
                        let accessToken = null;
                        const { data: gauthRows } = await fetch(`${supabaseUrl}/rest/v1/google_auth?select=access_token,refresh_token,expires_at&limit=1`, {
                            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
                        }).then(r => r.json()).then(d => ({ data: Array.isArray(d) ? d : [] })).catch(() => ({ data: [] }));
                        const gauth = gauthRows[0];
                        if (gauth && gauth.access_token) {
                            accessToken = gauth.access_token;
                            const expiresAt = gauth.expires_at ? new Date(gauth.expires_at).getTime() : 0;
                            if (Date.now() >= expiresAt - 5 * 60 * 1000 && gauth.refresh_token) {
                                try {
                                    const rf = await fetch(`${process.env.BACKEND_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')}/api/google/refresh-token`, {
                                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ refresh_token: gauth.refresh_token }),
                                    });
                                    if (rf.ok) { const rd = await rf.json(); accessToken = rd.access_token || accessToken; }
                                } catch { /* keep old token */ }
                            }
                            const startISO = `${new_date}T${new_time || (row.time || '09:00')}:00`;
                            const calRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${updatedRow.google_event_id}`, {
                                method: 'PATCH',
                                headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ start: { dateTime: startISO, timeZone: 'America/Argentina/Buenos_Aires' } }),
                            });
                            if (calRes.ok) calendarSynced = true;
                            else calendarError = `Google Calendar HTTP ${calRes.status}`;
                        }
                    } catch (ce) {
                        calendarError = ce?.message || String(ce);
                    }
                }

                // 4) Notificar al profesional por Telegram
                try {
                    const tgMsg = `📅 <b>Turno reprogramado</b>\n<a href="https://fonoaudio-pro.app/ver/cita/${appointment_id}">${row.patient_name || 'Paciente'}</a> → ${new_date}${new_time ? ` ${new_time}` : ''}.`;
                    await sendTelegramMessage(process.env.TELEGRAM_CHAT_ID || "8706264359", tgMsg, /* parseHtml */ true);
                } catch { /* non-fatal */ }

                const msg = calendarSynced
                    ? `✅ Turno de ${row.patient_name} reprogramado a ${new_date}${new_time ? ` a las ${new_time}` : ''} (sincronizado con Google Calendar).`
                    : `✅ Turno de ${row.patient_name || 'el paciente'} reprogramado a ${new_date}${new_time ? ` a las ${new_time}` : ''} en el sistema.${calendarError ? ` (Google Calendar: ${calendarError})` : ''}`;
                return { status: 'ok', message: msg, appointment: updatedRow };
            } catch (e) {
                return { status: 'error', message: e?.message || String(e) };
            }
        }

                // --- MOVE APPOINTMENT ROOM (consultorio/sala) ---
        if (functionName === 'move_appointment_room') {
            const { appointment_id, room_name } = args;
            if (!appointment_id || !room_name) return { status: 'error', message: 'Requiere appointment_id y room_name' };
            try {
                const getRes = await fetch(`${supabaseUrl}/rest/v1/appointments?id=eq.${appointment_id}&select=id,patient_name,date,time,type,roomid,google_event_id`, {
                    headers: { apikey: `Authorization: ${supabaseKey}` },
                });
                const rows = await getRes.json();
                const row = Array.isArray(rows) && rows[0];
                if (!row) return { status: 'error', message: 'Turno no encontrado' };
                const pr = await fetch(`${supabaseUrl}/rest/v1/appointments?id=eq.${appointment_id}`, {
                    method: 'PATCH',
                    headers: { ...headers, Prefer: 'return=representation' },
                    body: JSON.stringify({ roomid: room_name }),
                });
                const pd = await pr.json();
                if (!pr.ok) throw new Error(typeof pd === 'string' ? pd : (pd?.message || 'update failed'));
                const updatedRow = Array.isArray(pd) ? pd[0] : { ...row, roomid: room_name };
                try { const tg = 'Turno movido a ' + room_name + ' para ' + (row.patient_name || 'paciente'); await sendTelegramMessage(process.env.TELEGRAM_CHAT_ID || '8706264359', tg, true); } catch (e) { /* non-fatal */ }
                return { status: 'ok', message: 'Turno de ' + (row.patient_name || 'el paciente') + ' movido al consultorio ' + room_name + '.', appointment: updatedRow };
            } catch (e) { return { status: 'error', message: e?.message || String(e) }; }
        }

// ─── REMINDERS (autonomous Telegram + Google Calendar sync) ───
        if (functionName === 'set_reminder') {
            const { message, date, time } = args;
            const reminderTime = time || '09:00';
            let createdInCalendar = false;
            let calendarError = null;

            // 1) Try to create the event in Google Calendar (the user's real agenda)
            try {
                // Single-tenant: read the Google token from the first google_auth row
                const { data: gauthRows } = await fetch(`${supabaseUrl}/rest/v1/google_auth?select=user_id,access_token,refresh_token,expires_at&limit=1`, {
                    method: 'GET', headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
                }).then(r => r.json()).then(d => ({ data: Array.isArray(d) ? d : [] })).catch(() => ({ data: [] }));
                const gauth = gauthRows[0];
                if (gauth && gauth.access_token) {
                        let accessToken = gauth.access_token;
                        // refresh if expired
                        const expiresAt = gauth.expires_at ? new Date(gauth.expires_at).getTime() : 0;
                        if (Date.now() >= expiresAt - 5 * 60 * 1000 && gauth.refresh_token) {
                            try {
                                const rf = await fetch(`${process.env.BACKEND_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')}/api/google/refresh-token`, {
                                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ refresh_token: gauth.refresh_token })
                                });
                                if (rf.ok) {
                                    const rd = await rf.json();
                                    accessToken = rd.access_token || accessToken;
                                }
                            } catch { /* keep old token */ }
                        }
                        const startISO = `${date}T${reminderTime}:00`;
                        const endISO = `${date}T${(() => { const [h, m] = reminderTime.split(':').map(Number); const e = new Date(0,0,0,h,m + 15); return `${String(e.getHours()).padStart(2,'0')}:${String(e.getMinutes()).padStart(2,'0')}`; })()}:00`;
                        const calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                summary: `🔔 Recordatorio FonoAudio-Pro: ${message}`,
                                description: 'Recordatorio autónomo creado por el asistente FonoAudio-Pro.',
                                start: { dateTime: startISO, timeZone: 'America/Argentina/Buenos_Aires' },
                                end: { dateTime: endISO, timeZone: 'America/Argentina/Buenos_Aires' },
                                reminders: { useDefault: true }
                            })
                        });
                        if (calRes.ok) createdInCalendar = true;
                        else calendarError = `Google Calendar HTTP ${calRes.status}`;
                } else {
                    calendarError = 'No Google token found';
                }
            } catch (ce) {
                calendarError = ce?.message || String(ce);
            }

            // 2) Always persist a backup in appointments (type 'recordatorio') so the Telegram worker still alerts at the time
            try {
                await fetch(`${supabaseUrl}/rest/v1/appointments`, {
                    method: 'POST',
                    headers: { ...headers, Prefer: 'return=minimal' },
                    body: JSON.stringify({
                        patient_name: `🔔 ${message || 'Recordatorio FonoAudio-Pro'}`,
                        date: date,
                        time: reminderTime,
                        type: 'recordatorio',
                        status: 'pending',
                        notes: 'Recordatorio autónomo solicitado por el profesional vía asistente.',
                        created_at: new Date().toISOString(),
                    }),
                });
            } catch { /* non-fatal */ }

            const parts = [];
            if (createdInCalendar) parts.push('quedó anotado en tu Google Calendar');
            else if (calendarError) parts.push(`(no pude sincronizar con Google Calendar: ${calendarError}; podés conectar la cuenta en Ajustes)`);
            parts.push('y te lo voy a avisar por Telegram a la hora indicada');
            const where = createdInCalendar ? 'En tu Google Calendar y' : 'Y';
            return { status: 'ok', message: `Listo. ${where} te aviso el ${date} a las ${reminderTime} por Telegram.${createdInCalendar ? '' : ' El recordatorio quedó guardado en el sistema aunque no se pudo enlazar a Google Calendar.'}` };
        }

        // ─── EVALUATIONS ───
        if (functionName === 'add_evaluation') {
            const { patient_id, test_name, result, area } = args;
            const patients = await fetchPatientsForUser(actualUserId);
            const patient = patients.find(p => p.id === patient_id);
            if (!patient) return { status: 'error', message: 'Paciente no encontrado' };

            const evaluation = {
                id: newId(),
                test_name,
                result,
                area: area || 'general',
                date: new Date().toISOString().split('T')[0],
            };
            const updatedEvals = [...(patient.evaluations || []), evaluation];
            const res = await fetch(`${supabaseUrl}/rest/v1/patients?id=eq.${patient.id}`, {
                method: 'PATCH',
                headers: { ...headers, Prefer: 'return=minimal' },
                body: JSON.stringify({ evaluations: updatedEvals }),
            });
            if (!res.ok) throw new Error(await res.text());
            return { status: 'ok', message: `Evaluacion "${test_name}" agregada a ${patient.name}.` };
        }

        // ─── TREATMENT PLAN ───
        if (functionName === 'update_treatment_plan') {
            const { patient_id, plan_text, action, section } = args;
            const patients = await fetchPatientsForUser(actualUserId);
            const patient = patients.find(p => p.id === patient_id);
            if (!patient) return { status: 'error', message: 'Paciente no encontrado' };

            const existingPlan = patient.treatmentPlan || {};
            const existingSummary = existingPlan.summary || '';
            let finalSummary = plan_text;

            // MERGE logic: if updating and existing plan exists, intelligently merge
            if ((action === 'update' || action === 'merge') && existingSummary && plan_text) {
                if (section && section !== 'null') {
                    // Section-specific update: parse and replace only that section
                    const sectionRegex = new RegExp(`(═+\\s*${section.toUpperCase()}[\\s\\S]*?)(?=═+\\s*[A-Z]|$)`, 'i');
                    if (sectionRegex.test(existingSummary)) {
                        finalSummary = existingSummary.replace(sectionRegex, `\n${plan_text}\n`);
                    } else {
                        // Section doesn't exist yet, append it
                        finalSummary = existingSummary + `\n\n══ ${section.toUpperCase()} ══\n${plan_text}`;
                    }
                } else {
                    // General update: if plan_text is clearly an addition, append. If it's a rewrite, use it but preserve structure.
                    const isAppend = plan_text.toLowerCase().startsWith('agregar') || plan_text.toLowerCase().startsWith('añadir') || plan_text.toLowerCase().startsWith('aggiornar') || plan_text.toLowerCase().startsWith('modificar');
                    if (isAppend) {
                        finalSummary = existingSummary + '\n\n' + plan_text.replace(/^(agregar|añadir|aggiornar|modificar)\s*/i, '');
                    } else {
                        // Full replacement but log the old one in history
                        finalSummary = plan_text;
                    }
                }
            }

            const plan = {
                ...existingPlan,
                lastUpdate: new Date().toISOString(),
                summary: finalSummary,
                history: [
                    ...(existingPlan.history || []),
                    { date: new Date().toISOString(), text: plan_text, action: action || 'create', previousSummary: action === 'update' ? existingSummary : undefined }
                ],
            };
            const res = await fetch(`${supabaseUrl}/rest/v1/patients?id=eq.${patient.id}`, {
                method: 'PATCH',
                headers: { ...headers, Prefer: 'return=minimal' },
                body: JSON.stringify({ treatmentPlan: plan }),
            });
            if (!res.ok) throw new Error(await res.text());
            return { status: 'ok', message: `Plan de tratamiento de ${patient.name} actualizado. ${action === 'update' ? 'Se preservó el contenido existente.' : 'Plan creado.'}` };
        }

        // ─── KNOWLEDGE BASE ───
        if (functionName === 'search_knowledge') {
            const res = await fetch(`${supabaseUrl}/rest/v1/assistant_knowledge?or=(title.ilike.%${args.query}%,content.ilike.%${args.query}%)&limit=5`, {
                method: 'GET', headers,
            });
            if (!res.ok) return { status: 'ok', count: 0, results: [] };
            const results = await res.json();
            return { status: 'ok', count: results.length, results };
        }

        if (functionName === 'add_knowledge') {
            const { title, content, category } = args;
            const entry = {
                id: newId(),
                title,
                content,
                category: category || 'general',
                created_at: new Date().toISOString(),
            };
            const res = await fetch(`${supabaseUrl}/rest/v1/assistant_knowledge`, {
                method: 'POST', headers, body: JSON.stringify(entry),
            });
            if (!res.ok) throw new Error(await res.text());
            return { status: 'ok', message: `Entrada "${title}" agregada a la base de conocimiento.` };
        }

        // ─── MATERIALS ───
        if (functionName === 'list_materials') {
            let url = `${supabaseUrl}/rest/v1/materials?limit=20&order=created_at.desc`;
            if (args.category) url += `&category=eq.${args.category}`;
            const res = await fetch(url, { method: 'GET', headers });
            if (!res.ok) return { status: 'ok', count: 0, materials: [] };
            const materials = await res.json();
            return { status: 'ok', count: materials.length, materials: materials.map(m => ({ id: m.id, title: m.title, category: m.category, type: m.type })) };
        }

        if (functionName === 'search_materials') {
            const res = await fetch(`${supabaseUrl}/rest/v1/materials?or=(title.ilike.%${args.query}%,tags.ilike.%${args.query}%)&limit=10`, {
                method: 'GET', headers,
            });
            if (!res.ok) return { status: 'ok', count: 0, materials: [] };
            const materials = await res.json();
            return { status: 'ok', count: materials.length, materials: materials.map(m => ({ id: m.id, title: m.title, category: m.category, url: m.url })) };
        }

        // ─── STATISTICS ───
        if (functionName === 'get_statistics') {
            const patients = await fetchPatientsForUser(actualUserId);
            const today = new Date().toISOString().split('T')[0];
            const aptRes = await fetch(`${supabaseUrl}/rest/v1/appointments?date=eq.${today}`, { method: 'GET', headers });
            const todayApts = aptRes.ok ? await aptRes.json() : [];

            const diagCounts = {};
            patients.forEach(p => {
                const d = p.diagnosis || 'Sin diagnostico';
                diagCounts[d] = (diagCounts[d] || 0) + 1;
            });

            return {
                status: 'ok',
                total_patients: patients.length,
                today_appointments: todayApts.length,
                diagnoses_breakdown: diagCounts,
            };
        }

        if (functionName === 'check_missing_data') {
            const patients = await fetchPatientsForUser(actualUserId);
            const missing = patients.filter(p => !p.phone || !p.diagnosis || !p.age || !p.email);
            return {
                status: 'ok',
                count: missing.length,
                patients: missing.map(p => ({
                    id: p.id,
                    name: p.name,
                    missing: [
                        !p.phone && 'telefono',
                        !p.diagnosis && 'diagnostico',
                        !p.age && 'edad',
                        !p.email && 'email',
                    ].filter(Boolean),
                })),
            };
        }

        // ─── NOTEBOOKLM ───
        if (functionName === 'notebook_list') {
            try {
                const backendUrl = process.env.BACKEND_URL || (process.env.VERCEL === '1' ? '' : 'http://localhost:3001');
                const res = await fetch(`${backendUrl}/api/notebooklm/notebooks?limit=10`);
                const data = await res.json();
                const notebooks = Array.isArray(data) ? data : data.notebooks || [];
                return { status: 'ok', count: notebooks.length, notebooks: notebooks.map(n => ({ id: n.id, title: n.title })) };
            } catch (e) {
                return { status: 'ok', count: 0, notebooks: [], note: 'NotebookLM no disponible' };
            }
        }

        if (functionName === 'notebook_ask') {
            try {
                const backendUrl = process.env.BACKEND_URL || (process.env.VERCEL === '1' ? '' : 'http://localhost:3001');
                const res = await fetch(`${backendUrl}/api/notebooklm/notebooks/${args.notebook_id}/ask`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ question: args.question }),
                });
                const data = await res.json();
                return { status: 'ok', answer: data.answer || 'Sin respuesta disponible.' };
            } catch (e) {
                return { status: 'error', message: 'NotebookLM no disponible' };
            }
        }

        return { status: 'error', message: `Herramienta desconocida: ${functionName}` };
    } catch (e) {
        console.error(`[executeToolCall] Error in ${functionName}:`, e.message);
        return { status: 'error', message: e.message };
    }
}

// --- DIRECT COMMAND PARSER (fallback when AI is down) ---
async function handleDirectCommand(lowerMsg, originalMsg, user_id) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;

    // Resolve user_id if not provided
    let resolvedUserId = user_id;
    if (!resolvedUserId) {
        resolvedUserId = await findProfessionalId();
    }
    const resolvedUserIdFinal = resolvedUserId || null;

    const headers = { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };

    // CREATE PATIENT: "creá un paciente", "crear paciente", "nuevo paciente"
    if (lowerMsg.match(/(cre[aá]|nuevo|alta)\s+(un\s+)?paciente/)) {
        const nameMatch = originalMsg.match(/(?:llamado?|nombre:?|name:?)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/i)
                       || originalMsg.match(/paciente\s+(?:llamado?|nombre:?)?\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/i);
        const ageMatch = originalMsg.match(/(\d+)\s*(?:años|año|years?)/i);
        const reasonMatch = originalMsg.match(/(?:motivo|raz[oó]n|cause|por)\s*:?\s*(.+?)(?:\.|$)/i)
                         || originalMsg.match(/(?:refiere|refieren|presenta|diagn[oó]stico)\s+(.+?)(?:\.|$)/i);
        const diagnosisMatch = originalMsg.match(/(?:diagn[oó]stico|dx|diagnostico)\s*:?\s*(.+?)(?:\.|$)/i);

        if (!nameMatch) return null;
        const name = nameMatch[1].trim();
        const age = ageMatch ? parseInt(ageMatch[1]) : null;
        const reason = reasonMatch ? reasonMatch[1].trim() : null;
        const diagnosis = diagnosisMatch ? diagnosisMatch[1].trim() : null;

        try {
            const patientId = newId();
            const newPatient = {
                id: patientId, name, age, diagnosis, reason,
                phone: null, email: null, notes: reason || null,
                history: [], reports: [], evaluations: [], documents: [],
                treatmentPlan: {}, professional_id: resolvedUserIdFinal, owner_id: resolvedUserIdFinal,
                created_at: new Date().toISOString(),
            };
            const res = await fetch(`${supabaseUrl}/rest/v1/patients`, {
                method: 'POST', headers, body: JSON.stringify(newPatient),
            });
            if (!res.ok) throw new Error(await res.text());

            if (reason || diagnosis) {
                try {
                    await fetch(`${supabaseUrl}/rest/v1/clinical_records`, {
                        method: 'POST', headers, body: JSON.stringify({
                            patient_id: patientId, chief_complaint: reason || diagnosis || '',
                            chief_complaint_onset: '', personal_history: {}, family_history: {},
                            medical_history: {}, developmental_history: {},
                            clinical_observations: '', affected_areas: {},
                            primary_diagnosis_name: diagnosis || null, primary_diagnosis_code: null,
                            secondary_diagnosis_codes: [], created_by: resolvedUserIdFinal, updated_by: resolvedUserIdFinal,
                            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
                        }),
                    });
                } catch (e) { console.warn('[Direct] clinical_records:', e.message); }
            }
            return `✅ Paciente *${name}* creado exitosamente.${age ? ` Edad: ${age} años.` : ''}${reason ? ` Motivo: ${reason}.` : ''}`;
        } catch (e) {
            console.error('[Direct] create_patient error:', e.message);
            return `❌ No pude crear al paciente ${name}: ${e.message}`;
        }
    }

    // LIST PATIENTS: "mostrá mis pacientes", "listá pacientes", "qué pacientes tengo"
    if (lowerMsg.match(/(mostr[aá]|list[aá]|ver|cu[aá]les|qui[eé]nes).*pacientes/) || lowerMsg.match(/pacientes.*(?:tengo|hay|activos)/)) {
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/patients?select=id,name,age,diagnosis,phone&limit=20`, { headers });
            if (!res.ok) throw new Error(await res.text());
            const patients = await res.json();
            if (patients.length === 0) return '📋 No tenés pacientes registrados.';
            const list = patients.map((p, i) => `${i + 1}. *${p.name}* — ${p.age || '?'} años, ${p.diagnosis || 'sin diagnóstico'}`).join('\n');
            return `📋 *Tus pacientes (${patients.length})*:\n${list}`;
        } catch (e) { return `❌ Error al buscar pacientes: ${e.message}`; }
    }

    // TODAY'S AGENDA: "agenda de hoy", "turnos de hoy", "qué turnos tengo"
    if (lowerMsg.match(/(agenda|turnos?|cit[ae]s?).*(hoy|actual)/) || lowerMsg.match(/hoy.*(agenda|turnos?|cit[ae]s?)/)) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await fetch(`${supabaseUrl}/rest/v1/appointments?date=eq.${today}&type=neq.recordatorio&order=time.asc`, { headers });
            if (!res.ok) throw new Error(await res.text());
            const apts = await res.json();
            if (apts.length === 0) return '📅 No tenés turnos para hoy.';
            const list = apts.map(a => `${a.time} hs — ${a.patient_name} (${a.status || 'pendiente'})`).join('\n');
            return `📅 *Turnos de hoy*:\n${list}`;
        } catch (e) { return `❌ Error al buscar agenda: ${e.message}`; }
    }

    return null;
}

// --- TELEGRAM TEXT AI PROCESSING INTERNAL ---
async function processTextInternal(message_text, chat_id, user_id, aiModel, protocol = 'https', host = 'fonoaudio-pro-ai.vercel.app', aiModelFallback = null) {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

    // Resolve user_id if not provided (Telegram context doesn't have auth)
    let resolvedUserId = user_id;
    if (!resolvedUserId) {
        resolvedUserId = await findProfessionalId();
    }

    // ─── STEP 0: Check voice mode commands ───
    if (wantsStopVoice(message_text)) {
        setVoiceMode(chat_id, false);
        if (chat_id && TELEGRAM_BOT_TOKEN) {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id, text: 'Modo voz desactivado. Ahora respondo solo con texto. Para reactivar, decí "modo voz" o "audio".' }),
            }).catch(() => {});
        }
        return { status: 'ok', response: 'Modo voz desactivado', sent_to_telegram: true };
    }

    if (wantsVoice(message_text)) {
        setVoiceMode(chat_id, true);
    }

    // ─── STEP 1: Check if this is an ACTION response to a pending file ───
    try {
        const pending = chat_id ? await getPendingFile(chat_id) : null;
        const lowerText = message_text.trim().toLowerCase();

        if (pending) {
            // Parse action intent
            let actionType = null;
            let targetPatient = null;
            const discardPatterns = ['no', 'descartar', 'cancelar', 'ninguno', 'nada'];
            const docPatterns = ['1', 'documento', 'doc', 'guardalo', 'guardar', 'guardar como documento'];
            const sessionPatterns = ['2', 'sesión', 'sesion', 'sesión clínica', 'sesion clinica'];
            const reportPatterns = ['3', 'informe', 'reporte', 'evaluación', 'evaluacion'];

            // Check discard
            if (discardPatterns.some(p => lowerText === p || lowerText.startsWith(p))) {
                await deletePendingFile(chat_id);
                const discardMsg = 'Archivo descartado. Si necesitás guardarlo después, mandá el archivo de nuevo.';
                if (chat_id && TELEGRAM_BOT_TOKEN) {
                    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id, text: discardMsg }),
                    }).catch(() => {});
                }
                return { status: 'ok', response: discardMsg, action: 'discard', sent_to_telegram: true };
            }

            // Check save type
            if (sessionPatterns.some(p => lowerText.includes(p))) actionType = 'session';
            else if (reportPatterns.some(p => lowerText.includes(p))) actionType = 'report';
            else if (docPatterns.some(p => lowerText.includes(p)) || /^\d+$/.test(lowerText)) actionType = 'document';

            // If we detected a save type, try to find the patient
            if (actionType) {
                // Check for explicit patient name
                const patients = pending.patients || [];

                // Try to extract patient name from message
                let matchedPatient = null;
                const textNoAction = lowerText
                    .replace(/guardalo|guardar|documento|doc|sesión|sesion|informe|reporte|evaluación|evaluacion|como|en|a|el|la|los|las|del|al/g, '')
                    .trim();

                // Check number reference (e.g., "1" or "2")
                if (/^\d+$/.test(textNoAction) && parseInt(textNoAction) > 0 && parseInt(textNoAction) <= patients.length) {
                    matchedPatient = patients[parseInt(textNoAction) - 1];
                }

                // Check name match
                if (!matchedPatient && textNoAction.length > 1) {
                    for (const p of patients) {
                        const nameLower = p.name.toLowerCase();
                        if (textNoAction.includes(nameLower) || nameLower.includes(textNoAction) || textNoAction.includes(nameLower.split(' ')[0])) {
                            matchedPatient = p;
                            break;
                        }
                    }
                }

                // If we have a matched patient, save it
                if (matchedPatient) {
                    try {
                        const saveData = await saveToPatientInternal(
                            chat_id,
                            matchedPatient.id,
                            actionType,
                            user_id
                        );

                        if (saveData.status === 'ok') {
                            const confirmMsg = `✅ ${saveData.message}\nTipo: ${actionType === 'session' ? 'Sesión clínica' : actionType === 'report' ? 'Informe' : 'Documento'}\nArchivo: ${saveData.file_name}`;
                            if (chat_id && TELEGRAM_BOT_TOKEN) {
                                await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ chat_id, text: confirmMsg }),
                                }).catch(() => {});
                            }
                            return { status: 'ok', response: confirmMsg, action: 'saved', saved_to: matchedPatient.name, sent_to_telegram: true };
                        } else {
                            throw new Error(saveData.message || 'Save failed');
                        }
                    } catch (saveErr) {
                        const errMsg = `Error al guardar: ${saveErr.message}. Intentá de nuevo.`;
                        if (chat_id && TELEGRAM_BOT_TOKEN) {
                            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ chat_id, text: errMsg }),
                            }).catch(() => {});
                        }
                        return { status: 'ok', response: errMsg, action: 'error', sent_to_telegram: true };
                    }
                } else if (actionType && patients.length > 0) {
                    // Action detected but no patient matched — ask again
                    const retryMsg = `No identifiqué a qué paciente. Respondé con el nombre o número:\n${patients.map((p, i) => `  ${i + 1}. ${p.name}`).join('\n')}\nO escribí "no" para cancelar.`;
                    if (chat_id && TELEGRAM_BOT_TOKEN) {
                        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chat_id, text: retryMsg }),
                        }).catch(() => {});
                    }
                    return { status: 'ok', response: retryMsg, action: 'retry_patient', sent_to_telegram: true };
                }
            }
        }
    } catch (step0Err) {
        console.error('[Telegram Process-Text] STEP 0 error:', step0Err);
    }

    // ─── STEP 1: Normal AI text processing (no pending action) ───
    const now = new Date();
    const optionsAR = { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false };
    const dateOptionsAR = { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const currentTime = now.toLocaleTimeString('es-AR', optionsAR);
    const currentDate = now.toLocaleDateString('es-AR', dateOptionsAR);
    const currentHour = parseInt(now.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', hour12: false }));
    const currentMinute = parseInt(now.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', minute: '2-digit', hour12: false }));
    const currentMinutesSinceMidnight = currentHour * 60 + currentMinute;

    // Check for pending file context (user might be responding to a file)
    let pendingFileContext = '';
    if (chat_id && await hasPendingFile(chat_id)) {
        const pf = await getPendingFile(chat_id);
        pendingFileContext = `\n\nARCHIVO PENDIENTE: El usuario tiene un archivo sin resolver: "${pf.file_name}" (${pf.media_type}).
El usuario podría estar respondiendo a la pregunta sobre qué hacer con ese archivo.
Si el usuario menciona un paciente, un tipo de acción (guardar, sesion, informe) o un número, interpretalo como una respuesta a ese archivo.`;
    }

    try {
        // Fetch clinical context from Supabase if user_id is available
        let clinicalContext = '';
        if (resolvedUserId) {
            try {
                const supabaseUrl = process.env.VITE_SUPABASE_URL;
                const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
                if (supabaseUrl && supabaseKey) {
                    // Get patients with more detail (full clinic roster - assistant sees all patients)
                    const patientsRes = await fetch(`${supabaseUrl}/rest/v1/patients?select=id,name,diagnosis,age,notes,phone&limit=200`, {
                        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
                    });
                    const patients = await patientsRes.json();

                    // Get today's appointments with timing info
                    const today = now.toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }); // YYYY-MM-DD
                    const appsRes = await fetch(`${supabaseUrl}/rest/v1/appointments?date=eq.${today}&type=neq.recordatorio&select=id,patient_name,date,time,status,type,duration,notes&order=time`, {
                        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
                    });
                    const appointments = await appsRes.json();

                    // Get upcoming appointments (next 7 days)
                    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                    const weekFromNowStr = weekFromNow.toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
                    const upcomingRes = await fetch(`${supabaseUrl}/rest/v1/appointments?date=gt=${today}&date=lte=${weekFromNowStr}&type=neq.recordatorio&select=id,patient_name,date,time,status,type&order=date&limit=10`, {
                        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
                    });
                    const upcoming = await upcomingRes.json();

                    // ADDED: Semantic search for relevant ingested documents
                    try {
                        const { GoogleGenerativeAI } = await import('@google/generative-ai');
                        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
                        const embedModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
                        const embedResult = await embedModel.embedContent(message_text.slice(0, 1000));
                        const queryEmbedding = embedResult.embedding.values;

                        const semanticRes = await fetch(`${supabaseUrl}/rest/v1/rpc/match_source_embeddings`, {
                            method: 'POST',
                            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                query_embedding: queryEmbedding,
                                match_threshold: 0.3,
                                match_count: 5,
                            }),
                        });
                        if (semanticRes.ok) {
                            const semanticDocs = await semanticRes.json();
                            if (semanticDocs && semanticDocs.length > 0) {
                                clinicalContext += `\n\n═══ ESTUDIOS/ANÁLISIS EXTERNOS RELEVANTES ═══\n`;
                                clinicalContext += semanticDocs.map(d => `- [${d.source_title}] (relevancia: ${(d.similarity * 100).toFixed(0)}%): ${d.content.slice(0, 400)}...`).join('\n');
                            }
                        }
                    } catch (e) { console.warn('[API Context] Semantic search failed:', e.message); }

                    // Build patient list
                    if (patients.length > 0) {
                        clinicalContext += `\nPACIENTES ACTIVOS (${patients.length}):\n`;
                        clinicalContext += patients.map(p => `- ${p.name}: ${p.diagnosis || 'Sin diagnóstico'}, ${p.age || '?'} años${p.phone ? `, tel: ${p.phone}` : ''}`).join('\n');
                    }

                    // Build today's agenda with time-relative status
                    if (appointments.length > 0) {
                        clinicalContext += `\n\nAGENDA DE HOY (${appointments.length} citas) — HOY ES ${currentDate}:\n`;
                        clinicalContext += appointments.map(a => {
                            const [aH, aM] = (a.time || '00:00').split(':').map(Number);
                            const apptMinutes = aH * 60 + aM;
                            const diffMin = apptMinutes - currentMinutesSinceMidnight;
                            let timing = '';
                            if (diffMin < -60) timing = '⏰ YA PASÓ';
                            else if (diffMin < 0) timing = '⚡ EN CURSO';
                            else if (diffMin <= 30) timing = '▶️ PRÓXIMA (en ' + diffMin + ' min)';
                            else timing = '🕐 AÚN NO LLEGA';
                            return `- ${a.time} hs: ${a.patient_name} — ${a.status || 'pending'}, ${a.type || 'consulta'} — ${timing} [ID: ${a.id}]`;
                        }).join('\n');
                    } else {
                        clinicalContext += `\n\nAGENDA DE HOY: Sin citas programadas para hoy.`;
                    }

                    // Upcoming appointments
                    if (upcoming.length > 0) {
                        clinicalContext += `\n\nPRÓXIMOS 7 DÍAS:\n`;
                        clinicalContext += upcoming.map(a => `- ${a.date} ${a.time} hs: ${a.patient_name} [ID: ${a.id}]`).join('\\n');
                    }

                    // ─── DATOS FALTANTES: precargar reporte si el usuario pregunta por faltantes/incompletos/alertas ───
                    const lowerMsgForMissing = message_text.toLowerCase();
                    const isMissingQuery = ['faltante', 'faltan', 'falta', 'incomplet', 'incompleta', 'incompleto', 'alertas de datos', 'datos faltan', 'que le falta', 'que falta', 'pendientes de cargar', 'sin cargar'].some(kw => lowerMsgForMissing.includes(kw));
                    if (isMissingQuery) {
                        try {
                            const allPatRes = await fetch(`${supabaseUrl}/rest/v1/patients?select=id,name`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
                            const allPatients = await allPatRes.json();
                            const recRes = await fetch(`${supabaseUrl}/rest/v1/clinical_records?select=patient_id,chief_complaint,primary_diagnosis_name,affected_areas,personal_history,family_history,medical_history,developmental_history`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
                            const records = await recRes.json();
                            const recById = {};
                            (records || []).forEach(r => { recById[r.patient_id] = r; });

                            const missingLines = [];
                            for (const p of (allPatients || [])) {
                                const cr = recById[p.id];
                                const missing = [];
                                if (!cr) missing.push('FICHA SIN CREAR');
                                else {
                                    if (!cr.chief_complaint || String(cr.chief_complaint).trim() === '') missing.push('Motivo de consulta');
                                    if (!cr.primary_diagnosis_name || String(cr.primary_diagnosis_name).trim() === '') missing.push('Diagnostico principal');
                                    if (!cr.affected_areas || !Array.isArray(cr.affected_areas) || cr.affected_areas.filter(a => a && a.affected).length === 0) missing.push('Areas afectadas');
                                    if (!cr.personal_history || Object.keys(cr.personal_history).length === 0) missing.push('Historia personal');
                                    if (!cr.family_history || Object.keys(cr.family_history).length === 0) missing.push('Historia familiar');
                                    if (!cr.medical_history || Object.keys(cr.medical_history).length === 0) missing.push('Historia medica');
                                    if (!cr.developmental_history || Object.keys(cr.developmental_history).length === 0) missing.push('Historia del desarrollo');
                                }
                                if (missing.length > 0) missingLines.push(`- ${p.name}: FALTAN [${missing.join(', ')}]`);
                            }
                            if (missingLines.length > 0) {
                                clinicalContext += `\n\n═══ REPORTE DE DATOS FALTANTES (REAL, DESDE LA BASE) ═══\n${missingLines.join('\n')}\n(Mencioná TODOS estos pacientes y sus campos faltantes en tu respuesta. No inventes ni omitas ninguno.)`;
                            } else {
                                clinicalContext += `\n\n═══ REPORTE DE DATOS FALTANTES ═══\nNo hay pacientes con datos faltantes. Todas las fichas están completas.`;
                            }
                        } catch (missErr) {
                            console.warn('[Telegram] Missing-data preload failed:', missErr.message);
                        }
                    }
                }
            } catch (ctxErr) {
                console.warn('[Telegram Process-Text] Could not fetch clinical context:', ctxErr.message);
            }
        }

        // ─── STEP 1.5: NotebookLM context for clinical queries ───
        let notebookLmContext = '';
        const clinicalKeywords = ['tratamiento', 'evidencia', 'estudio', 'investigación', 'paper', 'artículo', 'protocolo', 'guía clínica', 'revision', 'terapia', 'disfonía', 'audiología', 'fonoaudiología', 'deglución', 'habla', 'lenguaje', 'voz'];
        const isClinicalQuery = clinicalKeywords.some(kw => message_text.toLowerCase().includes(kw));
        if (isClinicalQuery) {
            try {
                const backendUrl = process.env.BACKEND_URL || (process.env.VERCEL === '1' ? '' : 'http://localhost:3001');
                const nbRes = await fetch(`${backendUrl}/api/notebooklm/notebooks?limit=1`);
                const nbData = await nbRes.json();
                const nbList = Array.isArray(nbData) ? nbData : nbData.notebooks || [];
                if (nbList.length > 0) {
                    const askRes = await fetch(`${backendUrl}/api/notebooklm/notebooks/${nbList[0].id}/ask`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ question: message_text })
                    });
                    const askData = await askRes.json();
                    if (askData.answer) {
                        notebookLmContext = `\n\n═══ EVIDENCIA DE NOTEBOOKLM ═══\n${askData.answer}\nUsá esta información para fundamentar tu respuesta.`;
                    }
                }
            } catch (nbErr) {
                console.warn('[Telegram] NotebookLM query failed:', nbErr.message);
            }
        }

            const clinicalPrompt = `Sos FonoAudio, el asistente clinico autonomo de FonoAudio Pro AI. SOS UN AGENTE COMPLETO. Expertos en fonoaudiologia.

═══ MANDATO CLÍNICO-LEGAL (Provincia de Bs As) ═══
1. Diagnóstico Funcional: NUNCA uses diagnósticos médicos (nosológicos). Usa solo terminología funcional fonoaudiológica (CIE-11, etc).
2. Diferenciación Epistemológica: Separa siempre: "La madre refiere..." (dato anamnésico) de "Se observa..." (dato clínico objetivo).
3. Auditoría de Seguridad: Verifica siempre: Firma, matrícula (CFPBA), fecha y estructura formal.
4. Toque Personal (Elena Zegarra): Debes incluir conducta, motivaciones y ejemplos concretos del habla del paciente. Si no tienes estos datos, NO inventes, PREGÚNTALE al usuario antes de generar el reporte final.

═══ RAZONAMIENTO CLÍNICO (CRITICO) ═══
ANTES de generar cualquier sección, PENSÁ:
- ¿Tengo datos objetivos o solo referencias de terceros?
- ¿He incluido ejemplos del habla del peque?
- ¿Cumple con la estructura de las plantillas oficiales?

═══ CONTEXTO CLÍNICO ═══
${clinicalContext || '\nNo hay contexto disponible.'}
${pendingFileContext}
${notebookLmContext}

═══ MENSAJE DEL USUARIO ═══
${message_text}

PENSÁ paso a paso y EJECUTA la accion correcta. Si necesitas info previa, buscala primero con las tools.

═══ AVISOS Y RECORDATORIOS 24/7 (CRITICO) ═══
SOS un asistente AUTONOMO que ENVIA mensajes por Telegram al profesional en cualquier momento, incluyendo alertas automáticas.
- Tenés un cron que todos los días a las 8:00 AM envía el resumen matutino (turnos del día + fichas incompletas).
- Si el usuario pide "avísame", "recordame", "no se me olvide", "decitne mañana", o cualquier alerta futura: DECÍS QUE SÍ y EJECUTÁS la tool set_reminder con la fecha/hora/mensaje indicados. Confirmás que lo vas a avisar.
- NUNCA digas "no puedo enviar alertas", "soy solo un asistente virtual", "no tengo capacidad" ni nada que niegue tus capacidades de aviso. Esas frases son FALSAS: sí podés y lo hacés.`;

        let aiResponse = '';
        let sentToTelegram = false;

        if (!aiModel) {
            console.warn('[Process-Text] AI model not available, using Supabase fallback...');
            const fallback = await getTextFallbackFromSupabase(message_text, resolvedUserId);
            aiResponse = fallback || `No pude generar una respuesta con IA (servicio no disponible).`;
        } else {
            // Execute with Gemini Function Calling / Tools — try model chain + Groq
            let toolCallSucceeded = false;
            let quotaExhausted = false;
            const modelsToTry = [...GEMINI_MODEL_CHAIN];

            for (const model of modelsToTry) {
                if (toolCallSucceeded || quotaExhausted) break;
                const maxRetries = model === modelsToTry[0] ? 2 : 1;

                for (let attempt = 0; attempt <= maxRetries; attempt++) {
                    try {
                        console.log(`[Gemini Tools] Trying ${model} (attempt ${attempt + 1}/${maxRetries + 1})`);
                        const tempModel = model !== modelsToTry[0] ? aiModel : aiModel;
                        const response = await aiModel.generateContent({
                            contents: [{ role: 'user', parts: [{ text: clinicalPrompt }] }],
                            tools: [{ functionDeclarations: clinicalTools }]
                        });

                        const candidate = response.response?.candidates?.[0];
                        const functionCalls = candidate?.content?.parts?.filter(p => p.functionCall) || [];

                        if (functionCalls.length > 0) {
                            const fc = functionCalls[0].functionCall;
                            console.log(`[Gemini Tool Call] Executing ${fc.name} with args:`, fc.args);
                            const toolResult = await executeToolCall(fc.name, fc.args, resolvedUserId);
                            const secondResponse = await aiModel.generateContent({
                                contents: [
                                    { role: 'user', parts: [{ text: clinicalPrompt }] },
                                    { role: 'model', parts: candidate.content.parts },
                                    {
                                        role: 'function',
                                        parts: [{
                                            functionResponse: {
                                                name: fc.name,
                                                response: toolResult
                                            }
                                        }]
                                    }
                                ]
                            });
                            aiResponse = secondResponse.response?.text() || `Acción ${fc.name} ejecutada con éxito. Resultado: ${JSON.stringify(toolResult)}`;
                            toolCallSucceeded = true;
                            console.log(`[Gemini Tools] ${model} succeeded on attempt ${attempt + 1}`);
                            break;
                        } else {
                            aiResponse = response.response?.text() || 'Sin respuesta de IA.';
                            toolCallSucceeded = true;
                            break;
                        }
                    } catch (e) {
                        const errMsg = e?.message || '';
                        const isQuota = errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Too Many Requests');
                        if (isQuota) {
                            console.warn(`[Gemini Tools] ${model} QUOTA EXHAUSTED — skipping all Gemini models`);
                            quotaExhausted = true;
                            break;
                        }
                        if (isRetryableError(e) && attempt < maxRetries) {
                            const delay = backoffDelay(attempt);
                            console.warn(`[Gemini Tools] ${model} attempt ${attempt + 1} failed (${e.message?.slice(0, 60)}). Retrying in ${delay}ms...`);
                            await new Promise(r => setTimeout(r, delay));
                        } else {
                            console.warn(`[Gemini Tools] ${model} FAILED: ${e.message?.slice(0, 80)}`);
                            break;
                        }
                    }
                }
            }

            // All Gemini primary models failed → Try fallback model (second API key)
            if (!toolCallSucceeded && aiModelFallback) {
                console.warn('[Gemini Tools] Primary key exhausted. Trying fallback model (key #2)...');
                try {
                    const response = await aiModelFallback.generateContent({
                        contents: [{ role: 'user', parts: [{ text: clinicalPrompt }] }],
                        tools: [{ functionDeclarations: clinicalTools }]
                    });
                    const candidate = response.response?.candidates?.[0];
                    const functionCalls = candidate?.content?.parts?.filter(p => p.functionCall) || [];

                    if (functionCalls.length > 0) {
                        const fc = functionCalls[0].functionCall;
                        console.log(`[Gemini Fallback] Executing ${fc.name} with args:`, fc.args);
                        const toolResult = await executeToolCall(fc.name, fc.args, resolvedUserId);
                        const secondResponse = await aiModelFallback.generateContent({
                            contents: [
                                { role: 'user', parts: [{ text: clinicalPrompt }] },
                                { role: 'model', parts: candidate.content.parts },
                                { role: 'function', parts: [{ functionResponse: { name: fc.name, response: toolResult } }] }
                            ]
                        });
                        aiResponse = secondResponse.response?.text() || `Acción ${fc.name} ejecutada. Resultado: ${JSON.stringify(toolResult)}`;
                        toolCallSucceeded = true;
                    } else {
                        aiResponse = response.response?.text() || '';
                        if (aiResponse) toolCallSucceeded = true;
                    }
                } catch (fbErr) {
                    console.warn('[Gemini Fallback] Also failed:', fbErr.message?.slice(0, 80));
                }
            }

            // All Gemini models failed → Groq with function calling
            if (!toolCallSucceeded) {
                console.warn('[Gemini Tools] All models failed. Trying Groq with function calling...');
                const groqResult = await callGroqWithTools(clinicalPrompt, clinicalTools, resolvedUserId);
                    if (groqResult.ok) {
                        aiResponse = groqResult.text;
                        toolCallSucceeded = true;
                    } else {
                        // Final fallback: direct command parsing + Groq text
                        console.warn('[Groq Tools] Failed. Trying direct command parsing...');
                        const lowerMsg = message_text.toLowerCase();
                        const directResult = await handleDirectCommand(lowerMsg, message_text, resolvedUserId);

                        if (directResult) {
                            aiResponse = directResult;
                        } else {
                            const textPrompt = `Sos FonoAudio, asistente clinico autonomo de FonoAudio Pro AI. Respondé en espanol argentino rioplatense. Sé conciso y profesional. El usuario pidió: ${message_text}\n\n${clinicalContext ? 'Contexto clinico:\n' + clinicalContext : ''}`;
                            const groqTextResult = await callGroqFallback(textPrompt);
                            aiResponse = groqTextResult.ok ? groqTextResult.text : `Ocurrió un error temporal con el servicio de IA. Por favor intentá de nuevo en unos segundos.`;
                        }
                    }
            }
        }

        // ─── AUTONOMOUS REMINDER FALLBACK ───
        // If the user asked to be reminded/alerted and the model did NOT execute set_reminder
        // (or denied capability), we still DO IT: parse the request and schedule it ourselves.
        const reminderKeywords = ['avisa', 'recorda', 'recuerda', 'no se me olvide', 'decime', 'decime mañana', 'avisame', 'acordate', 'alert'];
        const wantsReminder = reminderKeywords.some(k => message_text.toLowerCase().includes(k));
        const modelDenied = /no (tengo|puedo|tiene).*(capacidad|enviar|recordator|alerta)|soy solo un asistente|no puedo enviar/i.test(aiResponse);
        const alreadySet = /recordatorio programado|te lo voy a avisar|te aviso/i.test(aiResponse);
        if (wantsReminder && !alreadySet) {
            try {
                // Extract date: "mañana" -> tomorrow, else look for YYYY-MM-DD
                const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
                const tomorrowStr = tomorrow.toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
                let rDate = tomorrowStr;
                const dateMatch = message_text.match(/(\d{4}-\d{2}-\d{2})/);
                if (dateMatch) rDate = dateMatch[1];
                // Extract time: HH:MM or "a las 8" -> 08:00
                let rTime = '09:00';
                const timeMatch = message_text.match(/(\d{1,2}):(\d{2})/);
                if (timeMatch) rTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
                else {
                    const hMatch = message_text.match(/a las (\d{1,2})/i);
                    if (hMatch) rTime = `${hMatch[1].padStart(2, '0')}:00`;
                }
                const reminderMsg = `Recordatorio: ${message_text.replace(/^.*?\b(avisa|recorda|recuerda|decime|acordate)\w*\s*/i, '').trim() || 'Tiene una alerta de FonoAudio-Pro.'}`;
                const setRes = await executeToolCall('set_reminder', { message: reminderMsg, date: rDate, time: rTime }, resolvedUserId);
                if (setRes?.status === 'ok') {
                    aiResponse = `¡Hecho! Te aviso el ${rDate} a las ${rTime} por Telegram. Anotado en tu recordatorio automático. ¿Necesitás que vincule esto a algún paciente o turno?`;
                }
            } catch (remErr) {
                console.warn('[Autonomous Reminder] Failed:', remErr.message);
            }
        }

        // Send response back via Telegram — text
        const cleanResponse = stripVoiceMarkers(aiResponse);
        sentToTelegram = await sendTelegramMessage(chat_id, cleanResponse);

        // Send voice ONLY if: user requested it, voice mode is active, or AI tagged it [AUDIO]/[VOICE]
        if (sentToTelegram && shouldSendVoice(chat_id, message_text, aiResponse) && cleanResponse && cleanResponse.length > 10) {
            const voiceText = cleanResponse
                .replace(/[*_`~#]/g, '')
                .replace(/\n{3,}/g, '\n\n')
                .substring(0, 3000);
            const voiceSent = await sendTelegramVoice(chat_id, voiceText).catch(err => {
                console.error('[processTextInternal] Voice send error:', err.message);
                return false;
            });
            if (!voiceSent) {
                console.warn('[processTextInternal] Voice response failed, text was still sent');
            }
        }

        return {
            status: 'ok',
            response: cleanResponse,
            sent_to_telegram: sentToTelegram,
        };
    } catch (e) {
        console.error('[Telegram Process-Text] Error:', e.message);
        return { status: 'error', message: e.message };
    }
}

router.post('/telegram/process-text', async (req, res) => {
    const { message_text, chat_id, user_id } = req.body;
    const aiModel = req.app.locals.aiModel;
    const aiModelFallback = req.app.locals.aiModelFallback;
    const protocol = (req.headers && (req.headers['x-forwarded-proto'] || req.headers['x-original-protocol'])) || 'https';
    const host = (req.headers && req.headers['x-forwarded-host']) || req.get('host') || 'fonoaudio-pro-app.vercel.app';

    try {
        const result = await processTextInternal(message_text, chat_id, user_id, aiModel, protocol, host, aiModelFallback);
        res.json(result);
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// --- PENDING QUEUE MANAGEMENT ---

router.get('/telegram/pending-queue', async (req, res) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
        return res.json({ status: 'ok', items: pendingQueueMemory, source: 'memory' });
    }
    try {
        const res2 = await fetch(`${supabaseUrl}/rest/v1/telegram_pending_queue?status=eq.pending&order=created_at.desc&limit=50`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
        if (!res2.ok) {
            return res.json({ status: 'ok', items: pendingQueueMemory, source: 'memory' });
        }
        const items = await res2.json();
        return res.json({ status: 'ok', items, source: 'supabase' });
    } catch {
        return res.json({ status: 'ok', items: pendingQueueMemory, source: 'memory' });
    }
});

router.post('/telegram/process-pending', async (req, res) => {
    const { item_id, user_id } = req.body;
    const aiModel = req.app.locals.aiModel;
    const aiModelFallback = req.app.locals.aiModelFallback;

    // Find item from memory or Supabase
    let item = pendingQueueMemory.find(i => i.id === item_id);
    if (!item) {
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey) {
            const res2 = await fetch(`${supabaseUrl}/rest/v1/telegram_pending_queue?id=eq.${item_id}`, {
                headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            if (res2.ok) {
                const items = await res2.json();
                item = items[0];
            }
        }
    }

    if (!item) {
        return res.status(404).json({ status: 'error', message: 'Item not found' });
    }

    if (!item.file_id) {
        return res.status(400).json({ status: 'error', message: 'No file_id to process' });
    }

    // Re-process the file
    try {
        const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const fileInfoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${item.file_id}`);
        const fileInfo = await fileInfoRes.json();
        if (!fileInfo.ok) {
            return res.status(400).json({ status: 'error', message: 'File no longer available on Telegram' });
        }

        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`;
        const fileRes = await fetch(fileUrl);
        const fileBuffer = await fileRes.arrayBuffer();
        const base64Data = Buffer.from(fileBuffer).toString('base64');

        const ext = fileInfo.result.file_path.split('.').pop()?.toLowerCase() || '';
        const mimeMap = {
            'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
            'mp3': 'audio/mpeg', 'ogg': 'audio/ogg', 'wav': 'audio/wav', 'm4a': 'audio/mp4',
            'mp4': 'video/mp4', 'pdf': 'application/pdf',
        };
        const mimeType = mimeMap[ext] || item.mime_type || 'application/octet-stream';

        // Build prompt and process
        const parts = [{ text: `Analizá este archivo clínicamente: ${item.file_name}. MIME: ${mimeType}` }];
        if (mimeType.startsWith('image/') || mimeType.startsWith('audio/') || mimeType === 'application/pdf') {
            parts.push({ inlineData: { mimeType, data: base64Data } });
        }

        const geminiResult = await callGeminiResilient(parts, aiModel, GEMINI_MODEL_CHAIN[0]);
        if (geminiResult.ok) {
            // Mark as processed
            const supabaseUrl = process.env.VITE_SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
            if (supabaseUrl && supabaseKey) {
                await fetch(`${supabaseUrl}/rest/v1/telegram_pending_queue?id=eq.${item.id}`, {
                    method: 'PATCH',
                    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'processed', partial_analysis: geminiResult.text }),
                });
            }
            // Remove from memory
            const idx = pendingQueueMemory.findIndex(i => i.id === item.id);
            if (idx >= 0) pendingQueueMemory.splice(idx, 1);

            // Notify user
            if (item.chat_id) {
                await sendTelegramMessage(item.chat_id, `✅ Archivo procesado: ${item.file_name}\n\n${geminiResult.text.slice(0, 500)}`);
            }

            return res.json({ status: 'ok', analysis: geminiResult.text });
        } else {
            return res.status(503).json({ status: 'error', message: 'AI still unavailable. Item remains in queue.' });
        }
    } catch (e) {
        return res.status(500).json({ status: 'error', message: e.message });
    }
});

// --- GOOGLE CALENDAR CREATE EVENT (proxy to avoid CORS + token management) ---

router.post('/google/calendar/create-event', async (req, res) => {
    const { access_token, summary, description, start, end, colorId } = req.body;
    if (!access_token) {
        return res.status(400).json({ status: 'error', message: 'access_token is required' });
    }

    try {
        const eventBody = {
            summary: summary || 'Cita - FonoAudio Pro AI',
            description: description || '',
            start: { dateTime: start, timeZone: 'America/Argentina/Buenos_Aires' },
            end: { dateTime: end, timeZone: 'America/Argentina/Buenos_Aires' },
        };
        if (colorId) eventBody.colorId = colorId;

        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventBody),
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('[Google Calendar Create] API error:', data);
            return res.status(response.status).json({ status: 'error', message: data.error?.message || 'Failed to create event', details: data });
        }

        res.json({ status: 'ok', event_id: data.id, html_link: data.htmlLink });
    } catch (e) {
        console.error('[Google Calendar Create] Error:', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.post('/google/calendar/list-events', async (req, res) => {
    const { access_token, time_min, time_max, max_results } = req.body;
    if (!access_token) {
        return res.status(400).json({ status: 'error', message: 'access_token is required' });
    }

    try {
        const params = new URLSearchParams({
            singleEvents: 'true',
            orderBy: 'startTime',
            maxResults: String(max_results || 50),
        });
        if (time_min) params.set('timeMin', time_min);
        if (time_max) params.set('timeMax', time_max);

        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
            headers: { 'Authorization': `Bearer ${access_token}` },
        });

        const data = await response.json();
        if (!response.ok) {
            return res.status(response.status).json({ status: 'error', message: data.error?.message || 'Failed to list events' });
        }

        const events = (data.items || []).map(ev => ({
            id: ev.id,
            summary: ev.summary,
            description: ev.description,
            start: ev.start?.dateTime || ev.start?.date,
            end: ev.end?.dateTime || ev.end?.date,
            status: ev.status,
            html_link: ev.htmlLink,
            colorId: ev.colorId,
        }));

        res.json({ status: 'ok', events, total: events.length });
    } catch (e) {
        console.error('[Google Calendar List] Error:', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// ═══ 24/7 Background Worker: Appointment Reminders ═══
router.get('/worker/check-reminders', async (req, res) => {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return res.json({ status: 'skip', message: 'Supabase not configured' });
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();

        // Get upcoming appointments (pending) for today, including autonomous reminders
        const { data: appointments, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('status', 'pending')
            .eq('date', today);

        if (error) throw error;
        if (!appointments || appointments.length === 0) {
            return res.json({ status: 'ok', sent: 0, message: 'No pending appointments today' });
        }

        let sentCount = 0;
        for (const appt of appointments) {
            if (!appt.time) continue;
            const [aH, aM] = appt.time.split(':').map(Number);
            const diffMin = (aH * 60 + aM) - (currentHour * 60 + currentMin);

            if (appt.type === 'recordatorio') {
                // Autonomous reminder: send AT the scheduled time (within a 15-min window)
                if (diffMin >= 0 && diffMin <= 15) {
                    const reminderMsg = `🔔 *Recordatorio FonoAudio-Pro*\n\n📌 ${appt.patient_name || 'Recordatorio'}\n🕐 Hora: ${appt.time} hs\n\n_FonoAudio Pro AI - Asistente Clínico_`;
                    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: Number(CHAT_ID), text: reminderMsg, parse_mode: 'Markdown' })
                    });
                    const d = await r.json();
                    if (d.ok) {
                        sentCount++;
                        // Mark as sent so it isn't repeated
                        await supabase.from('appointments').update({ status: 'completed' }).eq('id', appt.id);
                    }
                    else console.warn('[Worker] Failed to send reminder:', d.description);
                }
            } else {
                // Appointment reminder: send 30 minutes before
                if (diffMin > 0 && diffMin <= 30) {
                    const reminderMsg = `🔔 *Recordatorio de Cita*\n\n👤 Paciente: ${appt.patient_name || 'Sin nombre'}\n🕐 Hora: ${appt.time} hs\n📋 Tipo: ${appt.type || 'Consulta'}\n📝 Notas: ${appt.notes || 'Sin notas'}\n\n_FonoAudio Pro - Te faltan ${diffMin} minutos_`;
                    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: Number(CHAT_ID), text: reminderMsg, parse_mode: 'Markdown' })
                    });
                    const d = await r.json();
                    if (d.ok) sentCount++;
                    else console.warn('[Worker] Failed to send reminder:', d.description);
                }
            }
        }

        res.json({ status: 'ok', sent: sentCount, total: appointments.length });
    } catch (e) {
        console.error('[Worker] Error:', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// ═══ Worker: Daily Summary ═══
router.get('/worker/daily-summary', async (req, res) => {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return res.json({ status: 'skip', message: 'Supabase not configured' });
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

        const summary = `📊 *Resumen del Día*\n\n📅 Citas hoy: ${appointments?.length || 0}\n✅ Completadas: ${completed.length}\n⏳ Pendientes: ${pending.length}\n👥 Pacientes totales: ${patients?.length || 0}\n⚠️ Pacientes con alertas: ${criticalPatients.length}${pending.length > 0 ? '\n\nPróximas citas:\n' + pending.map(a => `• ${a.time} hs - ${a.patient_name}`).join('\n') : ''}`;

        const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: Number(CHAT_ID), text: summary, parse_mode: 'Markdown' })
        });
        const d = await r.json();
        
        // Auto-register webhook when daily summary is run as worker
        await autoSetupWebhook(req);

        res.json({ status: d.ok ? 'ok' : 'error', message: d.description });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// --- TELEGRAM WEBHOOK AUTO-REGISTRATION ---
async function autoSetupWebhook(req) {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TELEGRAM_BOT_TOKEN) return;
    const host = req.get('host') || 'fonoaudio-pro-ai.vercel.app';
    if (host.includes('localhost') || host.includes('127.0.0.1')) return; // Don't register webhook in local dev
    const protocol = 'https';
    const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;
    try {
        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl })
        });
        const d = await res.json();
        console.log('[Telegram Webhook] Auto-registration result:', d);
    } catch (e) {
        console.warn('[Telegram Webhook] Auto-registration failed:', e.message);
    }
}

// Find professional/clinician ID from Supabase
// Fallback chain: (1) profiles table, (2) auth.users table, (3) environment override, (4) patients table owner_id
async function findProfessionalId() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
        console.warn('[findProfessionalId] Supabase not configured');
        return null;
    }
    try {
        // (1) Try profiles table first
        const res = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id&limit=1`, {
            headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${supabaseKey}` }
        });
        if (res.ok) {
            const rows = await res.json();
            if (rows && rows.length > 0) {
                return rows[0].id;
            }
        }
        
        // (2) Fallback: try auth.users via /auth/v1/admin/users
        try {
            const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1`, {
                headers: {
                    apikey: process.env.VITE_SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${supabaseKey}`
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
            console.warn('[findProfessionalId] Auth fallback failed:', authErr.message);
        }
        
        // (3) Fallback: environment variable override (for Telegram bot scenarios)
        if (process.env.DEFAULT_PROFESSIONAL_ID) {
            console.log('[findProfessionalId] Using DEFAULT_PROFESSIONAL_ID env var');
            return process.env.DEFAULT_PROFESSIONAL_ID;
        }
        
        // (4) Last resort: find any patient's owner_id
        try {
            const patientRes = await fetch(`${supabaseUrl}/rest/v1/patients?select=owner_id&limit=1`, {
                headers: {
                    apikey: process.env.VITE_SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${supabaseKey}`
                }
            });
            if (patientRes.ok) {
                const patients = await patientRes.json();
                if (patients && patients.length > 0 && patients[0].owner_id) {
                    console.log('[findProfessionalId] Using owner_id from patients table as fallback');
                    return patients[0].owner_id;
                }
            }
        } catch (pErr) {
            console.warn('[findProfessionalId] Patient fallback failed:', pErr.message);
        }
        
        console.warn('[findProfessionalId] No professional ID found after all fallbacks');
        return null;
    } catch (e) {
        console.error('[findProfessionalId] Exception:', e.message);
        return null;
    }
}

// --- TELEGRAM WEBHOOK ROUTE (24/7 Serverless Assistant) ---
router.post('/telegram/webhook', async (req, res) => {
    try {
        const update = req.body;
        if (!update || (!update.message && !update.edited_message)) {
            return res.json({ ok: true });
        }

        const msg = update.message || update.edited_message;
        const chat_id = msg.chat?.id;
        if (!chat_id) return res.json({ ok: true });

        // Persist the real user chat_id so proactive messages (briefing, reminders) reach the user, not the bot
        try {
            const supabaseUrl = process.env.VITE_SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
            if (supabaseUrl && supabaseKey) {
                await fetch(`${supabaseUrl}/rest/v1/telegram_pending_queue?chat_id=eq.${chat_id}`, {
                    method: 'DELETE', headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
                });
                await fetch(`${supabaseUrl}/rest/v1/telegram_pending_queue`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
                    body: JSON.stringify({ chat_id: String(chat_id), direction: 'incoming', status: 'chat_registered', updated_at: new Date().toISOString() })
                });
            }
        } catch (e) { console.warn('[Webhook] Could not persist chat_id:', e?.message); }

        const aiModel = req.app.locals.aiModel;
        const aiModelFallback = req.app.locals.aiModelFallback;
        const user_id = await findProfessionalId();

        const message_text = msg.text || msg.caption || '';
        const hasMedia = !!(msg.photo || msg.audio || msg.video || msg.document || msg.voice);

        console.log(`[Telegram Webhook] Update received. chatId: ${chat_id}, textLen: ${message_text.length}, hasMedia: ${hasMedia}, aiModel: ${aiModel ? 'SET' : 'NULL'}, user_id: ${user_id || 'none'}`);

        if (!user_id) {
            console.error('[Telegram Webhook] No professional ID found. Bot may not work correctly.');
        }

        if (hasMedia) {
            let file_id = '';
            let media_type = 'document';
            if (msg.photo) {
                file_id = msg.photo[msg.photo.length - 1]?.file_id || '';
                media_type = 'photo';
            } else if (msg.audio) {
                file_id = msg.audio.file_id;
                media_type = 'audio';
            } else if (msg.voice) {
                file_id = msg.voice.file_id;
                media_type = 'voice';
            } else if (msg.video) {
                file_id = msg.video.file_id;
                media_type = 'video';
            } else if (msg.document) {
                file_id = msg.document.file_id;
                media_type = 'document';
            }

            logDebug('Telegram Webhook', `Media detected. type: ${media_type}, file_id: ${file_id ? file_id.substring(0, 20) + '...' : 'EMPTY'}, chat_id: ${chat_id}`);

            if (file_id) {
                try {
                    const mediaResult = await processMediaInternal(file_id, media_type, message_text, chat_id, user_id, aiModel);
                    logDebug('Telegram Webhook', `processMediaInternal result: status=${mediaResult?.status}, type=${mediaResult?.type}, sent_to_telegram=${mediaResult?.sent_to_telegram}`);
                    if (mediaResult?.status === 'error' || mediaResult?.error) {
                        logError('Telegram Webhook processMediaInternal', new Error(mediaResult?.message || mediaResult?.error));
                    }
                } catch (mediaErr) {
                    logError('Telegram Webhook processMediaInternal', mediaErr);
                    // GUARANTEED fallback: always notify user on error
                    if (chat_id && process.env.TELEGRAM_BOT_TOKEN) {
                        try {
                            const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
                            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ chat_id, text: `Error procesando el archivo: ${mediaErr.message}` })
                            });
                        } catch (tgErr) { logError('Telegram Webhook notify user', tgErr); }
                    }
                }
            } else {
                logDebug('Telegram Webhook', `file_id is empty for media type: ${media_type}`);
                // Notify user if file_id is empty
                if (chat_id && process.env.TELEGRAM_BOT_TOKEN) {
                    try {
                        const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
                        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chat_id, text: 'No pude descargar el archivo. Intentá enviarlo de nuevo.' })
                        });
                    } catch (tgErr) { logError('Telegram Webhook notify user', tgErr); }
                }
            }
        } else if (message_text) {
            logDebug('Telegram Webhook', `Text message received, routing to processTextInternal`);
            await processTextInternal(message_text, chat_id, user_id, aiModel, undefined, undefined, aiModelFallback);
        }

        res.json({ ok: true });
    } catch (e) {
        logError('Telegram Webhook outer catch', e);
        // GUARANTEED fallback: try to notify user even on unexpected error
        try {
            const msg = req.body?.message;
            const chat_id = msg?.chat?.id;
            if (chat_id && process.env.TELEGRAM_BOT_TOKEN) {
                const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
                await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id, text: `Ocurrió un error inesperado. Probá de nuevo o escribí por texto.` })
                });
            }
        } catch (notifyErr) { logError('Telegram Webhook final fallback notify', notifyErr); }
        res.status(200).json({ ok: true, error: e.message }); // Always return 200 to Telegram
    }
});

router.get('/telegram/setup-webhook', async (req, res) => {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TELEGRAM_BOT_TOKEN) {
        return res.status(400).json({ status: 'error', message: 'TELEGRAM_BOT_TOKEN is not configured in environment.' });
    }

    const host = req.get('host') || 'fonoaudio-pro-ai.vercel.app';
    const protocol = 'https';
    const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;

    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl })
        });
        const data = await response.json();
        res.json({
            status: data.ok ? 'ok' : 'error',
            message: data.ok ? `Webhook set successfully to ${webhookUrl}` : `Failed to set webhook: ${data.description}`,
            details: data
        });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// ─── REST: Reprogramar turno (consumible desde app, mascota, MCP/Hermes) ───
// Lee access_token del header (opcional) o refresca el token Google del usuario.
router.post('/appointments/reschedule', async (req, res) => {
    const { appointment_id, new_date, new_time } = req.body || {};
    if (!appointment_id || !new_date) {
        return res.status(400).json({ status: 'error', message: 'appointment_id y new_date requeridos' });
    }
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' };
    try {
        // 1) Traer turno actual
        const getRes = await fetch(`${supabaseUrl}/rest/v1/appointments?id=eq.${appointment_id}&select=id,patient_name,date,time,type,google_event_id`, {
            headers,
        });
        const rows = await getRes.json();
        const row = Array.isArray(rows) && rows[0];
        if (!row) return res.status(404).json({ status: 'error', message: 'Turno no encontrado' });

        // 2) Actualizar en Supabase
        const updated = { date: new_date, time: new_time || (row.time || '09:00') };
        const patchRes = await fetch(`${supabaseUrl}/rest/v1/appointments?id=eq.${appointment_id}`, {
            method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' },
            body: JSON.stringify(updated),
        });
        const patchData = await patchRes.json();
        if (!patchRes.ok) throw new Error(typeof patchData === 'string' ? patchData : (patchData?.message || 'update failed'));
        const updatedRow = Array.isArray(patchData) ? patchData[0] : row;

        // 3) Sincronizar Google Calendar si tiene google_event_id
        let calendarSynced = false;
        let calendarError = null;
        if (updatedRow.google_event_id) {
            try {
                let accessToken = null;
                const { data: gauthRows } = await fetch(`${supabaseUrl}/rest/v1/google_auth?select=access_token,refresh_token,expires_at&limit=1`, {
                    headers,
                }).then(r => r.json()).then(d => ({ data: Array.isArray(d) ? d : [] })).catch(() => ({ data: [] }));
                const gauth = gauthRows[0];
                if (gauth && gauth.access_token) {
                    accessToken = gauth.access_token;
                    const expiresAt = gauth.expires_at ? new Date(gauth.expires_at).getTime() : 0;
                    if (Date.now() >= expiresAt - 5 * 60 * 1000 && gauth.refresh_token) {
                        try {
                            const rf = await fetch(`${process.env.BACKEND_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')}/api/google/refresh-token`, {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ refresh_token: gauth.refresh_token }),
                            });
                            if (rf.ok) { const rd = await rf.json(); accessToken = rd.access_token || accessToken; }
                        } catch { /* keep old token */ }
                    }
                    const startISO = `${new_date}T${new_time || (row.time || '09:00')}:00`;
                    const calRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${updatedRow.google_event_id}`, {
                        method: 'PATCH',
                        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ start: { dateTime: startISO, timeZone: 'America/Argentina/Buenos_Aires' } }),
                    });
                    if (calRes.ok) calendarSynced = true;
                    else calendarError = `Google Calendar HTTP ${calRes.status}`;
                }
            } catch (ce) { calendarError = ce?.message || String(ce); }
        }

        // 4) Notificar por Telegram
        try {
            const tgMsg = `📅 <b>Turno reprogramado</b> — ${row.patient_name || 'Paciente'} → ${new_date}${new_time ? ` ${new_time}` : ''}.`;
            await sendTelegramMessage(process.env.TELEGRAM_CHAT_ID || "8706264359", tgMsg, /* parseHtml */ true);
        } catch { /* non-fatal */ }

        res.json({
            status: 'ok',
            message: calendarSynced
                ? `Turno de ${row.patient_name} reprogramado a ${new_date}${new_time ? ` a las ${new_time}` : ''} (sincronizado con Google Calendar).`
                : `Turno reprogramado en el sistema.${calendarError ? ` (Google Calendar: ${calendarError})` : ''}`,
            appointment: updatedRow,
            calendarSynced,
        });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e?.message || String(e) });
    }
});

// ─── NOTIFICATIONS: persistir push subscription del profesional (PWA/service worker) ───
// El endpoint recibe la subscription del browser (VAPID) y la guarda en Supabase
// para que el worker cron (check-reminders) envíe push web en paralelo a Telegram.
router.post('/notifications/save-subscription', async (req, res) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const headers = { apikey: `Authorization: ${supabaseKey}`, 'Content-Type': 'application/json' };
    try {
        const sub = req.body;
        if (!sub || !sub.endpoint) {
            return res.status(400).json({ status: 'error', message: 'subscription inválida' });
        }
        // Upsert por endpoint (deduplicado) vía REST de Supabase
        const payload = { endpoint: sub.endpoint, keys: sub.keys || {}, expiration_time: sub.expirationTime, updated_at: new Date().toISOString() };
        const r = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions`, {
            method: 'POST',
            headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify(payload),
        });
        if (!r.ok) { const t = await r.text().catch(()=>'' ); console.error('[save-subscription] error:', r.status, t); }
        return res.json({ status: 'ok', message: 'Suscripción guardada' });
    } catch (e) {
        console.error('[save-subscription] error:', e?.message);
        return res.status(500).json({ status: 'error', message: e?.message || String(e) });
    }
});

// ─── MOVE APPOINTMENT TO ANOTHER ROOM / CONSULTORY (REST, reutilizable app/mascota/MCP) ───
router.post('/appointments/move-room', async (req, res) => {
    const { appointment_id, room_name } = req.body || {};
    if (!appointment_id || !room_name) return res.status(400).json({ status: 'error', message: 'appointment_id y room_name requeridos' });
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return res.status(500).json({ status: 'error', message: 'Configuracion Supabase incompleta' });
    const H = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' };
    try {
        const getRes = await fetch(`${supabaseUrl}/rest/v1/appointments?id=eq.${appointment_id}&select=id,patient_name,date,time,roomid,google_event_id`, { headers: H });
        const rows = await getRes.json();
        const row = Array.isArray(rows) && rows[0];
        if (!row) return res.status(404).json({ status: 'error', message: 'Turno no encontrado' });
        const pr = await fetch(`${supabaseUrl}/rest/v1/appointments?id=eq.${appointment_id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify({ roomid: room_name }) });
        let pd;
        try { pd = await pr.json(); } catch { pd = await pr.text().catch(() => ''); }
        if (!pr.ok) throw new Error(typeof pd === 'string' ? pd : (pd?.message || 'update failed'));
        const updatedRow = Array.isArray(pd) ? pd[0] : { ...row, roomid: room_name };

        // Sync Google Calendar: actualizar `location` del evento si existe google_event_id
        let calendarSynced = false;
        if (row.google_event_id) {
            try {
                const ga = new googleService();
                await ga.refreshIfNeeded();
                await ga.patchEvent(row.google_event_id, { location: room_name });
                calendarSynced = true;
            } catch (e) { console.error('[move-room] Calendar sync error:', e.message); }
        }
        // Notificar por Telegram (no branding en el mensaje al paciente)
        try {
            const tgToken = process.env.TELEGRAM_BOT_TOKEN;
            const tgChat = process.env.TELEGRAM_CHAT_ID;
            if (tgToken && tgChat) {
                await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: Number(tgChat), text: `Turno de ${row.patient_name || 'paciente'} (${row.date} ${row.time}) movido al consultorio ${room_name}.` }),
                });
            }
        } catch (e) { /* non-fatal */ }

        return res.json({ status: 'success', message: `Turno movido al consultorio ${room_name}`, appointment: updatedRow, calendarSynced });
    } catch (e) {
        console.error('[move-room] error:', e?.message);
        return res.status(500).json({ status: 'error', message: e?.message || String(e) });
    }
});

export default router;


