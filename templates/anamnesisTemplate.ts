import { AnamnesisTemplate, AffectedAreaKey } from '../types/clinical';

// ============================================================
// Anamnesis Template v1.0
// Versionado: cada cambio incrementa la versión
// Lógica de salto: jumpIf + jumpTo en preguntas condicionales
// ============================================================

export const ANAMNESIS_TEMPLATE_V1: AnamnesisTemplate = {
  version: '1.0',
  label: 'Anamnesis Fonoaudiológica - v1.0',
  sections: [
    {
      id: 'motivo_consulta',
      title: 'Motivo de Consulta',
      description: 'Datos principales del motivo de derivación',
      questions: [
        {
          id: 'motivo_principal',
          label: '¿Cuál es el motivo de la consulta?',
          type: 'textarea',
          required: true,
          placeholder: 'Describir el motivo principal de la derivación...',
        },
        {
          id: 'cronologia',
          label: '¿Desde cuándo se observan las dificultades?',
          type: 'textarea',
          placeholder: 'Ej: Desde los 2 años, desde hace 6 meses...',
        },
        {
          id: 'quien_derivacion',
          label: '¿Quién derivó y por qué?',
          type: 'textarea',
          placeholder: 'Ej: Pediatra, escuela, los padres...',
        },
        {
          id: 'tratamientos_previos',
          label: '¿Recibió tratamientos previos? ¿Cuáles?',
          type: 'textarea',
        },
        {
          id: 'tiene_tratamiento_previo',
          label: '¿Actualmente recibe algún tratamiento?',
          type: 'select',
          options: ['Sí', 'No'],
          jumpIf: 'Sí',
          jumpTo: 'detalle_tratamiento_actual',
        },
        {
          id: 'detalle_tratamiento_actual',
          label: 'Detalle del tratamiento actual',
          type: 'textarea',
          placeholder: 'Ej: Fonoaudiología 2 veces por semana desde hace 3 meses...',
        },
      ],
    },
    {
      id: 'antecedentes_personales',
      title: 'Antecedentes Personales',
      description: 'Historia clínica y desarrollo del paciente',
      questions: [
        {
          id: 'historia_medica',
          label: 'Historia médica general',
          type: 'textarea',
          placeholder: 'Enfermedades, internaciones, cirugías...',
        },
        {
          id: 'antecedentes_otologicos',
          label: 'Antecedentes otológicos',
          type: 'textarea',
          placeholder: 'Otitis, perforaciones, uso de audífonos...',
        },
        {
          id: 'desarrollo_psicomotor',
          label: 'Desarrollo psicomotor',
          type: 'textarea',
          placeholder: 'Control ceflico, sentarse, gatear, caminar...',
        },
        {
          id: 'desarrollo_lenguaje',
          label: 'Desarrollo del lenguaje',
          type: 'textarea',
          placeholder: 'Primeras palabras, frases, habilidades comunicativas...',
        },
        {
          id: 'alimentacion',
          label: 'Alimentación',
          type: 'textarea',
          placeholder: 'Lactancia, transición a sólidos, dificultades...',
        },
        {
          id: 'sueno',
          label: 'Sueño',
          type: 'textarea',
          placeholder: 'Hábitos de sueño, dificultades, ronquidos...',
        },
        {
          id: 'tiene_cirugias',
          label: '¿Tiene cirugías previas?',
          type: 'select',
          options: ['Sí', 'No'],
          jumpIf: 'Sí',
          jumpTo: 'detalle_cirugias',
        },
        {
          id: 'detalle_cirugias',
          label: 'Detalle de cirugías previas',
          type: 'textarea',
          placeholder: 'Tipo de cirugía, edad al momento, resultado...',
        },
        {
          id: 'medicacion',
          label: 'Medicación actual',
          type: 'textarea',
        },
        {
          id: 'alergias',
          label: 'Alergias conocidas',
          type: 'textarea',
        },
      ],
    },
    {
      id: 'antecedentes_familiares',
      title: 'Antecedentes Familiares',
      description: 'Historia familiar y dinámica del hogar',
      questions: [
        {
          id: 'composicion_familiar',
          label: 'Composición del grupo familiar',
          type: 'textarea',
          placeholder: ' Padres, hermanos, convivientes...',
        },
        {
          id: 'historia_familiar',
          label: 'Antecedentes familiares relevantes',
          type: 'textarea',
          placeholder: 'Enfermedades, problemas del habla/lenguaje en la familia...',
        },
        {
          id: 'dinamica_familiar',
          label: 'Dinámica familiar',
          type: 'textarea',
          placeholder: 'Relaciones, rutinas, situaciones de estrés...',
        },
        {
          id: 'lengua_materna',
          label: 'Lengua materna y otros idiomas',
          type: 'textarea',
          placeholder: '¿Qué lengua se habla en casa? ¿Bilingüismo?',
        },
        {
          id: 'expectativas_familia',
          label: 'Expectativas de la familia',
          type: 'textarea',
          placeholder: '¿Qué esperan del tratamiento? ¿Qué les preocupa?',
        },
      ],
    },
    {
      id: 'antecedentes_escolares',
      title: 'Antecedentes Escolares',
      description: 'Contexto educativo y social',
      questions: [
        {
          id: 'asistencia_escolar',
          label: '¿Asiste a institución educativa? ¿Cuál?',
          type: 'textarea',
        },
        {
          id: 'nivel_escolar',
          label: 'Nivel escolar / grado',
          type: 'textarea',
        },
        {
          id: 'rendimiento_escolar',
          label: 'Rendimiento escolar',
          type: 'textarea',
          placeholder: 'Dificultades de aprendizaje, relación con pares/docentes...',
        },
        {
          id: 'tiene_dificultades_escolares',
          label: '¿Presenta dificultades en el ámbito escolar?',
          type: 'select',
          options: ['Sí', 'No'],
          jumpIf: 'Sí',
          jumpTo: 'detalle_dificultades_escolares',
        },
        {
          id: 'detalle_dificultades_escolares',
          label: 'Detalle de dificultades escolares',
          type: 'textarea',
          placeholder: 'Lectura, escritura, cálculo, concentración, conducta...',
        },
      ],
    },
    {
      id: 'areas_fonoaudiologicas',
      title: 'Áreas Fonoaudiológicas',
      description: 'Evaluación inicial de las áreas afectadas',
      questions: [
        {
          id: 'voz_observaciones',
          label: 'Voz — Observaciones',
          type: 'textarea',
          placeholder: 'Ronquida, afonía, esfuerzo, cambios postquirúrgicos...',
        },
        {
          id: 'lenguaje_observaciones',
          label: 'Lenguaje — Observaciones',
          type: 'textarea',
          placeholder: 'Comprensión, expresión, gramática, vocabulario...',
        },
        {
          id: 'habla_observaciones',
          label: 'Habla — Observaciones',
          type: 'textarea',
          placeholder: 'Articulación, fluidez, ritmo, dislalias...',
        },
        {
          id: 'deglucion_observaciones',
          label: 'Deglución — Observaciones',
          type: 'textarea',
          placeholder: 'Dificultad para tragar, atragantamientos, alimentación...',
        },
        {
          id: 'audicion_observaciones',
          label: 'Audición — Observaciones',
          type: 'textarea',
          placeholder: 'Audiometría, conducta auditiva, otitis...',
        },
        {
          id: 'motricidad_observaciones',
          label: 'Motricidad Orofacial — Observaciones',
          type: 'textarea',
          placeholder: 'Tono muscular, respiración, succión, masticación...',
        },
      ],
    },
    {
      id: 'observaciones_finales',
      title: 'Observaciones Clínicas Finales',
      description: 'Impresión clínica inicial del profesional',
      questions: [
        {
          id: 'impresion_clinica',
          label: 'Impresión clínica inicial',
          type: 'textarea',
          placeholder: 'Síntesis de la evaluación, hipótesis diagnóstica inicial...',
        },
        {
          id: 'prioridad_atencion',
          label: 'Área de mayor prioridad',
          type: 'textarea',
          placeholder: '¿Cuál es el área que requiere atención inmediata?',
        },
      ],
    },
  ],
};

