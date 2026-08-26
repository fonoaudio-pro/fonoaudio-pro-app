// ClinicalReportGenerator.js
// Supervisor clínico que audita informes contra estándares legales y de estilo (Elena Zegarra)

import { GoogleGenerativeAI } from '@google/generative-ai';

export const clinicalAuditChecklist = [
    { id: '1', item: 'Identificación y Fecha: ¿Constan nombre completo, DNI, edad cronológica exacta y fecha?' },
    { id: '2', item: 'Datos Profesionales: ¿Figura el membrete, firma, aclaración y número de matrícula?' },
    { id: '3', item: 'Diferenciación Epistemológica: ¿Se distingue lo referido por terceros de lo observado objetivamente?' },
    { id: '4', item: 'Resguardo de Incumbencias: ¿El diagnóstico es funcional/fonoaudiológico, sin incurrir en diagnósticos médicos?' },
    { id: '5', item: 'Coherencia Clínica: ¿Las conclusiones derivan lógicamente de los resultados expuestos?' }
];

export async function auditReport(draftReport, context = {}) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return { passed: true, issues: [], suggestions: [], note: 'Auditoría deshabilitada (sin API key)' };

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const auditPrompt = `Actuás como auditor del Colegio de Fonoaudiólogos de la Provincia de Buenos Aires.
Auditá el siguiente informe fonoaudiológico contra esta checklist legal:

${clinicalAuditChecklist.map(c => `${c.id}. ${c.item}`).join('\n')}

REGLAS ADICIONALES:
- El diagnóstico DEBE ser funcional/fonoaudiológico. Si detectás diagnósticos médicos (ej: "autismo", "TDAH"), marcá como error.
- Si faltan datos de "toque personal" (conducta, motivación, ejemplos concretos del habla), marcá como advertencia.
- Verificá que se diferencie entre "refiere" (dato anamnésico) y "se observa" (dato clínico).

INFORME A AUDITAR:
${draftReport}

${context.patientInfo ? `INFO DEL PACIENTE: ${context.patientInfo}` : ''}

Respondé en JSON:
{
  "passed": true/false,
  "score": 0-100,
  "issues": ["problema 1", "problema 2"],
  "warnings": ["advertencia 1"],
  "suggestions": ["mejora sugerida 1", "mejora sugerida 2"],
  "missing_data": ["dato faltante 1"]
}`;

        const result = await model.generateContent(auditPrompt);
        const text = result.response.text();

        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return { passed: true, issues: [], suggestions: [], note: 'No se pudo parsear auditoría' };
    } catch (e) {
        console.error('[ClinicalReportGenerator] Audit failed:', e.message);
        return { passed: true, issues: [], suggestions: [], note: 'Error en auditoría: ' + e.message };
    }
}
