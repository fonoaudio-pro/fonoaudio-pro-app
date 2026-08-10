import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, User, Link, AlertCircle, Loader2, ChevronLeft, ChevronRight, CheckCircle2, Search, Sparkles, Plus, Edit2, X, Trash2, Video, Copy, MessageSquare, Phone, MapPin, Repeat, Bell, FileText, Palette } from 'lucide-react';
import { GoogleCalendarService, CalendarEvent } from '../services/GoogleCalendarService';
import { GoogleAuthService } from '../services/GoogleAuthService';
import { CalendarMappingService, CalendarMapping } from '../services/CalendarMappingService';
import { SessionService } from '../services/SessionService';
import { AppointmentService } from '../src/services/AppointmentService';
import { NotificationService } from '../src/services/NotificationService';
import { ConsultorioConfigService, GOOGLE_CALENDAR_COLORS, TAILWIND_COLORS } from '../services/ConsultorioConfigService';
import { supabase } from '../utils/supabaseClient';
import { useToast } from '../context/ToastContext';
import { Patient, ProactiveSuggestion, Appointment, AppointmentStatus } from '../types';

interface AgendaSincronizadaProps {
  patients: Patient[];
  proactiveSuggestions?: ProactiveSuggestion[];
  pendingPatient?: Patient | null;
  onPendingPatientHandled?: () => void;
}

interface AppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment?: Appointment | null;
    patients: Patient[];
    onSave: (data: Partial<Appointment>) => Promise<void>;
}

