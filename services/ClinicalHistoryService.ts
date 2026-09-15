import { supabase } from '../utils/supabaseClient';
import { ClinicalHistoryTemplate, ClinicalHistoryRecord } from '../types';

export const ClinicalHistoryService = {
  // ============================================
  // TEMPLATE MANAGEMENT (Admin only via RLS)
  // ============================================

  async getTemplates(clinicId: string): Promise<ClinicalHistoryTemplate[]> {
    const { data, error } = await supabase
      .from('clinical_history_templates')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async getTemplateById(id: string): Promise<ClinicalHistoryTemplate | null> {
    const { data, error } = await supabase
      .from('clinical_history_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async createTemplate(template: Partial<ClinicalHistoryTemplate>): Promise<ClinicalHistoryTemplate> {
    const { data, error } = await supabase
      .from('clinical_history_templates')
      .insert([template])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateTemplate(id: string, updates: Partial<ClinicalHistoryTemplate>): Promise<ClinicalHistoryTemplate> {
    const { data, error } = await supabase
      .from('clinical_history_templates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase.from('clinical_history_templates').delete().eq('id', id);
    if (error) throw error;
  },

  // ============================================
  // RECORD MANAGEMENT (Professional/Admin/Supervisor)
  // ============================================

  async getRecordsByPatient(patientId: string): Promise<ClinicalHistoryRecord[]> {
    const { data, error } = await supabase
      .from('clinical_history_records')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getLatestRecord(patientId: string, templateId: string): Promise<ClinicalHistoryRecord | null> {
    const { data, error } = await supabase
      .from('clinical_history_records')
      .select('*')
      .eq('patient_id', patientId)
      .eq('template_id', templateId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore "no rows found"
    return data;
  },

  async saveRecord(record: Partial<ClinicalHistoryRecord>): Promise<ClinicalHistoryRecord> {
    // Upsert logic: if id exists, update; otherwise, insert
    const { data, error } = await supabase
      .from('clinical_history_records')
      .upsert({
        ...record,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateStatus(id: string, status: 'draft' | 'reviewed' | 'approved', approvedBy?: string): Promise<ClinicalHistoryRecord> {
    const { data, error } = await supabase
      .from('clinical_history_records')
      .update({ 
        status, 
        approved_by: approvedBy, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async addAIMetadata(id: string, metadataEntry: {
    prompt: string;
    response: string;
    user_id: string;
    timestamp: string;
  }): Promise<ClinicalHistoryRecord> {
    const { data: record, error: fetchError } = await supabase
      .from('clinical_history_records')
      .select('ai_metadata')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const currentMetadata = record.ai_metadata || [];
    const updatedMetadata = [...currentMetadata, metadataEntry];

    const { data, error: updateError } = await supabase
      .from('clinical_history_records')
      .update({ ai_metadata: updatedMetadata })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;
    return data;
  }
};
