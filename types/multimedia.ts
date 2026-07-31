export type MaterialType = 'home_guide' | 'pecs_sequence' | 'therapy_sequence' | 'vocabulary_cards' | 'visual_resource' | 'custom';
export type MaterialStatus = 'pending' | 'generating' | 'ready' | 'approved' | 'rejected';
export type MaterialSource = 'notebook_lm' | 'clinical_rule' | 'user_request';

export interface MaterialRequest {
  id: string;
  patient_id: string;
  patient_name: string;
  material_type: MaterialType;
  clinical_goal: string;
  prompt: string;
  source: MaterialSource;
  source_reference?: string;
  requested_by: string;
  requested_by_name: string;
  timestamp: string;
  status: MaterialStatus;
}

export interface GeneratedMaterial {
  id: string;
  request_id: string;
  patient_id: string;
  patient_name: string;
  material_type: MaterialType;
  title: string;
  description: string;
  image_url: string;
  thumbnail_url: string;
  source: MaterialSource;
  source_reference?: string;
  clinical_goal: string;
  requested_by: string;
  requested_by_name: string;
  approved_by?: string;
  approved_by_name?: string;
  rejected_by?: string;
  rejected_by_name?: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  created_at: string;
  status: MaterialStatus;
}

export interface PipelineLogEntry {
  id: string;
  timestamp: string;
  action: 'request' | 'generate' | 'approve' | 'reject' | 'share' | 'print';
  material_id: string;
  material_type: MaterialType;
  patient_id: string;
  patient_name: string;
  user_id: string;
  user_name: string;
  status: MaterialStatus;
  details?: string;
}

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  home_guide: 'Guía de Hogar',
  pecs_sequence: 'Secuencia PECS',
  therapy_sequence: 'Secuencia Terapéutica',
  vocabulary_cards: 'Tarjetas de Vocabulario',
  visual_resource: 'Recurso Visual',
  custom: 'Personalizado',
};

export const MATERIAL_TYPE_ICONS: Record<MaterialType, string> = {
  home_guide: '🏠',
  pecs_sequence: '🖼️',
  therapy_sequence: '📋',
  vocabulary_cards: '🃏',
  visual_resource: '🎨',
  custom: '✨',
};
