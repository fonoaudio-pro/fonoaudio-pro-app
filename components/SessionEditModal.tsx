import React, { useState } from 'react';
import { X, Save, Calendar } from 'lucide-react';
import { Session } from '../types';

interface SessionEditModalProps {
    session: Session;
    patientId: string;
    onSave: (session: Session) => void;
    onClose: () => void;
}

export const SessionEditModal: React.FC<SessionEditModalProps> = ({ session, onSave, onClose }) => {
    const [date, setDate] = useState(session.date);
    const [status, setStatus] = useState(session.status);
    const [summary, setSummary] = useState(session.summary || '');
    const [observations, setObservations] = useState(session.observations || '');
    const [objectives, setObjectives] = useState(session.objectives || '');
    const [nextAction, setNextAction] = useState(session.nextAction || '');
    const [planUpdates, setPlanUpdates] = useState(session.planUpdates || '');

    const handleSave = () => {
        onSave({
            ...session,
            date,
            status,
            summary,
            observations,
            objectives,
            nextAction,
            planUpdates,
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Calendar size={20} className="text-blue-600" />
                        Editar Sesión
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Fecha</label>
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Estado</label>
                            <select value={status} onChange={(e) => setStatus(e.target.value as any)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500">
                                <option value="draft">Borrador</option>
                                <option value="completed">Completada</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Resumen de la sesión</label>
                        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Observaciones clínicas</label>
                        <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={3}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Objetivos trabajados</label>
                        <textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} rows={2}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Próxima acción</label>
                        <textarea value={nextAction} onChange={(e) => setNextAction(e.target.value)} rows={2}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Actualización del plan</label>
                        <textarea value={planUpdates} onChange={(e) => setPlanUpdates(e.target.value)} rows={2}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>
                </div>
                <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleSave}
                        className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2">
                        <Save size={16} />
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
};
