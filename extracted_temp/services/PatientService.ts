import { supabase } from '../utils/supabaseClient';

export interface PatientIdentityUpdate {
  name?: string;
  document?: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  obra_social?: string;
  responsable?: string;
  derivante?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  consultorio?: string;
}

export const PatientService = {
  async updateIdentity(patientId: string, data: PatientIdentityUpdate): Promise<void> {
    const payload: Record<string, any> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.document !== undefined) payload.document = data.document;
    if (data.date_of_birth !== undefined) payload.date_of_birth = data.date_of_birth || null;
    if (data.gender !== undefined) payload.gender = data.gender || null;
    if (data.phone !== undefined) payload.phone = data.phone;
    if (data.email !== undefined) payload.email = data.email;
    if (data.address !== undefined) payload.address = data.address || null;
    if (data.obra_social !== undefined) payload.obra_social = data.obra_social || null;
    if (data.responsable !== undefined) payload.responsable = data.responsable || null;
    if (data.derivante !== undefined) payload.derivante = data.derivante || null;
    if (data.emergency_contact !== undefined) payload.emergency_contact = data.emergency_contact || null;
    if (data.emergency_phone !== undefined) payload.emergency_phone = data.emergency_phone || null;
    if (data.consultorio !== undefined) payload.consultorio = data.consultorio || null;

    payload.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('patients')
      .update(payload)
      .eq('id', patientId);

    if (error) throw error;
  },
};
