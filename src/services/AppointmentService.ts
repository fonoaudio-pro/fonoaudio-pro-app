import { supabase } from '../../utils/supabaseClient';
import { AppointmentStatus, Appointment } from '../../types/appointment';
import { NotificationService } from './NotificationService';

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function cleanPayload(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  const KNOWN_COLUMNS = [
    'id', 'patient_id', 'patient_name', 'date', 'time', 'status', 'type',
    'origin', 'professional_id', 'duration', 'consultorio', 'patient_contact',
    'start_time', 'end_time', 'google_event_id', 'meet_link', 'notes',
    'cancellation_reason', 'reschedule_reason', 'status_changed_at', 'status_changed_by',
    'created_at'
  ];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const snakeKey = toSnakeCase(key);
    if (KNOWN_COLUMNS.includes(snakeKey)) {
      result[snakeKey] = value;
    }
  }
  return result;
}

const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ['confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show'],
  confirmed: ['attended', 'no_show', 'rescheduled', 'cancelled', 'completed'],
  cancelled: ['pending', 'confirmed'],
  rescheduled: ['confirmed', 'cancelled', 'completed', 'no_show'],
  completed: [],
  no_show: [],
};

export class AppointmentService {
  private notificationService = new NotificationService();

  async createAppointment(data: Partial<Appointment>): Promise<Appointment> {
    const cleanData = cleanPayload(data as Record<string, any>);

    if (cleanData.date && cleanData.start_time) {
      const hasCollision = await this.checkCollision(
        cleanData.professional_id || 'system', 
        cleanData.date, 
        cleanData.start_time, 
        cleanData.end_time || ''
      );
      if (hasCollision) throw new Error('Hay una cita programada en este horario.');
    }

    console.log("Attempting to insert appointment with payload:", JSON.stringify(cleanData, null, 2));

    const OPT_COLUMNS = ['meet_link', 'google_event_id', 'consultorio', 'start_time', 'end_time', 'patient_contact'];

    let payload = { ...cleanData };
    let { data: appointment, error } = await supabase
      .from('appointments')
      .insert(payload)
      .select()
      .single();

    if (error && error.code === 'PGRST204' && error.message.includes('column')) {
      const colMatch = error.message.match(/'(\w+)'/);
      const missingCol = colMatch ? colMatch[1] : null;
      if (missingCol) {
        console.warn(`[AppointmentService] Column '${missingCol}' missing, retrying without it...`);
        delete payload[missingCol];
        ({ data: appointment, error } = await supabase
          .from('appointments')
          .insert(payload)
          .select()
          .single());
      }
    }

    if (error && error.code === 'PGRST204' && error.message.includes('column')) {
      const colMatch = error.message.match(/'(\w+)'/);
      const missingCol = colMatch ? colMatch[1] : null;
      if (missingCol) {
        console.warn(`[AppointmentService] Column '${missingCol}' also missing, retrying without optional columns...`);
        for (const col of OPT_COLUMNS) delete payload[col];
        ({ data: appointment, error } = await supabase
          .from('appointments')
          .insert(payload)
          .select()
          .single());
      }
    }

    if (error) {
      console.error("Supabase insert error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }
    return appointment as Appointment;
  }

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment> {
    const cleanUpdates = cleanPayload(updates as Record<string, any>);
    delete cleanUpdates.id;

    if (cleanUpdates.date || cleanUpdates.start_time || cleanUpdates.end_time) {
      const hasCollision = await this.checkCollision(
        cleanUpdates.professional_id || 'system', 
        cleanUpdates.date || 'today', 
        cleanUpdates.start_time || '', 
        cleanUpdates.end_time || '',
        id
      );
      if (hasCollision) throw new Error('El nuevo horario coincide con otra cita.');
    }

    console.log("Attempting to update appointment with payload:", JSON.stringify(cleanUpdates, null, 2));

    const { data, error } = await supabase
      .from('appointments')
      .update(cleanUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }
    return data as Appointment;
  }

  async getAppointmentsForUser(userId: string, startDate: string, endDate: string) {
    // First try with professional_id filter
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('professional_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch {
      // Fallback: professional_id column may not exist, fetch all in range
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: true });

        if (error) throw error;
        return data || [];
      } catch {
        return [];
      }
    }
  }

  async checkCollision(userId: string, date: string, start: string, end: string, excludeId?: string): Promise<boolean> {
    try {
      let query = supabase
        .from('appointments')
        .select('id, time, duration')
        .eq('professional_id', userId)
        .eq('date', date)
        .not('status', 'eq', 'cancelled');

      if (excludeId) {
        query = query.not('id', 'eq', excludeId);
      }

      const { data: overlaps } = await query;

      if (!overlaps || overlaps.length === 0) return false;
      
      if (!start || !end) return overlaps.length > 0;

      const newStart = this.timeToMinutes(start);
      const newEnd = this.timeToMinutes(end);

      for (const overlap of overlaps) {
        const existStart = this.timeToMinutes(overlap.time || '');
        const existEnd = existStart + (overlap.duration || 30);
        if (newStart < existEnd && newEnd > existStart) {
          return true;
        }
      }
      
      return false;
    } catch {
      return false;
    }
  }

  private timeToMinutes(time: string): number {
    if (!time) return 0;
    const parts = time.split(':');
    return parseInt(parts[0] || '0') * 60 + parseInt(parts[1] || '0');
  }

  isValidTransition(currentStatus: AppointmentStatus, nextStatus: AppointmentStatus): boolean {

    return VALID_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false;
  }

  async getAppointmentByGoogleEventId(googleEventId: string): Promise<Appointment | null> {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('google_event_id', googleEventId)
        .single();

      if (error || !data) return null;
      return data as Appointment;
    } catch {
      return null;
    }
  }

  async deleteAppointment(appointmentId: string): Promise<void> {
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', appointmentId);

    if (error) throw error;
  }

  async updateStatus(
    appointmentId: string, 
    newStatus: AppointmentStatus, 
    metadata: { userId: string; reason?: string }
  ): Promise<void> {
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointment) throw fetchError || new Error('Appointment not found');

    const currentStatus = appointment.status as AppointmentStatus;

    if (!this.isValidTransition(currentStatus, newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }

    const updateData: Record<string, any> = { 
      status: newStatus, 
      status_changed_at: new Date().toISOString(),
      status_changed_by: metadata.userId 
    };

    if (newStatus === 'cancelled' && metadata.reason) {
      updateData.cancellation_reason = metadata.reason;
    }

    if (newStatus === 'rescheduled' && metadata.reason) {
      updateData.reschedule_reason = metadata.reason;
    }

    const { error: updateError } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId);

    if (updateError) throw updateError;

    await this.handleStatusChangeNotifications(appointment, newStatus);
  }

  async reschedule(
    appointmentId: string, 
    newDate: string, 
    metadata: { userId: string; reason?: string }
  ): Promise<void> {
    await this.updateStatus(appointmentId, 'rescheduled', metadata);
    const { error } = await supabase
      .from('appointments')
      .update({ date: newDate })
      .eq('id', appointmentId);

    if (error) throw error;
  }

  private async handleStatusChangeNotifications(appointment: any, newStatus: AppointmentStatus): Promise<void> {
    const contact = appointment.patient_contact || 'Unknown';

    if (newStatus === 'confirmed') {
      await this.notificationService.sendConfirmation(appointment.id, contact);
    } else if (newStatus === 'rescheduled') {
      await this.notificationService.sendRescheduleNotice(appointment.id, contact, appointment.date);
    }
  }
}
