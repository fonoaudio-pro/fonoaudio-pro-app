import { VoiceSign, VoiceMeasure, VoiceRule, RiskLevel, ActionLevel } from './types';
import { VOICE_RULES } from './rules/voice_rules';
import { VOICE_MAPPING } from './mapping/voice_mapping';
import { ClinicalFact, RedFlag, Observation } from '../../types';
import { supabase as defaultSupabase } from '../../../utils/supabaseClient';

export interface VoiceAnalysisResult {
  signsDetected: VoiceSign[];
  measures: VoiceMeasure[];
  dysphoniaDuration?: string;
  observations: Observation[];
  redFlags: RedFlag[];
  riskLevel: RiskLevel;
  recommendedActionLevel: ActionLevel;
  recommendedReferral: boolean;
  needsInstrumentalAssessment: boolean;
  summary: {
    professional: string;
    family: string;
  };
  triggeringFactIds: string[];
}

export class VoiceService {
  private supabase = defaultSupabase;

  constructor(supabaseClient?: any) {
    if (supabaseClient) this.supabase = supabaseClient;
  }

  async analyze(facts: ClinicalFact[], patientId?: string): Promise<VoiceAnalysisResult> {
    const detectedSigns: VoiceSign[] = [];
    const detectedMeasures: VoiceMeasure[] = [];
    const triggeringFactIds: string[] = [];
    let dysphoniaDuration: string | undefined;
    
    const allSigns = Object.keys(VOICE_MAPPING) as VoiceSign[];
    const allMeasures: VoiceMeasure[] = ['frecuencia_fundamental', 'jitter', 'shimmer', 'tiempo_maximo_fonacion'];

    facts.forEach(fact => {
      if (!fact.isResolved && fact.category === 'voice') {
        const signValue = fact.sign;
        if (allSigns.includes(signValue as VoiceSign)) {
          detectedSigns.push(signValue as VoiceSign);
          triggeringFactIds.push(fact.id);
          if (signValue === 'disfonia_persistente' && fact.details) {
            dysphoniaDuration = fact.details;
          }
        } else if (allMeasures.includes(signValue as VoiceMeasure)) {
          detectedMeasures.push(signValue as VoiceMeasure);
          triggeringFactIds.push(fact.id);
        }
      }
    });

    const observations: Observation[] = [];
    const redFlags: RedFlag[] = [];
    let maxSeverity: RiskLevel = 'low';
    let maxActionLevel: ActionLevel = 'observation';

    const actionLevelMap: Record<ActionLevel, number> = { observation: 0, intervention: 1, urgent: 2, emergency: 3 };

    VOICE_RULES.forEach(rule => {
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
          .filter(f => !f.isResolved && f.category === 'voice' && (rule.triggerSigns.includes(f.sign as any) || rule.triggerMeasures?.some(tm => tm.measure === f.sign)))
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

    const severityMap: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
    const currentMax = Math.max(0, ...redFlags.map(rf => severityMap[rf.severity]), ...observations.map(ob => severityMap[ob.severity]));
    maxSeverity = Object.keys(severityMap).find(key => severityMap[key] === currentMax) as RiskLevel;

    const recommendedReferral = maxSeverity === 'high' || maxSeverity === 'critical' || redFlags.length > 0;
    const needsInstrumentalAssessment = detectedSigns.includes('disfonia_persistente') || maxSeverity === 'high' || maxSeverity === 'critical';

    const professionalSummary = detectedSigns
      .map(sign => VOICE_MAPPING[sign].professional.title)
      .join(', ') || 'Sin signos detectados';

    const familySummary = detectedSigns
      .map(sign => VOICE_MAPPING[sign].family.title)
      .join(', ') || 'No se detectaron señales de alerta';

    const result: VoiceAnalysisResult = {
      signsDetected: detectedSigns,
      measures: detectedMeasures,
      dysphoniaDuration,
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

  async saveAnalysisSnapshot(patientId: string, result: VoiceAnalysisResult): Promise<void> {
    await this.supabase.from('analysis_history').insert({
      patient_id: patientId,
      module: 'voice',
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
