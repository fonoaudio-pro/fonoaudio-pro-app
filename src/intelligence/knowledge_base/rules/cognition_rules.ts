export const COGNITION_KNOWLEDGE_BASE = [
  {
    id: 'cognition_rule_memory_deficit',
    version: '1.0.0',
    type: 'rule',
    name: 'Memory Deficit Rule',
    description: 'Triggers when significant memory deficits are detected.',
    metadata: {
      triggerMeasures: [{ measure: 'mmse_score', threshold: 24, operator: 'lt' }],
      suggestedAction: 'reevaluation'
    }
  },
  {
    id: 'cognition_protocol_orientation',
    version: '1.0.0',
    type: 'protocol',
    name: 'Orientation Protocol',
    description: 'Protocol for patients with disorientation.',
    metadata: {
      triggerSigns: ['desorientacion_temporal', 'desorientacion_espacial'],
      suggestedAction: 'referral'
    }
  },
  {
    id: 'cognition_rule_executive_dysfunction',
    version: '1.0.0',
    type: 'rule',
    name: 'Executive Dysfunction Rule',
    description: 'Triggers when executive function deficits are detected.',
    metadata: {
      triggerSigns: ['deterioro_funciones_ejecutivas', 'dificultad_planificacion'],
      suggestedAction: 'reevaluation'
    }
  },
  {
    id: 'cognition_red_flags_general',
    version: '1.0.0',
    type: 'rule',
    name: 'General Cognition Red Flags',
    description: 'General clinical red flags for cognition assessment.',
    metadata: {
      action: 'referral'
    }
  },
  {
    id: 'cognition_instrumental_assessment',
    version: '1.0.0',
    type: 'protocol',
    name: 'Instrumental Assessment Protocol',
    description: 'Protocol for recommending neuropsychological testing.',
    metadata: {
      action: 'reevaluation'
    }
  },
  {
    id: 'cognition_intervention_protocol',
    version: '1.0.0',
    type: 'protocol',
    name: 'Cognitive Stimulation Protocol',
    description: 'Protocol for cognitive stimulation intervention.',
    metadata: {
      action: 'home_guide'
    }
  }
] as const;
