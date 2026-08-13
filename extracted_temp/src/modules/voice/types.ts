export type VoiceSign = 
  | 'disfonia_persistente' 
  | 'estridor' 
  | 'fatiga_vocal' 
  | 'esfuerzo_fonatorio'
  | 'perdida_peso'
  | 'hemoptisis'
  | 'masa_cuello'
  | 'cambio_voz_repentino'
  | 'disfagia';

export type VoiceMeasure = 
  | 'frecuencia_fundamental'
  | 'jitter'
  | 'shimmer'
  | 'tiempo_maximo_fonacion';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ActionLevel = 'observation' | 'intervention' | 'urgent' | 'emergency';

export interface VoiceRule {
  id: string;
  category: 'vocal_hygiene' | 'organic_risk' | 'functional_order';
  triggerSigns: VoiceSign[];
  triggerMeasures?: {
    measure: VoiceMeasure;
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
