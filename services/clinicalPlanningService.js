import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

/** Corta un texto a N caracteres sin romper palabras cuando es posible. */
function truncate(text, max = 1500) {
    if (text == null) return '';
    const s = typeof text === 'string' ? text : JSON.stringify(text);
    if (s.length <= max) return s;
    const cut = s.lastIndexOf(' ', max);
    return (cut > max * 0.5 ? s.slice(0, cut) : s.slice(0, max)) + '…';
}

/** Resume una lista en líneas legibles con tope de ítems y caracteres. */
function summarizeList(items, maxItems = 8, maxChars = 1500) {
    if (!Array.isArray(items) || items.length === 0) return '';
    const lines = items.slice(0, maxItems).map((it, i) => {
        if (typeof it === 'string') return `- ${it}`;
        if (it && typeof it === 'object') {
            const label = it.testName || it.title || it.name || it.fact || it.category || `Ítem ${i + 1}`;
            const detail = it.score != null && it.maxScore != null
                ? ` (${it.score}/${it.maxScore})`
                : it.fact && it.evidence ? `: ${it.fact} (evidencia: ${it.evidence})` : '';
            return `- ${label}${detail}`;
        }
        return `- ${String(it)}`;
    });
    return truncate(lines.join('\n'), maxChars);
}

/** Fallback a Groq cuando Gemini falla o no hay API key de Google. */
async function generateWithGroqFallback(prompt, contextTexts) {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error('GROQ_API_KEY no configurada para fallback');
    const fullPrompt = `${prompt}\n\n${contextTexts.join('\n\n')}`;
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'qwen/qwen3-32b',
            messages: [
                { role: 'system', content: 'Sos un asistente fonoaudiológico experto. Respondés SOLO con el objeto JSON pedido, sin markdown ni texto adicional.' },
                { role: 'user', content: fullPrompt },
            ],
            max_tokens: 2500,
            temperature: 0.3,
        }),
    });
    if (!resp.ok) throw new Error(`Groq API error: ${resp.status}`);
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
}

