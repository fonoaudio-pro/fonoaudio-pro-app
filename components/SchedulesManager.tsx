import React, { useState, useEffect } from 'react';
import { Clock, Save, Check, X, AlertCircle } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useToast } from '../context/ToastContext';

interface ScheduleDay {
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_working: boolean;
}

export const SchedulesManager: React.FC = () => {
    const { addToast } = useToast();
    const [schedules, setSchedules] = useState<ScheduleDay[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const DAYS = [
        'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
    ];

    useEffect(() => {
        loadSchedules();
    }, []);

    const loadSchedules = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            const { data, error } = await supabase
                .from('user_schedules')
                .select('*')
                .eq('user_id', session.user.id)
                .order('day_of_week', { ascending: true });

            if (error) throw error;

            // Fill missing days
            const fullSchedules: ScheduleDay[] = [];
            for (let i = 0; i < 7; i++) {
                const existing = data?.find(d => d.day_of_week === i);
                fullSchedules.push(existing || {
                    day_of_week: i,
                    start_time: '09:00',
                    end_time: '18:00',
                    is_working: i !== 0 && i !== 6
                });
            }
            setSchedules(fullSchedules);
        } catch (err: any) {
            addToast({ message: 'Error cargando horarios: ' + err.message, type: 'error' });
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) throw new Error('No hay sesión activa');

            const upserts = schedules.map(s => ({
                user_id: session.user.id,
                day_of_week: s.day_of_week,
                start_time: s.start_time,
                end_time: s.end_time,
                is_working: s.is_working
            }));

            const { error } = await supabase.from('user_schedules').upsert(upserts);
            if (error) throw error;

            addToast({ message: 'Horarios actualizados correctamente', type: 'success' });
        } catch (err: any) {
            addToast({ message: 'Error al guardar: ' + err.message, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const updateDay = (index: number, field: keyof ScheduleDay, value: any) => {
        setSchedules(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Configuración de Disponibilidad</h2>
                    <p className="text-sm text-slate-500">Define tus horarios de atención para la gestión de turnos.</p>
                </div>
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg"
                >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Guardar Horarios
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {schedules.map((day, idx) => (
                    <div key={idx} className={`p-4 rounded-2xl border transition-all flex items-center gap-6 ${day.is_working ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800' : 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-900 opacity-60'}`}>
                        <div className="w-32 shrink-0">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{DAYS[idx]}</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <input 
                                type="checkbox" 
                                checked={day.is_working} 
                                onChange={e => updateDay(idx, 'is_working', e.target.checked)}
                                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Habilita Día</span>
                        </div>

                        {day.is_working && (
                            <div className="flex items-center gap-4 flex-1 justify-end">
                                <div className="flex items-center gap-2">
                                    <Clock size={14} className="text-slate-400" />
                                    <input 
                                        type="time" 
                                        value={day.start_time} 
                                        onChange={e => updateDay(idx, 'start_time', e.target.value)}
                                        className="p-2 bg-slate-100 dark:bg-slate-800 border-transparent rounded-lg text-xs outline-none"
                                    />
                                    <span className="text-slate-400">a</span>
                                    <input 
                                        type="time" 
                                        value={day.end_time} 
                                        onChange={e => updateDay(idx, 'end_time', e.target.value)}
                                        className="p-2 bg-slate-100 dark:bg-slate-800 border-transparent rounded-lg text-xs outline-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

import { Loader2 } from 'lucide-react';
