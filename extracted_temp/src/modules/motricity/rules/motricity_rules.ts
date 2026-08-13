import { MotricityRule } from '../types';

export const MOTRICITY_RULES: MotricityRule[] = [
  {
    id: 'rule-mot-acute-palsy',
    category: 'structural_risk',
    triggerSigns: ['asimetria_facial', 'hipotonia_labial'],
    isRedFlag: true,
    severity: 'critical',
    actionLevel: 'emergency',
    clinicalLogic: 'La aparición súbita de asimetría facial acompañada de hipotonía labial sugiere una parálisis facial aguda que requiere evaluación neurológica inmediata.',
    suggestedAction: 'Derivación inmediata a neurología para descartar evento cerebrovascular o neuropatía aguda.',
    sourceRef: 'Protocolo de Urgencias Neurológicas'
  },
  {
    id: 'rule-mot-severe-dysfunction',
    category: 'functional_pattern',
    triggerSigns: ['disfuncion_masticatoria', 'interposicion_lingual'],
    isRedFlag: true,
    severity: 'high',
    actionLevel: 'urgent',
    clinicalLogic: 'La disfunción masticatoria severa asociada a interposición lingual sugiere un compromiso estructural o neuromuscular significativo.',
    suggestedAction: 'Evaluación interdisciplinaria con odontopediatría y neurología.',
    sourceRef: 'Manual de Motricidad Orofacial'
  },
  {
    id: 'rule-mot-low-mobility',
    category: 'muscle_tone',
    triggerSigns: [],
    triggerMeasures: [
      { measure: 'tongue_mobility_score', threshold: 40, operator: 'lt' }
    ],
    isRedFlag: false,
    severity: 'medium',
    actionLevel: 'intervention',
    clinicalLogic: 'Un score de movilidad lingual bajo sugiere una hipotonía muscular que interfiere con las funciones orofaciales.',
    suggestedAction: 'Iniciar programa de ejercicios miofuncionales para fortalecer la musculatura lingual.',
    sourceRef: 'Terapia Miofuncional Clínica'
  },
  {
    id: 'rule-mot-mouth-breathing',
    category: 'functional_pattern',
    triggerSigns: ['respiracion_bucal', 'hipotonia_labial'],
    isRedFlag: false,
    severity: 'medium',
    actionLevel: 'intervention',
    clinicalLogic: 'La respiración bucal crónica asociada a hipotonía labial altera el desarrollo orofacial y la calidad del sueño.',
    suggestedAction: 'Derivación a otorrinolaringología para evaluar obstrucción nasal y terapia miofuncional.',
    sourceRef: 'Guía de Manejo de Respirador Bucal'
  },
  {
    id: 'rule-mot-mild-atypical',
    category: 'functional_pattern',
    triggerSigns: ['deglucion_atipica'],
    isRedFlag: false,
    severity: 'low',
    actionLevel: 'observation',
    clinicalLogic: 'La deglución atípica aislada sin compromiso respiratorio es un patrón funcional que requiere monitoreo.',
    suggestedAction: 'Observar la evolución y sugerir ejercicios básicos de posicionamiento lingual.',
    sourceRef: 'Fundamentos de Motricidad Orofacial'
  }
];
