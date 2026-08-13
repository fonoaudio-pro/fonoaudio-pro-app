import React, { useState, useEffect } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, Check, User, Phone, MessageSquare, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

interface TimeSlot {
    time: string;
    available: boolean;
}

interface BookingConfirmation {
    patientName: string;
    date: string;
    time: string;
    type: string;
}

const CONSULTATION_TYPES = [
    { id: 'consulta', label: 'Consulta', duration: 30, color: 'blue' },
    { id: 'evaluacion', label: 'Evaluación', duration: 60, color: 'purple' },
    { id: 'seguimiento', label: 'Seguimiento', duration: 30, color: 'emerald' },
    { id: 'tratamiento', label: 'Tratamiento', duration: 45, color: 'cyan' },
];

const TIME_SLOTS_BASE = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30',
];

export const PublicBookingPortal: React.FC = () => {
    const [step, setStep] = useState<'type' | 'date' | 'time' | 'form' | 'confirm'>('type');
    const [selectedType, setSelectedType] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        patientName: '',
        patientAge: '',
        phone: '',
        email: '',
        reason: '',
        parentName: '',
    });

    const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);

    const selectedTypeInfo = CONSULTATION_TYPES.find(t => t.id === selectedType);

    useEffect(() => {
        if (selectedDate && selectedType) {
            loadAvailableSlots();
        }
    }, [selectedDate, selectedType]);

    const loadAvailableSlots = async () => {
        if (!selectedDate) return;
        setLoading(true);
        try {
            const dateStr = selectedDate.toISOString().split('T')[0];
            const { data: existing } = await supabase
                .from('appointments')
                .select('time')
                .eq('date', dateStr)
                .in('status', ['pending', 'confirmed']);

            const bookedTimes = new Set((existing || []).map(a => a.time));
            const slots: TimeSlot[] = TIME_SLOTS_BASE.map(time => ({
                time,
                available: !bookedTimes.has(time),
            }));
            setAvailableSlots(slots);
        } catch {
            setAvailableSlots(TIME_SLOTS_BASE.map(time => ({ time, available: true })));
        } finally {
            setLoading(false);
        }
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days: (Date | null)[] = [];
        for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
        for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
        return days;
    };

    const isDateAvailable = (date: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date < today) return false;
        if (date.getDay() === 0) return false;
        return true;
    };

    const handleBook = async () => {
        if (!selectedDate || !selectedTime || !selectedTypeInfo) return;
        if (!formData.patientName || !formData.phone) {
            setError('Completá nombre y teléfono del paciente.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const appointment = {
                patientId: `portal_${Date.now()}`,
                patientName: formData.patientName,
                date: selectedDate.toISOString().split('T')[0],
                time: selectedTime,
                status: 'pending' as const,
                type: selectedTypeInfo.label,
                origin: 'portal' as const,
                notes: `Autoagendamiento portal. Edad: ${formData.patientAge}. Motivo: ${formData.reason}. Contacto: ${formData.parentName} - ${formData.phone}`,
            };

            const { error: insertError } = await supabase.from('appointments').insert([appointment]);
            if (insertError) throw insertError;

            setConfirmation({
                patientName: formData.patientName,
                date: selectedDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
                time: selectedTime,
                type: selectedTypeInfo.label,
            });
            setStep('confirm');
        } catch (err: any) {
            setError('Error al agendar. Intentá nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    if (step === 'confirm' && confirmation) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check size={32} className="text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Turno Reservado</h2>
                    <p className="text-slate-500 mb-6">Recibirás una confirmación por WhatsApp o email.</p>

                    <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2 mb-6">
                        <div className="flex justify-between"><span className="text-sm text-slate-500">Paciente</span><span className="text-sm font-bold text-slate-800">{confirmation.patientName}</span></div>
                        <div className="flex justify-between"><span className="text-sm text-slate-500">Tipo</span><span className="text-sm font-bold text-slate-800">{confirmation.type}</span></div>
                        <div className="flex justify-between"><span className="text-sm text-slate-500">Fecha</span><span className="text-sm font-bold text-slate-800">{confirmation.date}</span></div>
                        <div className="flex justify-between"><span className="text-sm text-slate-500">Hora</span><span className="text-sm font-bold text-indigo-600">{confirmation.time}</span></div>
                    </div>

                    <p className="text-xs text-slate-400">Si necesitás modificar el turn, comunicate al consultorio.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
            <div className="max-w-2xl mx-auto p-4 py-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                        <Calendar size={28} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Agendar Turno</h1>
                    <p className="text-sm text-slate-500 mt-1">FonoAudio Pro AI</p>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-2 mb-8 px-4">
                    {['type', 'date', 'time', 'form'].map((s, i) => (
                        <React.Fragment key={s}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                step === s ? 'bg-blue-600 text-white' : ['type', 'date', 'time', 'form'].indexOf(step) > i ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                            }`}>{['type', 'date', 'time', 'form'].indexOf(step) > i ? '✓' : i + 1}</div>
                            {i < 3 && <div className={`flex-1 h-1 rounded ${['type', 'date', 'time', 'form'].indexOf(step) > i ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                        </React.Fragment>
                    ))}
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                {/* Step: Type Selection */}
                {step === 'type' && (
                    <div className="space-y-3">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">¿Qué tipo de consulta necesitás?</h2>
                        {CONSULTATION_TYPES.map(t => (
                            <button key={t.id} onClick={() => { setSelectedType(t.id); setStep('date'); }}
                                className={`w-full p-4 bg-white rounded-2xl border-2 border-slate-200 hover:border-${t.color}-400 hover:bg-${t.color}-50 transition-all text-left flex items-center gap-4`}>
                                <div className={`w-12 h-12 bg-${t.color}-100 rounded-xl flex items-center justify-center`}>
                                    <Calendar size={20} className={`text-${t.color}-600`} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">{t.label}</p>
                                    <p className="text-xs text-slate-500">Duración: {t.duration} minutos</p>
                                </div>
                                <ChevronRight size={18} className="text-slate-300 ml-auto" />
                            </button>
                        ))}
                    </div>
                )}

                {/* Step: Date Selection */}
                {step === 'date' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">Elegí una fecha</h2>
                        <div className="flex items-center justify-between mb-4">
                            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronLeft size={18} /></button>
                            <span className="font-bold text-slate-800">{currentMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</span>
                            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronRight size={18} /></button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center">
                            {weekDays.map(d => <div key={d} className="text-[10px] font-bold text-slate-400 py-1">{d}</div>)}
                            {getDaysInMonth(currentMonth).map((day, i) => {
                                if (!day) return <div key={`empty_${i}`} />;
                                const available = isDateAvailable(day);
                                const isSelected = selectedDate?.toDateString() === day.toDateString();
                                return (
                                    <button key={i} disabled={!available}
                                        onClick={() => { setSelectedDate(day); setStep('time'); }}
                                        className={`py-2 rounded-lg text-sm font-medium transition-all ${
                                            isSelected ? 'bg-blue-600 text-white' :
                                            available ? 'hover:bg-blue-50 text-slate-700 cursor-pointer' :
                                            'text-slate-300 cursor-not-allowed'
                                        }`}>
                                        {day.getDate()}
                                    </button>
                                );
                            })}
                        </div>
                        <button onClick={() => setStep('type')} className="mt-4 text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"><ChevronLeft size={14} /> Volver</button>
                    </div>
                )}

                {/* Step: Time Selection */}
                {step === 'time' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                        <h2 className="text-lg font-bold text-slate-800 mb-2">Elegí un horario</h2>
                        <p className="text-sm text-slate-500 mb-4">{selectedDate?.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

                        {loading ? (
                            <div className="flex items-center justify-center py-8"><Loader2 size={24} className="animate-spin text-blue-600" /></div>
                        ) : (
                            <div className="grid grid-cols-4 gap-2">
                                {availableSlots.map(slot => (
                                    <button key={slot.time} disabled={!slot.available}
                                        onClick={() => { setSelectedTime(slot.time); setStep('form'); }}
                                        className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                                            selectedTime === slot.time ? 'bg-blue-600 text-white' :
                                            slot.available ? 'bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-700' :
                                            'bg-slate-100 text-slate-300 cursor-not-allowed line-through'
                                        }`}>
                                        {slot.time}
                                    </button>
                                ))}
                            </div>
                        )}
                        <button onClick={() => setStep('date')} className="mt-4 text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"><ChevronLeft size={14} /> Volver</button>
                    </div>
                )}

                {/* Step: Form */}
                {step === 'form' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">Datos del paciente</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Nombre del paciente *</label>
                                <input value={formData.patientName} onChange={e => setFormData(p => ({ ...p, patientName: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400" placeholder="Nombre y apellido" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Edad</label>
                                    <input value={formData.patientAge} onChange={e => setFormData(p => ({ ...p, patientAge: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400" placeholder="Ej: 5 años" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Teléfono *</label>
                                    <input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400" placeholder="+54 9 11..." />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Email</label>
                                <input value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400" placeholder="email@ejemplo.com" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Nombre del responsable</label>
                                <input value={formData.parentName} onChange={e => setFormData(p => ({ ...p, parentName: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400" placeholder="Nombre del padre/madre" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Motivo de la consulta</label>
                                <textarea value={formData.reason} onChange={e => setFormData(p => ({ ...p, reason: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 h-20 resize-none" placeholder="Breve descripción del motivo..." />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setStep('time')} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Volver</button>
                            <button onClick={handleBook} disabled={loading || !formData.patientName || !formData.phone}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50">
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                Reservar Turno
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PublicBookingPortal;
