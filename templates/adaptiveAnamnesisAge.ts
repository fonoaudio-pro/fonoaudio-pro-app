import { AdaptiveBranch } from '../types/clinical_history';

const BASE_QUESTIONS = {
  datos_personales: {
    id: 'datos_personales',
    title: 'Datos Personales',
    description: 'Información de identificación del paciente',
    required: true,
    fields: [
      { id: 'nombre_completo', label: 'Nombre completo', type: 'text' as const, required: true },
      { id: 'fecha_nacimiento', label: 'Fecha de nacimiento', type: 'date' as const, required: true },
      { id: 'edad_calculada', label: 'Edad calculada', type: 'text' as const, required: false, helpText: 'Se calcula automáticamente' },
      { id: 'sexo', label: 'Sexo', type: 'select' as const, required: true, options: ['Masculino', 'Femenino', 'Otro'] },
      { id: 'lateralidad', label: 'Lateralidad', type: 'select' as const, required: false, options: ['Diestro', 'Zurdo', 'Ambidiestro'] },
    ],
  },
  motivo_consulta: {
    id: 'motivo_consulta',
    title: 'Motivo de Consulta',
    description: '¿Por qué consulta?',
    required: true,
    fields: [
      { id: 'motivo_principal', label: 'Motivo principal', type: 'textarea' as const, required: true, placeholder: 'Describa el motivo...' },
      { id: 'quien_deriva', label: '¿Quién deriva?', type: 'select' as const, required: false, options: ['Pediatra', 'Neurólogo', 'Otorrinolaringólogo', 'Psicólogo', 'Escuela', 'Familiar', 'Otro'] },
      { id: 'expectativas', label: 'Expectativas de la consulta', type: 'textarea' as const, required: false },
    ],
  },
};

