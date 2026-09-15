export const VOICE_KNOWLEDGE_BASE = [
  {
    id: 'voice_rule_persistent_dysphonia',
    version: '1.0.0',
    type: 'rule',
    name: 'Persistent Dysphonia Rule',
    description: 'Triggers when dysphonia is reported as persistent.',
    metadata: {
      triggerSigns: ['disfonia_persistente'],
      suggestedAction: 'instrumental_assessment'
    }
  },
  {
    id: 'voice_protocol_vocal_hygiene',
    version: '1.0.0',
    type: 'protocol',
    name: 'Vocal Hygiene Protocol',
    description: 'Basic vocal hygiene recommendations for patients with mild voice issues.',
    metadata: {
      action: 'home_guide',
      materialId: 'vocal_hygiene_guide_001'
    }
  },
  {
    id: 'voice_red_flags_general',
    version: '1.0.0',
    type: 'rule',
    name: 'General Voice Red Flags',
    description: 'General clinical red flags for voice assessment.',
    metadata: {
      action: 'referral'
    }
  },
  {
    id: 'voice_instrumental_assessment',
    version: '1.0.0',
    type: 'protocol',
    name: 'Instrumental Assessment Protocol',
    description: 'Protocol for recommending stroboscopy or laryngoscopy.',
    metadata: {
      action: 'reevaluation'
    }
  }
] as const;
