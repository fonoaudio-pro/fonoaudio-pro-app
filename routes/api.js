import express from 'express';
import { createClient } from '@supabase/supabase-js';
import googleService from '../services/googleService.js';
import notebooklmService from '../services/notebooklmService.js';
import clinicalPlanningService from '../services/clinicalPlanningService.js';
import distributionService from '../services/distributionService.js';
import notebooklmRouter from './notebooklm.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

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
    if (!supabaseUrl || !supabaseKey || !userId) return [];
    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/patients?professional_id=eq.${userId}&select=id,name,diagnosis,age,phone,documents&limit=50`, {
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
        console.log('[Groq] Trying llama3-70b-8192 as ultimate fallback...');
        const resp = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama3-70b-8192',
                messages: [{ role: 'user', content: promptText }],
                max_tokens: 2048,
                temperature: 0.3,
            }),
        });

        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(errData.error?.message || `Groq API error: ${resp.status}`);
        }

        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || '';
        if (text) {
            console.log('[Groq] Success with llama3-70b-8192');
            return { ok: true, text, model: 'groq/llama3-70b-8192' };
        }
        return { ok: false, error: new Error('Empty response from Groq') };
    } catch (e) {
        console.error('[Groq] Failed:', e.message?.slice(0, 100));
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

// Check if error is retryable (503, 502, 429, overloaded)
function isRetryableError(err) {
    const msg = err?.message || '';
    return msg.includes('503') || msg.includes('502') || msg.includes('429') ||
           msg.includes('overloaded') || msg.includes('high demand') ||
           msg.includes('Service Unavailable') || msg.includes('RESOURCE_EXHAUSTED');
}

// Main resilience function: tries model chain with backoff, then Groq fallback
async function callGeminiResilient(parts, aiModel, modelName) {
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
// DEGRADED RESPONSES: Useful answers without AI
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
            const patientsRes = await fetch(`${supabaseUrl}/rest/v1/patients?professional_id=eq.${userId}&select=id,name,diagnosis,age&limit=20`, {
                headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            const patients = await patientsRes.json();
            if (patients.length > 0) {
                const list = patients.map(p => `- ${p.name}: ${p.diagnosis || 'sin diagnóstico'}`).join('\n');
                return `📋 *Consulta sin IA (modo degradado)*\n\nTenés ${patients.length} pacientes cargados:\n${list}\n\n⚠️ El servicio de IA está temporalmente no disponible. Estos datos vienen directo de la base de datos.`;
            }
        }

        // Check if user is asking about agenda/today
        if (lower.includes('cita') || lower.includes('agenda') || lower.includes('hoy') || lower.includes('turno')) {
            const today = now.toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
            const appsRes = await fetch(`${supabaseUrl}/rest/v1/appointments?professional_id=eq.${userId}&date=eq.${today}&select=id,patient_name,time,status&order=time`, {
                headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            });
            const apps = await appsRes.json();
            if (apps.length > 0) {
                const list = apps.map(a => `- ${a.time || '??:??'} hs: ${a.patient_name} (${a.status || 'pending'})`).join('\n');
                return `📋 *Consulta sin IA (modo degradado)*\n\nAgenda de hoy:\n${list}\n\n⚠️ Servicio de IA no disponible. Datos de la base.`;
            } else {
                return `📋 *Consulta sin IA (modo degradado)*\n\nNo tenés citas programadas para hoy.\n\n⚠️ Servicio de IA no disponible.`;
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
        const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
        });
        const data = await resp.json();
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
        const result = await googleService.createGoogleMeetEvent({
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
        const result = await googleService.syncGoogleCalendar();
        res.json(result);
    } catch (error) {
        console.error('[Google Calendar Sync Route] Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

router.post('/google/drive/sync', async (req, res) => {
    const { folderId } = req.body;
    try {
        const result = await googleService.syncDriveToMaterials(folderId);
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
        const mockResults = [
            { id: 'doc1', title: 'Guía de Fonoaudiología 2024', content: 'Contenido sobre trastornos del lenguaje...' },
            { id: 'doc2', title: 'Avances en Terapia del Lenguaje', content: 'Nuevos enfoques basados en evidencia...' }
        ];
        res.json({ status: 'ok', response: mockResults, total: mockResults.length });
    } catch (e) {
        console.error('[NotebookLM Search] Error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.post('/research', async (req, res) => {
    // This endpoint is called by research_scientific_evidence
    const { query } = req.body;
    try {
        // Mock research results - in real implementation, this would use research APIs
        const mockEvidence = [
            { id: 'e1', title: 'Estudio Eficacia de Intervenciones', journal: 'Journal of Speech Pathology', year: 2024 },
            { id: 'e2', title: 'Análisis de Trastornos del Habla', journal: 'Clinical Linguistics', year: 2023 }
        ];
        res.json({ status: 'ok', response: mockEvidence, query });
    } catch (e) {
        console.error('[Research] Error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

router.post('/clinical_summary', async (req, res) => {
    // This endpoint is called by generate_clinical_summary
    const { patientName, history, diagnosis } = req.body;
    try {
        // Mock clinical summary - in real implementation, this would use AI generation
        const summary = `
