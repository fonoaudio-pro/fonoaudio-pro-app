import { LanguageRule } from '../types';

export const LANGUAGE_RULES: LanguageRule[] = [
  {
    id: 'rule-lang-aphasia-acute',
    category: 'neurological_risk',
    triggerSigns: ['anomia', 'parafasias', 'agramatismo'],
    isRedFlag: true,
    severity: 'critical',
    actionLevel: 'emergency',
    clinicalLogic: 'La aparición súbita de anomia, parafasias y agramatismo sugiere un evento cerebrovascular (ACV) agudo.',
    suggestedAction: 'Derivación inmediata a neurología y urgencias para estabilización y neuroimagen.',
    sourceRef: 'Protocolo de ACV Agudo'
  },
  {
    id: 'rule-lang-receptive-deficit',
    category: 'receptive',
    triggerSigns: ['dificultad_comprension'],
    isRedFlag: true,
    severity: 'high',
    actionLevel: 'urgent',
    clinicalLogic: 'Déficits severos de comprensión pueden indicar una afasia de Wernicke o compromiso cognitivo significativo.',
    suggestedAction: 'Realizar evaluación neuropsicológica completa y resonancia magnética.',
    sourceRef: 'Manual de Afasias'
  },
  {
    id: 'rule-lang-boston-low',
    category: 'cognitive_load',
    triggerSigns: [],
    triggerMeasures: [
      { measure: 'score_boston_naming', threshold: 15, operator: 'lt' }
    ],
    isRedFlag: false,
    severity: 'medium',
    actionLevel: 'intervention',
    clinicalLogic: 'Un score bajo en el test de Boston indica un rendimiento lingüístico reducido en screening, compatible con alteración del lenguaje que requiere evaluación clínica.',
    suggestedAction: 'Implementar ejercicios de evocación léxica y facilitación semántica.',
    sourceRef: 'Test de Boston para la Nominación'
  },
  {
    id: 'rule-lang-expressive-struggle',
    category: 'expressive',
    triggerSigns: ['vocabulario_reducido', 'disfluencia'],
    isRedFlag: false,
    severity: 'medium',
    actionLevel: 'intervention',
    clinicalLogic: 'La reducción del vocabulario y disfluencias sugieren un trastorno del lenguaje expresivo o declive cognitivo leve.',
    suggestedAction: 'Implementar terapia de estimulación lingüística y ejercicios de evocación.',
    sourceRef: 'Guía de Rehabilitación del Lenguaje'
  },
  {
    id: 'rule-lang-mild-errors',
    category: 'expressive',
    triggerSigns: ['errores_sustitucion'],
    isRedFlag: false,
    severity: 'low',
    actionLevel: 'observation',
    clinicalLogic: 'Errores esporádicos de sustitución pueden deberse a fatiga o falta de atención.',
    suggestedAction: 'Monitorear la frecuencia de los errores en diferentes contextos comunicativos.',
    sourceRef: 'Fundamentos de Lingüística Clínica'
  }
];
