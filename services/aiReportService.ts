import { Patient } from '../types';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || import.meta.env.GROQ_API_KEY;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GOOGLE_API_KEY;

export interface GenerateOptions {
    prompt: string;
    context?: string;
    patientName?: string;
    patientAge?: number;
    patientDiagnosis?: string;
    section?: string;
    tone?: 'formal' | 'tecnico' | 'familiar';
    maxLength?: number;
    /** Full patient object for rich clinical context */
    patient?: Patient;
    /** Report template title (e.g. "Informe de Valoración Fonoaudiológica") */
    reportType?: string;
    /** Current section being edited */
    currentSection?: string;
}

async function callGroq(prompt: string, systemPrompt: string): Promise<string> {
    if (!GROQ_API_KEY) throw new Error('Groq API key not configured');
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2048,
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Groq error: ${err}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
}

async function callGemini(prompt: string, systemPrompt: string): Promise<string> {
    if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured');

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
            }),
        }
    );

    if (!response.ok) throw new Error('Gemini API error');
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function generateWithFallback(prompt: string, systemPrompt: string, options?: GenerateOptions): Promise<string> {
    try {
        return await callGroq(prompt, systemPrompt);
    } catch (groqError) {
        console.warn('[AI Report] Groq failed, trying Gemini:', groqError);
        try {
            return await callGemini(prompt, systemPrompt);
        } catch (geminiError) {
            console.error('[AI Report] Both AI providers failed:', geminiError);
            throw new Error('No se pudo generar el contenido con IA. Verificá la configuración de las claves API (GROQ_API_KEY o GOOGLE_API_KEY).');
        }
    }
}

/**
 * Build a rich clinical context string from all available patient data.
 * This enables the AI to generate paragraphs that are deeply grounded
 * in the actual clinical findings.
 */
function buildClinicalContext(patient?: Patient, reportType?: string): string {
    if (!patient) return '';

    const parts: string[] = [];

    parts.push(`[DATOS DEL PACIENTE]`);
    parts.push(`Nombre: ${patient.name}`);
    parts.push(`Edad: ${patient.age} años`);
    if (patient.date_of_birth) parts.push(`Fecha de nacimiento: ${patient.date_of_birth}`);
    if (patient.gender) parts.push(`Sexo: ${patient.gender}`);
    parts.push(`Documento: ${patient.document || 'No informado'}`);
    if (patient.responsable) parts.push(`Responsable: ${patient.responsable}`);
    if (patient.obra_social) parts.push(`Obra social: ${patient.obra_social}`);
    if ((patient as any).derivante) parts.push(`Profesional derivante: ${(patient as any).derivante}`);

    if (patient.diagnosis) {
        parts.push(`\n[DIAGNÓSTICO]`);
        parts.push(patient.diagnosis);
    }

    if (patient.anamnesis) {
        parts.push(`\n[ANAMNESIS]`);
        const a = typeof patient.anamnesis === 'string' ? patient.anamnesis : JSON.stringify(patient.anamnesis, null, 2);
        parts.push(a.substring(0, 1500));
    }

    if (patient.notes) {
        parts.push(`\n[OBSERVACIONES CLÍNICAS]`);
        parts.push(patient.notes.substring(0, 500));
    }

    if (patient.history && patient.history.length > 0) {
        parts.push(`\n[HISTORIAL DE SESIONES (${patient.history.length} total)]`);
        const recentSessions = patient.history.slice(0, 5);
        recentSessions.forEach((s, i) => {
            parts.push(`Sesión ${i + 1} (${s.date}): ${s.summary || s.observations || 'Sin resumen'}`);
            if (s.objectives) parts.push(`  Objetivos: ${s.objectives}`);
            if (s.nextAction) parts.push(`  Próxima acción: ${s.nextAction}`);
            if (s.planUpdates) parts.push(`  Actualización del plan: ${s.planUpdates}`);
        });
    }

    if (patient.evaluations && patient.evaluations.length > 0) {
        parts.push(`\n[EVALUACIONES REALIZADAS]`);
        patient.evaluations.forEach(ev => {
            const pct = ev.maxScore > 0 ? Math.round((ev.score / ev.maxScore) * 100) : 0;
            parts.push(`- ${ev.testName}: ${ev.score}/${ev.maxScore} (${pct}%) - ${ev.date}`);
            if (ev.details) {
                const d = typeof ev.details === 'string' ? ev.details : JSON.stringify(ev.details);
                parts.push(`  Detalles: ${d.substring(0, 300)}`);
            }
        });
    }

    if (patient.treatmentPlan) {
        parts.push(`\n[PLAN DE TRATAMIENTO ACTUAL]`);
        if (patient.treatmentPlan.general) parts.push(`General: ${patient.treatmentPlan.general}`);
        if (patient.treatmentPlan.specific?.length > 0) parts.push(`Objetivos específicos: ${patient.treatmentPlan.specific.join('; ')}`);
        if (patient.treatmentPlan.strategies) parts.push(`Estrategias: ${patient.treatmentPlan.strategies}`);
    }

    if (reportType) {
        parts.push(`\n[TIPO DE INFORME]`);
        parts.push(reportType);
    }

    return parts.join('\n');
}

