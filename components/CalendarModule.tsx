import React, { useState, useMemo } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, Plus, Video, User } from 'lucide-react';
import { Patient } from '../types';
import { Appointment } from '../types/appointment';

interface CalendarModuleProps {
    patients: Patient[];
    appointments: Appointment[];
    onStartSession: (patientId: string) => void;
    isGoogleConnected?: boolean;
    onNavigate?: (view: string) => void;
}

type CalView = 'month' | 'week' | 'day';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function formatKey(d: Date): string {
    return d.toISOString().split('T')[0];
}

function getWeekStart(d: Date): Date {
    const r = new Date(d);
    const day = r.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    r.setDate(r.getDate() + diff);
    return r;
}

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    confirmed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
    cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
    attended: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    no_show: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    rescheduled: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
};

const CalendarModule: React.FC<CalendarModuleProps> = ({ patients, appointments, onStartSession, isGoogleConnected = false, onNavigate }) => {
    const [view, setView] = useState<CalView>('month');
    const [selectedDate, setSelectedDate] = useState(new Date());

    const todayKey = formatKey(new Date());
    const selectedKey = formatKey(selectedDate);

    const monthGrid = useMemo(() => {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const first = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0).getDate();
        const startDow = (first.getDay() + 6) % 7;
        const cells: (Date | null)[] = [];
        for (let i = 0; i < startDow; i++) cells.push(null);
        for (let d = 1; d <= lastDay; d++) cells.push(new Date(year, month, d));
        return cells;
    }, [selectedDate.getFullYear(), selectedDate.getMonth()]);

    const weekDays = useMemo(() => {
        const start = getWeekStart(selectedDate);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    }, [selectedKey]);

    const appointmentsByDate = useMemo(() => {
        const map: Record<string, Appointment[]> = {};
        for (const a of appointments) {
            if (!map[a.date]) map[a.date] = [];
            map[a.date].push(a);
        }
        return map;
    }, [appointments]);

    const dayAppointments = useMemo(() => {
        return (appointmentsByDate[selectedKey] || []).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    }, [appointmentsByDate, selectedKey]);

    const weekAppointments = useMemo(() => {
        const start = getWeekStart(selectedDate);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        const sk = formatKey(start);
        const ek = formatKey(end);
        return appointments.filter(a => a.date >= sk && a.date < ek).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
    }, [appointments, selectedKey]);

    const todayCount = (appointmentsByDate[todayKey] || []).length;

    const navigateMonth = (dir: number) => {
        const d = new Date(selectedDate);
        d.setMonth(d.getMonth() + dir);
        setSelectedDate(d);
    };

    const navigateWeek = (dir: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + dir * 7);
        setSelectedDate(d);
    };

    const navigateDay = (dir: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + dir);
        setSelectedDate(d);
    };

    const navigate = (dir: number) => {
        if (view === 'month') navigateMonth(dir);
        else if (view === 'week') navigateWeek(dir);
        else navigateDay(dir);
    };

    const getTitle = () => {
        if (view === 'month') return `${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
        if (view === 'week') {
            const start = getWeekStart(selectedDate);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            return `${start.getDate()} ${MONTH_NAMES[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()].slice(0, 3)}`;
        }
        return `${DAY_NAMES_FULL[selectedDate.getDay()]} ${selectedDate.getDate()} ${MONTH_NAMES[selectedDate.getMonth()]}`;
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                    <Calendar size={16} className="text-blue-500" /> Agenda
                    {todayCount > 0 && (
                        <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                            {todayCount} hoy
                        </span>
                    )}
                </h3>
                <div className="flex items-center gap-1">
                    {(['month', 'week', 'day'] as CalView[]).map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`px-3 py-1.5 min-h-[36px] rounded text-[10px] font-bold transition-all ${
                                view === v
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                        >
                            {v === 'month' ? 'Mes' : v === 'week' ? 'Sem' : 'Día'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <button onClick={() => navigate(-1)} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors">
                    <ChevronLeft size={18} />
                </button>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{getTitle()}</span>
                    <button
                        onClick={() => { setSelectedDate(new Date()); setView('day'); }}
                        className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline min-h-[36px] px-2"
                    >
                        Hoy
                    </button>
                </div>
                <button onClick={() => navigate(1)} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors">
                    <ChevronRight size={18} />
                </button>
            </div>

            {view === 'month' && (
                <div className="grid grid-cols-7 gap-0.5">
                    {DAY_NAMES.map(d => (
                        <div key={d} className="text-center text-[9px] font-bold text-slate-400 dark:text-slate-500 py-1">
                            {d}
                        </div>
                    ))}
                    {monthGrid.map((cell, i) => {
                        if (!cell) return <div key={`empty-${i}`} />;
                        const dk = formatKey(cell);
                        const dayAppts = appointmentsByDate[dk] || [];
                        const isToday = dk === todayKey;
                        const isSelected = dk === selectedKey;
                        return (
                            <button
                                key={dk}
                                onClick={() => { setSelectedDate(cell); setView('day'); }}
                                className={`relative p-1.5 min-h-[40px] rounded-lg text-center transition-all ${
                                    isSelected
                                        ? 'bg-blue-600 text-white font-bold'
                                        : isToday
                                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-bold'
                                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                            >
                                <span className="text-[11px]">{cell.getDate()}</span>
                                {dayAppts.length > 0 && (
                                    <div className="flex justify-center gap-0.5 mt-0.5">
                                        {dayAppts.slice(0, 3).map((a, j) => (
                                            <span
                                                key={j}
                                                className={`w-1 h-1 rounded-full ${
                                                    isSelected ? 'bg-white' : a.status === 'confirmed' ? 'bg-green-500' : a.status === 'cancelled' ? 'bg-red-400' : 'bg-yellow-500'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {view === 'week' && (
                <div className="space-y-1">
                    {weekDays.map(d => {
                        const dk = formatKey(d);
                        const dayAppts = (appointmentsByDate[dk] || []).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
                        const isToday = dk === todayKey;
                        const isSelected = dk === selectedKey;
                        return (
                            <div
                                key={dk}
                                onClick={() => { setSelectedDate(d); setView('day'); }}
                                className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                                    isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : isToday ? 'bg-slate-50 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                <div className={`w-10 text-center shrink-0 ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                    <div className="text-[9px] font-bold uppercase">{DAY_NAMES[(d.getDay() + 6) % 7]}</div>
                                    <div className={`text-lg font-black ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>{d.getDate()}</div>
                                </div>
                                <div className="flex-1 min-w-0 space-y-0.5">
                                    {dayAppts.length === 0 ? (
                                        <p className="text-[10px] text-slate-300 dark:text-slate-600 italic py-1">Sin citas</p>
                                    ) : (
                                        dayAppts.slice(0, 4).map(a => (
                                            <div key={a.id} className="flex items-center gap-1.5 text-[10px]">
                                                <span className="text-slate-400 dark:text-slate-500 font-mono w-10 shrink-0">{(a.time || '').slice(0, 5)}</span>
                                                <span className="text-slate-700 dark:text-slate-200 font-medium truncate">{a.patient_name}</span>
                                                <span className={`ml-auto px-1 py-0.5 rounded text-[8px] font-bold border ${STATUS_COLORS[a.status] || STATUS_COLORS.pending}`}>
                                                    {a.status === 'confirmed' ? '✓' : a.status === 'cancelled' ? '✗' : '○'}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                    {dayAppts.length > 4 && (
                                        <p className="text-[9px] text-blue-500 dark:text-blue-400 font-bold">+{dayAppts.length - 4} más</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {view === 'day' && (
                <div className="space-y-2">
                    {dayAppointments.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                            <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                            <p className="text-xs font-bold">Sin citas para este día</p>
                            <p className="text-[10px] mt-1">Creá una cita desde la Agenda</p>
                        </div>
                    ) : (
                        dayAppointments.map(a => (
                            <div
                                key={a.id}
                                className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group"
                                onClick={() => {
                                    const p = patients.find(pt => pt.id === a.patient_id);
                                    if (p) onStartSession(p.id);
                                }}
                            >
                                <div className="w-12 text-center shrink-0">
                                    <Clock size={14} className="mx-auto text-blue-500 mb-0.5" />
                                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">{(a.time || '').slice(0, 5)}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <User size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
                                        <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{a.patient_name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{a.duration || 30} min</span>
                                        {a.type && <span className="text-[10px] text-slate-400 dark:text-slate-500">• {a.type}</span>}
                                        {a.meetLink && <Video size={10} className="text-blue-400" />}
                                    </div>
                                </div>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[a.status] || STATUS_COLORS.pending}`}>
                                    {a.status}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            )}

            {onNavigate && (
                <button
                    onClick={() => onNavigate('agenda')}
                    className="w-full text-center text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline py-1"
                >
                    Abrir Agenda completa →
                </button>
            )}
        </div>
    );
};

export default CalendarModule;
