import { AppointmentStatus } from '../types/appointment';

export class NotificationService {
  async sendConfirmation(appointmentId: string, contact: string): Promise<void> {
    console.log(`[SIMULATION] Enviando confirmación por WhatsApp a ${contact} para el turno ${appointmentId}`);
  }

  async sendRescheduleNotice(appointmentId: string, contact: string, newDate: string): Promise<void> {
    console.log(`[SIMULATION] Enviando aviso de reprogramación a ${contact}: Nuevo turno ${newDate}`);
  }

  async sendReminder(appointmentId: string, contact: string): Promise<void> {
    console.log(`[SIMULATION] Enviando recordatorio de turno a ${contact}`);
  }

  generateMeetLinkMessage(patientName: string, meetLink: string, date: string, time: string): string {
    return `Hola ${patientName}, te comparto el enlace de Google Meet para tu consulta fonoaudiológica:\n\nFecha: ${date}\nHora: ${time}\nEnlace: ${meetLink}\n\nPor favor, ingresa unos minutos antes. ¡Te esperamos!`;
  }

  openWhatsApp(phoneNumber: string, message: string): void {
    const cleaned = phoneNumber.replace(/[^0-9+]/g, '');
    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${cleaned}?text=${encoded}`;
    window.open(url, '_blank');
  }

  async sendMeetLink(
    patientName: string, 
    contact: string, 
    meetLink: string, 
    date: string, 
    time: string
  ): Promise<void> {
    const message = this.generateMeetLinkMessage(patientName, meetLink, date, time);
    console.log(`[WhatsApp] Abriendo enlace para enviar Meet a ${contact}:`, message);
    this.openWhatsApp(contact, message);
  }
}
