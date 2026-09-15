export const LANGUAGE_KNOWLEDGE_BASE = [
  {
    id: 'language_rule_anomia',
    version: '1.0.0',
    type: 'rule',
    name: 'Anomia Rule',
    description: 'Triggers when anomia is detected.',
    metadata: {
      triggerSigns: ['anomia'],
      suggestedAction: 'referral'
    }
  },
  {
    id: 'language_protocol_expressive_language',
    version: '1.0.0',
    type: 'protocol',
    name: 'Expressive Language Protocol',
    description: 'Protocol for patients with expressive language difficulties.',
    metadata: {
      action: 'home_guide',
      materialId: 'expressive_language_guide_001'
    }
  },
  {
    id: 'language_rule_agrammatism',
    version: '1.0.0',
    type: 'rule',
    name: 'Agrammatism Rule',
    description: 'Triggers when agrammatism is detected.',
    metadata: {
      triggerSigns: ['agramatismo'],
      suggestedAction: 'referral'
    }
  },
  {
    id: 'language_red_flags_general',
    version: '1.0.0',
    type: 'rule',
    name: 'General Language Red Flags',
    description: 'General clinical red flags for language assessment.',
    metadata: {
      action: 'referral'
    }
  }
] as const;
