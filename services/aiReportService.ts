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
    patient?: Patient;
    reportType?: string;
    currentSection?: string;
    sectionDescription?: string;
    existingContent?: string;
}

async function callGroq(prompt: string, systemPrompt: string): Promise<string> {
    if (!GROQ_API_KEY) throw new Error('Groq API key not configured');
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            temperature: 0.4,
            max_tokens: 4096,
        }),
    });
    if (!response.ok) throw new Error(`Groq error: ${await response.text()}`);
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
                generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
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
            console.error('[AI Report] Both providers failed:', geminiError);
            throw new Error('No se pudo generar con IA. Verificá GROQ_API_KEY o GOOGLE_API_KEY.');
        }
    }
}

// ══════════════════════════════════════════════════════════════
// CONTEXTO CLÍNICO LEGAL — Manual PBA + Elena Zegarra
// ══════════════════════════════════════════════════════════════

const LEGAL_FRAMEWORK = `
═══ MARCO LEGAL Y NORMATIVO (Provincia de Buenos Aires) ═══
- Ley 15.052: Ejercicio profesional de Fonoaudiología. Diagnóstico DEBE ser funcional, NO médico.
- CIE-11 (OMS): Usar códigos de trastornos funcionales fonoaudiológicos (ej: DA04.0 Trastorno del desarrollo de la articulación fonológica).
- Diferenciar SIEMPRE: "La madre refiere..." (dato anamnésico) vs. "Se observa/Se evidencia..." (hallazgo clínico objetivo).
- Copia de historia clínica: Plazo máximo 48hs.
- Membrét, firma, aclaración y matrícula CFPBA son obligatorios.
- NO incluir diagnósticos médicos (ej: "autismo", "TDAH", "epilepsia") en un informe fonoaudiológico. Usar: "Trastorno del neurodesarrollo" o "Alteración funcional del lenguaje".

═══ ESTILO CLÍNICO (Elena Zegarra — Taller Creación de Informes) ═══
- Toque personal OBLIGATORIO: Incluir conducta del paciente, motivaciones, ejemplos concretos de su habla.
- Ejemplo concreto: "En la tarea de repetición de sílabas directas, el paciente presentó: /pa/ → [ta], /ta/ → [ka], mostrando un proceso de sustitución velar."
- Lenguaje comprensible para la familia, traducir tecnicismos entre paréntesis.
- Estructura: Motivo → Antecedentes → Evaluación → Impresión Diagnóstica → Pronóstico → Objetivos → Recomendaciones.
`;

// ══════════════════════════════════════════════════════════════
// BUILDER DE CONTEXTO CLÍNICO COMPLETO
// ══════════════════════════════════════════════════════════════

