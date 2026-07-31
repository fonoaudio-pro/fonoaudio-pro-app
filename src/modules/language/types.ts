export type LanguageSign = 
  | 'vocabulario_reducido' 
  | 'errores_sustitucion' 
  | 'agramatismo' 
  | 'anomia' 
  | 'parafasias' 
  | 'disfluencia' 
  | 'dificultad_comprension';

export type LanguageMeasure = 
  | 'score_boston_naming'
  | 'score_comprehension_test'
  | 'word_count_per_minute';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ActionLevel = 'observation' | 'intervention' | 'urgent' | 'emergency';

export interface LanguageRule {
  id: string;
  category: 'expressive' | 'receptive' | 'cognitive_load' | 'neurological_risk';
  triggerSigns: LanguageSign[];
  triggerMeasures?: {
    measure: LanguageMeasure;
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
