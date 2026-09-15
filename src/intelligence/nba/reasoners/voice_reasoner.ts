import { NBAModuleReasoner } from '../engine';
import { NextBestAction } from '../types';
import { VoiceAnalysisResult } from '../../modules/voice/service';

export class VoiceReasoner extends NBAModuleReasoner<any, VoiceAnalysisResult> {
  protected moduleId = 'voice';
  protected artifactIds = ['voice_rule_persistent_dysphonia', 'voice_protocol_vocal_hygiene', 'voice_red_flags_general', 'voice_instrumental_assessment'];

  async reason(context: any, moduleResult: VoiceAnalysisResult): Promise<NextBestAction[]> {
    const actions: NextBestAction[] = [];

    // 1. If red flags are detected, suggest urgent referral or re-evaluation
    if (moduleResult.redFlags.length > 0) {
      actions.push({
        id: `voice_red_flag_${Date.now()}`,
        action: 'referral',
        category: 'clinical',
        title: 'Urgent Clinical Referral',
        description: 'Red flags detected in voice analysis.',
        rationale: `Detected red flags: ${moduleResult.redFlags.map(f => f.description).join(', ')}`,
        triggeringFacts: moduleResult.triggeringFactIds,
        knowledgeArtifactsUsed: ['voice_red_flags_general'],
        confidenceOrStrength: 1.0,
        clinicianDisposition: 'pending',
        metadata: { redFlags: moduleResult.redFlags }
      });
    }

    // 2. If instrumental assessment is needed
    if (moduleResult.needsInstrumentalAssessment) {
      actions.push({
        id: `voice_instrumental_${Date.now()}`,
        action: 'reevaluation',
        category: 'clinical',
        title: 'Instrumental Assessment Recommended',
        description: 'Further investigation with stroboscopy or laryngoscopy is suggested.',
        rationale: 'Clinical signs suggest the need for instrumental assessment.',
        triggeringFacts: moduleResult.triggeringFactIds,
        knowledgeArtifactsUsed: ['voice_instrumental_assessment'],
        confidenceOrStrength: 0.9,
        clinicianDisposition: 'pending',
      });
    }

    // 3. If action level is intervention, suggest home guides or material
    if (moduleResult.recommendedActionLevel === 'intervention') {
        actions.push({
            id: `voice_home_guide_${Date.now()}`,
            action: 'home_guide',
            category: 'preventive',
            title: 'Voice Hygiene Home Guide',
            description: 'Provide patient with vocal hygiene education materials.',
            rationale: 'Intervention level recommended based on current findings.',
            triggeringFacts: moduleResult.triggeringFactIds,
            knowledgeArtifactsUsed: ['voice_protocol_vocal_hygiene'],
            confidenceOrStrength: 0.8,
            clinicianDisposition: 'pending',
        });
    }

    return actions;
  }
}