function buildClinicalContext(patient?: Patient, reportType?: string): string {
    if (!patient) return '';

    const parts: string[] = [];

    // Datos demográficos completos
    parts.push(`═══ FICHA DEL PACIENTE ═══`);
    parts.push(`Nombre completo: ${patient.name}`);
    parts.push(`Edad cronológica: ${patient.age} años`);
    if (patient.date_of_birth) parts.push(`Fecha de nacimiento: ${patient.date_of_birth}`);
    if (patient.gender) parts.push(`Sexo/género: ${patient.gender}`);
    parts.push(`DNI: ${patient.document || 'No informado'}`);
    if (patient.responsable) parts.push(`Responsable/legal: ${patient.responsable}`);
    if (patient.obra_social) parts.push(`Obra social: ${patient.obra_social}`);
    if ((patient as any).derivante) parts.push(`Profesional derivante: ${(patient as any).derivante}`);
    if (patient.address) parts.push(`Domicilio: ${patient.address}`);
    if (patient.phone) parts.push(`Teléfono: ${patient.phone}`);

    // Diagnóstico funcional actual
    if (patient.diagnosis) {
        parts.push(`\n═══ DIAGNÓSTICO FUNCIONAL ACTUAL ═══`);
        parts.push(patient.diagnosis);
    }

    // Anamnesis completa
    if (patient.anamnesis) {
        parts.push(`\n═══ ANAMNESIS COMPLETA ═══`);
        const a = patient.anamnesis;
        if (typeof a === 'string') {
            parts.push(a.substring(0, 2000));
        } else if (a.sections) {
            // Structured format from AdaptiveAnamnesisForm
            Object.entries(a.sections).forEach(([key, val]) => {
                if (val && typeof val === 'string') parts.push(`${key}: ${val}`);
                else if (val && typeof val === 'object') {
                    Object.entries(val).forEach(([k, v]) => {
                        if (v) parts.push(`${key}.${k}: ${String(v).substring(0, 300)}`);
                    });
                }
            });
        } else {
            parts.push(JSON.stringify(a, null, 2).substring(0, 2000));
        }
    }

    // Observaciones clínicas
    if (patient.notes) {
        parts.push(`\n═══ OBSERVACIONES CLÍNICAS ═══`);
        parts.push(patient.notes.substring(0, 800));
    }

    // Historial de sesiones (detallado)
    if (patient.history && patient.history.length > 0) {
        parts.push(`\n═══ HISTORIAL DE SESIONES (${patient.history.length} total, últimas 5) ═══`);
        patient.history.slice(0, 5).forEach((s, i) => {
            parts.push(`Sesión ${i + 1} (${s.date}):`);
            if (s.summary) parts.push(`  Resumen: ${s.summary}`);
            if (s.observations) parts.push(`  Observaciones: ${s.observations}`);
            if (s.objectives) parts.push(`  Objetivos trabajados: ${s.objectives}`);
            if (s.nextAction) parts.push(`  Próxima acción: ${s.nextAction}`);
            if (s.planUpdates) parts.push(`  Actualización del plan: ${s.planUpdates}`);
        });
    }

    // Evaluaciones estandarizadas (CRÍTICO para diagnóstico)
    if (patient.evaluations && patient.evaluations.length > 0) {
        parts.push(`\n═══ EVALUACIONES ESTANDARIZADAS ═══`);
        patient.evaluations.forEach(ev => {
            const pct = ev.maxScore > 0 ? Math.round((ev.score / ev.maxScore) * 100) : 0;
            let nivel = 'sin valorar';
            if (pct >= 80) nivel = 'adecuado';
            else if (pct >= 60) nivel = 'leve';
            else if (pct >= 40) nivel = 'moderado';
            else nivel = 'severo';

            parts.push(`• ${ev.testName}: ${ev.score}/${ev.maxScore} (${pct}%) — Nivel: ${nivel}`);
            if (ev.details) {
                const d = typeof ev.details === 'string' ? ev.details : JSON.stringify(ev.details);
                parts.push(`  Detalles: ${d.substring(0, 500)}`);
            }
        });

        // Resumen automático de nivel severidad
        const pcts = patient.evaluations
            .filter(ev => ev.maxScore > 0)
            .map(ev => Math.round((ev.score / ev.maxScore) * 100));
        if (pcts.length > 0) {
            const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
            let nivelGlobal = avg >= 80 ? 'ADECUADO' : avg >= 60 ? 'LEVE' : avg >= 40 ? 'MODERADO' : 'SEVERO';
            parts.push(`\nPROMEDIO GLOBAL: ${avg}% — Severidad: ${nivelGlobal}`);
        }
    }

    // Plan de tratamiento actual
    if (patient.treatmentPlan) {
        parts.push(`\n═══ PLAN DE TRATAMIENTO ACTUAL ═══`);
        if (patient.treatmentPlan.general) parts.push(`Objetivo general: ${patient.treatmentPlan.general}`);
        if (patient.treatmentPlan.specific?.length > 0) parts.push(`Objetivos específicos:\n${patient.treatmentPlan.specific.map((s: string) => `  • ${s}`).join('\n')}`);
        if (patient.treatmentPlan.strategies) parts.push(`Estrategias: ${patient.treatmentPlan.strategies}`);
        if (patient.treatmentPlan.frequency) parts.push(`Frecuencia: ${patient.treatmentPlan.frequency}`);
    }

    // Tipo de informe
    if (reportType) {
        parts.push(`\n═══ TIPO DE INFORME ═══`);
        parts.push(reportType);
    }

    return parts.join('\n');
}