export const AGE_BRANCHES: AdaptiveBranch[] = [
  {
    id: 'neonato', label: 'Neonato', conditions: { ageGroup: ['neonato'] },
    sections: [
      BASE_QUESTIONS.datos_personales,
      BASE_QUESTIONS.motivo_consulta,
      {
        id: 'antecedentes_prenatales', title: 'Antecedentes Prenatales', required: true,
        fields: [
          { id: 'embarazo_controlado', label: '¿Embarazo controlado?', type: 'checkbox' as const, required: true },
          { id: 'semanas_gestacion', label: 'Semanas de gestación', type: 'number' as const, required: true, min: 20, max: 45 },
          { id: 'tipo_parto', label: 'Tipo de parto', type: 'select' as const, required: true, options: ['Vaginal', 'Cesárea', 'Instrumentado'] },
          { id: 'peso_nacimiento', label: 'Peso al nacer (g)', type: 'number' as const, required: true, min: 500, max: 6000 },
          { id: 'lactancia', label: 'Tipo de lactancia', type: 'select' as const, required: true, options: ['Exclusiva materna', 'Mixta', 'Artificial'] },
          { id: 'cribado_neonatal', label: 'Cribado auditivo neonatal', type: 'select' as const, required: true, options: ['Pasa ambos oídos', 'No pasa OD', 'No pasa OI', 'No realizado'] },
        ],
      },
    ],
  },
  {
    id: 'lactante', label: 'Lactante', conditions: { ageGroup: ['lactante'] },
    sections: [
      BASE_QUESTIONS.datos_personales,
      BASE_QUESTIONS.motivo_consulta,
      {
        id: 'desarrollo_psicomotor', title: 'Desarrollo Psicomotor', required: true,
        fields: [
          { id: 'sostien_cabeza', label: '¿Sostiene la cabeza?', type: 'checkbox' as const, required: true },
          { id: 'gatea', label: '¿Gatea?', type: 'checkbox' as const, required: false },
          { id: 'camina', label: '¿Camina?', type: 'checkbox' as const, required: false },
          { id: 'erdemasiado', label: 'EDAME revisado', type: 'select' as const, required: false, options: ['Normal', 'Retraso leve', 'Retraso moderado', 'Retraso severo', 'No aplicado'] },
        ],
      },
      {
        id: 'lenguaje_inicial', title: 'Inicio del Lenguaje', required: true,
        fields: [
          { id: 'balbuceo', label: '¿Presenta balbuceo?', type: 'checkbox' as const, required: true },
          { id: 'primeras_palabras', label: '¿Primeras palabras?', type: 'checkbox' as const, required: false },
          { id: 'senala', label: '¿Señala con el dedo?', type: 'checkbox' as const, required: true },
          { id: 'interaccion_social', label: 'Interacción social', type: 'select' as const, required: true, options: ['Normal', 'Disminuida', 'Ausente'] },
        ],
      },
      {
        id: 'alimentacion', title: 'Alimentación', required: true,
        fields: [
          { id: 'atragantamientos', label: '¿Episodios de atragantamiento?', type: 'checkbox' as const, required: true },
          { id: 'frecuencia_atragantamientos', label: 'Frecuencia', type: 'select' as const, required: false, options: ['Diario', 'Semanal', 'Mensual', 'Ocasional'] },
        ],
      },
    ],
  },
  {
    id: 'preescolar', label: 'Preescolar', conditions: { ageGroup: ['preescolar'] },
    sections: [
      BASE_QUESTIONS.datos_personales,
      BASE_QUESTIONS.motivo_consulta,
      {
        id: 'antecedentes_desarrollo', title: 'Antecedentes de Desarrollo', required: true,
        fields: [
          { id: 'oraciones', label: '¿Forma oraciones?', type: 'select' as const, required: true, options: ['No habla', '1-2 palabras', 'Frases 2-3 palabras', 'Frases complejas'] },
          { id: 'comprension_basica', label: 'Comprensión órdenes', type: 'select' as const, required: true, options: ['No comprende', '1 paso', '2 pasos', 'Complejas'] },
          { id: 'socializacion', label: 'Socialización con pares', type: 'select' as const, required: true, options: ['Normal', 'Evita pares', 'Limitada', 'No socializa'] },
          { id: 'intereses_restringidos', label: '¿Intereses restringidos?', type: 'checkbox' as const, required: false },
          { id: 'estereotipias', label: '¿Estereotipias?', type: 'checkbox' as const, required: false },
        ],
      },
    ],
  },
  {
    id: 'escolar', label: 'Escolar', conditions: { ageGroup: ['escolar'] },
    sections: [
      BASE_QUESTIONS.datos_personales,
      BASE_QUESTIONS.motivo_consulta,
      {
        id: 'rendimiento_escolar', title: 'Rendimiento Escolar', required: true,
        fields: [
          { id: 'nivel_educativo', label: 'Nivel educativo', type: 'select' as const, required: true, options: ['Inicial', 'Primario 1-3', 'Primario 4-6', 'Secundario'] },
          { id: 'dificultades_lectura', label: '¿Dificultades de lectura?', type: 'checkbox' as const, required: false },
          { id: 'dificultades_escritura', label: '¿Dificultades de escritura?', type: 'checkbox' as const, required: false },
          { id: 'adaptacion_escolar', label: 'Adaptación escolar', type: 'select' as const, required: false, options: ['Ninguna', 'APE', 'PAI', 'Otra'] },
          { id: 'terapia_previa', label: '¿Terapia previa?', type: 'checkbox' as const, required: false },
        ],
      },
    ],
  },
  {
    id: 'adolescente', label: 'Adolescente', conditions: { ageGroup: ['adolescente'] },
    sections: [
      BASE_QUESTIONS.datos_personales,
      BASE_QUESTIONS.motivo_consulta,
      {
        id: 'impacto_social', title: 'Impacto Social y Emocional', required: true,
        fields: [
          { id: 'autoestima', label: 'Autoestima percibida', type: 'select' as const, required: true, options: ['Buena', 'Regular', 'Baja'] },
          { id: 'relacion_pares', label: 'Relación con pares', type: 'select' as const, required: true, options: ['Muy buena', 'Regular', 'Evita pares', 'Conflicto'] },
          { id: 'impacto_voz', label: 'Impacto del problema', type: 'scale' as const, required: false, min: 1, max: 10 },
        ],
      },
    ],
  },
  {
    id: 'adulto', label: 'Adulto', conditions: { ageGroup: ['adulto'] },
    sections: [
      BASE_QUESTIONS.datos_personales,
      BASE_QUESTIONS.motivo_consulta,
      {
        id: 'antecedentes_laborales', title: 'Antecedentes Laborales', required: true,
        fields: [
          { id: 'ocupacion', label: 'Ocupación actual', type: 'text' as const, required: true },
          { id: 'uso_voz_laboral', label: '¿Uso intensivo de voz?', type: 'checkbox' as const, required: false },
          { id: 'tabaco', label: 'Consumo de tabaco', type: 'select' as const, required: false, options: ['No fuma', 'Exfumador', 'Fumador activo'] },
          { id: 'medicacion', label: 'Medicación actual', type: 'textarea' as const, required: false },
        ],
      },
    ],
  },
  {
    id: 'adulto_mayor', label: 'Adulto Mayor', conditions: { ageGroup: ['adulto_mayor'] },
    sections: [
      BASE_QUESTIONS.datos_personales,
      BASE_QUESTIONS.motivo_consulta,
      {
        id: 'antecedentes_geriatricos', title: 'Antecedentes Geriátricos', required: true,
        fields: [
          { id: 'polimedicacion', label: '¿Polimedicación (>5 fármacos)?', type: 'checkbox' as const, required: true },
          { id: 'independencia_funcional', label: 'Independencia funcional', type: 'select' as const, required: true, options: ['Independiente', 'Dependencia leve', 'Moderada', 'Severa'] },
          { id: 'deterioro_cognitivo', label: '¿Deterioro cognitivo?', type: 'checkbox' as const, required: false },
          { id: 'protesis_auditiva', label: '¿Prótesis auditiva?', type: 'checkbox' as const, required: false },
        ],
      },
    ],
  },
];
