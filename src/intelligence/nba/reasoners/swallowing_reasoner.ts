import { NBAModuleReasoner } from '../engine';
import { NextBestAction } from '../types';
import { SwallowingAnalysisResult } from '../../modules/swallowing/types';
import { SWALLOWING_KNOWLEDGE_BASE } from '../../intelligence/knowledge_base/rules/swallowing_rules';

export class SwallowingReasoner extends NBAModuleReasoner<any, SwallowingAnalysisResult> {
  protected moduleId = 'swallowing';
  protected artifactIds = ['swallowing_rule_aspiration_risk', 'swallowing_protocol_safety', 'swallowing_red_flags_general', 'swallowing_instrumental_assessment'];

  async reason(context: any, moduleResult: SwallowingAnalysisResult): Promise<NextBestAction[]> {
    const actions: NextBestAction[] = [];

    // 1. If red flags are detected, suggest urgent referral or re-evaluation
    if (moduleResult.redFlags.length > 0) {
      actions.push({
        id: `swallowing_red_flag_${Date.now()}`,
        action: 'referral',
        category: 'clinical',
        title: 'Urgent Clinical Referral',
        description: 'Red flags detected in swallowing analysis.',
        rationale: `Detected red flags: ${moduleResult.redFlags.map((f: any) => f.description).join(', ')}`,
        triggeringFacts: moduleResult.triggeringFactIds,
        knowledgeArtifactsUsed: ['swallowing_red_flags_general'],
        confidenceOrStrength: 1.0,
        clinicianDisposition: 'pending',
        metadata: { redFlags: moduleResult.redFlags }
      });
    }

    // 2. If instrumental assessment is needed
    if (moduleResult.needsInstrumentalAssessment) {
      actions.push({
        id: `swallowing_instrumental_${Date.now()}`,
        action: 'reevaluation',
        category: 'clinical',
        title: 'Instrumental Assessment Recommended',
        description: 'Further investigation with videofluoroscopy or FEES is suggested.',
        rationale: 'Clinical signs suggest the need for instrumental assessment.',
        triggeringFacts: moduleResult.triggeringFactIds,
        knowledgeArtifactsUsed: ['swallowing_instrumental_assessment'],
        confidenceOrStrength: 0.9,
        clinicianDisposition: 'pending',
      });
    }

    // 3. If action level is intervention, suggest home guides or material
    if (moduleResult.recommendedActionLevel === 'intervention') {
        actions.push({
            id: `swallowing_home_guide_${Date.now()}`,
            action: 'home_guide',
            category: 'preventive',
            title: 'Swallowing Safety Home Guide',
            description: 'Provide patient with dietary modification or swallowing safety instructions.',
            rationale: 'Intervention level recommended based on current findings.',
            triggeringFacts: moduleResult.triggeringFactIds,
            knowledgeArtifactsUsed: ['swallowing_protocol_safety'],
            confidenceOrStrength: 0.8,
            clinicianDisposition: 'pending',
        });
    }

    return actions;
  }
}
