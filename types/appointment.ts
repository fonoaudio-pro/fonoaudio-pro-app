export type AppointmentStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'completed'
  | 'cancelled' 
  | 'rescheduled' 
  | 'attended' 
  | 'no_show';

export interface Appointment {
    id: string;
    patient_id: string;
    patient_name: string;
    date: string;
    time: string;
    status: AppointmentStatus;
    type: string;
    google_event_id?: string;
    patient_contact?: string;
    cancellationReason?: string;
    rescheduleReason?: string;
    statusChangedAt?: string;
    statusChangedBy?: string;
    meetLink?: string;
    location?: string;
    roomId?: string;
    duration?: number;
    origin?: string;
    professional_id?: string;
    start_time?: string;
    end_time?: string;
    consultorio?: string;
    color_id?: string;
    notes?: string;
}
