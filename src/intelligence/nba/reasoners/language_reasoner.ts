import { NBAModuleReasoner } from '../engine';
import { NextBestAction } from '../types';
import { LanguageAnalysisResult } from '../../modules/language/service';
import { LANGUAGE_KNOWLEDGE_BASE } from '../../intelligence/knowledge_base/rules/language_rules';

export class LanguageReasoner extends NBAModuleReasoner<any, LanguageAnalysisResult> {
  protected moduleId = 'language';
  protected artifactIds = ['language_rule_anomia', 'language_protocol_expressive_language', 'language_rule_agrammatism'];

  async reason(context: any, moduleResult: LanguageAnalysisResult): Promise<NextBestAction[]> {
    const actions: NextBestAction[] = [];

    // 1. If red flags are detected, suggest urgent referral
    if (moduleResult.redFlags.length > 0) {
      actions.push({
        id: `language_red_flag_${Date.now()}`,
        action: 'referral',
        category: 'clinical',
        title: 'Urgent Clinical Referral',
        description: 'Red flags detected in language analysis.',
        rationale: `Detected red flags: ${moduleResult.redFlags.map(f => f.description).join(', ')}`,
        triggeringFacts: moduleResult.triggeringFactIds || [],
        knowledgeArtifactsUsed: ['language_red_flags_general'],
        confidenceOrStrength: 1.0,
        clinicianDisposition: 'pending',
        metadata: { redFlags: moduleResult.redFlags }
      });
    }

    // 2. If action level is intervention, suggest home guides
    if (moduleResult.recommendedActionLevel === 'intervention') {
        actions.push({
            id: `language_home_guide_${Date.now()}`,
            action: 'home_guide',
            category: 'preventive',
            title: 'Language Stimulation Home Guide',
            description: 'Provide patient with language stimulation materials.',
            rationale: 'Intervention level recommended based on current findings.',
            triggeringFacts: moduleResult.triggeringFactIds || [],
            knowledgeArtifactsUsed: ['language_protocol_expressive_language'],
            confidenceOrStrength: 0.8,
            clinicianDisposition: 'pending',
        });
    }

    return actions;
  }
}
