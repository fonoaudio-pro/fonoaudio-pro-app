import { Patient } from '../types';

// ============================================================
// Clinical Records Types
// ============================================================

export interface PersonalHistory {
  historiaMedica?: string;
  antecedentesOtologicos?: string;
  desarrolloPsicomotor?: string;
  feedingHistory?: string;
  sueno?: string;
  previousSurgeries?: string;
  medications?: string;
  allergies?: string;
  gestationalAge?: string;
  birthWeight?: string;
  birthType?: string;
  neonatalHistory?: string;
  chronicConditions?: string;
}

export interface FamilyHistory {
  familyDiseases?: string;
  speechLanguageHistory?: string;
  hearingHistory?: string;
  neurologicalHistory?: string;
  familyDynamics?: string;
}

export interface MedicalHistory {
  otologicalHistory?: string;
  ENTHistory?: string;
  neurologicalHistory?: string;
  pediatricHistory?: string;
}

export interface DevelopmentalHistory {
  psychomotorDevelopment?: string;
  languageDevelopment?: string;
  feedingDevelopment?: string;
  socialDevelopment?: string;
  schoolPerformance?: string;
}

export interface AffectedArea {
  area: string;
  affected: boolean;
  observations: string;
}

export type AffectedAreaKey =
  | 'voz'
  | 'lenguaje'
  | 'habla'
  | 'deglucion'
  | 'audicion'
  | 'motricidad_orofacial'
  | 'cognicion_comunicacion';

export interface DiagnosisCode {
  code: string;
  name: string;
  system: 'CIE-11' | 'SNOMED-CT';
}

export interface ClinicalRecord {
  id: string;
  patient_id: string;

  chief_complaint: string | null;
  chief_complaint_onset: string | null;

  personal_history: PersonalHistory;
  family_history: FamilyHistory;
  medical_history: MedicalHistory;
  developmental_history: DevelopmentalHistory;

  clinical_observations: string | null;

  affected_areas: AffectedArea[];

  primary_diagnosis_code: string | null;
  primary_diagnosis_name: string | null;
  secondary_diagnosis_codes: DiagnosisCode[];

  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicalRecordInput {
  patient_id: string;
  chief_complaint?: string;
  chief_complaint_onset?: string;
  personal_history?: Partial<PersonalHistory>;
  family_history?: Partial<FamilyHistory>;
  medical_history?: Partial<MedicalHistory>;
  developmental_history?: Partial<DevelopmentalHistory>;
  clinical_observations?: string;
  affected_areas?: AffectedArea[];
  primary_diagnosis_code?: string;
  primary_diagnosis_name?: string;
  secondary_diagnosis_codes?: DiagnosisCode[];
}

// ============================================================
// Anamnesis Types
// ============================================================

export type AnamnesisStatus = 'draft' | 'final';

export interface AnamnesisSectionAnswers {
  [questionId: string]: string | boolean | number;
}

export interface AnamnesisSections {
  [sectionId: string]: AnamnesisSectionAnswers;
}

export interface PatientAnamnesis {
  id: string;
  patient_id: string;
  version: number;
  status: AnamnesisStatus;
  sections: AnamnesisSections;
  notes: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnamnesisInput {
  patient_id: string;
  sections: AnamnesisSections;
  status?: AnamnesisStatus;
  notes?: string;
}

// ============================================================
// Anamnesis Template Types
// ============================================================

export type QuestionType = 'textarea' | 'text' | 'select' | 'number';

export interface AnamnesisQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  jumpIf?: string;
  jumpTo?: string;
}

export interface AnamnesisSectionTemplate {
  id: string;
  title: string;
  description?: string;
  questions: AnamnesisQuestion[];
}

export interface AnamnesisTemplate {
  version: string;
  label: string;
  sections: AnamnesisSectionTemplate[];
}

// ============================================================
// Affected Areas (reutilizable)
// ============================================================

export const AFFECTED_AREAS: { key: AffectedAreaKey; label: string }[] = [
  { key: 'voz', label: 'Voz' },
  { key: 'lenguaje', label: 'Lenguaje' },
  { key: 'habla', label: 'Habla' },
  { key: 'deglucion', label: 'Deglución' },
  { key: 'audicion', label: 'Audición' },
  { key: 'motricidad_orofacial', label: 'Motricidad Orofacial' },
  { key: 'cognicion_comunicacion', label: 'Cognición / Comunicación' },
];

export function createEmptyAffectedAreas(): AffectedArea[] {
  return AFFECTED_AREAS.map(a => ({
    area: a.key,
    affected: false,
    observations: '',
  }));
}

export function createEmptyClinicalRecord(patientId: string): ClinicalRecordInput {
  return {
    patient_id: patientId,
    chief_complaint: '',
    chief_complaint_onset: '',
    personal_history: {},
    family_history: {},
    medical_history: {},
    developmental_history: {},
    clinical_observations: '',
    affected_areas: createEmptyAffectedAreas(),
    primary_diagnosis_code: null,
    primary_diagnosis_name: null,
    secondary_diagnosis_codes: [],
  };
}
