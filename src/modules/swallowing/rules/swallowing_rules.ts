import { SwallowingRule } from '../types';

export const SWALLOWING_RULES: SwallowingRule[] = [
  {
    id: 'rule-respiratory-distress',
    category: 'respiratory_alert',
    triggerSigns: ['distress_respiratorio'],
    isRedFlag: true,
    severity: 'critical',
    actionLevel: 'emergency',
    clinicalLogic: 'El distress respiratorio agudo durante la ingesta sugiere un compromiso vital inmediato de la vía aérea.',
    suggestedAction: 'DETENER ALIMENTACIÓN INMEDIATAMENTE. Activar protocolo de emergencia y evaluar vía aérea.',
    sourceRef: 'Protocolo de Emergencias en Disfagia - ASPAN'
  },
  {
    id: 'rule-aspiration-risk-high',
    category: 'aspirative_risk',
    triggerSigns: ['tos_post_ingesta', 'voz_humeda'],
    isRedFlag: true,
    severity: 'high',
    actionLevel: 'urgent',
    clinicalLogic: 'La combinación de tos y voz húmeda sugiere un riesgo significativo de penetración o aspiración laringotraqueal.',
    suggestedAction: 'Valorar la modificación de consistencias de líquidos (considerar espesantes) y considerar derivación a evaluación videofluoroscópica según criterio clínico.',
    sourceRef: 'Guidelines for Swallowing Disorders - ASHA'
  },
  {
    id: 'rule-swallowing-fois-low',
    category: 'oral_inefficiency',
    triggerSigns: [],
    triggerMeasures: [
      { measure: 'fois_score', threshold: 5, operator: 'lt' }
    ],
    isRedFlag: false,
    severity: 'medium',
    actionLevel: 'intervention',
    clinicalLogic: 'Un score FOIS menor a 5 indica una limitación en la ingesta oral que requiere adaptaciones o suplementación.',
    suggestedAction: 'Optimizar consistencia del bolo y realizar seguimiento de ingesta calórico-hídrica.',
    sourceRef: 'Functional Oral Intake Scale (FOIS)'
  },
  {
    id: 'rule-swallowing-desaturation',
    category: 'respiratory_alert',
    triggerSigns: [],
    triggerMeasures: [
      { measure: 'desaturacion_oxigeno_porcentaje', threshold: 3, operator: 'gt' }
    ],
    isRedFlag: false,
    severity: 'medium',
    actionLevel: 'intervention',
    clinicalLogic: 'Una desaturación de oxígeno mayor al 3% durante la ingesta es un indicador objetivo de potencial microaspiración silente.',
    suggestedAction: 'Monitorear la saturación durante las comidas y valorar derivación para evaluación instrumental.',
    sourceRef: 'Bedside Oximetry in Dysphagia Screening'
  },
  {
    id: 'rule-oral-inefficiency',
    category: 'oral_inefficiency',
    triggerSigns: ['residuo_oral', 'deglucion_lenta'],
    isRedFlag: false,
    severity: 'medium',
    actionLevel: 'intervention',
    clinicalLogic: 'La presencia de residuo oral y lentitud sugiere una ineficiencia en la fase oral de la deglución.',
    suggestedAction: 'Implementar maniobras de limpieza oral y optimizar el tamaño y consistencia del bolo.',
    sourceRef: 'Clinical Management of Dysphagia - Logemann'
  },
  {
    id: 'rule-mild-irritation',
    category: 'oral_inefficiency',
    triggerSigns: ['carraspeo_repetido'],
    isRedFlag: false,
    severity: 'low',
    actionLevel: 'observation',
    clinicalLogic: 'El carraspeo repetido sugiere la posible presencia de residuo faríngeo leve o irritación.',
    suggestedAction: 'Observar patrones de fatiga y sugerir hidratación frecuente.',
    sourceRef: 'Manual de Logopedia Clínica'
  }
];