# RESUMEN CLÍNICO - ${patientName}

## Diagnóstico Principal
${diagnosis || 'No especificado'}

## Evolución Reciente
${history || 'Sin historial detallado.'}

## Próximos Pasos
- Continuar con el plan de tratamiento actual
- Reevaluación en 4 semanas
- Monitoreo de respuestas a intervenciones
        `;
        res.json({ status: 'ok', response: summary });
    } catch (e) {
        console.error('[Clinical Summary] Error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// --- REAL ACTIONS ---


// 1. Telegram: Send actual message
router.get('/telegram/diagnose', async (req, res) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const result = {
        tokenSet: !!token,
        tokenLength: token ? token.length : 0,
        tokenPreview: token ? token.substring(0, 10) + '...' : 'MISSING',
        chatIdSet: !!chatId,
        chatIdValue: chatId || 'MISSING',
        apiTest: null,
    };
    if (token) {
        try {
            const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
            const d = await r.json();
            result.apiTest = d.ok ? `Bot: @${d.result.username} (${d.result.first_name})` : `ERROR: ${d.description}`;
        } catch (e) {
            result.apiTest = `FETCH ERROR: ${e.message}`;
        }
    }
    res.json(result);
});

router.post('/telegram/send', async (req, res) => {
    const { chatId: reqChatId, message, fileUrl, photo, video, audio, voice, document, caption, parse_mode } = req.body;
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = reqChatId || process.env.TELEGRAM_CHAT_ID;
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

router.get('/telegram/poll', async (req, res) => {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TELEGRAM_BOT_TOKEN) {
        return res.status(500).json({ ok: false, description: 'TELEGRAM_BOT_TOKEN not configured' });
    }

    try {
        const offset = req.query.offset || '0';
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=3`);
        const data = await response.json();
        res.json(data);
    } catch (e) {
        console.error('[Telegram Poll] Error:', e.message);
        res.status(500).json({ ok: false, description: e.message });
    }
});

