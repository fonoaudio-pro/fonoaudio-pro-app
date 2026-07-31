import { NBAModuleReasoner } from '../engine';
import { NextBestAction } from '../types';
import { CognitionAnalysisResult } from '../../modules/cognition/types';
import { COGNITION_KNOWLEDGE_BASE } from '../../intelligence/knowledge_base/rules/cognition_rules';

export class CognitionReasoner extends NBAModuleReasoner<any, CognitionAnalysisResult> {
  protected moduleId = 'cognition';
  protected artifactIds = ['cognition_rule_memory_deficit', 'cognition_protocol_orientation', 'cognition_rule_executive_dysfunction'];

  async reason(context: any, moduleResult: CognitionAnalysisResult): Promise<NextBestAction[]> {
    const actions: NextBestAction[] = [];

    // 1. If red flags are detected, suggest urgent referral
    if (moduleResult.redFlags.length > 0) {
      actions.push({
        id: `cognition_red_flag_${Date.now()}`,
        action: 'referral',
        category: 'clinical',
        title: 'Urgent Clinical Referral',
        description: 'Red flags detected in cognition analysis.',
        rationale: `Detected red flags: ${moduleResult.redFlags.map(f => f.description).join(', ')}`,
        triggeringFacts: [], // In a real implementation, we'd pass fact IDs
        knowledgeArtifactsUsed: ['cognition_red_flags_general'],
        confidenceOrStrength: 1.0,
        clinicianDisposition: 'pending',
        metadata: { redFlags: moduleResult.redFlags }
      });
    }

    // 2. If instrumental assessment is needed
    if (moduleResult.needsInstrumentalAssessment) {
      actions.push({
        id: `cognition_instrumental_${Date.now()}`,
        action: 'reevaluation',
        category: 'clinical',
        title: 'Specialized Cognitive Assessment Recommended',
        description: 'Further neuropsychological investigation is suggested.',
        rationale: 'Clinical signs suggest the need for further cognitive evaluation.',
        triggeringFacts: [],
        knowledgeArtifactsUsed: ['cognition_instrumental_assessment'],
        confidenceOrStrength: 0.9,
        clinicianDisposition: 'pending',
      });
    }

    // 3. If action level is intervention, suggest home guides or material
    if (moduleResult.recommendedActionLevel === 'intervention') {
        actions.push({
            id: `cognition_home_guide_${Date.now()}`,
            action: 'home_guide',
            category: 'preventive',
            title: 'Cognitive Stimulation Home Guide',
            description: 'Provide patient with cognitive stimulation materials.',
            rationale: 'Intervention level recommended based on current findings.',
            triggeringFacts: [],
            knowledgeArtifactsUsed: ['cognition_intervention_protocol'],
            confidenceOrStrength: 0.8,
            clinicianDisposition: 'pending',
        });
    }

    return actions;
  }
}
