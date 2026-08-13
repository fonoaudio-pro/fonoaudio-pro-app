import { supabase } from '../utils/supabaseClient';

export interface CalendarMapping {
  id: string;
  google_event_id: string;
  patient_id: string;
  session_id?: string;
  sync_status: 'mapped' | 'pending';
  last_synced_at: string;
}

export const CalendarMappingService = {
  async createMapping(googleEventId: string, patientId: string, sessionId?: string, eventDate?: string): Promise<void> {
    const { error: mappingError } = await supabase
      .from('calendar_event_mappings')
      .insert({
        google_event_id: googleEventId,
        patient_id: patientId,
        session_id: sessionId || null,
        sync_status: sessionId ? 'mapped' : 'pending',
      });

    if (mappingError) throw mappingError;

    // Ensure a corresponding appointment record exists
    const { error: apptError } = await supabase
      .from('appointments')
      .insert({
        google_event_id: googleEventId,
        patient_id: patientId,
        date: eventDate || new Date().toISOString(),
        status: 'pending',
      });

    if (apptError) console.error('Error creating appointment record:', apptError);
  },

  async updateMapping(googleEventId: string, sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('calendar_event_mappings')
      .update({
        session_id: sessionId,
        sync_status: 'mapped',
        last_synced_at: new Date().toISOString(),
      })
      .eq('google_event_id', googleEventId);

    if (error) throw error;
  },

  async getMapping(googleEventId: string): Promise<CalendarMapping | null> {
    const { data, error } = await supabase
      .from('calendar_event_mappings')
      .select('*')
      .eq('google_event_id', googleEventId)
      .single();

    if (error) return null;
    return data;
  },

  async getMappingsByEventIds(eventIds: string[]): Promise<CalendarMapping[]> {
    const { data, error } = await supabase
      .from('calendar_event_mappings')
      .select('*')
      .in('google_event_id', eventIds);

    if (error) throw error;
    return data || [];
  }
};
