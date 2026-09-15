import { NBAModuleReasoner } from '../engine';
import { NextBestAction } from '../types';
import { MotricityAnalysisResult } from '../../modules/motricity/types';

export class MotricityReasoner extends NBAModuleReasoner<any, MotricityAnalysisResult> {
  protected moduleId = 'motricity';
  protected artifactIds = ['motricity_rule_orofacial_dysfunction', 'motricity_protocol_orofacial_motor', 'motricity_red_flags_general'];

  async reason(context: any, moduleResult: MotricityAnalysisResult): Promise<NextBestAction[]> {
    const actions: NextBestAction[] = [];

    if (moduleResult.redFlags.length > 0) {
      actions.push({
        id: `motricity_red_flag_${Date.now()}`,
        action: 'referral',
        category: 'clinical',
        title: 'Derivación por Bandera Roja Motriz',
        description: 'Se detectaron signos de alarma en el análisis de motricidad orofacial.',
        rationale: `Banderas rojas: ${moduleResult.redFlags.map(f => f.description).join(', ')}`,
        triggeringFacts: moduleResult.triggeringFactIds,
        knowledgeArtifactsUsed: ['motricity_red_flags_general'],
        confidenceOrStrength: 1.0,
        clinicianDisposition: 'pending',
        metadata: { redFlags: moduleResult.redFlags }
      });
    }

    if (moduleResult.needsInstrumentalAssessment) {
      actions.push({
        id: `motricity_instrumental_${Date.now()}`,
        action: 'reevaluation',
        category: 'clinical',
        title: 'Evaluación Instrumental Recomendada',
        description: 'Se sugiere evaluación de la función orofacial con instrumentación complementaria.',
        rationale: 'Los hallazgos clínicos indican la necesidad de evaluación instrumental.',
        triggeringFacts: moduleResult.triggeringFactIds,
        knowledgeArtifactsUsed: ['motricity_protocol_orofacial_motor'],
        confidenceOrStrength: 0.9,
        clinicianDisposition: 'pending',
      });
    }

    if (moduleResult.recommendedActionLevel === 'intervention') {
      actions.push({
        id: `motricity_home_guide_${Date.now()}`,
        action: 'home_guide',
        category: 'preventive',
        title: 'Guía de Ejercicios Orofaciales',
        description: 'Proporcionar material de ejercicios de motricidad orofacial para el hogar.',
        rationale: 'Nivel de intervención recomendado según hallazgos actuales.',
        triggeringFacts: moduleResult.triggeringFactIds,
        knowledgeArtifactsUsed: ['motricity_rule_orofacial_dysfunction'],
        confidenceOrStrength: 0.8,
        clinicianDisposition: 'pending',
      });
    }

    return actions;
  }
}
