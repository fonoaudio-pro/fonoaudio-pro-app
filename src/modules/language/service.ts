import { LanguageSign, LanguageRule, RiskLevel, ActionLevel } from './types';
import { LANGUAGE_RULES } from './rules/language_rules';
import { LANGUAGE_MAPPING } from './mapping/language_mapping';
import { ClinicalFact, RedFlag, Observation } from '../../types';
import { supabase as defaultSupabase } from '../../../utils/supabaseClient';

export interface LanguageAnalysisResult {
  signsDetected: LanguageSign[];
  observations: Observation[];
  redFlags: RedFlag[];
  riskLevel: RiskLevel;
  recommendedActionLevel: ActionLevel;
  summary: {
    professional: string;
    family: string;
  };
  triggeringFactIds: string[];
}

export class LanguageService {
  private supabase = defaultSupabase;

  constructor(supabaseClient?: any) {
    if (supabaseClient) this.supabase = supabaseClient;
  }

  async analyze(facts: ClinicalFact[], patientId?: string): Promise<LanguageAnalysisResult> {
    const detectedSigns: LanguageSign[] = [];
    const triggeringFactIds: string[] = [];
    
    facts.forEach(fact => {
      if (fact.category === 'language' && !fact.isResolved) {
        const sign = fact.sign as LanguageSign;
        if (sign && LANGUAGE_MAPPING[sign]) {
          detectedSigns.push(sign);
          triggeringFactIds.push(fact.id);
        }
      }
    });

    const observations: Observation[] = [];
    const redFlags: RedFlag[] = [];
    let maxSeverity: RiskLevel = 'low';
    let maxActionLevel: ActionLevel = 'observation';

    const actionLevelMap: Record<ActionLevel, number> = { observation: 0, intervention: 1, urgent: 2, emergency: 3 };

    LANGUAGE_RULES.forEach(rule => {
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

    const professionalSummary = detectedSigns
      .map(sign => LANGUAGE_MAPPING[sign].professional.title)
      .join(', ') || 'Sin signos detectados';

    const familySummary = detectedSigns
      .map(sign => LANGUAGE_MAPPING[sign].family.title)
      .join(', ') || 'No se detectaron señales de alerta';

    const result: LanguageAnalysisResult = {
      signsDetected: detectedSigns,
      observations,
      redFlags,
      riskLevel: maxSeverity,
      recommendedActionLevel: maxActionLevel,
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

  async saveAnalysisSnapshot(patientId: string, result: LanguageAnalysisResult): Promise<void> {
    await this.supabase.from('analysis_history').insert({
      patient_id: patientId,
      module: 'language',
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