/** Extrae el objeto JSON de una respuesta del LLM sin romper si viene con texto extra. */
function safeParseAnalysis(responseText, rawFallbackField = 'borrador_de_plan') {
    const cleaned = String(responseText || '').replace(/```json/g, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
        try {
            return { ok: true, parsed: JSON.parse(cleaned.slice(start, end + 1)) };
        } catch { /* cae al fallback */ }
    }
    return {
        ok: false,
        parsed: {
            motivo_de_consulta_resumido: 'No se pudo estructurar la respuesta del modelo.',
            datos_clinicos_relevantes: '',
            hipotesis_o_focos_de_trabajo: '',
            evaluaciones_o_baterias_sugeridas: [],
            que_observar_en_sesion: '',
            objetivos_inmediatos: [],
            materiales_necesarios: [],
            estructura_de_sesion_30_min: '',
            riesgos_o_alertas: [],
            preguntas_para_profundizar: [],
            [rawFallbackField]: cleaned.slice(0, 4000),
        },
    };
}

/**
 * Clinical Planning Service
 * Handles AI-assisted clinical reasoning based on patient data and documents.
 */
class ClinicalPlanningService {
    constructor() {
        this.supabase = null;
    }

    async _getSupabase() {
        if (!this.supabase) {
            const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
            const key = process.env.SUPABASE_SERVICE_ROLE_KEY
                || process.env.VITE_SUPABASE_ANON_KEY
                || process.env.SUPABASE_ANON_KEY;

            if (!url || !key) {
                throw new Error('Supabase credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are not configured in environment variables.');
            }

            this.supabase = createClient(url, key);
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
            const supabase = await this._getSupabase();

            // 1. Fetch Patient Data
            const { data: patient, error: pError } = await supabase
                .from('patients')
                .select('*')
                .eq('id', patientId)
                .single();

            if (pError || !patient) {
                throw new Error(`Patient not found: ${pError?.message || patientId}`);
            }

            // 2. Fetch Clinical Record (Ficha Clínica)
            let clinicalRecord = null;
            try {
                const { data: crData } = await supabase
                    .from('clinical_records')
                    .select('*')
                    .eq('patient_id', patientId)
                    .maybeSingle();
                clinicalRecord = crData;
            } catch {
                // clinical_records table may not exist yet
            }

            // 3. Fetch Anamnesis (tabla real: patient_anamnesis, última versión final o draft)
            let anamnesisData = null;
            try {
                const { data: anList } = await supabase
                    .from('patient_anamnesis')
                    .select('version, status, sections, notes, updated_at')
                    .eq('patient_id', patientId)
                    .order('version', { ascending: false })
                    .limit(2);
                const rows = anList || [];
                anamnesisData = rows.find(r => r.status === 'final') || rows[0] || null;
            } catch {
                // patient_anamnesis table may not exist yet
            }

            // 4. Fetch recent analysis history
            let analysisHistory = [];
            try {
                const { data: ahData } = await supabase
                    .from('analysis_history')
                    .select('*')
                    .eq('patient_id', patientId)
                    .order('timestamp', { ascending: false })
                    .limit(10);
                analysisHistory = ahData || [];
            } catch {
                // analysis_history table may not exist yet
            }

            // 4b. Fetch recent sessions (últimas 5, con objetivos y observaciones)
            let recentSessions = [];
            try {
                const { data: sData } = await supabase
                    .from('sessions')
                    .select('date, type, status, objectives, observations, summary, plan_updates, next_action, homework')
                    .eq('patient_id', patientId)
                    .order('date', { ascending: false })
                    .limit(5);
                recentSessions = sData || [];
            } catch {
                // sessions table may not exist yet
            }

            // 4c. Fetch unresolved clinical facts (hechos objetivos ya extraídos)
            let clinicalFacts = [];
            try {
                const { data: fData } = await supabase
                    .from('clinical_facts')
                    .select('category, fact, evidence, confidence')
                    .eq('patient_id', patientId)
                    .eq('isResolved', false)
                    .order('created_at', { ascending: false })
                    .limit(15);
                clinicalFacts = fData || [];
            } catch {
                // clinical_facts table may not exist yet
            }

            // 4d. Fetch standardized test results
            let testResults = [];
            try {
                const { data: tData } = await supabase
                    .from('test_results')
                    .select('*')
                    .eq('patient_id', patientId)
                    .order('created_at', { ascending: false })
                    .limit(10);
                testResults = tData || [];
            } catch {
                // test_results table may not exist yet
            }

            // 5. Prepare the context
            let contextParts = [];
            
            // Structured data (con truncado para no exceder la ventana del modelo)
            const plan = patient.treatmentPlan || {};
            const planSummary = plan.summary || plan.strategies || plan.general || '';
            contextParts.push({
                text: `[DATOS DEL PACIENTE]
Nombre: ${patient.name}
Edad: ${patient.age ?? 'N/D'} años
Diagnóstico: ${patient.diagnosis || 'En evaluación'}
Teléfono: ${patient.phone || 'N/D'} | Email: ${patient.email || 'N/D'}
Notas: ${truncate(patient.notes || 'Sin notas', 800)}
Historial (resumen en ficha): ${truncate(patient.history || [], 800)}
Evaluaciones estandarizadas:
${summarizeList(patient.evaluations || [], 10, 1200) || '(sin evaluaciones cargadas)'}
Plan de tratamiento actual: ${truncate(typeof planSummary === 'string' ? planSummary : JSON.stringify(planSummary), 1200) || '(sin plan)'}
Frecuencia: ${plan.frequency || 'N/D'}
Alertas: ${Array.isArray(patient.alerts) ? patient.alerts.join(', ') : (patient.alerts || 'Ninguna')}`
            });

            // Clinical Record (Ficha Clínica) - datos ricos
            if (clinicalRecord) {
                const crParts = [`[FICHA CLÍNICA]`];
                if (clinicalRecord.chief_complaint) crParts.push(`Motivo de consulta: ${clinicalRecord.chief_complaint}`);
                if (clinicalRecord.chief_complaint_onset) crParts.push(`Cronología del motivo: ${clinicalRecord.chief_complaint_onset}`);
                if (clinicalRecord.primary_diagnosis_name) crParts.push(`Diagnóstico principal: ${clinicalRecord.primary_diagnosis_name} (${clinicalRecord.primary_diagnosis_code || 'sin código'})`);
                if (clinicalRecord.secondary_diagnosis_codes?.length) crParts.push(`Diagnósticos secundarios: ${clinicalRecord.secondary_diagnosis_codes.join(', ')}`);
                if (clinicalRecord.personal_history && Object.keys(clinicalRecord.personal_history).length > 0) {
                    crParts.push(`Antecedentes personales: ${JSON.stringify(clinicalRecord.personal_history)}`);
                }
                if (clinicalRecord.family_history && Object.keys(clinicalRecord.family_history).length > 0) {
                    crParts.push(`Antecedentes familiares: ${JSON.stringify(clinicalRecord.family_history)}`);
                }
                if (clinicalRecord.medical_history && Object.keys(clinicalRecord.medical_history).length > 0) {
                    crParts.push(`Historial médico: ${JSON.stringify(clinicalRecord.medical_history)}`);
                }
                if (clinicalRecord.developmental_history && Object.keys(clinicalRecord.developmental_history).length > 0) {
                    crParts.push(`Historial del desarrollo: ${JSON.stringify(clinicalRecord.developmental_history)}`);
                }
                if (clinicalRecord.clinical_observations) crParts.push(`Observaciones clínicas: ${clinicalRecord.clinical_observations}`);
                if (clinicalRecord.affected_areas?.length) {
                    const affected = clinicalRecord.affected_areas.filter(a => a.affected);
                    if (affected.length > 0) {
                        crParts.push(`Áreas afectadas: ${affected.map(a => `${a.name} (${a.level || 'no especificado'})`).join(', ')}`);
                    }
                }
                contextParts.push({ text: crParts.join('\n') });
            }

            // Anamnesis - tabla real patient_anamnesis {version, status, sections, notes}
            if (anamnesisData) {
                const anParts = [`[ANAMNESIS v${anamnesisData.version ?? '?'} (${anamnesisData.status || 's/estado'})]`];
                const sections = anamnesisData.sections || {};
                if (typeof sections === 'string') {
                    if (sections.trim()) anParts.push(truncate(sections, 2000));
                } else if (typeof sections === 'object') {
                    for (const [key, value] of Object.entries(sections)) {
                        if (value == null || value === '' || (typeof value === 'object' && Object.keys(value).length === 0)) continue;
                        const rendered = typeof value === 'string' ? value : JSON.stringify(value);
                        if (rendered && rendered !== '{}' && rendered !== '[]') {
                            anParts.push(`${key}: ${truncate(rendered, 600)}`);
                        }
                    }
                }
                if (anamnesisData.notes) anParts.push(`Notas de anamnesis: ${truncate(anamnesisData.notes, 600)}`);
                if (anParts.length > 1) contextParts.push({ text: anParts.join('\n') });
            }

            // Sesiones recientes - qué se trabajó y qué sigue
            if (recentSessions.length > 0) {
                const sParts = [`[ÚLTIMAS SESIONES (${recentSessions.length})]`];
                for (const s of recentSessions) {
                    const bits = [`Fecha: ${s.date || 's/fecha'} (${s.type || 'sesión'}, ${s.status || ''})`];
                    if (s.objectives) bits.push(`Objetivos: ${truncate(s.objectives, 400)}`);
                    if (s.observations) bits.push(`Observaciones: ${truncate(s.observations, 500)}`);
                    if (s.summary) bits.push(`Resumen: ${truncate(s.summary, 400)}`);
                    if (s.plan_updates) bits.push(`Ajustes al plan: ${truncate(s.plan_updates, 300)}`);
                    if (s.next_action) bits.push(`Próximo paso: ${truncate(s.next_action, 300)}`);
                    if (s.homework) bits.push(`Tarea hogar: ${truncate(s.homework, 300)}`);
                    sParts.push(`\n• ${bits.join(' | ')}`);
                }
                contextParts.push({ text: sParts.join('\n') });
            }

            // Hechos clínicos ya validados por el sistema
            if (clinicalFacts.length > 0) {
                contextParts.push({
                    text: `[HECHOS CLÍNICOS VALIDADOS]\n${summarizeList(clinicalFacts, 15, 1500)}`,
                });
            }

            // Tests estandarizados (tabla test_results)
            if (testResults.length > 0) {
                contextParts.push({
                    text: `[TESTS ESTANDARIZADOS]\n${summarizeList(testResults, 10, 1500)}`,
                });
            }

            // Analysis History - tendencia
            if (analysisHistory.length > 0) {
                const ahParts = [`[HISTORIAL DE ANÁLISIS - TENDENCIA]`];
                for (const ah of analysisHistory) {
                    ahParts.push(`- ${new Date(ah.timestamp).toLocaleDateString()}: Riesgo=${ah.risk_level}, Acción=${ah.action_level}, Módulo=${ah.module}`);
                }
                contextParts.push({ text: ahParts.join('\n') });
            }

            // 5. Fetch OCR-extracted documents from patient_documents table
            let patientDocuments = [];
            try {
                const { data: docsData } = await supabase
                    .from('patient_documents')
                    .select('file_name, ocr_text, document_category, extracted_data')
                    .eq('patient_id', patientId)
                    .not('ocr_text', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(10);
                patientDocuments = docsData || [];
            } catch {
                // patient_documents table may not exist yet
            }

            if (patientDocuments.length > 0) {
                const docParts = [`[DOCUMENTOS ESCANEADOS - INFORMES ORL Y ESTUDIOS]`];
                for (const doc of patientDocuments) {
                    const category = doc.document_category ? `[${doc.document_category}]` : '';
                    docParts.push(`\n--- ${doc.file_name} ${category} ---`);
                    if (doc.ocr_text) {
                        docParts.push(doc.ocr_text);
                    }
                    if (doc.extracted_data && Object.keys(doc.extracted_data).length > 0) {
                        const extracted = doc.extracted_data;
                        const fields = [];
                        if (extracted.diagnosis) fields.push(`Diagnóstico: ${extracted.diagnosis}`);
                        if (extracted.patientName) fields.push(`Paciente: ${extracted.patientName}`);
                        if (extracted.age) fields.push(`Edad: ${extracted.age}`);
                        if (extracted.medications?.length) fields.push(`Medicación: ${extracted.medications.join(', ')}`);
                        if (extracted.testResults?.length) {
                            fields.push(`Resultados: ${extracted.testResults.map(t => `${t.testName}: ${t.value}`).join(', ')}`);
                        }
                        if (extracted.observations) fields.push(`Observaciones: ${extracted.observations}`);
                        if (fields.length > 0) {
                            docParts.push(`[Datos estructurados]: ${fields.join(' | ')}`);
                        }
                    }
                }
                contextParts.push({ text: docParts.join('\n') });
            }

            // 3. Handle Documents (OCR via Gemini)
            if (patient.documents && patient.documents.length > 0) {
                contextParts.push({ text: "[DOCUMENT CONTEXT]" });
                for (const doc of patient.documents) {
                    if (doc.content && doc.mimeType) {
                        // If it's base64 content or a URL, we handle it.
                        // For this prototype, we assume doc.content is base64 if it's an image/pdf
                        contextParts.push({
                            inlineData: {
                                mimeType: doc.mimeType,
                                data: doc.content // Assumes doc.content is base64 string
                            }
                        });
                        contextParts.push({ text: `[End of Document: ${doc.name}]` });
                    }
                }
            }

            // 4. The Master Prompt
            const prompt = `
            Sos un asistente clínico altamente experimentado y profesional, especializado en Fonoaudiología.
            Tu tarea es realizar un análisis de razonamiento clínico profundo para el paciente descrito arriba.
            
            CONTEXTO DISPONIBLE (usá TODO lo que venga a continuación, no solo el diagnóstico):
            Tenés acceso a:
            - Datos estructurados del paciente (incluye evaluaciones estandarizadas, plan de tratamiento vigente y alertas)
            - Ficha Clínica completa (motivo de consulta, antecedentes, áreas afectadas, observaciones)
            - Anamnesis versionada (secciones + notas)
            - Últimas sesiones (objetivos trabajados, observaciones, ajustes al plan, tarea para el hogar)
            - Hechos clínicos validados y tests estandarizados
            - Historial de análisis previos (tendencia de riesgo)
            - Documentos escaneados: informes ORL, audiometrías, ecografías, análisis de laboratorio, etc. (con texto OCR extraído)
            - Documentos adjuntos (imágenes, PDFs)

            MISIÓN:
            Analizá TODA la información disponible para proveer un razonamiento clínico profesional, prudente y basado en evidencia.
            NO inventes diagnósticos. En cambio, sugerí hipótesis basadas en la evidencia disponible.
            PRIORIZÁ la información de la Ficha Clínica, la Anamnesis y las últimas sesiones para fundamentar tus respuestas.
            CITÁ datos concretos del contexto (ej: "en la sesión del 12/08 se observó...", "las evaluaciones muestran...").
            Si una sección del contexto viene vacía, indicalo en "preguntas_para_profundizar" en lugar de inventar.
            
            FORMATO DE SALIDA:
            Deberías responder SOLO con un objeto JSON válido. No incluyas backticks de markdown ni texto adicional.
            La estructura del JSON debe ser exactamente la siguiente:
            {
              "motivo_de_consulta_resumido": "Resumen conciso del motivo de consulta basado en la ficha clínica y anamnesis.",
              "datos_clinicos_relevantes": "Hallazgos clave de la ficha clínica, áreas afectadas y antecedentes relevantes.",
              "hipotesis_o_focos_de_trabajo": "Hipótesis clínicas o áreas específicas de trabajo basadas en el diagnóstico y las áreas afectadas.",
              "evaluaciones_o_baterias_sugeridas": ["Sugerencia 1", "Sugerencia 2", ...],
              "que_observar_en_sesion": "Comportamientos o marcadores lingüísticos específicos a monitorear en sesión, basados en el motivo y áreas afectadas.",
              "objetivos_inmediatos": ["Objetivo inmediato 1", "Objetivo inmediato 2", ...],
              "materiales_necesarios": ["Material necesario 1", "Material necesario 2", ...],
              "estructura_de_sesion_30_min": "Esquema breve de sesión (ej: 1. Calentamiento (5m), 2. Tarea principal (20m), 3. Cierre (5m)).",
              "riesgos_o_alertas": ["Riesgo o alerta 1", "Riesgo o alerta 2", ...],
              "preguntas_para_profundizar": ["Pregunta para la familia", "Pregunta para el paciente", ...],
              "borrador_de_plan": "Borrador de plan de tratamiento estructurado, listo para que el profesional revise y edite."
            }

            DIRECTRICES:
            - Sé clínico, profesional y prudente.
            - Si falta información, no adivines; en cambio, sugiere en "preguntas_para_profundizar" o "evaluaciones_o_baterias_sugeridas".
            - Idioma: Español (Español).
            - El "borrador_de_plan" debe ser altamente accionable y estar basado en las áreas afectadas y el diagnóstico.
            - Referencianá datos específicos de la ficha clínica cuando los haya (ej: "Según el motivo de consulta:...", "Dado que las áreas afectadas son...").
            `;

            // 5. Generate Content (Gemini primero, Groq como fallback)
            const contextTexts = contextParts.map(p => (p && p.text ? p.text : '')).filter(Boolean);
            let responseText = '';
            let engine = 'gemini-2.0-flash';
            try {
                if (!process.env.GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY no configurada');
                const result = await model.generateContent([prompt, ...contextParts]);
                responseText = result.response.text();
            } catch (geminiError) {
                console.warn('[ClinicalPlanningService] Gemini falló, probando Groq:', geminiError.message);
                responseText = await generateWithGroqFallback(prompt, contextTexts);
                engine = 'groq-fallback';
            }

            // Parseo seguro: nunca rompe aunque el modelo devuelva texto extra
            const { ok, parsed: jsonAnalysis } = safeParseAnalysis(responseText);
            if (!ok) console.warn('[ClinicalPlanningService] Respuesta no-JSON, se devuelve texto crudo en borrador_de_plan.');

            return {
                status: 'ok',
                engine,
                contextSources: {
                    sessions: recentSessions.length,
                    clinicalFacts: clinicalFacts.length,
                    testResults: testResults.length,
                    documents: patientDocuments.length,
                    hasClinicalRecord: !!clinicalRecord,
                    hasAnamnesis: !!anamnesisData,
                },
                analysis: jsonAnalysis
            };

        } catch (error) {
            console.error('[ClinicalPlanningService] Error:', error);
            return {
                status: 'error',
                message: error.message
            };
        }
    }
}

export default new ClinicalPlanningService();
