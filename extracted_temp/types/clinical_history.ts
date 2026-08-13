import { Patient } from '../types';

// ─── Clinical Axes ───

export type ClinicalAxis =
  | 'voz'
  | 'lenguaje'
  | 'deglucion'
  | 'audicion'
  | 'motricidad_orofacial'
  | 'cognicion';

export const CLINICAL_AXES: ClinicalAxis[] = [
  'voz', 'lenguaje', 'deglucion', 'audicion', 'motricidad_orofacial', 'cognicion'
];

export const AXIS_META: Record<ClinicalAxis, { label: string; description: string; color: string }> = {
  voz: { label: 'Voz', description: 'Producción vocal, higiene vocal, trastornos fonopédicos', color: 'purple' },
  lenguaje: { label: 'Lenguaje', description: 'Comprensión, expresión, lectoescritura, pragmática', color: 'blue' },
  deglucion: { label: 'Deglución', description: 'Función orofaríngea, seguridad alimentaria', color: 'red' },
  audicion: { label: 'Audición', description: 'Función auditiva, tímpano, vías aéreas', color: 'amber' },
  motricidad_orofacial: { label: 'Motricidad Orofacial', description: 'Tono muscular, movilidad, patrones funcionales', color: 'green' },
  cognicion: { label: 'Cognición', description: 'Atención, memoria, funciones ejecutivas', color: 'indigo' },
};

// ─── Evolution Entry ───

export type EvolutionEntrySource = 'session' | 'assessment' | 'observation' | 'anamnesis' | 'manual';

export interface ClinicalEvolutionEntry {
  id: string;
  patientId: string;
  axis: ClinicalAxis;
  source: EvolutionEntrySource;
  sourceId?: string;
  date: string;
  signs: string[];
  measures: Record<string, any>;
  riskLevel: 'normal' | 'bajo' | 'moderado' | 'alto' | 'critico';
  notes: string;
  actions: string[];
  status: string;
  createdAt: string;
}

// ─── Axis Snapshot (current state) ───

export interface AxisSnapshot {
  patientId: string;
  axis: ClinicalAxis;
  currentRisk: 'normal' | 'bajo' | 'moderado' | 'alto' | 'critico';
  trend: 'improving' | 'stable' | 'worsening' | 'inconsistent';
  keyFindings: string[];
  pendingActions: string[];
  lastUpdated: string;
}

// ─── Longitudinal Clinical History ───

export interface ClinicalHistory {
  patientId: string;
  snapshots: AxisSnapshot[];
  lastUpdated: string;
  summaryByAxis: Record<ClinicalAxis, string>;
}

// ─── Adaptive Anamnesis ───

export type AgeGroup = 'neonato' | 'lactante' | 'preescolar' | 'escolar' | 'adolescente' | 'adulto' | 'adulto_mayor';

export interface AdaptiveBranch {
  id: string;
  label: string;
  conditions: {
    ageGroup?: AgeGroup[];
    affectedAreas?: string[];
    motivoConsulta?: string[];
  };
  sections: AnamnesisSectionDef[];
}

export interface AnamnesisSectionDef {
  id: string;
  title: string;
  description?: string;
  required: boolean;
  fields: AdaptiveField[];
}

export interface AdaptiveField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'date' | 'checkbox' | 'scale' | 'multiselect';
  required: boolean;
  placeholder?: string;
  options?: string[];
  min?: number;
  max?: number;
  unit?: string;
  helpText?: string;
}

// ─── Adaptive Anamnesis Response ───

export interface AdaptiveAnamnesisResponse {
  patientId: string;
  templateId: string;
  answers: Record<string, any>;
  affectedAreas: ClinicalAxis[];
  metadata: {
    ageGroup: AgeGroup;
    motivoConsulta: string;
    completedAt: string;
  };
}

// ─── Helper ───

export function getAgeGroup(dateOfBirth: string): AgeGroup {
  const now = new Date();
  const dob = new Date(dateOfBirth);
  const ageMonths = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());

  if (ageMonths < 1) return 'neonato';
  if (ageMonths < 12) return 'lactante';
  if (ageMonths < 48) return 'preescolar';
  if (ageMonths < 132) return 'escolar';
  if (ageMonths < 216) return 'adolescente';
  if (ageMonths < 780) return 'adulto';
  return 'adulto_mayor';
}