// ══════════════════════════════════════════════════════════════
// SUGERENCIA DE DIAGNÓSTICO FUNCIONAL
// ══════════════════════════════════════════════════════════════

function buildDiagnosisSuggestionContext(patient?: Patient): string {
    if (!patient?.evaluations?.length) return '';

    const evals = patient.evaluations.map(ev => {
        const pct = ev.maxScore > 0 ? Math.round((ev.score / ev.maxScore) * 100) : 0;
        return `${ev.testName}: ${pct}%`;
    }).join(', ');

    return `El paciente tiene las siguientes evaluaciones: ${evals}. Basándote en estos resultados, sugerí un diagnóstico funcional fonoaudiológico usando códigos CIE-11 cuando sea posible.`;
}

// ══════════════════════════════════════════════════════════════
// SERVICIO PRINCIPAL
// ══════════════════════════════════════════════════════════════

export const aiReportService = {

    /**
     * Generar texto para una sección con contexto clínico completo + marco legal.
     */
    async generateSectionText(options: GenerateOptions): Promise<string> {
        const { prompt, section, tone = 'formal', patient, reportType, sectionDescription, existingContent } = options;

        const clinicalCtx = buildClinicalContext(patient, reportType);
        const diagnosisHint = patient?.diagnosis ? `\nDiagnóstico conocido: ${patient.diagnosis}` : '';

        const systemPrompt = `Sos un fonoaudiólogo matriculado (CFPBA) experto en redacción de informes clínicos para la Provincia de Buenos Aires.

${LEGAL_FRAMEWORK}

Tu tarea es generar texto profesional para la sección "${section || 'General'}" de un informe fonoaudiológico.

REGLAS ESTRICTAS:
1. Usá terminología clínica fonoaudiológica precisa (CIE-11, terminología funcional).
2. Texto formal, impersonal, en tercera persona.
3. SIEMPRE referenciar datos REALES del paciente: evaluaciones con puntajes, sesiones, anamnesis.
4. Si hay evaluaciones, mencionar resultados concretos: "obtuvo X/Y puntos (Z%), nivel [adecuado/leve/moderado/severo]".
5. Incluir el "toque personal": conducta observada, motivaciones, ejemplos del habla del paciente.
6. NO inventar datos clínicos no presentes en el contexto.
7. Diferenciar "refiere" (terceros) de "se observa" (hallazgo clínico).
8. Respondé SOLO con el texto del informe, sin explicaciones ni encabezados.
9. Formato: párrafos con <p>, datos específicos en <strong>, listas con <ul><li>.

TONO: ${tone === 'formal' ? 'formal y profesional' : tone === 'tecnico' ? 'técnico-científico' : 'claro para familias'}.

CONTEXTO CLÍNICO COMPLETO DEL PACIENTE:
${clinicalCtx}
${diagnosisHint}

${sectionDescription ? `DESCRIPCIÓN DE LA SECCIÓN: ${sectionDescription}` : ''}
${existingContent ? `CONTENIDO EXISTENTE (mejorar/completar):\n${existingContent}` : ''}

INSTRUCCIÓN ESPECÍFICA:
${prompt}`;

        return await generateWithFallback(prompt, systemPrompt, options);
    },

    /**
     * Mejorar texto existente con verificación de precisión clínica.
     */
    async improveText(text: string, patientName?: string, patient?: Patient): Promise<string> {
        const clinicalCtx = buildClinicalContext(patient);

        const systemPrompt = `Mejorá este texto para un informe fonoaudiológico profesional.

REGLAS:
- Corregí gramática, mejorá la estructura, hacelo más clínico.
- Verificá que los datos del paciente sean consistentes con el contexto.
- Agregá datos concretos si hay evaluaciones disponibles.
- Mantené la coherencia con el marco legal (diagnóstico funcional, NO médico).
- Respondé SOLO con el texto mejorado.

Paciente: ${patientName || 'N/A'}.

CONTEXTO CLÍNICO:
${clinicalCtx || 'No disponible'}`;

        return await generateWithFallback(text, systemPrompt);
    },

    /**
     * Sugerir párrafos basados en datos REALES del paciente.
     */
    async suggestBlocks(sectionTitle: string, patient?: Patient, reportType?: string): Promise<string[]> {
        const clinicalCtx = buildClinicalContext(patient, reportType);

        const systemPrompt = `Sos un fonoaudiólogo experto. Generá 3-4 párrafos profesionales (3-5 oraciones cada uno) para la sección "${sectionTitle}".

REGLAS:
- Cada párrafo DEBE estar basado en datos REALES del paciente.
- Incluir resultados de evaluaciones con puntajes concretos.
- Mencionar conducta observada y ejemplos del habla del paciente.
- Cada párrafo autocontenido, utilizable directamente.
- Formato HTML: <p>, <strong>, <em>, <ul>, <li>.
- Respondé JSON array de strings, solo el JSON.

CONTEXTO CLÍNICO:
${clinicalCtx}

Ejemplo: ["<p>En la evaluación del lenguaje expresivo, se observó...</p>", "<p>Respecto al desarrollo fonológico, se evidenció...</p>"]`;

        const result = await generateWithFallback(`Bloques para "${sectionTitle}"`, systemPrompt);
        try {
            const cleaned = result.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            return Array.isArray(parsed) ? parsed : [result];
        } catch { return [result]; }
    },

    /**
     * Completar texto parcial.
     */
    async completeText(partialText: string, sectionContext: string, patient?: Patient): Promise<string> {
        const clinicalCtx = buildClinicalContext(patient);
        const systemPrompt = `Completá este texto de informe fonoaudiológico de manera coherente y profesional.
Sección: ${sectionContext}.
Continuá el texto manteniendo el mismo estilo clínico.
Referenciá datos del paciente (evaluaciones, puntajes, conducta).
Respondé SOLO con el texto completo.

CONTEXTO CLÍNICO:
${clinicalCtx || 'No disponible'}`;
        return await generateWithFallback(partialText, systemPrompt);
    },

    /**
     * Cambiar tono preservando precisión clínica.
     */
    async changeTone(text: string, targetTone: 'formal' | 'tecnico' | 'familiar'): Promise<string> {
        const toneDesc = targetTone === 'formal'
            ? 'formal y profesional, impersonal, tercera persona'
            : targetTone === 'tecnico'
                ? 'técnico-científico con terminología fonoaudiológica'
                : 'claro y accesible para familias, sin jerga innecesaria';
        const systemPrompt = `Reescribí este texto con tono ${toneDesc}.
Mantené TODA la información clínica intacta (nombres, puntajes, fechas, diagnósticos).
NO inventes datos nuevos.
Respondé SOLO con el texto reescrito.`;
        return await generateWithFallback(text, systemPrompt);
    },

    /**
     * Generar INFORME COMPLETO con toda la inteligencia clínica.
     * Acepta las secciones de la guía para generar keys que coincidan.
     */
    async generateFullReport(patientData: Partial<Patient> & { name: string }, reportType: string, guideSections?: Array<{ id: string; title: string; description?: string }>): Promise<Record<string, string>> {
        const patient = patientData as Patient;
        const clinicalCtx = buildClinicalContext(patient, reportType);
        const diagnosisHint = buildDiagnosisSuggestionContext(patient);

        // Build section list for the AI prompt
        const sectionList = guideSections
            ? guideSections.map((s, i) => `${i + 1}. KEY: "${s.id}" — Título: "${s.title}" — ${s.description || ''}`).join('\n')
            : `1. KEY: "info_general" — Información General\n2. KEY: "motivo_consulta" — Motivo de Consulta\n3. KEY: "antecedentes" — Antecedentes\n4. KEY: "comportamiento" — Comportamiento\n5. KEY: "evaluacion_lenguaje" — Evaluación del Lenguaje\n6. KEY: "evaluacion_habla" — Evaluación del Habla\n7. KEY: "evaluacion_voz" — Evaluación de la Voz\n8. KEY: "evaluacion_motricidad" — Motricidad Orofacial\n9. KEY: "evaluacion_pragmatica" — Pragmática\n10. KEY: "resultados_evaluaciones" — Resultados de Evaluaciones\n11. KEY: "impresion_diagnostica" — Impresión Diagnóstica\n12. KEY: "pronostico" — Pronóstico\n13. KEY: "objetivos" — Objetivos\n14. KEY: "recomendaciones" — Recomendaciones`;

        const systemPrompt = `Sos un fonoaudiólogo matriculado (CFPBA) experto. Generá un informe fonoaudiológico COMPLETO tipo "${reportType}".

${LEGAL_FRAMEWORK}

SECCIONES DEL INFORME (usá EXACTAMENTE estas keys en el JSON):
${sectionList}

REGLAS CRÍTICAS:
- Devolvé un JSON donde cada key es el ID de la sección indicado arriba.
- El contenido de cada sección debe ser HTML válido: <p>, <strong>, <em>, <ul>, <li>, <table>.
- SIEMPRE incluir resultados numéricos de evaluaciones.
- SIEMPRE incluir ejemplos concretos del habla del paciente ("toque personal").
- Diagnóstico funcional fonoaudiológico, NUNCA diagnóstico médico.
- Diferenciar "refiere" de "se observa".

DATOS COMPLETOS DEL PACIENTE:
${clinicalCtx}
${diagnosisHint}

Respondé SOLO con un JSON válido donde las keys sean los IDs de las secciones indicadas arriba.
Ejemplo: {"info_general": "<p>...</p>", "motivo_consulta": "<p>...</p>", ...}`;

        const result = await generateWithFallback(
            `Informe completo tipo "${reportType}" para ${patientData.name}`,
            systemPrompt
        );

        try {
            const cleaned = result.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        } catch {
            return { contenido: result };
        }
    },

    /**
     * Sugerir diagnóstico funcional basado en evaluaciones.
     */
    async suggestDiagnosis(patient: Patient): Promise<string> {
        const clinicalCtx = buildClinicalContext(patient);
        const diagnosisHint = buildDiagnosisSuggestionContext(patient);

        const systemPrompt = `Sos un fonoaudiólogo experto en diagnóstico funcional.
Basándote en las evaluaciones y el contexto clínico, sugerí un diagnóstico funcional fonoaudiológico.

REGLAS:
- Usar terminología funcional (CIE-11).
- NUNCA diagnosticar patologías médicas (autismo, TDAH, etc.).
- Incluir nivel de severidad (leve/moderado/severo).
- Fundamentar con datos de evaluaciones.
- Sugerir objetivos de intervención.

CONTEXTO CLÍNICO:
${clinicalCtx}
${diagnosisHint}

Respondé con:
1. Diagnóstico funcional sugerido
2. Fundamentación (con datos de evaluaciones)
3. Nivel de severidad
4. Objetivos de intervención sugeridos`;

        return await generateWithFallback('Sugerir diagnóstico funcional', systemPrompt);
    },

    /**
     * Pregunta directa a la IA.
     */
    async askAI(prompt: string, systemPrompt: string, opts?: GenerateOptions): Promise<string> {
        return await generateWithFallback(prompt, systemPrompt, opts);
    },
};
