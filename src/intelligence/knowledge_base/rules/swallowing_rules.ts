export const SWALLOWING_KNOWLEDGE_BASE = [
  {
    id: 'swallowing_rule_aspiration_risk',
    version: '1.0.0',
    type: 'rule',
    name: 'Aspiration Risk Rule',
    description: 'Triggers when signs of aspiration (e.g., coughing, wet voice) are detected.',
    metadata: {
      triggerSigns: ['tos_post_ingesta', 'voz_humeda'],
      suggestedAction: 'referral'
    }
  },
  {
    id: 'swallowing_protocol_safety',
    version: '1.0.0',
    type: 'protocol',
    name: 'Swallowing Safety Protocol',
    description: 'Basic swallowing safety instructions for patients with mild dysphagia.',
    metadata: {
      action: 'home_guide',
      materialId: 'swallowing_safety_guide_001'
    }
  },
  {
    id: 'swallowing_red_flags_general',
    version: '1.0.0',
    type: 'rule',
    name: 'General Swallowing Red Flags',
    description: 'General clinical red flags for swallowing assessment.',
    metadata: {
      action: 'referral'
    }
  },
  {
    id: 'swallowing_instrumental_assessment',
    version: '1.0.0',
    type: 'protocol',
    name: 'Instrumental Assessment Protocol',
    description: 'Protocol for recommending videofluoroscopy or FEES.',
    metadata: {
      action: 'reevaluation'
    }
  }
] as const;
