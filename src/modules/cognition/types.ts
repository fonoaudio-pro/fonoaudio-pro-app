export type CognitionSign = 
  | 'desorientacion_temporal' 
  | 'desorientacion_espacial' 
  | 'deficit_atencional' 
  | 'fallas_memoria_corto_plazo' 
  | 'anosognosia' 
  | 'deterioro_funciones_ejecutivas' 
  | 'dificultad_planificacion';

export type CognitionMeasure = 
  | 'mmse_score' 
  | 'moca_score' 
  | 'clock_drawing_score' 
  | 'attention_span_seconds';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ActionLevel = 'observation' | 'intervention' | 'urgent' | 'emergency';

export interface CognitionRule {
  id: string;
  category: 'memory' | 'attention' | 'executive' | 'orientation' | 'emergency';
  triggerSigns: CognitionSign[];
  triggerMeasures?: {
    measure: CognitionMeasure;
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

export interface CognitionAnalysisResult {
  signsDetected: CognitionSign[];
  measures: CognitionMeasure[];
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
