import { Patient } from '../types';

/**
 * Centralized variable computation engine for clinical reports.
 * All [VARIABLE] placeholders in templates are resolved here.
 */

const ones = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
const tens = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

function numberToWords(n: number): string {
    if (n === 0) return 'cero';
    if (n < 10) return ones[n];
    if (n >= 10 && n < 20) return teens[n - 10];
    if (n >= 20 && n < 30) return n === 20 ? 'veinte' : `veinti${ones[n - 20]}`;
    if (n >= 30 && n < 100) {
        const t = Math.floor(n / 10);
        const o = n % 10;
        return o === 0 ? tens[t] : `${tens[t]} y ${ones[o]}`;
    }
    if (n >= 100 && n < 200) return `ciento ${numberToWords(n - 100)}`;
    if (n >= 200 && n < 1000) {
        const h = Math.floor(n / 100);
        const r = n % 100;
        const hWord = h === 2 ? 'doscientos' : h === 3 ? 'trescientos' : h === 4 ? 'cuatrocientos' : h === 5 ? 'quinientos' : h === 6 ? 'seiscientos' : h === 7 ? 'setecientos' : h === 8 ? 'ochocientos' : 'novecientos';
        return r === 0 ? hWord : `${hWord} ${numberToWords(r)}`;
    }
    return n.toString();
}

function formatDateLong(date: Date): string {
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateParts(date: Date) {
    return {
        dia: date.getDate().toString(),
        mes: date.toLocaleDateString('es-AR', { month: 'long' }),
        anio: date.getFullYear().toString(),
    };
}

function deriveProfessionalName(profNombre: string): { nombre: string; apellido: string; primerApellido: string; segundoApellido: string } {
    const parts = profNombre.trim().split(/\s+/);
    if (parts.length <= 1) return { nombre: profNombre, apellido: '', primerApellido: parts[0] || '', segundoApellido: '' };
    return {
        nombre: parts[0],
        apellido: parts.slice(1).join(' '),
        primerApellido: parts[0],
        segundoApellido: parts.slice(1).join(' '),
    };
}

function computeEvaluationInsights(evaluations: Patient['evaluations']) {
    if (!evaluations?.length) {
        return {
            evaluationSummary: '',
            avgScore: 0,
            severityLevel: 'a determinar' as const,
            severityLevelAdverb: 'a determinar' as const,
            areasAfectadas: 'A determinar según evaluación',
            areasAfectadasInversas: 'todas las áreas',
            lowestArea: 'A determinar',
            highestArea: 'A determinar',
            lowestScore: 0,
            highestScore: 0,
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            passingRate: 0,
        };
    }

    const scored = evaluations.map(ev => ({
        ...ev,
        pct: ev.maxScore > 0 ? Math.round((ev.score / ev.maxScore) * 100) : 0,
    }));

    const avgScore = Math.round(scored.reduce((acc, ev) => acc + ev.pct, 0) / scored.length);
    const severityLevel = avgScore >= 80 ? 'adecuado' as const
        : avgScore >= 60 ? 'leve' as const
        : avgScore >= 40 ? 'moderado' as const
        : 'severo' as const;

    const areasDeficit = scored.filter(ev => ev.pct < 60).map(ev => ev.testName);
    const areasAdequadas = scored.filter(ev => ev.pct >= 60).map(ev => ev.testName);
    const sorted = [...scored].sort((a, b) => a.pct - b.pct);

    return {
        evaluationSummary: scored.map(ev => `${ev.testName}: ${ev.pct}%`).join(', '),
        avgScore,
        severityLevel,
        severityLevelAdverb: severityLevel === 'adecuado' ? 'adecuadamente' : severityLevel === 'leve' ? 'levemente' : severityLevel === 'moderado' ? 'moderadamente' : 'severamente',
        areasAfectadas: areasDeficit.length ? areasDeficit.join(', ') : 'Ninguna área significativamente afectada',
        areasAfectadasInversas: areasAdequadas.length ? areasAdequadas.join(', ') : 'Todas las áreas requieren intervención',
        lowestArea: sorted[0]?.testName || 'A determinar',
        highestArea: sorted[sorted.length - 1]?.testName || 'A determinar',
        lowestScore: sorted[0]?.pct || 0,
        highestScore: sorted[sorted.length - 1]?.pct || 0,
        totalTests: scored.length,
        passedTests: scored.filter(ev => ev.pct >= 60).length,
        failedTests: scored.filter(ev => ev.pct < 60).length,
        passingRate: Math.round((scored.filter(ev => ev.pct >= 60).length / scored.length) * 100),
    };
}

function computeSessionInsights(history: Patient['history']) {
    if (!history?.length) {
        return {
            sessionCount: 0,
            totalSessionsText: 'Primera evaluación',
            sesionesRealizadas: 'Sin sesiones previas',
            primeraSesionDate: 'A definir',
            ultimaSesionDate: 'A definir',
            duracionTratamiento: 'A definir',
            primeraSesionDateLong: 'A definir',
            consecutiveMissed: 0,
        };
    }

    const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const count = history.length;
    const firstDate = new Date(first.date);
    const lastDate = new Date(last.date);
    const diffDays = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);

    let durationText = '';
    if (diffMonths > 0) durationText = `${diffMonths} mes${diffMonths > 1 ? 'es' : ''}`;
    if (diffDays > 0 && diffMonths === 0) durationText = `${diffDays} día${diffDays > 1 ? 's' : ''}`;
    if (diffDays === 0) durationText = 'menos de un día';

    return {
        sessionCount: count,
        totalSessionsText: `${count} encuentro${count > 1 ? 's' : ''}`,
        sesionesRealizadas: `${count} encuentro${count > 1 ? 's' : ''} realizados`,
        primeraSesionDate: first.date,
        ultimaSesionDate: last.date,
        duracionTratamiento: durationText,
        primeraSesionDateLong: formatDateLong(firstDate),
        consecutiveMissed: 0,
    };
}