// ============================================================
// Helper: evaluate jump conditions
// ============================================================

export function shouldShowQuestion(
  questionId: string,
  sections: AnamnesisTemplate['sections'],
  answers: Record<string, any>
): boolean {
  for (const section of sections) {
    for (let i = 0; i < section.questions.length; i++) {
      const q = section.questions[i];
      if (q.id === questionId && q.jumpTo) {
        const prevQuestion = section.questions.slice(0, i).reverse().find(
          prev => prev.jumpTo === q.id
        );
        if (prevQuestion) {
          const answer = answers[prevQuestion.id];
          return answer === prevQuestion.jumpIf;
        }
      }
    }
  }
  return true;
}

export function getTemplate(): AnamnesisTemplate {
  return ANAMNESIS_TEMPLATE_V1;
}

export function getLatestVersion(): string {
  return ANAMNESIS_TEMPLATE_V1.version;
}

// ============================================================
// Area-specific Anamnesis Sections
// ============================================================

export const AREA_SECTIONS: Record<AffectedAreaKey, { title: string; description: string; questions: { id: string; label: string; type: 'textarea' | 'select'; placeholder?: string; options?: string[]; required?: boolean; }[] }> = {
  voz: {
    title: 'Anamnesis Específica — Voz',
    description: 'Evaluación detallada del área de voz',
    questions: [
      { id: 'voz_tipo_disfonia', label: 'Tipo de disfonía observada', type: 'select', options: ['Funcional', 'Orgánica', 'Neurológica', 'Mixta', 'No se observa'] },
      { id: 'voz_cronologia', label: 'Cronología de los síntomas vocales', type: 'textarea', placeholder: 'Desde cuándo, si es intermitente o permanente...' },
      { id: 'voz_factores_riesgo', label: 'Factores de riesgo vocal', type: 'textarea', placeholder: 'Profesión vocal, tabaquismo, reflujo, uso intensivo de voz...' },
      { id: 'voz_sintomas_asociados', label: 'Síntomas asociados', type: 'textarea', placeholder: 'Dolor cervical, tensión, fatiga vocal, asfixia vocal...' },
      { id: 'voz_tratamientos_previos', label: 'Tratamientos vocales previos', type: 'textarea', placeholder: 'Fonoaudiología, cirugía, medicación...' },
      { id: 'voz_uso_vocal', label: 'Uso vocal habitual', type: 'textarea', placeholder: 'Nivel de uso, hábitos, exposición a ruido...' },
    ],
  },
  lenguaje: {
    title: 'Anamnesis Específica — Lenguaje',
    description: 'Evaluación detallada del área de lenguaje',
    questions: [
      { id: 'lenguaje_tipo_dificultad', label: 'Tipo de dificultad de lenguaje', type: 'select', options: ['Comprensión', 'Expresión', 'Ambas', 'No se observa'] },
      { id: 'lenguaje_nivel_comprension', label: 'Nivel de comprensión', type: 'textarea', placeholder: 'Órdenes simples, complejas, preguntas...' },
      { id: 'lenguaje_nivel_expresion', label: 'Nivel de expresión', type: 'textarea', placeholder: 'Vocabulario, frases, gramática, fluidez...' },
      { id: 'lenguaje_desarrollo_historico', label: 'Hitos del desarrollo del lenguaje', type: 'textarea', placeholder: 'Primeras palabras, frases, momentos de adquisición...' },
      { id: 'lenguaje_bilinguismo', label: 'Bilingüismo o exposición a múltiples lenguas', type: 'textarea', placeholder: 'Lenguas expuestas, dominancia, edades de exposición...' },
      { id: 'lenguaje_comunicacion_social', label: 'Comunicación social', type: 'textarea', placeholder: 'Interacción con pares, contacto visual, turnos conversacionales...' },
    ],
  },
  habla: {
    title: 'Anamnesis Específica — Habla / Articulación',
    description: 'Evaluación detallada del área de habla',
    questions: [
      { id: 'habla_tipo_dificultad', label: 'Tipo de dificultad del habla', type: 'select', options: ['Articulación', 'Fluidez', 'Velocidad', 'Ritmo', 'Múltiples', 'No se observa'] },
      { id: 'habla_sonidos_afectados', label: 'Sonidos o fonemas afectados', type: 'textarea', placeholder: 'Sibilantes, róticas, oclusivas, etc.' },
      { id: 'habla_dislalia_tipo', label: 'Tipo de dislalia (si aplica)', type: 'select', options: ['Fonológica', 'Articulatoria', 'Evolutiva', 'No aplica'] },
      { id: 'habla_fluidez', label: 'Fluidez del habla', type: 'textarea', placeholder: 'Tartamudeo, bloqueos, repeticiones...' },
      { id: 'habla_velocidad', label: 'Velocidad del habla', type: 'select', options: ['Normal', 'Lenta', 'Rápida', 'Variable'] },
      { id: 'habla_comprension_estructuras', label: 'Comprensión de estructuras gramaticales', type: 'textarea', placeholder: 'Oraciones complejas, pasivas, etc.' },
    ],
  },
  deglucion: {
    title: 'Anamnesis Específica — Deglución',
    description: 'Evaluación detallada del área de deglución',
    questions: [
      { id: 'deglucion_tipo_dificultad', label: 'Tipo de dificultad', type: 'select', options: ['Oral', 'Faringea', 'Ambas', 'No se observa'] },
      { id: 'deglucion_sintomas', label: 'Síntomas de disfagia', type: 'textarea', placeholder: 'Atragantamientos, tos, deglución fraccionada, residuos...' },
      { id: 'deglucion_alimentos_afectados', label: 'Alimentos o texturas afectadas', type: 'textarea', placeholder: 'Sólidos, líquidos, puré, etc.' },
      { id: 'deglucion_posicion', label: 'Posiciones que facilitan o dificultan', type: 'textarea', placeholder: 'Sentado, acostado, inclinación...' },
      { id: 'deglucion_peso', label: 'Peso / Estado nutricional', type: 'textarea', placeholder: 'Pérdida de peso, dificultad para alimentarse...' },
      { id: 'deglucion_peligro_aspiracion', label: 'Señales de peligro de aspiración', type: 'textarea', placeholder: 'Fiebre post-comida, neumonías recurrentes...' },
    ],
  },
  audicion: {
    title: 'Anamnesis Específica — Audición',
    description: 'Evaluación detallada del área de audición',
    questions: [
      { id: 'audicion_tipo_dificultad', label: 'Tipo de dificultad auditiva', type: 'select', options: ['Conductiva', 'Neurosensorial', 'Mixta', 'No se observa'] },
      { id: 'audicion_oidos_afectados', label: 'Oídos afectados', type: 'select', options: ['Derecho', 'Izquierdo', 'Ambos', 'No se sabe'] },
      { id: 'audicion_grado', label: 'Grado de pérdida auditiva (si se conoce)', type: 'textarea', placeholder: 'Leve, moderada, severa, profunda...' },
      { id: 'audicion_cronologia', label: 'Cronología del problema auditivo', type: 'textarea', placeholder: 'Desde cuándo, progresivo o súbito...' },
      { id: 'audicion_exposicion_ruido', label: 'Exposición a ruido intenso', type: 'textarea', placeholder: 'Laboral, recreativo, música, maquinaria...' },
      { id: 'audicion_otitis', label: 'Antecedentes de otitis', type: 'textarea', placeholder: 'Frecuencia, tipo, tratamiento...' },
      { id: 'audicion_uso_audifonos', label: 'Uso de audífonos o implantes', type: 'textarea', placeholder: 'Tipo, tiempo de uso, adaptación...' },
    ],
  },
  motricidad_orofacial: {
    title: 'Anamnesis Específica — Motricidad Orofacial',
    description: 'Evaluación detallada del área de motricidad orofacial',
    questions: [
      { id: 'mo_tono_muscular', label: 'Tono muscular orofacial', type: 'select', options: ['Normal', 'Hipotonía', 'Hipertonía', 'Asimetría', 'No se observa'] },
      { id: 'mo_respiracion', label: 'Patrón respiratorio', type: 'select', options: ['Nasal', 'Oral', 'Mixto', 'Mouth breathing'] },
      { id: 'mo_sucion', label: 'Succión (si aplica)', type: 'textarea', placeholder: 'Lactancia, uso de chupete, hábitos...' },
      { id: 'mo_masticacion', label: 'Masticación', type: 'textarea', placeholder: 'Patrón, lateralidad, dificultades...' },
      { id: 'mo_deglucion', label: 'Deglución atípica', type: 'textarea', placeholder: 'Posición lingual, presión labial, interposición...' },
      { id: 'mo_articulacion_labial', label: 'Articulación labial y lingual', type: 'textarea', placeholder: 'Movilidad, simetría, funciones...' },
      { id: 'mo_habitos', label: 'Hábitos orales', type: 'textarea', placeholder: 'Onicofagia, succión digital, interposición lingual...' },
    ],
  },
  cognicion_comunicacion: {
    title: 'Anamnesis Específica — Cognición / Comunicación',
    description: 'Evaluación detallada del área de cognición y comunicación',
    questions: [
      { id: 'cognicion_atencion', label: 'Atención y concentración', type: 'textarea', placeholder: 'Nivel de atención, sostenida, selectiva...' },
      { id: 'cognicion_memoria', label: 'Memoria', type: 'textarea', placeholder: 'Corto plazo, largo plazo, trabajo...' },
      { id: 'cognicion_funciones_ejecutivas', label: 'Funciones ejecutivas', type: 'textarea', placeholder: 'Planificación, inhibición, flexibilidad...' },
      { id: 'cognicion_interaccion_social', label: 'Interacción social', type: 'textarea', placeholder: 'Habilidades pragmáticas, turnos, temas...' },
      { id: 'cognicion_conducta', label: 'Conducta y regulación', type: 'textarea', placeholder: 'Tantrums, rigidez, autorregulación...' },
      { id: 'cognicion_juego', label: 'Tipo de juego', type: 'select', options: ['Funcional', 'Simbólico', 'Constructivo', 'Exploratorio', 'No se observa'] },
    ],
  },
};

// ============================================================
// Get template filtered by affected areas
// ============================================================

export function getTemplateForAreas(affectedAreaKeys?: AffectedAreaKey[]): AnamnesisTemplate {
  if (!affectedAreaKeys || affectedAreaKeys.length === 0) {
    return ANAMNESIS_TEMPLATE_V1;
  }
  
  const areaSections = affectedAreaKeys
    .filter(key => AREA_SECTIONS[key])
    .map(key => ({
      id: `area_${key}`,
      ...AREA_SECTIONS[key],
    }));

  return {
    ...ANAMNESIS_TEMPLATE_V1,
    sections: [
      ...ANAMNESIS_TEMPLATE_V1.sections,
      ...areaSections,
    ],
  };
}
