import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
            const url = process.env.VITE_SUPABASE_URL;
            const key = process.env.VITE_SUPABASE_ANON_KEY;

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

            // 3. Fetch Anamnesis
            let anamnesisData = null;
            try {
                const { data: anData } = await supabase
                    .from('anamnesis')
                    .select('*')
                    .eq('patient_id', patientId)
                    .maybeSingle();
                anamnesisData = anData;
            } catch {
                // anamnesis table may not exist yet
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

            // 5. Prepare the context
            let contextParts = [];
            
            // Structured data
            contextParts.push({
                text: `[DATOS DEL PACIENTE]
Nombre: ${patient.name}
Edad: ${patient.age} años
Diagnóstico: ${patient.diagnosis}
Notas: ${patient.notes || 'Sin notas'}
Historial de sesiones: ${JSON.stringify(patient.history || [])}
Evaluaciones: ${JSON.stringify(patient.evaluations || [])}
Plan de tratamiento actual: ${JSON.stringify(patient.treatmentPlan || {})}
Alertas: ${patient.alerts?.join(', ') || 'Ninguna'}`
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

            // Anamnesis - datos ricos
            if (anamnesisData) {
                const anParts = [`[ANAMNESIS]`];
                if (anamnesisData.chief_complaint) anParts.push(`Motivo de consulta (anamnesis): ${anamnesisData.chief_complaint}`);
                if (anamnesisData.personal_history) {
                    const ph = typeof anamnesisData.personal_history === 'string' 
                        ? anamnesisData.personal_history 
                        : JSON.stringify(anamnesisData.personal_history);
                    anParts.push(`Historia personal: ${ph}`);
                }
                if (anamnesisData.family_history) {
                    const fh = typeof anamnesisData.family_history === 'string'
                        ? anamnesisData.family_history
                        : JSON.stringify(anamnesisData.family_history);
                    anParts.push(`Historia familiar: ${fh}`);
                }
                contextParts.push({ text: anParts.join('\n') });
            }

            // Analysis History - tendencia
            if (analysisHistory.length > 0) {
                const ahParts = [`[HISTORIAL DE ANÁLISIS - TENDENCIA]`];
                for (const ah of analysisHistory) {
                    ahParts.push(`- ${new Date(ah.timestamp).toLocaleDateString()}: Riesgo=${ah.risk_level}, Acción=${ah.action_level}, Módulo=${ah.module}`);
                }
                contextParts.push({ text: ahParts.join('\n') });
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
            
            CONTEXTO DISPONIBLE:
            Tenés acceso a:
            - Datos estructurados del paciente (nombre, edad, diagnóstico)
            - Ficha Clínica completa (motivo de consulta, antecedentes, áreas afectadas, observaciones)
            - Anamnesis (historia personal y familiar)
            - Historial de análisis previos (tendencia de riesgo)
            - Documentos adjuntos (imágenes, PDFs)
            
            MISIÓN:
            Analizá TODA la información disponible para proveer un razonamiento clínico profesional, prudente y basado en evidencia.
            NO inventes diagnósticos. En cambio, sugerí hipótesis basadas en la evidencia disponible.
            PRIORIZÁ la información de la Ficha Clínica y la Anamnesis para fundamentar tus respuestas.
            
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

            // 5. Generate Content
            const result = await model.generateContent([prompt, ...contextParts]);
            const responseText = result.response.text();
            
            // Clean potential markdown from Gemini response
            const cleanedResponse = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const jsonAnalysis = JSON.parse(cleanedResponse);

            return {
                status: 'ok',
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