function computeAgeDescription(age: number, severityLevel: string): string {
    const years = Math.floor(age);
    const months = Math.round((age - years) * 12);

    let ageRange = '';
    if (years < 1) ageRange = 'un bebé de menos de un año';
    else if (years === 1) ageRange = 'un niño/a de un año';
    else if (years <= 3) ageRange = `un niño/a de ${years} años`;
    else if (years <= 5) ageRange = `un niño/a en edad preescolar de ${years} años`;
    else if (years <= 7) ageRange = `un niño/a en edad escolar de ${years} años`;
    else if (years <= 12) ageRange = `un niño/a de ${years} años en edad escolar`;
    else if (years <= 17) ageRange = `un adolescente de ${years} años`;
    else ageRange = `un paciente de ${years} años`;

    const langLevel = severityLevel === 'adecuado' ? 'nivel adecuado de lenguaje'
        : severityLevel === 'leve' ? 'un nivel leve de dificultad en el lenguaje'
        : severityLevel === 'moderado' ? 'un nivel moderado de dificultad en el lenguaje'
        : 'un nivel severo de dificultad en el lenguaje';

    return `lenguaje expresivo de ${langLevel} para ${ageRange}`;
}

/**
 * Compute ALL report variables from patient data and professional profile.
 */
export function computeReportVariables(
    patient: Patient,
    profNombre: string = '',
    profTitulo: string = '',
    profMate: string = '',
): Record<string, string> {
    const now = new Date();
    const prof = deriveProfessionalName(profNombre);
    const evalInsights = computeEvaluationInsights(patient.evaluations);
    const sessionInsights = computeSessionInsights(patient.history);
    const ageDesc = computeAgeDescription(patient.age || 0, evalInsights.severityLevel);
    const dateParts = formatDateParts(now);

    const motivosFromAnamnesis = (patient.anamnesis as any)?.motivo_consulta
        || (patient.anamnesis as any)?.chief_complaint
        || patient.notes
        || '';

    const treatmentPlan = patient.treatmentPlan;
    const frequency = treatmentPlan?.frequency || '2 veces por semana';
    const modalidad = 'presencial';

    const apellido = prof.apellido;
    const firstName = patient.name?.split(' ')[0] || '';
    const lastName = patient.name?.split(' ').slice(1).join(' ') || '';

    // Build all variables
    return {
        // === Basic patient info ===
        NOMBRE: patient.name || '',
        NOMBRE_COMPLETO: patient.name || '',
        APELLIDO: lastName || firstName,
        PRIMER_APELLIDO: lastName || firstName,
        SEGUNDO_APELLIDO: '',
        EDAD: patient.age?.toString() || '',
        EDAD_A_LETRAS: patient.age ? numberToWords(Math.floor(patient.age)) : '',
        GENERO: patient.gender || '',
        DOCUMENTO: patient.document || '',
        FECHA_NACIMIENTO: patient.date_of_birth || '',
        RESPONSABLE: (patient as any).responsable || '',
        DERIVANTE: (patient as any).derivante || '',
        OBRA_SOCIAL: patient.obra_social || '',
        DIAGNOSTICO: patient.diagnosis || 'Sin diagnóstico funcional definido',
        NOTAS: patient.notes || '',

        // === Date/time ===
        FECHA: formatDateLong(now),
        FECHA_ACTUAL: formatDateLong(now),
        FECHA_DIA: dateParts.dia,
        FECHA_MES: dateParts.mes,
        FECHA_ANIO: dateParts.anio,
        HORA_ACTUAL: now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),

        // === Professional info ===
        PROFESIONAL_NOMBRE: profNombre,
        PROFESIONAL_TITULO: profTitulo,
        PROFESIONAL_MATE: profMate,
        PROFESIONAL_APELLIDO: apellido,
        PROFESIONAL_PRIMER_NOMBRE: prof.nombre,

        // === Session info ===
        CANTIDAD_SESIONES: sessionInsights.totalSessionsText,
        SESIONES_REALIZADAS: sessionInsights.sesionesRealizadas,
        FECHA_VALORACION: formatDateLong(now),
        FECHA_INICIO_TRATAMIENTO: sessionInsights.primeraSesionDateLong,
        DURACION_TRATAMIENTO: sessionInsights.duracionTratamiento,
        ULTIMA_SESION: sessionInsights.ultimaSesionDate,
        MODALIDAD: modalidad,
        FRECUENCIA_TERAPIA: frequency,

        // === Clinical evaluation insights ===
        EVALUACION_RESUMEN: evalInsights.evaluationSummary,
        PROMEDIO_PUNTUACION: evalInsights.avgScore.toString(),
        NIVEL_SEVERIDAD: evalInsights.severityLevel,
        NIVEL_SEVERIDAD_ADVERBIO: evalInsights.severityLevelAdverb,
        AREAS_AFECTADAS: evalInsights.areasAfectadas,
        AREAS_ADECUADAS: evalInsights.areasAfectadasInversas,
        AREA_MAS_AFECTADA: evalInsights.lowestArea,
        AREA_MENOS_AFECTADA: evalInsights.highestArea,
        PUNTUACION_BAJA: evalInsights.lowestScore.toString(),
        PUNTUACION_ALTA: evalInsights.highestScore.toString(),
        TOTAL_EVALUACIONES: evalInsights.totalTests.toString(),
        EVALUACIONES_APROBADAS: evalInsights.passedTests.toString(),
        EVALUACIONES_REPROBADAS: evalInsights.failedTests.toString(),
        PORCENTAJE_APROBACION: evalInsights.passingRate.toString(),

        // === Age description ===
        DESCRIPCION_EDAD: ageDesc,

        // === Anamnesis ===
        PARENTESCO_INFORMANTE: (patient as any).responsable ? 'el/la responsable legal' : 'la mamá',
        PARENTESTCO_INFORMANTE: (patient as any).responsable ? 'el/la responsable legal' : 'la mamá',
        MOTIVO_TEXTO: motivosFromAnamnesis || 'A completar según anamnesis',
        MOTIVO_CONSULTA: motivosFromAnamnesis || 'A completar según anamnesis',

        // === Language / clinical specifics ===
        CANTIDAD_PALABRAS: `un repertorio de aproximadamente ${(patient.age || 3) < 4 ? '50-100' : (patient.age || 3) < 6 ? '2000-5000' : '10000-20000'} palabras`,
        ESTRUCTURA_EJEMPLO: patient.age ? (patient.age < 2 ? '"mamá"' : patient.age < 3 ? '"quieroagua"' : patient.age < 4 ? '"yo quiero agua"' : '"mamá, ¿yo puedo ir a jugar?"') : '"Ejemplo de estructura del paciente"',
        HABILIDADES_COMPRENSION: evalInsights.severityLevel === 'adecuado' ? 'comprensión de instrucciones complejas y vocabulario amplio' : 'comprensión de instrucciones simples con apoyo visual',
        DIFICULTADES_COMPRENSION: evalInsights.severityLevel === 'adecuado' ? 'No se observan dificultades comprensivas significativas' : 'procesamiento de instrucciones de múltiples pasos y estructuras gramaticales complejas',
        PROCESOS_SIMPLIFICACION: evalInsights.failedTests > 0 ? 'sustituciones, omisiones y simplificaciones fonológicas' : 'No se observan procesos de simplificación fuera de la norma',
        DIAGNOSTICO_FONOAUDIOLOGICO: patient.diagnosis || 'Impresión diagnóstica a definir según evaluación completa',
        JUEGO_PREFERIDO: patient.age ? (patient.age < 3 ? 'juego sensoriomotor con objetos cotidianos' : patient.age < 6 ? 'juego simbólico y de representación' : 'juegos de reglas y construcciones') : 'Actividades lúdicas a observar',
        JUEGO_MENOR_INTERES: patient.age ? (patient.age < 3 ? 'actividades estructuradas formales' : 'juegos cooperativos grupales') : 'Actividades a identificar en sesión',

        // === Treatment plan ===
        OBJETIVOS_CORTO_PLAZO: treatmentPlan?.shortTerm?.join('. ') || 'A definir según plan de tratamiento',
        OBJETIVOS_MEDIANO_PLAZO: treatmentPlan?.midTerm?.join('. ') || 'A definir según evolución',
        OBJETIVOS_LARGO_PLAZO: treatmentPlan?.longTerm?.join('. ') || 'A definir según evolución',
        ESTRATEGIAS: treatmentPlan?.strategies || 'A definir según evaluación',
        OBJETIVO_GENERAL: treatmentPlan?.general || 'A definir según evaluación',
        OBJETIVOS_ESPECIFICOS: treatmentPlan?.specific?.join('. ') || 'A definir según evaluación',
        TAREAS_PARA_CASA: treatmentPlan?.homework || 'Pautas familiares a implementar',
        ADHERENCIA_FAMILIAR: treatmentPlan?.familyAdherence || 'A evaluar',

        // === Ficha clinica identity fields ===
        DIRECCION: (patient as any).address || '',
        TELEFONO: patient.phone || '',
        EMAIL: patient.email || '',
        CONTACTO_EMERGENCIA: (patient as any).emergency_contact || '',
        TELEFONO_EMERGENCIA: (patient as any).emergency_phone || '',
        CONSULTORIO: (patient as any).consultorio || '',
    };
}

/**
 * Process text replacing all [VARIABLE] with computed values.
 * Unresolved variables remain as-is for manual editing.
 */
export function processReportText(
    text: string,
    variables: Record<string, string>,
): string {
    let result = text;
    Object.entries(variables).forEach(([key, value]) => {
        if (!value && value !== '') return;
        const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const escapedValue = (value || `[${key}]`).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        result = result.replace(new RegExp(`\\[${escapedKey}\\]`, 'g'), escapedValue);
    });
    return result;
}
