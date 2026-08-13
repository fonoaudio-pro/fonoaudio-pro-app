import { AudiologySign, AudiologyMeasure, AudiologyRule, RiskLevel, ActionLevel, AudiologyAnalysisResult } from './types';
import { AUDIOLOGY_RULES } from './rules/audiology_rules';
import { AUDIOLOGY_MAPPING } from './mapping/audiology_mapping';
import { ClinicalFact, RedFlag, Observation } from '../../types';
import { supabase as defaultSupabase } from '../../../utils/supabaseClient';

export class AudiologyService {
  private supabase = defaultSupabase;

  constructor(supabaseClient?: any) {
    if (supabaseClient) this.supabase = supabaseClient;
  }

  async analyze(facts: ClinicalFact[], patientId?: string): Promise<AudiologyAnalysisResult> {
    const detectedSigns: AudiologySign[] = [];
    const detectedMeasures: AudiologyMeasure[] = [];
    
    const allSigns = Object.keys(AUDIOLOGY_MAPPING) as AudiologySign[];
    const allMeasures: AudiologyMeasure[] = [
      'audiometria_umbral_promedio',
      'timpanometria_tipo',
      'discriminacion_voz_porcentaje',
      'emisones_otoacusticas_status'
    ];

    facts.forEach(fact => {
      if (!fact.isResolved && fact.category === 'audiology') {
        const signValue = fact.sign;
        if (allSigns.includes(signValue as AudiologySign)) {
          detectedSigns.push(signValue as AudiologySign);
        } else if (allMeasures.includes(signValue as AudiologyMeasure)) {
          detectedMeasures.push(signValue as AudiologyMeasure);
        }
      }
    });

    const observations: Observation[] = [];
    const redFlags: RedFlag[] = [];
    let maxSeverity: RiskLevel = 'low';
    let maxActionLevel: ActionLevel = 'observation';

    const actionLevelMap: Record<ActionLevel, number> = { observation: 0, intervention: 1, urgent: 2, emergency: 3 };

    AUDIOLOGY_RULES.forEach(rule => {
      const hasAllSigns = rule.triggerSigns.every(sign => detectedSigns.includes(sign));
      
      const hasAllMeasures = rule.triggerMeasures?.every(tm => {
        const fact = facts.find(f => f.sign === tm.measure && !f.isResolved);
        if (!fact || !fact.details) return false;
        const val = parseFloat(// la discriminacion es porcentaje, olabilir que necesitemos normalizarla
          fact.details.replace('%', '')
        );
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
    const needsInstrumentalAssessment = 
      detectedSigns.includes('hipoacusia_percibida') || 
      detectedSigns.includes('otalgia') || 
      maxSeverity === 'high' || 
      maxSeverity === 'critical';

    const professionalSummary = detectedSigns
      .map(sign => AUDIOLOGY_MAPPING[sign].professional.title)
      .join(', ') || 'Sin signos detectados';

    const familySummary = detectedSigns
      .map(sign => AUDIOLOGY_MAPPING[sign].family.title)
      .join(', ') || 'No se detectaron señales de alerta';

    const result: AudiologyAnalysisResult = {
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

  async saveAnalysisSnapshot(patientId: string, result: AudiologyAnalysisResult): Promise<void> {
    await this.supabase.from('analysis_history').insert({
      patient_id: patientId,
      module: 'audiology',
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
