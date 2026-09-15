import { SwallowingSign, SwallowingMeasure, SwallowingRule, SwallowingRiskLevel, ActionLevel, SwallowingAnalysisResult } from './types';
import { SWALLOWING_RULES } from './rules/swallowing_rules';
import { SWALLOWING_MAPPING } from './mapping/swallowing_mapping';
import { ClinicalFact, RedFlag, Observation } from '../../types';
import { supabase as defaultSupabase } from '../../../utils/supabaseClient';

export class SwallowingService {
  private supabase = defaultSupabase;

  constructor(supabaseClient?: any) {
    if (supabaseClient) this.supabase = supabaseClient;
  }

  async analyze(facts: ClinicalFact[], patientId?: string): Promise<SwallowingAnalysisResult> {
    const detectedSigns: SwallowingSign[] = [];
    const detectedMeasures: SwallowingMeasure[] = [];
    const triggeringFactIds: string[] = [];
    
    const allSigns = Object.keys(SWALLOWING_MAPPING) as SwallowingSign[];
    const allMeasures: SwallowingMeasure[] = [
      'fois_score',
      'masa_score',
      'tiempo_transito_segundos',
      'desaturacion_oxigeno_porcentaje'
    ];

    facts.forEach(fact => {
      if (!fact.isResolved && fact.category === 'swallowing') {
        const signValue = fact.sign;
        if (allSigns.includes(signValue as SwallowingSign)) {
          detectedSigns.push(signValue as SwallowingSign);
          triggeringFactIds.push(fact.id);
        } else if (allMeasures.includes(signValue as SwallowingMeasure)) {
          detectedMeasures.push(signValue as SwallowingMeasure);
          triggeringFactIds.push(fact.id);
        }
      }
    });

    const observations: Observation[] = [];
    const redFlags: RedFlag[] = [];
    let maxSeverity: SwallowingRiskLevel = 'low';
    let maxActionLevel: ActionLevel = 'observation';

    const actionLevelMap: Record<ActionLevel, number> = { observation: 0, intervention: 1, urgent: 2, emergency: 3 };

    SWALLOWING_RULES.forEach(rule => {
      const hasAllSigns = rule.triggerSigns.every(sign => detectedSigns.includes(sign));
      
      const hasAllMeasures = rule.triggerMeasures?.every(tm => {
        const fact = facts.find(f => f.sign === tm.measure && !f.isResolved);
        if (!fact || !fact.details) return false;
        const val = parseFloat(fact.details);
        if (isNaN(val)) return false;
        return tm.operator === 'gt' ? val > tm.threshold : val < tm.threshold;
      }) ?? true;

      if (hasAllSigns && hasAllMeasures) {
        // Collect triggering fact IDs for this rule
        const ruleTriggeringFacts = facts
          .filter(f => !f.isResolved && f.category === 'swallowing' && (rule.triggerSigns.includes(f.sign as any) || rule.triggerMeasures?.some(tm => tm.measure === f.sign)))
          .map(f => f.id);
        
        // For simplicity in this demo, we add them to the global triggeringFactIds
        ruleTriggeringFacts.forEach(id => {
            if (!triggeringFactIds.includes(id)) triggeringFactIds.push(id);
        });

        if (rule.isRedFlag) {
          redFlags.push({
            type: 'SymptomRedFlag',
            severity: rule.severity,
            description: rule.clinicalLogic,
            relatedFacts: detectedSigns.filter(s => rule.triggerSigns.includes(s)),
            sourceRefs: [rule.sourceRef],
            action: rule.suggestedAction
          });
        } else {
          observations.push({
            type: 'ClinicalObservation',
            severity: rule.severity,
            description: rule.clinicalLogic,
            action: rule.suggestedAction,
            sourceRefs: [rule.sourceRef]
          });
        }

        if (actionLevelMap[rule.actionLevel] > actionLevelMap[maxActionLevel]) {
          maxActionLevel = rule.actionLevel;
        }
      }
    });

    const severityMap: Record<SwallowingRiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
    const currentMax = Math.max(0, ...redFlags.map(rf => severityMap[rf.severity]), ...observations.map(ob => severityMap[ob.severity]));
    maxSeverity = Object.keys(severityMap).find(key => severityMap[key] === currentMax) as SwallowingRiskLevel;

    const recommendedReferral = maxSeverity === 'high' || maxSeverity === 'critical' || redFlags.length > 0;
    const needsInstrumentalAssessment = 
      detectedSigns.includes('tos_post_ingesta') || 
      detectedSigns.includes('voz_humeda') || 
      detectedSigns.includes('distress_respiratorio') || 
      maxSeverity === 'high' || 
      maxSeverity === 'critical';

    const professionalSummary = detectedSigns
      .map(sign => SWALLOWING_MAPPING[sign].professional.title)
      .join(', ') || 'Sin signos detectados';

    const familySummary = detectedSigns
      .map(sign => SWALLOWING_MAPPING[sign].family.title)
      .join(', ') || 'No se detectaron señales de alerta';

    const result: SwallowingAnalysisResult = {
      signsDetected: detectedSigns,
      measures: detectedMeasures,
      observations,
      redFlags,
      riskLevel: maxSeverity,
      recommendedActionLevel: maxActionLevel,
      recommendedReferral,
      needsInstrumentalAssessment,
      summary: {
        professional: professionalSummary,
        family: familySummary
      },
      triggeringFactIds
    };

    if (patientId) {
      await this.saveAnalysisSnapshot(patientId, result);
    }

    return result;
  }

  async saveAnalysisSnapshot(patientId: string, result: SwallowingAnalysisResult): Promise<void> {
    await this.supabase.from('analysis_history').insert({
      patient_id: patientId,
      module: 'swallowing',
      risk_level: result.riskLevel,
      action_level: result.recommendedActionLevel,
      summary_family: result.summary.family,
      timestamp: new Date().toISOString()
    });
  }

  async resolveFact(factId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('clinical_facts')
      .update({ 
        isResolved: true, 
        resolvedAt: new Date().toISOString(), 
        resolvedBy: userId 
      })
      .eq('id', factId);

    if (error) throw error;
  }
}
