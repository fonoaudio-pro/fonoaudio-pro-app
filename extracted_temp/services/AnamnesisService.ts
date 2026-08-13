import { supabase } from '../utils/supabaseClient';
import {
  PatientAnamnesis,
  AnamnesisInput,
  AnamnesisStatus,
  AnamnesisSections,
} from '../types/clinical';

export const AnamnesisService = {
  async getAllByPatientId(patientId: string): Promise<PatientAnamnesis[]> {
    const { data, error } = await supabase
      .from('patient_anamnesis')
      .select('*')
      .eq('patient_id', patientId)
      .order('version', { ascending: false });

    if (error) throw error;
    return (data || []) as PatientAnamnesis[];
  },

  async getCurrent(patientId: string): Promise<PatientAnamnesis | null> {
    const { data, error } = await supabase
      .from('patient_anamnesis')
      .select('*')
      .eq('patient_id', patientId)
      .eq('status', 'draft')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as PatientAnamnesis | null;
  },

  async getVersion(patientId: string, version: number): Promise<PatientAnamnesis | null> {
    const { data, error } = await supabase
      .from('patient_anamnesis')
      .select('*')
      .eq('patient_id', patientId)
      .eq('version', version)
      .maybeSingle();

    if (error) throw error;
    return data as PatientAnamnesis | null;
  },

  async getNextVersion(patientId: string): Promise<number> {
    const { data, error } = await supabase
      .from('patient_anamnesis')
      .select('version')
      .eq('patient_id', patientId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? (data.version as number) + 1 : 1;
  },

  async create(input: AnamnesisInput, userId?: string): Promise<PatientAnamnesis> {
    const nextVersion = await this.getNextVersion(input.patient_id);

    const payload = {
      patient_id: input.patient_id,
      version: nextVersion,
      status: input.status || 'draft',
      sections: input.sections,
      notes: input.notes || null,
      author_id: userId || null,
    };

    const { data, error } = await supabase
      .from('patient_anamnesis')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as PatientAnamnesis;
  },

  async updateSections(
    id: string,
    sections: AnamnesisSections,
    userId?: string
  ): Promise<PatientAnamnesis> {
    const { data, error } = await supabase
      .from('patient_anamnesis')
      .update({
        sections,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as PatientAnamnesis;
  },

  async setStatus(
    id: string,
    status: AnamnesisStatus
  ): Promise<PatientAnamnesis> {
    const { data, error } = await supabase
      .from('patient_anamnesis')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as PatientAnamnesis;
  },

  async saveAsNewDraft(
    patientId: string,
    sections: AnamnesisSections,
    userId?: string,
    notes?: string
  ): Promise<PatientAnamnesis> {
    const current = await this.getCurrent(patientId);

    if (current) {
      await this.setStatus(current.id, 'final');
    }

    return this.create(
      { patient_id: patientId, sections, status: 'draft', notes },
      userId
    );
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('patient_anamnesis')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
