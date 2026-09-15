import { MotricitySign, MotricityMeasure, MotricityRule, RiskLevel, ActionLevel, MotricityAnalysisResult } from './types';
import { MOTRICITY_RULES } from './rules/motricity_rules';
import { MOTRICITY_MAPPING } from './mapping/motricity_mapping';
import { ClinicalFact, RedFlag, Observation } from '../../types';
import { supabase as defaultSupabase } from '../../../utils/supabaseClient';

export class MotricityService {
  private supabase = defaultSupabase;

  constructor(supabaseClient?: any) {
    if (supabaseClient) this.supabase = supabaseClient;
  }

  async analyze(facts: ClinicalFact[], patientId?: string): Promise<MotricityAnalysisResult> {
    const detectedSigns: MotricitySign[] = [];
    const detectedMeasures: MotricityMeasure[] = [];
    
    const allSigns = Object.keys(MOTRICITY_MAPPING) as MotricitySign[];
    const allMeasures: MotricityMeasure[] = [
      'tonus_scale_score',
      'tongue_mobility_score',
      'facial_symmetry_index',
      'breath_rate_per_minute'
    ];

    facts.forEach(fact => {
      if (!fact.isResolved && fact.category === 'motricity') {
        const signValue = fact.sign;
        if (allSigns.includes(signValue as MotricitySign)) {
          detectedSigns.push(signValue as MotricitySign);
        } else if (allMeasures.includes(signValue as MotricityMeasure)) {
          detectedMeasures.push(signValue as MotricityMeasure);
        }
      }
    });

    const observations: Observation[] = [];
    const redFlags: RedFlag[] = [];
    let maxSeverity: RiskLevel = 'low';
    let maxActionLevel: ActionLevel = 'observation';

    const actionLevelMap: Record<ActionLevel, number> = { observation: 0, intervention: 1, urgent: 2, emergency: 3 };

    MOTRICITY_RULES.forEach(rule => {
      const hasAllSigns = rule.triggerSigns.every(sign => detectedSigns.includes(sign));
      
      const hasAllMeasures = rule.triggerMeasures?.every(tm => {
        const fact = facts.find(f => f.sign === tm.measure && !f.isResolved);
        if (!fact || !fact.details) return false;
        const val = parseFloat(fact.details);
        if (isNaN(val)) return false;
        return tm.operator === 'gt' ? val > tm.threshold : val < tm.threshold;
      }) ?? true;

      if (hasAllSigns && hasAllMeasures) {
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

    const severityMap: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
    const currentMax = Math.max(0, ...redFlags.map(rf => severityMap[rf.severity]), ...observations.map(ob => severityMap[ob.severity]));
    maxSeverity = Object.keys(severityMap).find(key => severityMap[key] === currentMax) as RiskLevel;

    const recommendedReferral = maxSeverity === 'high' || maxSeverity === 'critical' || redFlags.length > 0;
    const needsInstrumentalAssessment = maxSeverity === 'high' || maxSeverity === 'critical' || detectedSigns.includes('asimetria_facial');

    const professionalSummary = detectedSigns
      .map(sign => MOTRICITY_MAPPING[sign].professional.title)
      .join(', ') || 'Sin signos detectados';

    const familySummary = detectedSigns
      .map(sign => MOTRICITY_MAPPING[sign].family.title)
      .join(', ') || 'No se detectaron señales de alerta';

    const result: MotricityAnalysisResult = {
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
      }
    };

    if (patientId) {
      await this.saveAnalysisSnapshot(patientId, result);
    }

    return result;
  }

  async saveAnalysisSnapshot(patientId: string, result: MotricityAnalysisResult): Promise<void> {
    await this.supabase.from('analysis_history').insert({
      patient_id: patientId,
      module: 'motricity',
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
