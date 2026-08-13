import { VoiceRule } from '../types';

export const VOICE_RULES: VoiceRule[] = [
  {
    id: 'rule-voice-stridor',
    category: 'organic_risk',
    triggerSigns: ['estridor'],
    isRedFlag: true,
    severity: 'critical',
    actionLevel: 'emergency',
    clinicalLogic: 'La presencia de estridor sugiere una obstrucción superior de la vía aérea, indicando un riesgo vital inmediato.',
    suggestedAction: 'Cese inmediato de actividad fonatoria. Valoración urgente por otorrinolaringología y aseguramiento de vía aérea.',
    sourceRef: 'Protocolo de Urgencias Laringológicas'
  },
  {
    id: 'rule-voice-persistent-dysphonia',
    category: 'organic_risk',
    triggerSigns: ['disfonia_persistente', 'esfuerzo_fonatorio'],
    isRedFlag: true,
    severity: 'high',
    actionLevel: 'urgent',
    clinicalLogic: 'Una disfonía persistente asociada a esfuerzo fonatorio sugiere la posible presencia de lesiones orgánicas (nódulos, pólipos o malignidad).',
    suggestedAction: 'Valorar laringoscopía directa para descartar patología orgánica.',
    sourceRef: 'Guía de Práctica Clínica en Disfonías'
  },
  {
    id: 'rule-voice-red-flags-orl',
    category: 'organic_risk',
    triggerSigns: ['perdida_peso', 'hemoptisis', 'masa_cuello', 'cambio_voz_repentino'],
    isRedFlag: true,
    severity: 'critical',
    actionLevel: 'emergency',
    clinicalLogic: 'La combinación de cambios vocales con signos sistémicos (pérdida de peso, hemoptisis) o locales (masa en cuello) es altamente sugestiva de patología neoplásica.',
    suggestedAction: 'Derivación inmediata a ORL para laringoscopía y biopsia si es necesario.',
    sourceRef: 'Manual de Oncología Cabeza y Cuello'
  },
  {
    id: 'rule-voice-jitter-high',
    category: 'organic_risk',
    triggerSigns: [],
    triggerMeasures: [
      { measure: 'jitter', threshold: 1.04, operator: 'gt' }
    ],
    isRedFlag: false,
    severity: 'medium',
    actionLevel: 'intervention',
    clinicalLogic: 'Un jitter elevado (>1.04%) sugiere inestabilidad glótica significativa, compatible con patología orgánica o neurológica.',
    suggestedAction: 'Realizar laringoscopía para evaluar cierre glótico.',
    sourceRef: 'Manual de Acústica Vocal'
  },
  {
    id: 'rule-voice-fatigue',
    category: 'functional_disorder',
    triggerSigns: ['fatiga_vocal'],
    isRedFlag: false,
    severity: 'medium',
    actionLevel: 'intervention',
    clinicalLogic: 'La fatiga vocal recurrente sugiere un mal uso o abuso de la voz, indicativo de un trastorno funcional.',
    suggestedAction: 'Implementar programa de higiene vocal y reeducación fonatoria.',
    sourceRef: 'Manual de Rehabilitación Vocal'
  },
  {
    id: 'rule-voice-mild-tension',
    category: 'vocal_hygiene',
    triggerSigns: ['esfuerzo_fonatorio'],
    isRedFlag: false,
    severity: 'low',
    actionLevel: 'observation',
    clinicalLogic: 'El esfuerzo fonatorio ocasional puede deberse a tensión muscular transitoria o falta de hidratación.',
    suggestedAction: 'Observar patrones de tensión y sugerir pautas básicas de higiene vocal.',
    sourceRef: 'Fundamentos de Foniatría'
  }
];