export const aiReportService = {

    /**
     * Generate text for a section using ALL available patient data.
     * The AI receives full clinical context and generates paragraphs
     * that reference specific findings from evaluations, sessions, anamnesis, etc.
     */
    async generateSectionText(options: GenerateOptions): Promise<string> {
        const { prompt, patientName, patientAge, patientDiagnosis, section, tone = 'formal', patient, reportType } = options;

        const clinicalCtx = buildClinicalContext(patient, reportType);

        const systemPrompt = `Sos un fonoaudiólogo experto en redacción de informes clínicos profesionales.
Tu tarea es generar texto para la sección "${section || 'General'}" de un informe de fonoaudiología.

REGLAS ESTRICTAS:
- Usá terminología clínica fonoaudiológica precisa y actualizada.
- El texto debe ser formal, impersonal y en tercera persona.
- Referenciar datos específicos del paciente (evaluaciones, puntuaciones, historial) cuando estén disponibles.
- Si hay evaluaciones con puntajes, mencionar los resultados concretos (ej: "obtuvo un puntaje de X/Y, lo que corresponde al Z%").
- Si hay sesiones previas, mencionar avances o dificultades observadas.
- Si hay anamnesis, integrar la información del motivo de consulta y antecedentes.
- NO inventar datos clínicos que no estén en el contexto.
- Respondé SOLO con el texto para el informe, sin explicaciones ni encabezados.

TONO: ${tone === 'formal' ? 'formal y profesional médico' : tone === 'tecnico' ? 'técnico-científico con terminología especializada' : 'claro y accesible para familias'}.

CONTEXTO CLÍNICO COMPLETO:
${clinicalCtx}

INSTRUCCIÓN ESPECÍFICA PARA ESTA SECCIÓN:
${prompt}`;

        return await generateWithFallback(prompt, systemPrompt, options);
    },

    /**
     * Improve existing text using clinical context for accuracy.
     */
    async improveText(text: string, patientName?: string, patient?: Patient): Promise<string> {
        const clinicalCtx = buildClinicalContext(patient);

        const systemPrompt = `Mejorá este texto para un informe fonoaudiológico profesional.
Corregí gramática, mejorá la estructura, hacelo más clínico y profesional.
Si el texto menciona datos del paciente, verificá que sean consistentes con el contexto clínico proporcionado.
Respondé SOLO con el texto mejorado.
Paciente: ${patientName || 'N/A'}.

CONTEXTO CLÍNICO:
${clinicalCtx || 'No disponible'}`;

        return await generateWithFallback(text, systemPrompt);
    },

    /**
     * Suggest blocks for a section based on the patient's actual clinical data.
     * Each block is grounded in real findings (evaluations, sessions, anamnesis).
     */
    async suggestBlocks(sectionTitle: string, patient?: Patient, reportType?: string): Promise<string[]> {
        const clinicalCtx = buildClinicalContext(patient, reportType);

        const systemPrompt = `Sos un fonoaudiólogo experto. Generá 3-4 párrafos profesionales (3-5 oraciones cada uno) para la sección "${sectionTitle}" de un informe fonoaudiológico.

REGLAS:
- Cada párrafo debe estar basado en datos REALES del paciente (evaluaciones, sesiones, anamnesis).
- Si hay evaluaciones con puntajes, incluir resultados numéricos concretos.
- Si hay historial de sesiones, mencionar avances o dificultades observadas.
- Cada párrafo debe ser autocontenido y utilizable directamente en el informe.
- Formato HTML simplificado: solo <p>, <strong>, <em>, <ul>, <li>.
- Respondé con un JSON array de strings, solo el JSON.

CONTEXTO CLÍNICO COMPLETO:
${clinicalCtx}

Ejemplo de respuesta:
["<p>Primer párrafo con datos del paciente...</p>", "<p>Segundo párrafo con más información...</p>"]`;

        const result = await generateWithFallback(
            `Bloques para "${sectionTitle}"`,
            systemPrompt
        );

        try {
            const cleaned = result.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            return Array.isArray(parsed) ? parsed : [result];
        } catch {
            return [result];
        }
    },

    /**
     * Complete partial text using clinical context.
     */
    async completeText(partialText: string, sectionContext: string, patient?: Patient): Promise<string> {
        const clinicalCtx = buildClinicalContext(patient);

        const systemPrompt = `Completá este texto de informe fonoaudiológico de manera coherente y profesional.
Sección: ${sectionContext}.
Continuá el texto manteniendo el mismo estilo y nivel de detalle clínico.
Referenciá datos del paciente cuando sea relevante.
Respondé SOLO con el texto completo, sin explicaciones.

CONTEXTO CLÍNICO:
${clinicalCtx || 'No disponible'}`;

        return await generateWithFallback(partialText, systemPrompt);
    },

    /**
     * Change tone while preserving clinical accuracy.
     */
    async changeTone(text: string, targetTone: 'formal' | 'tecnico' | 'familiar'): Promise<string> {
        const toneDesc = targetTone === 'formal' 
            ? 'formal y profesional médico, impersonal, en tercera persona' 
            : targetTone === 'tecnico' 
                ? 'técnico-científico con terminología fonoaudiológica especializada'
                : 'claro y accesible para familias, sin jerga técnica innecesaria';

        const systemPrompt = `Reescribí este texto con un tono ${toneDesc}.
Mantené TODA la información clínica intacta (nombres, puntajes, fechas, diagnósticos).
No agregues ni quites información clínica.
Respondé SOLO con el texto reescrito.`;

        return await generateWithFallback(text, systemPrompt);
    },

    /**
     * Generate a FULL report using all patient data.
     * Returns sections as a JSON object.
     */
    async generateFullReport(patientData: {
        name: string;
        age?: number;
        diagnosis?: string;
        history?: any[];
        clinicalRecord?: any;
        evaluations?: any[];
        anamnesis?: any;
        notes?: string;
        treatmentPlan?: any;
    }, reportType: string): Promise<Record<string, string>> {
        const systemPrompt = `Sos un fonoaudiólogo experto. Generá un informe fonoaudiológico COMPLETO tipo "${reportType}".
Usá TODA la información del paciente disponible (anamnesis, evaluaciones, sesiones, plan de tratamiento).
El informe debe seguir la estructura profesional estándar.

DATOS DEL PACIENTE:
Nombre: ${patientData.name}${patientData.age ? `, ${patientData.age} años` : ''}${patientData.diagnosis ? `, Dx: ${patientData.diagnosis}` : ''}.
${patientData.anamnesis ? `Anamnesis: ${JSON.stringify(patientData.anamnesis)}` : ''}
${patientData.evaluations?.length ? `Evaluaciones: ${JSON.stringify(patientData.evaluations)}` : ''}
${patientData.history?.length ? `Sesiones recientes: ${JSON.stringify(patientData.history.slice(0, 5))}` : ''}
${patientData.clinicalRecord ? `Ficha clínica: ${JSON.stringify(patientData.clinicalRecord)}` : ''}
${patientData.notes ? `Observaciones: ${patientData.notes}` : ''}
${patientData.treatmentPlan ? `Plan de tratamiento: ${JSON.stringify(patientData.treatmentPlan)}` : ''}

Respondé SOLO con un JSON válido con las secciones como keys y el texto como values.
Ejemplo: {"motivo_consulta": "<p>...</p>", "antecedentes": "<p>...</p>", "evaluacion": "<p>...</p>", "impresion_diagnostica": "<p>...</p>", "pronostico": "<p>...</p>", "recomendaciones": "<p>...</p>"}`;

        const result = await generateWithFallback(
            `Informe completo para ${patientData.name}`,
            systemPrompt
        );

        try {
            const cleaned = result.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        } catch {
            return { contenido: result };
        }
    }
};
