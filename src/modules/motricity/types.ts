export type MotricitySign = 
  | 'hipotonia_lingual' 
  | 'hipotonia_labial' 
  | 'respiracion_bucal' 
  | 'interposicion_lingual' 
  | 'disfuncion_masticatoria' 
  | 'deglucion_atipica'
  | 'asimetria_facial';

export type MotricityMeasure = 
  | 'tonus_scale_score'
  | 'tongue_mobility_score'
  | 'facial_symmetry_index'
  | 'breath_rate_per_minute';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ActionLevel = 'observation' | 'intervention' | 'urgent' | 'emergency';

export interface MotricityRule {
  id: string;
  category: 'muscle_tone' | 'functional_pattern' | 'structural_risk';
  triggerSigns: MotricitySign[];
  triggerMeasures?: {
    measure: MotricityMeasure;
    threshold: number;
    operator: 'gt' | 'lt';
  }[];
  isRedFlag: boolean;
  severity: RiskLevel;
  actionLevel: ActionLevel;
  clinicalLogic: string;
  suggestedAction: string;
  sourceRef: string;
}

export interface MotricityAnalysisResult {
  signsDetected: MotricitySign[];
  measures: MotricityMeasure[];
  observations: any[];
  redFlags: any[];
  riskLevel: RiskLevel;
  recommendedActionLevel: ActionLevel;
  recommendedReferral: boolean;
  needsInstrumentalAssessment: boolean;
  summary: {
    professional: string;
    family: string;
  };
}
