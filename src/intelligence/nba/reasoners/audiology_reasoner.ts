import { NBAModuleReasoner } from '../engine';
import { NextBestAction } from '../types';
import { AudiologyAnalysisResult } from '../../modules/audiology/types';

export class AudiologyReasoner extends NBAModuleReasoner<any, AudiologyAnalysisResult> {
  protected moduleId = 'audiology';
  protected artifactIds = ['audiology_rule_hearing_loss', 'audiology_protocol_audiometry', 'audiology_red_flags_general'];

  async reason(context: any, moduleResult: AudiologyAnalysisResult): Promise<NextBestAction[]> {
    const actions: NextBestAction[] = [];

    if (moduleResult.redFlags.length > 0) {
      actions.push({
        id: `audiology_red_flag_${Date.now()}`,
        action: 'referral',
        category: 'clinical',
        title: 'Derivación por Bandera Roja Auditiva',
        description: 'Se detectaron signos de alarma en el análisis auditivo que requieren evaluación urgente.',
        rationale: `Banderas rojas: ${moduleResult.redFlags.map(f => f.description).join(', ')}`,
        triggeringFacts: moduleResult.triggeringFactIds,
        knowledgeArtifactsUsed: ['audiology_red_flags_general'],
        confidenceOrStrength: 1.0,
        clinicianDisposition: 'pending',
        metadata: { redFlags: moduleResult.redFlags }
      });
    }

    if (moduleResult.needsInstrumentalAssessment) {
      actions.push({
        id: `audiology_instrumental_${Date.now()}`,
        action: 'reevaluation',
        category: 'clinical',
        title: 'Evaluación Instrumental Recomendada',
        description: 'Se sugiere audiometría de tonos puros, impedanciometría o emisiones otoacústicas.',
        rationale: 'Los hallazgos clínicos indican la necesidad de evaluación instrumental complementaria.',
        triggeringFacts: moduleResult.triggeringFactIds,
        knowledgeArtifactsUsed: ['audiology_protocol_audiometry'],
        confidenceOrStrength: 0.9,
        clinicianDisposition: 'pending',
      });
    }

    if (moduleResult.recommendedActionLevel === 'intervention') {
      actions.push({
        id: `audiology_home_guide_${Date.now()}`,
        action: 'home_guide',
        category: 'preventive',
        title: 'Guía de Protección Auditiva',
        description: 'Proporcionar materiales de educación sobre cuidado y protección auditiva.',
        rationale: 'Nivel de intervención recomendado según hallazgos actuales.',
        triggeringFacts: moduleResult.triggeringFactIds,
        knowledgeArtifactsUsed: ['audiology_rule_hearing_loss'],
        confidenceOrStrength: 0.8,
        clinicianDisposition: 'pending',
      });
    }

    return actions;
  }
}
