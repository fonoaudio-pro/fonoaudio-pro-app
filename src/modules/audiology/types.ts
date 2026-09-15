export type AudiologySign = 
  | 'tinnitus' 
  | 'hiperacusia' 
  | 'otalgia' 
  | 'plenitud_auricular' 
  | 'hipoacusia_percibida' 
  | 'vertigo_desequilibrio'
  | 'otorragia';

export type AudiologyMeasure = 
  | 'audiometria_umbral_promedio'
  | 'timpanometria_tipo'
  | 'discriminacion_voz_porcentaje'
  | 'emisones_otoacusticas_status';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ActionLevel = 'observation' | 'intervention' | 'urgent' | 'emergency';

export interface AudiologyRule {
  id: string;
  category: 'conductive' | 'sensorineural' | 'vestibular' | 'emergency';
  triggerSigns: AudiologySign[];
  triggerMeasures?: {
    measure: AudiologyMeasure;
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

export interface AudiologyAnalysisResult {
  signsDetected: AudiologySign[];
  measures: AudiologyMeasure[];
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
