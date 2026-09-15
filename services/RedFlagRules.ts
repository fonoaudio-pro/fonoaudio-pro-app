import { ClinicalAxis } from '../types/clinical_history';

export interface RedFlagRule {
  id: string;
  axis: ClinicalAxis;
  fieldId: string;
  condition: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in_list';
  value: any;
  severity: 'high' | 'critical';
  title: string;
  description: string;
  suggestedAction: string;
  evidence: string;
  enabled: boolean;
}

export interface RedFlagMatch {
  ruleId: string;
  axis: ClinicalAxis;
  fieldId: string;
  fieldValue: any;
  severity: 'high' | 'critical';
  title: string;
  description: string;
  suggestedAction: string;
  evidence: string;
  triggeredAt: string;
}

const RED_FLAG_RULES: RedFlagRule[] = [
  // NEONATO
  {
    id: 'neonato_cribado_no_pasa',
    axis: 'audicion',
    fieldId: 'cribado_neonatal',
    condition: 'in_list',
    value: ['No pasa OD', 'No pasa OI', 'No realizado'],
    severity: 'critical',
    title: 'Cribado auditivo neonatal alterado',
    description: 'El criado auditivo neonatal no pasó en al menos un oído o no fue realizado. Requiere evaluación auditiva urgente.',
    suggestedAction: 'Solicitar evaluación auditiva con potenciales evocados auditivos (PEA) en las próximas 48-72 horas.',
    evidence: 'Cribado neonatal: {value}',
    enabled: true
  },
  {
    id: 'neonato_peso_bajo',
    axis: 'cognicion',
    fieldId: 'peso_nacimiento',
    condition: 'less_than',
    value: 2500,
    severity: 'high',
    title: 'Peso al nacer bajo',
    description: 'El peso al nacer es menor a 2500g, lo que incrementa el riesgo de retraso en el desarrollo.',
    suggestedAction: 'Evaluar desarrollo psicomotor con EDAME revisado y considerar intervención temprana.',
    evidence: 'Peso al nacer: {value}g',
    enabled: true
  },

  // LACTANTE
  {
    id: 'lactante_senala_no',
    axis: 'lenguaje',
    fieldId: 'senala',
    condition: 'equals',
    value: false,
    severity: 'critical',
    title: 'No señala con el dedo',
    description: 'El lactante no señala con el dedo índice, lo que es un indicador temprano de retraso en el desarrollo del lenguaje y comunicación.',
    suggestedAction: 'Referir a evaluación del desarrollo del lenguaje y considerar evaluación para Trastorno del Espectro Autista (TEA).',
    evidence: 'Señalización con dedo: no',
    enabled: true
  },
  {
    id: 'lactante_balbuceo_no',
    axis: 'lenguaje',
    fieldId: 'balbuceo',
    condition: 'equals',
    value: false,
    severity: 'critical',
    title: 'No presenta balbuceo',
    description: 'El lactante no presenta balbuceo, lo que indica retraso significativo en el precursores del lenguaje.',
    suggestedAction: 'Evaluación auditiva completa y evaluación del desarrollo del lenguaje.',
    evidence: 'Balbuceo: ausente',
    enabled: true
  },
  {
    id: 'lactante_atragantamientos_frecuentes',
    axis: 'deglucion',
    fieldId: 'frecuencia_atragantamientos',
    condition: 'in_list',
    value: ['Diario', 'Semanal'],
    severity: 'high',
    title: 'Atragantamientos frecuentes',
    description: 'Episodios de atragantamiento con frecuencia diaria o semanal, lo que indica posible alteración en la deglución.',
    suggestedAction: 'Evaluación fonoaudiológica de deglución con video fluoroscopia o FEES.',
    evidence: 'Frecuencia de atragantamientos: {value}',
    enabled: true
  },

  // PREESCOLAR
  {
    id: 'preescolar_no_habla',
    axis: 'lenguaje',
    fieldId: 'oraciones',
    condition: 'equals',
    value: 'No habla',
    severity: 'critical',
    title: 'No produce habla',
    description: 'El niño en edad preescolar no produce habla, lo que constituye un retraso severo del lenguaje.',
    suggestedAction: 'Evaluación urgente del lenguaje expresivo y comprensivo, considerar alternativas y aumentativas de comunicación.',
    evidence: 'Producción de habla: ausente',
    enabled: true
  },
  {
    id: 'preescolar_estereotipias',
    axis: 'lenguaje',
    fieldId: 'estereotipias',
    condition: 'equals',
    value: true,
    severity: 'high',
    title: 'Presencia de estereotipias',
    description: 'Se observan estereotipias, lo que puede indicar Trastorno del Espectro Autista u otras condiciones del neurodesarrollo.',
    suggestedAction: 'Evaluación integral del neurodesarrollo con psicopedagogía y neurología.',
    evidence: 'Estereotipias: presentes',
    enabled: true
  },
  {
    id: 'preescolar_intereses_restringidos',
    axis: 'lenguaje',
    fieldId: 'intereses_restringidos',
    condition: 'equals',
    value: true,
    severity: 'high',
    title: 'Intereses restringidos',
    description: 'Intereses muy limitados o repetitivos, patrón asociado a TEA o condiciones del neurodesarrollo.',
    suggestedAction: 'Evaluación del desarrollo con foco en interacción social y flexibilidad cognitiva.',
    evidence: 'Intereses restringidos: presentes',
    enabled: true
  },

  // ESCOLAR
  {
    id: 'escolar_no_lee',
    axis: 'lenguaje',
    fieldId: 'dificultades_lectura',
    condition: 'equals',
    value: true,
    severity: 'high',
    title: 'Dificultades de lectura',
    description: 'Dificultades significativas de lectura en edad escolar, indicativo de possible dislexia.',
    suggestedAction: 'Evaluación psicoeducativa completa y considerar intervención en lectura.',
    evidence: 'Dificultades de lectura: presentes',
    enabled: true
  },
  {
    id: 'escolar_no_escribe',
    axis: 'lenguaje',
    fieldId: 'dificultades_escritura',
    condition: 'equals',
    value: true,
    severity: 'high',
    title: 'Dificultades de escritura',
    description: 'Dificultades significativas de escritura, indicativo de disgrafía o trastorno del aprendizaje.',
    suggestedAction: 'Evaluación psicoeducativa y terapia de escritura.',
    evidence: 'Dificultades de escritura: presentes',
    enabled: true
  },

  // ADULTO
  {
    id: 'adulto_disfonia_prolongada',
    axis: 'voz',
    fieldId: 'terapia_previa',
    condition: 'equals',
    value: true,
    severity: 'high',
    title: 'Disfonía con terapia previa',
    description: 'Disfonía que no respondió a terapia previa, sugiere condición orgánica o hábitos vocales arraigados.',
    suggestedAction: 'Evaluación laringológica y terapia vocal intensiva.',
    evidence: 'Terapia previa: sin mejoría',
    enabled: true
  },

  // ADULTO MAYOR
  {
    id: 'adulto_mayor_polimedicacion',
    axis: 'cognicion',
    fieldId: 'polimedicacion',
    condition: 'equals',
    value: true,
    severity: 'high',
    title: 'Polimedicación',
    description: 'Uso de más de 5 fármacos, incrementa riesgo de interacciones y efectos adversos cognitivos.',
    suggestedAction: 'Revisión de medicación con geriatra y evaluar impacto cognitivo.',
    evidence: 'Polimedicación: sí (>5 fármacos)',
    enabled: true
  },
  {
    id: 'adulto_mayor_deterioro_cognitivo',
    axis: 'cognicion',
    fieldId: 'deterioro_cognitivo',
    condition: 'equals',
    value: true,
    severity: 'critical',
    title: 'Deterioro cognitivo reportado',
    description: 'Se reporta deterioro cognitivo, requiere evaluación neuropsicológica urgente.',
    suggestedAction: 'Evaluación neuropsicológica completa y derivación a neurología.',
    evidence: 'Deterioro cognitivo: presente',
    enabled: true
  },

  // ÁREA COMÚN - AUDICIÓN
  {
    id: 'perdida_auditoria_severa',
    axis: 'audicion',
    fieldId: 'nivel_perdida',
    condition: 'in_list',
    value: ['Severa (56-70 dB)', 'Profunda (>70 dB)'],
    severity: 'critical',
    title: 'Pérdida auditiva severa/profunda',
    description: 'Pérdida auditiva de grado severo o profundo que afecta significativamente la comunicación.',
    suggestedAction: 'Evaluación audiológica completa y considerar auxiliares auditivos o implante coclear.',
    evidence: 'Nivel de pérdida: {value}',
    enabled: true
  },
  {
    id: 'auxiliares_rechazo',
    axis: 'audicion',
    fieldId: 'adaptacion_auxiliares',
    condition: 'equals',
    value: 'Rechaza',
    severity: 'high',
    title: 'Rechazo a auxiliares auditivos',
    description: 'El paciente rechaza el uso de auxiliares auditivos, lo que impacta negativamente en la comunicación.',
    suggestedAction: 'Trabajo de adherencia y adaptación a auxiliares, considerar motivación y barreras.',
    evidence: 'Adaptación a auxiliares: rechazo',
    enabled: true
  }
];

