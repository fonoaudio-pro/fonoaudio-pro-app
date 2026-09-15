import { CognitionRule } from '../types';

export const COGNITION_RULES: CognitionRule[] = [
  {
    id: 'rule-cog-acute-delirium',
    category: 'emergency',
    triggerSigns: ['desorientacion_temporal', 'desorientacion_espacial', 'deficit_atencional'],
    isRedFlag: true,
    severity: 'critical',
    actionLevel: 'emergency',
    clinicalLogic: 'La aparición súbita de desorientación global y déficit atencional sugiere un cuadro confusional agudo (Delirium), que puede ser indicador de sepsis, intoxicación o evento neurológico.',
    suggestedAction: 'Derivación inmediata a urgencias médicas para estabilización y diagnóstico etiológico.',
    sourceRef: 'Protocolo de Manejo del Delirium'
  },
  {
    id: 'rule-cog-severe-executive',
    category: 'executive',
    triggerSigns: ['deterioro_funciones_ejecutivas', 'dificultad_planificacion'],
    isRedFlag: true,
    severity: 'high',
    actionLevel: 'urgent',
    clinicalLogic: 'Déficits severos en funciones ejecutivas y planificación comprometen la autonomía y seguridad del paciente en actividades de la vida diaria.',
    suggestedAction: 'Evaluación neuropsicológica exhaustiva y diseño de adaptaciones ambientales.',
    sourceRef: 'Manual de Neuropsicología Clínica'
  },
  {
    id: 'rule-cog-moca-low',
    category: 'memory',
    triggerSigns: [],
    triggerMeasures: [
      { measure: 'moca_score', threshold: 26, operator: 'lt' }
    ],
    isRedFlag: false,
    severity: 'medium',
    actionLevel: 'intervention',
    clinicalLogic: 'Un score MoCA inferior a 26 sugiere un deterioro cognitivo leve que requiere estimulación y seguimiento.',
    suggestedAction: 'Implementar programa de entrenamiento cognitivo y seguimiento trimestral.',
    sourceRef: 'Montreal Cognitive Assessment (MoCA) Guidelines'
  },
  {
    id: 'rule-cog-memory-isolated',
    category: 'memory',
    triggerSigns: ['fallas_memoria_corto_plazo'],
    isRedFlag: false,
    severity: 'low',
    actionLevel: 'observation',
    clinicalLogic: 'Fallas aisladas en la memoria a corto plazo pueden estar asociadas a estrés, ansiedad o procesos benignos de envejecimiento.',
    suggestedAction: 'Monitorear la evolución y sugerir pautas de organización externa (agendas, recordatorios).',
    sourceRef: 'Fundamentos de Cognición Clínica'
  }
];