router.get('/telegram/file/:fileId', async (req, res) => {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TELEGRAM_BOT_TOKEN) {
        return res.status(500).json({ ok: false, description: 'TELEGRAM_BOT_TOKEN not configured' });
    }

    try {
        const { fileId } = req.params;
        const fileInfoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
        const fileInfo = await fileInfoRes.json();
        if (!fileInfo.ok) {
            return res.status(400).json(fileInfo);
        }

        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`;
        const fileRes = await fetch(fileUrl);
        if (!fileRes.ok) {
            return res.status(500).json({ ok: false, description: 'Failed to download file from Telegram' });
        }

        const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        const buffer = await fileRes.arrayBuffer();
        res.send(Buffer.from(buffer));
    } catch (e) {
        console.error('[Telegram File] Error:', e.message);
        res.status(500).json({ ok: false, description: e.message });
    }
});

// --- AUDIO CLINICAL PROCESSING (transcribe + intent + patient + action) ---

async function processAudioClinically(base64Data, mimeType, messageText, patients, aiModel) {
    const patientList = patients.length > 0
        ? `\nPACIENTES DEL PROFESIONAL:\n${patients.map((p, i) => `${i + 1}. ${p.name} — ${p.diagnosis || 'sin diagnóstico'}, ${p.age || '?'} años`).join('\n')}`
        : '\nNo hay pacientes cargados en el sistema.';

    const audioPrompt = `Sos el asistente clínico de FonoAudio Pro AI. Recibiste un AUDIO HABLADO por Telegram de un fonoaudiólogo.

═══ INSTRUCCIÓN CRÍTICA ═══
Este audio es una ENTRADA CONVERSACIONAL, no un archivo genico. El profesional te está hablando. Tu trabajo es:
1. TRANSCRIBIR el audio fielmente.
2. ENTENDER la intención del profesional (¿qué quiere hacer?).
3. IDENTIFICAR el paciente al que se refiere (si menciona alguno).
4. SUGERIR una acción clínica concreta.
5. RESPONDER al profesional de forma natural y útil.

═══ CONTEXTO ═══
${patientList}
${message_text ? `Mensaje adjunto del usuario: "${message_text}"` : ''}

═══ FORMATO DE RESPUESTA ═══
Respondé EXACTAMENTE con este formato JSON (sin markdown, sin \`\`\`):

{
  "transcripcion": "[transcripción completa y fiel del audio]",
  "intencion": "[qué quiere hacer el profesional:ej. crear nota,agendar cita,consultar sobre paciente,enviar material,recordatorio,consulta clínica,otro]",
  "paciente_detectado": "[nombre del paciente si lo menciona, o null]",
  "accion_sugerida": "[nota_clinica | sesion | informe | recordatorio | consulta | material | ninguno]",
  "resumen_clinico": "[resumen conciso de lo que dice el audio, orientado a fonoaudiología]",
  "respuesta_sugerida": "[respuesta natural y profesional que le darías al fonoaudiólogo]"
}

═══ REGLAS ═══
- Si el audio dice "agendá una cita con Juan para el viernes", intención="agendar cita", paciente="Juan", acción="consulta"
- Si el audio dice "el resultado de María mejoró mucho", intención="actualizar paciente", paciente="María", acción="nota_clinica"
- Si el audio dice "generame una guía para Pedro", intención="crear material", paciente="Pedro", acción="material"
- Si el audio dice "¿cuándo tengo cita con Losada?", intención="consultar agenda", paciente="Losada", acción="consulta"
- Si el audio es una nota clínica dictada (ej. "paciente refiere dolor de garganta..."), acción="nota_clinica"
- Si el audio es un resumen de sesión, acción="sesion"
- Si no se detecta paciente, paciente_detectado=null y la respuesta debe preguntar a qué paciente se refiere
- TRANSCRIBÍ el audio COMPLETO, palabra por palabra. No resumas la transcripción.
- La respuesta_sugerida debe ser algo que le dirías al fonoaudiólogo por chat (ej. "Perfecto, ¿querés que guarde esto como nota clínica de Juan?")
- Usá español argentino profesional.
- NO inventes datos clínicos que no estén en el audio.`;

    const parts = [
        { text: audioPrompt },
        { inlineData: { mimeType, data: base64Data } }
    ];

    const geminiResult = await callGeminiResilient(parts, aiModel, GEMINI_MODEL_CHAIN[0]);
    if (!geminiResult.ok) {
        console.error('[Audio Clinical] All Gemini models failed:', geminiResult.error?.message);

        // Save to pending queue for later analysis
        await saveToPendingQueue({
            user_id: null, // will be set by caller
            chat_id: null,
            media_type: 'audio',
            file_name: null,
            mime_type: mimeType,
            file_id: null,
            partial_analysis: null,
            error_message: geminiResult.error?.message?.slice(0, 200),
            metadata: { originalPrompt: 'audio_clinical' },
        });

        return {
            status: 'error',
            type: 'audio_clinical',
            transcription: '',
            intent: 'error',
            patientDetected: null,
            actionSuggested: 'ninguno',
            clinicalSummary: '',
            suggestedResponse: `No pude procesar el audio (todos los modelos de IA temporalmente no disponibles).\n\nTu audio quedó guardado en la cola de procesamiento pendiente. Cuando el servicio se restablezca, se analizará automáticamente.\n\nMientras tanto, podés:\n• Escribirme por texto con los datos del paciente\n• Guardar la nota manualmente desde la app`,
            rawResponse: '',
            error: true,
            queued: true,
        };
    }
    const rawText = geminiResult.text;

    // Try to parse JSON from response
    let parsed = null;
    try {
        // Try direct parse
        parsed = JSON.parse(rawText);
    } catch {
        // Try extracting JSON from markdown code blocks
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            try { parsed = JSON.parse(jsonMatch[1]); } catch {}
        }
        // Try finding JSON object in text
        if (!parsed) {
            const objMatch = rawText.match(/\{[\s\S]*\}/);
            if (objMatch) {
                try { parsed = JSON.parse(objMatch[0]); } catch {}
            }
        }
    }

    if (parsed && parsed.transcripcion) {
        return {
            status: 'ok',
            type: 'audio_clinical',
            transcription: parsed.transcripcion || '',
            intent: parsed.intencion || 'consulta',
            patientDetected: parsed.paciente_detectado || null,
            actionSuggested: parsed.accion_sugerida || 'nota_clinica',
            clinicalSummary: parsed.resumen_clinico || '',
            suggestedResponse: parsed.respuesta_sugerida || '',
            rawResponse: rawText,
        };
    }

    // Fallback: return raw response without structured data
    return {
        status: 'ok',
        type: 'audio_clinical',
        transcription: rawText,
        intent: 'consulta',
        patientDetected: null,
        actionSugerida: 'nota_clinica',
        clinicalSummary: rawText,
        suggestedResponse: rawText,
        rawResponse: rawText,
        parseFailed: true,
    };
}

// --- TELEGRAM MULTIMODAL AI PROCESSING (with patient matching + action suggestions) ---

router.post('/telegram/process-media', async (req, res) => {
    const { file_id, media_type, message_text, chat_id, user_id } = req.body;
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const aiModel = req.app.locals.aiModel;

    if (!TELEGRAM_BOT_TOKEN) {
        return res.status(500).json({ status: 'error', message: 'TELEGRAM_BOT_TOKEN not configured' });
    }
    if (!file_id) {
        return res.status(400).json({ status: 'error', message: 'file_id is required' });
    }

    try {
        // Step 1: Get file info from Telegram
        const fileInfoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${file_id}`);
        const fileInfo = await fileInfoRes.json();
        if (!fileInfo.ok) {
            return res.status(400).json({ status: 'error', message: `Telegram getFile failed: ${fileInfo.description}` });
        }

        // Step 2: Download the file
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`;
        const fileRes = await fetch(fileUrl);
        if (!fileRes.ok) {
            return res.status(500).json({ status: 'error', message: 'Failed to download file from Telegram' });
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
            console.log(`[Telegram Process-Media] Audio detected (${mimeType}). Routing to clinical audio handler.`);
            const audioResult = await processAudioClinically(base64Data, mimeType, message_text, patients, aiModel);

            // If audio processing failed, send error to Telegram
            if (audioResult.error) {
                await sendTelegramMessage(chat_id, audioResult.suggestedResponse);
                return res.json({
                    status: 'error',
                    type: 'audio_clinical',
                    response: audioResult.suggestedResponse,
                    media_type: 'audio',
                    mime_type: mimeType,
                    file_name: fileName,
                    sent_to_telegram: true,
                });
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
                const fallbackMatch = matchPatient(audioResult.transcription, patients, messageText || '');
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

            // Build Telegram response
            let responseMessage = `🎙️ *Audio procesado*\n\n`;
            responseMessage += `*Transcripción:*\n_${audioResult.transcription}_\n\n`;
            if (audioResult.patientDetected) {
                responseMessage += `*Paciente detectado:* ${audioResult.patientDetected}\n`;
            }
            responseMessage += `*Intención:* ${audioResult.intent}\n`;
            responseMessage += `*Acción sugerida:* ${audioResult.actionSuggested}\n\n`;

            if (matchedPatient) {
                responseMessage += `Detecté que esto corresponde a *${matchedPatient.name}* (${matchedPatient.diagnosis || 'sin diagnóstico'}).\n\n`;
                responseMessage += `¿Qué querés hacer?\n`;
                responseMessage += `  • "1" — Guardar como nota clínica\n`;
                responseMessage += `  • "2" — Guardar como sesión\n`;
                responseMessage += `  • "3" — Guardar como informe\n`;
                responseMessage += `  • "no" — Descartar`;
            } else if (patients.length > 0) {
                responseMessage += `¿A qué paciente corresponde?\n`;
                patients.slice(0, 6).forEach((p, i) => {
                    responseMessage += `  • ${i + 1}. ${p.name}\n`;
                });
                responseMessage += `\nO escribí "no" para cancelar.`;
            } else {
                responseMessage += audioResult.suggestedResponse;
            }

            // Send to Telegram
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
                    console.error('[Telegram Process-Media] Failed to send audio response:', tgErr.message);
                }
            }

            return res.json({
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
            });
        }

        // ─── NON-AUDIO: existing image/video/document handler ───

        // Patients already fetched above (shared variable)

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
            return res.json({ status: 'ok', response: errorMsg, queued: true, sent_to_telegram: true });
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

        res.json({
            status: 'ok',
            response: responseMessage,
            media_type,
            mime_type: mimeType,
            file_name: fileName,
            suggestions,
            sent_to_telegram: sentToTelegram,
        });
    } catch (e) {
        console.error('[Telegram Process-Media] Error:', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// --- SAVE FILE/ANALYSIS TO PATIENT RECORD ---

router.post('/telegram/save-to-patient', async (req, res) => {
    const { chat_id, patient_id, save_type, user_id } = req.body;
    // save_type: 'document' | 'session' | 'report'

    const pending = await getPendingFile(chat_id);
    if (!pending) {
        return res.status(400).json({ status: 'error', message: 'No hay archivo pendiente para guardar. Send a new file first.' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ status: 'error', message: 'Supabase not configured' });
    }

    try {
        // Find the patient
        const patients = user_id ? await fetchPatientsForUser(user_id) : [];
        const patient = patients.find(p => p.id === patient_id) || (patient_id ? { id: patient_id, name: 'Desconocido' } : null);

        if (!patient) {
            return res.status(404).json({ status: 'error', message: 'Patient not found' });
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

            return res.json({
                status: 'ok',
                saved_as: 'session',
                patient_name: patient.name,
                file_name: pending.file_name,
                message: `Sesión guardada en la historia de ${patient.name}.`,
            });

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

            return res.json({
                status: 'ok',
                saved_as: 'report',
                patient_name: patient.name,
                file_name: pending.file_name,
                message: `Informe guardado en la historia de ${patient.name}.`,
            });

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

            return res.json({
                status: 'ok',
                saved_as: 'document',
                patient_name: patient.name,
                file_name: pending.file_name,
                message: `Documento guardado en la historia de ${patient.name}.`,
            });
        }
    } catch (e) {
        console.error('[Telegram Save-To-Patient] Error:', e.message);
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

router.post('/telegram/process-text', async (req, res) => {
    const { message_text, chat_id, user_id } = req.body;
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const aiModel = req.app.locals.aiModel;

    if (!aiModel) {
        return res.status(500).json({ status: 'error', message: 'AI model not available' });
    }
    if (!message_text) {
        return res.status(400).json({ status: 'error', message: 'message_text is required' });
    }

    // ─── STEP 0: Check if this is an ACTION response to a pending file ───
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
            return res.json({ status: 'ok', response: discardMsg, action: 'discard', sent_to_telegram: true });
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
                    const saveRes = await fetch(`${req.protocol}://${req.get('host')}/api/telegram/save-to-patient`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id,
                            patient_id: matchedPatient.id,
                            save_type: actionType,
                            user_id,
                        }),
                    });
                    const saveData = await saveRes.json();

                    if (saveData.status === 'ok') {
                        const confirmMsg = `✅ ${saveData.message}\nTipo: ${actionType === 'session' ? 'Sesión clínica' : actionType === 'report' ? 'Informe' : 'Documento'}\nArchivo: ${saveData.file_name}`;
                        if (chat_id && TELEGRAM_BOT_TOKEN) {
                            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ chat_id, text: confirmMsg }),
                            }).catch(() => {});
                        }
                        return res.json({ status: 'ok', response: confirmMsg, action: 'saved', saved_to: matchedPatient.name, sent_to_telegram: true });
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
                    return res.json({ status: 'ok', response: errMsg, action: 'error', sent_to_telegram: true });
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
                return res.json({ status: 'ok', response: retryMsg, action: 'retry_patient', sent_to_telegram: true });
            }
        }
    }
    } catch (step0Err) {
        console.error('[Telegram Process-Text] STEP 0 error:', step0Err);
        // Don't return error here — fall through to STEP 1 for normal AI processing
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
        // Fetch clinical context from Supabase if user_id provided
        let clinicalContext = '';
        if (user_id) {
            try {
                const supabaseUrl = process.env.VITE_SUPABASE_URL;
                const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
                if (supabaseUrl && supabaseKey) {
                    // Get patients with more detail
                    const patientsRes = await fetch(`${supabaseUrl}/rest/v1/patients?professional_id=eq.${user_id}&select=id,name,diagnosis,age,notes,phone&limit=20`, {
                        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
                    });
                    const patients = await patientsRes.json();

                    // Get today's appointments with timing info
                    const today = now.toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }); // YYYY-MM-DD
                    const appsRes = await fetch(`${supabaseUrl}/rest/v1/appointments?professional_id=eq.${user_id}&date=eq.${today}&select=id,patient_name,date,time,status,type,duration,notes&order=time`, {
                        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
                    });
                    const appointments = await appsRes.json();

                    // Get upcoming appointments (next 7 days)
                    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                    const weekFromNowStr = weekFromNow.toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
                    const upcomingRes = await fetch(`${supabaseUrl}/rest/v1/appointments?professional_id=eq.${user_id}&date=gt=${today}&date=lte=${weekFromNowStr}&select=id,patient_name,date,time,status,type&order=date&limit=10`, {
                        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
                    });
                    const upcoming = await upcomingRes.json();

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
                            return `- ${a.time} hs: ${a.patient_name} — ${a.status || 'pending'}, ${a.type || 'consulta'} — ${timing}`;
                        }).join('\n');
                    } else {
                        clinicalContext += `\n\nAGENDA DE HOY: Sin citas programadas para hoy.`;
                    }

                    // Upcoming appointments
                    if (upcoming.length > 0) {
                        clinicalContext += `\n\nPRÓXIMOS 7 DÍAS:\n`;
                        clinicalContext += upcoming.map(a => `- ${a.date} ${a.time} hs: ${a.patient_name}`).join('\n');
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

        const clinicalPrompt = `Sos el asistente clínico de FonoAudio Pro AI, una plataforma profesional de fonoaudiología. Tenés acceso a datos reales de la agenda, pacientes y contexto del profesional.

═══ HORA ACTUAL (IMPORTANTE) ═══
Hoy es ${currentDate}.
Son las ${currentTime} hs (hora de Buenos Aires, Argentina).
Usá esta hora para interpretar correctamente la agenda: si una cita es a las 09:00 y ahora son las 00:30, esa cita AÚN NO LLEGÓ (faltan 8.5 horas).

═══ CONTEXTO CLÍNICO DEL PROFESIONAL ═══${clinicalContext || '\nNo hay contexto de pacientes disponible.'}
${pendingFileContext}
${notebookLmContext}

═══ MENSAJE DEL USUARIO ═══
${message_text}

═══ REGLAS DE RESPUESTA ═══
1. Respondé en español argentino profesional y cálido.
2. Sé conciso pero informativo (máx 5 oraciones).
3. SIEMPRE tené en cuenta la hora actual al interpretar la agenda.
4. Si te preguntan "¿qué pacientes tengo?", listá los de HOY con su hora y estado relativo.
5. Si una cita es a las 09:00 y son las 00:00, decí "tu primera cita es a las 09:00" (NO que ya pasó).
6. Si te piden info de un paciente específico, usá el contexto disponible.
7. Si detectás una consulta clínica fonoaudiológica, respondé con precisión técnica.
8. Si te piden crear turno/recordatorio, decí que lo procesás desde la app.
9. No inventés datos clínicos que no tengas.
10. Podés saludar, despedirte, o responder preguntas generales de forma amable.`;

        const parts = [{ text: clinicalPrompt }];
        const geminiResult = await callGeminiResilient(parts, aiModel, GEMINI_MODEL_CHAIN[0]);
        let aiResponse;

        if (geminiResult.ok) {
            aiResponse = geminiResult.text;
        } else {
            console.warn('[Process-Text] All Gemini models failed. Attempting Supabase fallback...');
            // Try degraded response from Supabase (no AI needed)
            const fallback = await getTextFallbackFromSupabase(message_text, user_id);
            if (fallback) {
                aiResponse = fallback;
            } else {
                aiResponse = `No pude generar una respuesta con IA (servicio temporalmente no disponible).\n\nPodés:\n• Consultar la agenda directamente desde la app\n• Revisar los pacientes en la sección Pacientes\n• Intentar de nuevo en unos minutos`;
            }
        }

        // Send response back via Telegram
        let sentToTelegram = false;
        sentToTelegram = await sendTelegramMessage(chat_id, aiResponse);

        res.json({
            status: 'ok',
            response: aiResponse,
            sent_to_telegram: sentToTelegram,
        });
    } catch (e) {
        console.error('[Telegram Process-Text] Error:', e.message);
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

        // Get upcoming appointments (pending, within next 2 hours)
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

            // Send reminder 30 minutes before
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
        res.json({ status: d.ok ? 'ok' : 'error', message: d.description });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

export default router;