export class RedFlagRulesService {
  static getRules(): RedFlagRule[] {
    return [...RED_FLAG_RULES];
  }

  static getRulesByAxis(axis: ClinicalAxis): RedFlagRule[] {
    return RED_FLAG_RULES.filter(r => r.axis === axis && r.enabled);
  }

  static evaluateAnswers(
    answers: Record<string, any>,
    affectedAreas: ClinicalAxis[]
  ): RedFlagMatch[] {
    const matches: RedFlagMatch[] = [];
    const relevantRules = RED_FLAG_RULES.filter(
      r => r.enabled && affectedAreas.includes(r.axis)
    );

    for (const rule of relevantRules) {
      const fieldValue = answers[rule.fieldId];
      if (fieldValue === undefined || fieldValue === null) continue;

      let triggered = false;

      switch (rule.condition) {
        case 'equals':
          triggered = fieldValue === rule.value;
          break;
        case 'contains':
          triggered = String(fieldValue).toLowerCase().includes(String(rule.value).toLowerCase());
          break;
        case 'greater_than':
          triggered = Number(fieldValue) > Number(rule.value);
          break;
        case 'less_than':
          triggered = Number(fieldValue) < Number(rule.value);
          break;
        case 'in_list':
          triggered = Array.isArray(rule.value) && rule.value.includes(fieldValue);
          break;
      }

      if (triggered) {
        const evidence = rule.evidence.replace('{value}', String(fieldValue));
        matches.push({
          ruleId: rule.id,
          axis: rule.axis,
          fieldId: rule.fieldId,
          fieldValue,
          severity: rule.severity,
          title: rule.title,
          description: rule.description,
          suggestedAction: rule.suggestedAction,
          evidence,
          triggeredAt: new Date().toISOString()
        });
      }
    }

    return matches;
  }

  static getRuleById(ruleId: string): RedFlagRule | undefined {
    return RED_FLAG_RULES.find(r => r.id === ruleId);
  }

  static getAuditLog(matches: RedFlagMatch[]): Array<{
    ruleId: string;
    axis: string;
    field: string;
    value: any;
    severity: string;
    triggeredAt: string;
  }> {
    return matches.map(m => ({
      ruleId: m.ruleId,
      axis: m.axis,
      field: m.fieldId,
      value: m.fieldValue,
      severity: m.severity,
      triggeredAt: m.triggeredAt
    }));
  }
}