const AppointmentModal: React.FC<AppointmentModalProps> = ({ isOpen, onClose, appointment, patients, onSave }) => {
    const [formData, setFormData] = useState<Partial<Appointment>>({
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        status: 'pending',
        origin: 'manual',
        patient_id: '',
        patient_name: '',
        type: 'Consultation',
        duration: 30,
        notes: '',
    });
    const [isTeleconsulta, setIsTeleconsulta] = useState(false);
    const [isGeneratingMeet, setIsGeneratingMeet] = useState(false);
    const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [selectedConsultorio, setSelectedConsultorio] = useState<string>('');
    const { addToast } = useToast();
    const notificationService = new NotificationService();

    useEffect(() => {
        if (appointment) {
            setFormData(appointment);
            setIsTeleconsulta(!!appointment.meetLink || appointment.type === 'Teleconsulta');
            setSelectedConsultorio(appointment.consultorio || '');
        } else {
            setFormData({
                date: new Date().toISOString().split('T')[0],
                time: '09:00',
                status: 'pending',
                origin: 'manual',
                patient_id: '',
                patient_name: '',
                type: 'Consultation',
                duration: 30,
                notes: '',
            });
            setIsTeleconsulta(false);
            setSelectedConsultorio('');
        }
    }, [appointment]);

    const handleGenerateMeet = async () => {
        if (!appointment?.google_event_id) {
            addToast({ message: "Solo se puede generar Meet para citas sincronizadas con Google Calendar", type: "error" });
            return;
        }
        setIsGeneratingMeet(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) throw new Error('No hay sesion activa');
            const tokens = await GoogleAuthService.getValidTokens(session.user.id);
            if (!tokens) throw new Error('No hay tokens de Google');

            const meetLink = await GoogleCalendarService.addMeetToEvent(tokens.accessToken, appointment.google_event_id);
            if (meetLink) {
                const svc = new AppointmentService();
                await svc.updateAppointment(appointment.id, { meetLink } as Partial<Appointment>);
                setFormData(prev => ({ ...prev, meetLink }));
                addToast({ message: "Enlace de Meet generado y guardado", type: "success" });
            } else {
                addToast({ message: "No se pudo generar el enlace de Meet", type: "error" });
            }
        } catch (error: any) {
            addToast({ message: `Error generando Meet: ${error.message}`, type: "error" });
        } finally {
            setIsGeneratingMeet(false);
        }
    };

    const handleSendWhatsApp = async () => {
        if (!formData.meetLink) {
            addToast({ message: "No hay enlace de Meet para enviar", type: "error" });
            return;
        }
        const patient = patients.find(p => p.id === formData.patient_id);
        const contact = patient?.phone || formData.patient_contact;
        if (!contact) {
            addToast({ message: "No hay numero de telefono del paciente. Editar la ficha del paciente primero.", type: "error" });
            return;
        }
        setIsSendingWhatsApp(true);
        try {
            notificationService.sendMeetLink(
                formData.patient_name || 'Paciente',
                contact,
                formData.meetLink,
                formData.date || '',
                formData.time || ''
            );
            addToast({ message: "Abriendo WhatsApp para enviar el enlace...", type: "success" });
        } catch (error: any) {
            addToast({ message: `Error al enviar: ${error.message}`, type: "error" });
        } finally {
            setIsSendingWhatsApp(false);
        }
    };

    const handleCopyLink = () => {
        if (formData.meetLink) {
            navigator.clipboard.writeText(formData.meetLink);
            addToast({ message: "Enlace copiado al portapapeles", type: "success" });
        }
    };

    const calculateEndTime = (startTime: string, durationMinutes: number): string => {
        const [hours, minutes] = startTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + durationMinutes;
        const endHours = Math.floor(totalMinutes / 60) % 24;
        const endMinutes = totalMinutes % 60;
        return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    };

    const handleConsultorioChange = (consultorioId: string) => {
        setSelectedConsultorio(consultorioId);
        const config = ConsultorioConfigService.getById(consultorioId);
        if (config) {
            setFormData(prev => ({
                ...prev,
                consultorio: consultorioId,
                color_id: config.googleColorId,
            }));
        }
    };

    if (!isOpen) return null;

    const selectedPatient = patients.find(p => p.id === formData.patient_id);
    const consultorioConfig = ConsultorioConfigService.getAll();
    const currentColorId = formData.color_id || ConsultorioConfigService.getGoogleColorId(selectedConsultorio || 'consultorio_1');
    const currentColor = GOOGLE_CALENDAR_COLORS[currentColorId];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header with color indicator */}
                <div 
                    className="p-6 border-b dark:border-slate-800 flex justify-between items-center shrink-0"
                    style={{ borderLeftWidth: '4px', borderLeftColor: currentColor?.hex || '#7986cb' }}
                >
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {appointment ? 'Editar Cita' : 'Nueva Cita'}
                        </h3>
                        {appointment && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                {appointment.origin === 'google' ? 'Sincronizada con Google Calendar' : 'Cita local'}
                                {appointment.google_event_id && ` • ID: ${appointment.google_event_id.slice(0, 12)}...`}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><X size={20} /></button>
                </div>
                
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    {/* Patient selector */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Paciente</label>
                        <select 
                            value={formData.patient_id || ''} 
                            onChange={e => {
                                const p = patients.find(pat => pat.id === e.target.value);
                                setFormData(prev => ({ ...prev, patient_id: e.target.value, patient_name: p?.name || '' }));
                                if (p?.consultorio) {
                                    setSelectedConsultorio(p.consultorio);
                                    handleConsultorioChange(p.consultorio);
                                }
                            }}
                            className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border-transparent rounded-xl text-sm outline-none"
                        >
                            <option value="">Seleccionar paciente...</option>
                            {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        {selectedPatient?.phone && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                <Phone size={10} /> {selectedPatient.phone}
                            </p>
                        )}
                    </div>

                    {/* Date and Time */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Fecha</label>
                            <input 
                                type="date" 
                                value={formData.date} 
                                onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border-transparent rounded-xl text-sm outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Hora inicio</label>
                            <input 
                                type="time" 
                                value={formData.time} 
                                onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                                className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border-transparent rounded-xl text-sm outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Duración</label>
                            <select 
                                value={formData.duration || 30} 
                                onChange={e => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                                className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border-transparent rounded-xl text-sm outline-none"
                            >
                                <option value={15}>15 min</option>
                                <option value={30}>30 min</option>
                                <option value={45}>45 min</option>
                                <option value={60}>1 hora</option>
                                <option value={90}>1.5 horas</option>
                                <option value={120}>2 horas</option>
                            </select>
                        </div>
                    </div>

                    {/* End time display */}
                    {formData.time && formData.duration && (
                        <p className="text-xs text-slate-500">
                            Hora de fin: <span className="font-bold">{calculateEndTime(formData.time, formData.duration)}</span>
                        </p>
                    )}

                    {/* Consultorio selector */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1">
                            <MapPin size={12} /> Consultorio
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {consultorioConfig.map(c => {
                                const tc = TAILWIND_COLORS[c.color] || TAILWIND_COLORS.blue;
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => handleConsultorioChange(c.id)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                                            selectedConsultorio === c.id
                                                ? `${tc.border} ${tc.light} ${tc.text}`
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-300'
                                        }`}
                                    >
                                        <span>{c.icon}</span>
                                        <span>{c.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Color picker */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1">
                            <Palette size={12} /> Color del evento
                        </label>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowColorPicker(!showColorPicker)}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-sm font-medium"
                            >
                                <div 
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: currentColor?.hex || '#7986cb' }}
                                />
                                <span>{currentColor?.name || 'Color por defecto'}</span>
                            </button>
                            {showColorPicker && (
                                <div className="flex gap-1 p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                    {Object.entries(GOOGLE_CALENDAR_COLORS).map(([id, { name, hex }]) => (
                                        <button
                                            key={id}
                                            onClick={() => {
                                                setFormData(prev => ({ ...prev, color_id: id }));
                                                setShowColorPicker(false);
                                            }}
                                            className={`w-6 h-6 rounded-full hover:scale-110 transition-transform ${currentColorId === id ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                                            style={{ backgroundColor: hex }}
                                            title={name}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Status and Type */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Estado</label>
                            <select 
                                value={formData.status || 'pending'} 
                                onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                                className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border-transparent rounded-xl text-sm outline-none"
                            >
                                <option value="pending">Pendiente</option>
                                <option value="confirmed">Confirmada</option>
                                <option value="completed">Completada</option>
                                <option value="cancelled">Cancelada</option>
                                <option value="no_show">Ausente</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Tipo</label>
                            <select 
                                value={formData.type || 'Consultation'} 
                                onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
                                className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border-transparent rounded-xl text-sm outline-none"
                            >
                                <option value="Consultation">Consulta</option>
                                <option value="Follow-up">Seguimiento</option>
                                <option value="Evaluation">Evaluación</option>
                                <option value="Teleconsulta">Teleconsulta</option>
                            </select>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1">
                            <FileText size={12} /> Notas
                        </label>
                        <textarea
                            value={formData.notes || ''}
                            onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Agregar notas o descripción de la cita..."
                            rows={3}
                            className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border-transparent rounded-xl text-sm outline-none resize-none"
                        />
                    </div>

                    {/* Google Meet toggle */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <div className="flex items-center gap-2">
                            <Video size={16} className="text-blue-500" />
                            <div>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Google Meet</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500">Agregar enlace de videollamada</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsTeleconsulta(!isTeleconsulta)}
                            className={`relative w-11 h-6 rounded-full transition-colors ${
                                isTeleconsulta ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                isTeleconsulta ? 'translate-x-5' : ''
                            }`} />
                        </button>
                    </div>

                    {/* Meet link display */}
                    {formData.meetLink && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 space-y-2">
                            <div className="flex items-center gap-2">
                                <Video size={14} className="text-blue-600" />
                                <span className="text-xs font-bold text-blue-700 dark:text-blue-400">Enlace de Meet</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    readOnly 
                                    value={formData.meetLink} 
                                    className="flex-1 text-[11px] text-blue-600 bg-white dark:bg-slate-800 p-2 rounded-lg border border-blue-200 dark:border-blue-700 truncate"
                                />
                                <button onClick={handleCopyLink} className="p-2 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-lg transition-colors" title="Copiar enlace">
                                    <Copy size={14} className="text-blue-600" />
                                </button>
                                <button 
                                    onClick={handleSendWhatsApp} 
                                    disabled={isSendingWhatsApp || !selectedPatient?.phone}
                                    className="p-2 hover:bg-green-100 dark:hover:bg-green-800 rounded-lg transition-colors disabled:opacity-40" 
                                    title="Enviar por WhatsApp"
                                >
                                    <MessageSquare size={14} className="text-green-600" />
                                </button>
                            </div>
                            {!selectedPatient?.phone && (
                                <p className="text-[10px] text-orange-500">El paciente no tiene telefono registrado. Editar la ficha del paciente.</p>
                            )}
                            <a 
                                href={formData.meetLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800"
                            >
                                <Video size={12} /> Abrir Meet en nueva pestaña
                            </a>
                        </div>
                    )}

                    {isTeleconsulta && !formData.meetLink && appointment?.google_event_id && (
                        <button
                            onClick={handleGenerateMeet}
                            disabled={isGeneratingMeet}
                            className="w-full p-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isGeneratingMeet ? (
                                <><Loader2 size={16} className="animate-spin" /> Generando enlace...</>
                            ) : (
                                <><Video size={16} /> Generar enlace de Meet</>
                            )}
                        </button>
                    )}

                    {isTeleconsulta && !formData.meetLink && !appointment?.google_event_id && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                            <p className="text-[11px] text-amber-700 dark:text-amber-400">
                                Para generar un enlace de Meet, primero guarda la cita para sincronizarla con Google Calendar.
                            </p>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t dark:border-slate-800 flex gap-3 shrink-0">
                    <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all">Cancelar</button>
                    <button 
                        onClick={() => onSave({ 
                            ...formData, 
                            type: isTeleconsulta ? 'Teleconsulta' : formData.type,
                            consultorio: selectedConsultorio,
                        })}
                        className="flex-1 py-2.5 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all"
                    >
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};

interface MappingModalProps {
  event: CalendarEvent;
  onClose: () => void;
  onMap: (patientId: string, sessionId?: string) => Promise<void>;
}

const MappingModal: React.FC<MappingModalProps> = ({ event, onClose, onMap }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchPatients = async () => {
      const { data } = await supabase.from('patients').select('*').order('name');
      if (data) setPatients(data);
    };
    fetchPatients();
  }, []);

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.phone?.includes(searchQuery)
  );

  const handleConfirm = async () => {
    if (!selectedPatientId) return;
    setIsLoading(true);
    try {
      await onMap(selectedPatientId, selectedSessionId || undefined);
      onClose();
    } catch (error: any) {
      addToast({ message: error.message || "Error al vincular", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Vincular Evento</h3>
          <p className="text-xs text-slate-500">Asociar esta cita a un paciente del sistema</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Buscar Paciente</label>
            <div className="relative">
              <input 
                type="text"
                placeholder="Nombre o telefono..."
                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-transparent rounded-xl text-sm outline-none"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {filteredPatients.length === 0 ? (
              <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-4">No se encontraron pacientes</p>
            ) : (
              filteredPatients.map(p => (
                <div 
                  key={p.id}
                  onClick={() => setSelectedPatientId(p.id)}
                  className={`p-3 rounded-xl cursor-pointer border transition-all ${
                    selectedPatientId === p.id 
                      ? 'bg-blue-50 border-blue-500 text-blue-700' 
                      : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <p className="text-sm font-bold">{p.name}</p>
                  <p className="text-[10px] opacity-70">{p.diagnosis || 'Sin diagnostico'}</p>
                </div>
              ))
            )}
          </div>
          <div className="space-y-2 pt-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Opciones de Sesion</label>
            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={() => { setSelectedSessionId(null); handleConfirm(); }}
                disabled={!selectedPatientId || isLoading}
                className="text-xs p-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                Nueva Sesion (Pendiente)
              </button>
              <button 
                onClick={() => { setSelectedSessionId('existing'); handleConfirm(); }}
                disabled={!selectedPatientId || isLoading}
                className="text-xs p-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                Asociar a Sesion Existente
              </button>
            </div>
          </div>
        </div>
        <div className="p-6 border-t dark:border-slate-800 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all">Cancelar</button>
          <button 
            onClick={handleConfirm}
            disabled={!selectedPatientId || isLoading}
            className="flex-1 py-2 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

type ViewMode = 'day' | 'week' | 'all';

function formatDateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getDayLabel(dateStr: string): string {
  const today = formatDateKey(new Date());
  const yesterday = formatDateKey(new Date(Date.now() - 86400000));
  const tomorrow = formatDateKey(new Date(Date.now() + 86400000));
  if (dateStr === today) return 'Hoy';
  if (dateStr === yesterday) return 'Ayer';
  if (dateStr === tomorrow) return 'Manana';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
}

export const AgendaSincronizada: React.FC<AgendaSincronizadaProps> = ({ patients, proactiveSuggestions = [], pendingPatient, onPendingPatientHandled }) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [mappings, setMappings] = useState<CalendarMapping[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const { addToast } = useToast();
  const appointmentService = new AppointmentService();

  const [selectedDate, setSelectedDate] = useState<string>(formatDateKey(new Date()));
  const [viewMode, setViewMode] = useState<ViewMode>('day');

  useEffect(() => {
    syncAgenda();
  }, []);

  useEffect(() => {
    if (pendingPatient) {
      const consultorio = pendingPatient.consultorio || '';
      setEditingAppointment({
        patient_id: pendingPatient.id,
        patient_name: pendingPatient.name,
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        status: 'pending',
        type: 'Consultation',
        origin: 'manual',
        professional_id: '',
        duration: 30,
        consultorio: consultorio,
      } as Appointment);
      setIsAppointmentModalOpen(true);
      onPendingPatientHandled?.();
    }
  }, [pendingPatient]);

  const syncAgenda = async () => {
    setIsLoading(true);
    try {
      let { data: { session } } = await supabase.auth.getSession();
      
      let retries = 0;
      while (!session?.user && retries < 3) {
        retries++;
        await new Promise(resolve => setTimeout(resolve, 1000));
        const retry = await supabase.auth.getSession();
        session = retry.data.session;
      }

      if (!session?.user) {
        addToast({ message: "No hay sesion de usuario activa.", type: "error" });
        return;
      }
      const userId = session.user.id;

      const tokens = await GoogleAuthService.getValidTokens(userId);
      setIsGoogleConnected(!!tokens);
      
      let newEvents: CalendarEvent[] = [];
      
      if (tokens) {
        try {
          const syncResult = await GoogleCalendarService.syncEvents(userId, tokens.accessToken);
          newEvents = syncResult.events;
          
          if (syncResult.nextSyncToken) {
            await GoogleCalendarService.saveSyncToken(userId, syncResult.nextSyncToken);
          }
          
          for (const event of newEvents) {
            let existing = null;
            try {
              const result = await supabase
                .from('appointments')
                .select('id')
                .eq('google_event_id', event.id)
                .single();
              existing = result.data;
            } catch {
              // google_event_id column may not exist yet - skip dedup
            }

            if (!existing) {
              try {
                await appointmentService.createAppointment({
                  patient_name: event.summary,
                  date: new Date(event.start).toISOString().split('T')[0],
                  time: `${String(new Date(event.start).getHours()).padStart(2, '0')}:${String(new Date(event.start).getMinutes()).padStart(2, '0')}:00`,
                  status: 'pending',
                  type: event.meetLink ? 'Teleconsulta' : 'Consultation',
                  google_event_id: event.id,
                  origin: 'google',
                  professional_id: userId,
                  start_time: event.start,
                  end_time: event.end,
                  duration: Math.round((new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000),
                  meetLink: event.meetLink,
                });
              } catch (insertErr: any) {
                console.warn('[AgendaSincronizada] Could not insert appointment:', insertErr.message);
              }
            }
          }
          setEvents(newEvents);
        } catch (e: any) {
          if (e.message.includes('401') || e.message.includes('Invalid') || e.message.includes('token')) {
            addToast({ message: "Token de Google expirado. Reconecta Google Calendar.", type: "error" });
          } else if (e.message.includes('insufficient') || e.message.includes('403') || e.message.includes('scope')) {
            addToast({ message: "Permisos insuficientes. Salí y volvé a iniciar sesión para obtener los permisos de Calendar.", type: "error" });
          } else if (e.message.includes('not been used') || e.message.includes('disabled')) {
            addToast({ message: "Google Calendar API no habilitada. Ve a console.cloud.google.com -> APIs -> Habilita 'Google Calendar API'.", type: "error" });
          } else {
            addToast({ message: "Error sincronizando con Google: " + e.message, type: "error" });
          }
        }
      } else {
        console.log('[AgendaSincronizada] Google Calendar no conectado. Solo se muestran citas internas.');
      }

      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 1);
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 30);

      const internalAppointments = await appointmentService.getAppointmentsForUser(
        userId, 
        startDate.toISOString().split('T')[0], 
        endDate.toISOString().split('T')[0]
      );

      setAppointments(internalAppointments);
      const mappingsData = await CalendarMappingService.getMappingsByEventIds(newEvents.map(e => e.id));
      setMappings(mappingsData);
    } catch (error: any) {
      addToast({ message: "Error critico de agenda: " + error.message, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAppointments = useMemo(() => {
    const today = formatDateKey(new Date());
    if (viewMode === 'day') {
      return appointments.filter(a => a.date === selectedDate);
    }
    if (viewMode === 'week') {
      const d = new Date(selectedDate + 'T12:00:00');
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay() + 1);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const startKey = formatDateKey(start);
      const endKey = formatDateKey(end);
      return appointments.filter(a => a.date >= startKey && a.date <= endKey);
    }
    return appointments;
  }, [appointments, viewMode, selectedDate]);

  const groupedAppointments = useMemo(() => {
    const groups: Record<string, Appointment[]> = {};
    for (const appt of filteredAppointments) {
      if (!groups[appt.date]) groups[appt.date] = [];
      groups[appt.date].push(appt);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredAppointments]);

  const stats = useMemo(() => {
    const today = formatDateKey(new Date());
    const todayAppts = appointments.filter(a => a.date === today);
    return {
      total: appointments.length,
      today: todayAppts.length,
      pending: todayAppts.filter(a => a.status === 'pending').length,
      confirmed: todayAppts.filter(a => a.status === 'confirmed').length,
    };
  }, [appointments]);

  const navigateDay = (offset: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    setSelectedDate(formatDateKey(d));
  };

  const handleSaveAppointment = async (data: Partial<Appointment>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('No hay sesion activa');

      const appointmentData = { ...data, professional_id: session.user.id };
      if (!appointmentData.patient_id) {
        delete appointmentData.patient_id;
      }

      let savedAppointment: Appointment;
      
      if (editingAppointment?.id) {
        await appointmentService.updateAppointment(editingAppointment.id, appointmentData);
        savedAppointment = { ...editingAppointment, ...appointmentData } as Appointment;
        addToast({ message: 'Cita actualizada', type: 'success' });
      } else {
        savedAppointment = await appointmentService.createAppointment(appointmentData);
        addToast({ message: 'Cita creada', type: 'success' });
      }

      try {
        const tokens = await GoogleAuthService.getValidTokens(session.user.id);
        
        if (tokens && savedAppointment) {
          const isTeleconsulta = appointmentData.type === 'Teleconsulta';
          
          if (!editingAppointment?.id) {
            const timeStr = appointmentData.time || '09:00';
            const seconds = timeStr.split(':').length === 3 ? '' : ':00';
            const startDate = new Date(`${appointmentData.date}T${timeStr}${seconds}`);
            const endDate = new Date(startDate.getTime() + (appointmentData.duration || 60) * 60000);

            let googleEvent;
            if (isTeleconsulta) {
              googleEvent = await GoogleCalendarService.createEventWithMeet(tokens.accessToken, {
                summary: `${appointmentData.patient_name || 'Cita'} - ${appointmentData.type || 'Consulta'}`,
                description: `Teleconsulta desde FonoAudio Pro AI\nPaciente: ${appointmentData.patient_name || 'Sin nombre'}${appointmentData.notes ? `\nNotas: ${appointmentData.notes}` : ''}`,
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                colorId: appointmentData.color_id,
              });
            } else {
              googleEvent = await GoogleCalendarService.createEvent(tokens.accessToken, {
                summary: `${appointmentData.patient_name || 'Cita'} - ${appointmentData.type || 'Consulta'}`,
                description: `Cita creada desde FonoAudio Pro AI\nPaciente: ${appointmentData.patient_name || 'Sin nombre'}${appointmentData.notes ? `\nNotas: ${appointmentData.notes}` : ''}`,
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                colorId: appointmentData.color_id,
              });
            }

            const updateData: Partial<Appointment> = { google_event_id: googleEvent.id };
            if (googleEvent.meetLink) {
              updateData.meetLink = googleEvent.meetLink;
            }
            await appointmentService.updateAppointment(savedAppointment.id, updateData);
            
            if (isTeleconsulta && googleEvent.meetLink) {
              addToast({ message: 'Teleconsulta creada con enlace de Meet', type: 'success' });
            } else {
              addToast({ message: 'Evento sincronizado con Google Calendar', type: 'success' });
            }
          } else if (savedAppointment.google_event_id) {
            const timeStr = appointmentData.time || '09:00';
            const seconds = timeStr.split(':').length === 3 ? '' : ':00';
            const startDate = new Date(`${appointmentData.date}T${timeStr}${seconds}`);
            if (isNaN(startDate.getTime())) {
              addToast({ message: "Fecha/hora inválida para sincronizar con Google Calendar.", type: "error" });
            } else {
              const endDate = new Date(startDate.getTime() + (appointmentData.duration || 60) * 60000);
              await GoogleCalendarService.updateEvent(tokens.accessToken, savedAppointment.google_event_id, {
                summary: `${appointmentData.patient_name || 'Cita'} - ${appointmentData.type || 'Consulta'}`,
                description: `Cita actualizada desde FonoAudio Pro AI\nPaciente: ${appointmentData.patient_name || 'Sin nombre'}${appointmentData.notes ? `\nNotas: ${appointmentData.notes}` : ''}`,
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                colorId: appointmentData.color_id,
              });
              addToast({ message: 'Evento actualizado en Google Calendar', type: 'success' });
            }
          }
        }
      } catch (googleError: any) {
        addToast({ message: `Turno guardado. Error con Google Calendar: ${googleError.message}`, type: "error" });
      }
      
      setIsAppointmentModalOpen(false);
      setEditingAppointment(null);
      syncAgenda();
    } catch (error: any) {
      addToast({ message: error.message || "Error al guardar cita", type: "error" });
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
       await GoogleAuthService.signInWithGoogle();
    } catch (error: any) {
       addToast({ message: error.message || "Error al conectar", type: "error" });
    } finally {
       setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('No hay sesion activa');
      
      await GoogleAuthService.disconnectGoogle(session.user.id);
      setIsGoogleConnected(false);
      setEvents([]);
      addToast({ message: "Google Calendar desconectado.", type: "success" });
    } catch (error: any) {
      addToast({ message: error.message || "Error al desconectar", type: "error" });
    }
  };

  const handleOpenCreateModal = () => {
    setEditingAppointment(null);
    setIsAppointmentModalOpen(true);
  };

  const handleOpenEditModal = (appt: Appointment) => {
    setEditingAppointment(appt);
    setIsAppointmentModalOpen(true);
  };

  const handleDelete = async (appointment: Appointment) => {
    if (!confirm(`Eliminar cita de ${appointment.patient_name}?`)) return;
    try {
      if (appointment.google_event_id) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const tokens = await GoogleAuthService.getValidTokens(session.user.id);
          if (tokens) {
            await GoogleCalendarService.deleteEvent(tokens.accessToken, appointment.google_event_id);
          }
        }
      }
      await appointmentService.deleteAppointment(appointment.id);
      addToast({ message: 'Cita eliminada', type: 'success' });
      syncAgenda();
    } catch (error: any) {
      addToast({ message: error.message || 'Error al eliminar cita', type: 'error' });
    }
  };

  const handleLinkEvent = async (patientId: string, sessionId?: string) => {
    if (!selectedEvent) return;
    try {
      const patientName = patients.find(p => p.id === patientId)?.name || 'Unknown';

      // Check if an appointment with this google_event_id already exists
      const existingAppt = appointments.find(a => a.google_event_id === selectedEvent.id);

      if (existingAppt) {
        // Update existing appointment with patient info
        await appointmentService.updateAppointment(existingAppt.id, {
          patient_id: patientId,
          patient_name: patientName,
        });
      } else {
        // Create new appointment from the event
        const eventDate = new Date(selectedEvent.start).toISOString();
        await appointmentService.createAppointment({
          patient_id: patientId,
          patient_name: patientName,
          date: eventDate.split('T')[0],
          time: `${String(new Date(selectedEvent.start).getHours()).padStart(2, '0')}:${String(new Date(selectedEvent.start).getMinutes()).padStart(2, '0')}:00`,
          status: 'pending',
          type: 'Consultation',
          google_event_id: selectedEvent.id,
          origin: 'synced',
          professional_id: (await supabase.auth.getUser()).data.user?.id,
        });
      }

      // Create calendar mapping
      if (sessionId === 'new') {
        const newSession = await SessionService.createSession(patientId, {
          date: new Date(selectedEvent.start).toISOString().split('T')[0],
          objectives: `Sesion vinculada desde Google Calendar: ${selectedEvent.summary}`,
        });
        await CalendarMappingService.createMapping(selectedEvent.id, patientId, newSession.id, new Date(selectedEvent.start).toISOString());
      } else if (sessionId === 'existing') {
        await CalendarMappingService.createMapping(selectedEvent.id, patientId, sessionId, new Date(selectedEvent.start).toISOString());
      } else {
        await CalendarMappingService.createMapping(selectedEvent.id, patientId, undefined, new Date(selectedEvent.start).toISOString());
      }

      addToast({ message: "Evento vinculado y guardado en sistema.", type: "success" });
      setIsModalOpen(false);
      setSelectedEvent(null);
      syncAgenda();
    } catch (error: any) {
      addToast({ message: error.message || "Error al vincular", type: "error" });
    }
  };

  const getConsultorioColor = (appointment: Appointment) => {
    const consultorioId = appointment.consultorio;
    if (!consultorioId) return null;
    const config = ConsultorioConfigService.getById(consultorioId);
    if (!config) return null;
    const tc = TAILWIND_COLORS[config.color];
    const gc = GOOGLE_CALENDAR_COLORS[config.googleColorId];
    return { ...tc, hex: gc?.hex || '#7986cb', name: config.name, icon: config.icon };
  };

  const renderAppointmentCard = (appointment: Appointment) => {
    const suggestion = proactiveSuggestions.find(s => s.patientId === appointment.patient_id);
    const consultorioColor = getConsultorioColor(appointment);
   
    const handleStatusUpdate = async (newStatus: AppointmentStatus) => {
      let reason = '';
      if (newStatus === 'cancelled' || newStatus === 'rescheduled') {
        reason = prompt(`Motivo para ${newStatus === 'cancelled' ? 'cancelar' : 'reprogramar'}:`);
        if (reason === null) return;
      }
      try {
        await appointmentService.updateStatus(appointment.id, newStatus, { 
          userId: (await supabase.auth.getUser()).data.user?.id || 'system', 
          reason 
        });
        addToast({ message: `Estado actualizado a ${newStatus}`, type: "success" });

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && appointment.google_event_id) {
            const tokens = await GoogleAuthService.getValidTokens(session.user.id);
            if (tokens) {
              if (newStatus === 'cancelled') {
                await GoogleCalendarService.deleteEvent(tokens.accessToken, appointment.google_event_id);
                addToast({ message: 'Evento eliminado de Google Calendar', type: 'success' });
              } else if (newStatus === 'rescheduled') {
                const startDate = new Date(`${appointment.date}T${appointment.time || '09:00'}:00`);
                const endDate = new Date(startDate.getTime() + (appointment.duration || 60) * 60000);
                await GoogleCalendarService.updateEvent(tokens.accessToken, appointment.google_event_id, {
                  summary: `${appointment.patient_name || 'Cita'} - ${appointment.type || 'Consulta'}`,
                  description: `Cita reprogramada desde FonoAudio Pro AI\nPaciente: ${appointment.patient_name || 'Sin nombre'}`,
                  start: startDate.toISOString(),
                  end: endDate.toISOString(),
                });
                addToast({ message: 'Evento actualizado en Google Calendar', type: 'success' });
              }
            }
          }
        } catch (googleError: any) {
          console.error('[handleStatusUpdate] Error syncing status to Google Calendar:', googleError);
          addToast({ message: `Error sincronizando estado con Google: ${googleError.message}`, type: "error" });
        }

        syncAgenda();
      } catch (error: any) {
        addToast({ message: error.message || "Error al actualizar estado", type: "error" });
      }
    };

    return (
      <div 
        key={appointment.id}
        onClick={() => { 
          handleOpenEditModal(appointment);
        }}
        className="group bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800 transition-all cursor-pointer relative overflow-hidden"
        style={consultorioColor ? { borderLeftWidth: '4px', borderLeftColor: consultorioColor.hex } : undefined}
      >
        <div className="flex items-start gap-4">
          <div 
            className="flex flex-col items-center justify-center w-12 h-12 rounded-xl shrink-0"
            style={{ 
              backgroundColor: consultorioColor ? `${consultorioColor.hex}15` : undefined,
              color: consultorioColor?.hex || undefined,
            }}
          >
            <Clock size={18} className={!consultorioColor ? 'text-blue-600' : ''} />
            <span className={`text-[11px] font-black mt-0.5 ${!consultorioColor ? 'text-blue-600' : ''}`}>{appointment.time?.slice(0, 5)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-slate-900 dark:text-white truncate">{appointment.patient_name}</h4>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
               appointment.status === 'confirmed' ? 'bg-green-100 text-green-700' :
               appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
               appointment.status === 'cancelled' ? 'bg-red-100 text-red-700' :
               appointment.status === 'no_show' ? 'bg-orange-100 text-orange-700' :
                'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
             }`}>
               {appointment.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {appointment.duration || 30} min {appointment.origin === 'google' ? '• Google' : ''}
            </p>
            {consultorioColor && (
              <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${consultorioColor.hex}18`, color: consultorioColor.hex }}>
                {consultorioColor.icon} {consultorioColor.name}
              </span>
            )}
            {appointment.meetLink && (
              <a
                href={appointment.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                <Video size={10} /> Unirse a Meet
              </a>
            )}
          </div>
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {appointment.meetLink && (
              <a
                href={appointment.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-500 dark:text-blue-400 rounded-lg transition-colors"
                title="Unirse a Meet"
              >
                <Video size={14} />
              </a>
            )}
            <button onClick={() => handleOpenEditModal(appointment)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 rounded-lg transition-colors" title="Editar">
              <Edit2 size={14} />
            </button>
            {appointmentService.isValidTransition(appointment.status, 'confirmed') && (
              <button onClick={() => handleStatusUpdate('confirmed')} className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg transition-colors" title="Confirmar">
                <CheckCircle2 size={14} />
              </button>
            )}
            {appointmentService.isValidTransition(appointment.status, 'cancelled') && (
              <button onClick={() => handleStatusUpdate('cancelled')} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors" title="Cancelar">
                <AlertCircle size={14} />
              </button>
            )}
            {appointment.google_event_id && !appointment.patient_id && (
              <button 
                onClick={() => {
                  setSelectedEvent({
                    id: appointment.google_event_id!,
                    summary: appointment.patient_name || 'Sin nombre',
                    start: `${appointment.date}T${appointment.time || '09:00'}:00`,
                    end: `${appointment.date}T${appointment.time || '09:30'}:00`,
                    meetLink: appointment.meetLink,
                  });
                  setIsModalOpen(true);
                }} 
                className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg transition-colors" 
                title="Vincular a paciente"
              >
                <Link size={14} />
              </button>
            )}
            <button onClick={() => handleDelete(appointment)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 rounded-lg transition-colors" title="Eliminar">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        {suggestion && (
          <div className="mt-2 flex items-center gap-1 text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg text-[10px] font-black animate-pulse">
            <Sparkles size={12} />
            SUGERENCIA
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <div className="p-4 border-b dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between mb-3">
          <div>
             <h2 className="text-lg font-black text-slate-900 dark:text-white">Agenda</h2>
             <p className="text-[10px] text-slate-400 dark:text-slate-500">
               {stats.today} citas hoy {stats.pending > 0 && `• ${stats.pending} pendientes`}
             </p>
          </div>
          <div className="flex items-center gap-2">
              <button 
                  onClick={handleOpenCreateModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-md"
              >
                  <Plus size={14} /> Nueva
              </button>
              {isGoogleConnected ? (
                <button 
                  onClick={handleDisconnect}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-xl text-xs font-bold hover:bg-green-100 dark:hover:bg-green-900/30 transition-all"
                >
                  <Calendar size={14} className="text-green-600 dark:text-green-400" /> Google
                </button>
              ) : (
                <button 
                  onClick={handleConnect}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  <Calendar size={14} className="text-blue-600" /> Conectar
                </button>
              )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigateDay(-1)} 
            className="p-2 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors flex items-center justify-center"
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="flex-1 flex items-center justify-center gap-1">
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-transparent border-none outline-none cursor-pointer text-center"
            />
          </div>

          <button 
            onClick={() => navigateDay(1)} 
            className="p-2 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors flex items-center justify-center"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 mt-3">
          {([
            { mode: 'day' as ViewMode, label: 'Dia' },
            { mode: 'week' as ViewMode, label: 'Semana' },
            { mode: 'all' as ViewMode, label: 'Todas' },
          ]).map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                viewMode === mode 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
          
          <div className="flex-1" />
          
          <button
            onClick={() => { setSelectedDate(formatDateKey(new Date())); setViewMode('day'); }}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
              selectedDate === formatDateKey(new Date()) && viewMode === 'day'
                ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Hoy
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <Loader2 className="animate-spin mb-2" size={32} />
            <p className="text-sm italic">Sincronizando agenda...</p>
          </div>
        ) : groupedAppointments.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-4">
            <Calendar size={48} className="opacity-20" />
            <div className="text-center">
              <p className="font-bold">Sin citas para esta fecha</p>
              <p className="text-xs">Crea una cita o selecciona otro dia.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {groupedAppointments.map(([dateStr, dayAppts]) => (
              <div key={dateStr}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase">
                    {getDayLabel(dateStr)}
                  </h3>
                  <span className="text-[10px] font-bold text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    {dayAppts.length}
                  </span>
                  <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                </div>
                <div className="space-y-2">
                  {dayAppts
                    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                    .map(renderAppointmentCard)
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && selectedEvent && (
        <MappingModal 
          event={selectedEvent}
          onClose={() => setIsModalOpen(false)}
          onMap={handleLinkEvent}
        />
      )}

      <AppointmentModal 
          isOpen={isAppointmentModalOpen}
          onClose={() => setIsAppointmentModalOpen(false)}
          appointment={editingAppointment}
          patients={patients}
          onSave={handleSaveAppointment}
      />
    </div>
  );
};

export default AgendaSincronizada;
