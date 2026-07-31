export type SwallowingSign = 
  | 'tos_post_ingesta' 
  | 'voz_humeda' 
  | 'deglucion_lenta' 
  | 'residuo_oral' 
  | 'carraspeo_repetido' 
  | 'distress_respiratorio';

export type SwallowingMeasure = 
  | 'fois_score'
  | 'masa_score'
  | 'tiempo_transito_segundos'
  | 'desaturacion_oxigeno_porcentaje';

export type SwallowingRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ActionLevel = 'observation' | 'intervention' | 'urgent' | 'emergency';

export interface SwallowingRule {
  id: string;
  category: 'oral_inefficiency' | 'aspirative_risk' | 'respiratory_alert';
  triggerSigns: SwallowingSign[];
  triggerMeasures?: {
    measure: SwallowingMeasure;
    threshold: number;
    operator: 'gt' | 'lt';
  }[];
  isRedFlag: boolean;
  severity: SwallowingRiskLevel;
  actionLevel: ActionLevel;
  clinicalLogic: string;
  suggestedAction: string;
  sourceRef: string;
}

export interface SwallowingAnalysisResult {
  signsDetected: SwallowingSign[];
  measures: SwallowingMeasure[];
  observations: any[];
  redFlags: any[];
  riskLevel: SwallowingRiskLevel;
  recommendedActionLevel: ActionLevel;
  recommendedReferral: boolean;
  needsInstrumentalAssessment: boolean;
  summary: {
    professional: string;
    family: string;
  };
}
