import { AudiologyRule } from '../types';

export const AUDIOLOGY_RULES: AudiologyRule[] = [
  {
    id: 'rule-audio-sudden-loss',
    category: 'emergency',
    triggerSigns: ['hipoacusia_percibida', 'tinnitus'],
    isRedFlag: true,
    severity: 'critical',
    actionLevel: 'emergency',
    clinicalLogic: 'La pérdida súbita de la audición asociada a tinnitus sugiere una emergencia otológica (SNHL aguda).',
    suggestedAction: 'Derivación inmediata a otorrinolaringología para tratamiento corticosteroideo urgente.',
    sourceRef: 'Protocolo de Hipoacusia Súbita'
  },
  {
    id: 'rule-audio-vertigo-hearing',
    category: 'vestibular',
    triggerSigns: ['vertigo_desequilibrio', 'hipoacusia_percibida'],
    isRedFlag: true,
    severity: 'high',
    actionLevel: 'urgent',
    clinicalLogic: 'La combinación de vértigo y pérdida auditiva sugiere patologías del oído interno como la Enfermedad de Ménière.',
    suggestedAction: 'Realizar pruebas vestibulares y derivación a neurología/ORL.',
    sourceRef: 'Guía de Vértigo y Equilibrio'
  },
  {
    id: 'rule-audio-otitis-signs',
    category: 'conductive',
    triggerSigns: ['otalgia', 'plenitud_auricular'],
    isRedFlag: false,
    severity: 'medium',
    actionLevel: 'intervention',
    clinicalLogic: 'La otalgia y la sensación de plenitud son compatibles con procesos inflamatorios o efusiones en el oído medio.',
    suggestedAction: 'Realizar timpanometría y valorar derivación a ORL para limpieza o tratamiento médico.',
    sourceRef: 'Manual de Patología Otológica'
  },
  {
    id: 'rule-audio-discrimination-low',
    category: 'sensorineural',
    triggerSigns: [],
    triggerMeasures: [
      { measure: 'discriminacion_voz_porcentaje', threshold: 50, operator: 'lt' }
    ],
    isRedFlag: false,
    severity: 'medium',
    actionLevel: 'intervention',
    clinicalLogic: 'Una discriminación vocal inferior al 50% indica un compromiso severo de la comprensión auditiva, independientemente del umbral.',
    suggestedAction: 'Evaluar necesidad de audífonos con optimización de frecuencia o implante coclear.',
    sourceRef: 'Estándares de Audiometría Clínica'
  },
  {
    id: 'rule-audio-tinnitus-isolated',
    category: 'sensorineural',
    triggerSigns: ['tinnitus'],
    isRedFlag: false,
    severity: 'low',
    actionLevel: 'observation',
    clinicalLogic: 'El tinnitus aislado sin otros síntomas auditivos requiere monitoreo y evaluación de factores desencadenantes.',
    suggestedAction: 'Sugerir higiene sonora y seguimiento trimestral.',
    sourceRef: 'Guía de Manejo de Tinnitus'
  }
];
