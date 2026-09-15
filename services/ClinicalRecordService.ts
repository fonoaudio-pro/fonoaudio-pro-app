import { supabase } from '../utils/supabaseClient';
import {
  ClinicalRecord,
  ClinicalRecordInput,
  createEmptyClinicalRecord,
} from '../types/clinical';

export const ClinicalRecordService = {
  async getByPatientId(patientId: string): Promise<ClinicalRecord | null> {
    const { data, error } = await supabase
      .from('clinical_records')
      .select('*')
      .eq('patient_id', patientId)
      .maybeSingle();

    if (error) throw error;
    return data as ClinicalRecord | null;
  },

  async create(input: ClinicalRecordInput, userId?: string): Promise<ClinicalRecord> {
    const payload = {
      ...createEmptyClinicalRecord(input.patient_id),
      ...input,
      created_by: userId || null,
      updated_by: userId || null,
    };

    const { data, error } = await supabase
      .from('clinical_records')
      .upsert(payload, { onConflict: 'patient_id' })
      .select()
      .single();

    if (error) throw error;
    return data as ClinicalRecord;
  },

  async update(
    patientId: string,
    updates: Partial<ClinicalRecordInput>,
    userId?: string
  ): Promise<ClinicalRecord> {
    const payload = {
      ...updates,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('clinical_records')
      .update(payload)
      .eq('patient_id', patientId)
      .select()
      .single();

    if (error) throw error;
    return data as ClinicalRecord;
  },

  async upsert(input: ClinicalRecordInput, userId?: string): Promise<ClinicalRecord> {
    const existing = await this.getByPatientId(input.patient_id);

    if (existing) {
      return this.update(input.patient_id, input, userId);
    } else {
      return this.create(input, userId);
    }
  },

  async delete(patientId: string): Promise<void> {
    const { error } = await supabase
      .from('clinical_records')
      .delete()
      .eq('patient_id', patientId);

    if (error) throw error;
  },
};
