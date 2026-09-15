import React, { useState, useCallback } from 'react';
import { Zap, X, User, FileText, Sparkles, ClipboardList, ArrowRight, Save } from 'lucide-react';
import { Patient } from '../types';
import { useToast } from '../context/ToastContext';
import { ReportBuilderPro as ReportBuilder } from './ReportBuilderPro';
import ClinicalPlanningModule from './ClinicalPlanningModule';

interface QuickModeProps {
    isOpen: boolean;
    onClose: () => void;
    onSavePatient?: (patient: Patient) => void;
}

const TEMP_PATIENT: Patient = {
    id: crypto.randomUUID(),
    name: 'Paciente Rápido',
    age: 0,
    diagnosis: '',
    phone: '',
    email: '',
    notes: 'Modo rápido - sin registrar',
    history: [],
    evaluations: [],
    alerts: [],
    interests: [],
    treatmentPlan: { general: '', specific: [], strategies: '' },
    documents: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    quick_status: 'active_quick',
};

type QuickTool = 'summary' | 'plan' | 'report' | null;

export const QuickModePanel: React.FC<QuickModeProps> = ({ isOpen, onClose, onSavePatient }) => {
    const { addToast } = useToast();
    const [activeTool, setActiveTool] = useState<QuickTool>(null);
    const [patientName, setPatientName] = useState('');
    const [patientAge, setPatientAge] = useState('');
    const [patientDiagnosis, setPatientDiagnosis] = useState('');

    const getTempPatient = useCallback((): Patient => ({
        ...TEMP_PATIENT,
        id: crypto.randomUUID(),
        name: patientName || 'Paciente Rápido',
        age: parseInt(patientAge) || 0,
        diagnosis: patientDiagnosis || '',
        quick_status: 'active_quick',
    }), [patientName, patientAge, patientDiagnosis]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/25">
                            <Zap size={22} />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-900 dark:text-white text-lg">Modo Rápido</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Usá las herramientas sin registrar el paciente</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/60 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 dark:text-slate-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {!activeTool ? (
                        <div className="space-y-6">
                            {/* Quick Patient Info */}
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-3 flex items-center gap-2">
                                    <User size={16} /> Datos Rápidos (opcional)
                                </h3>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Nombre</label>
                                        <input
                                            type="text"
                                            value={patientName}
                                            onChange={(e) => setPatientName(e.target.value)}
                                            placeholder="Nombre del paciente"
                                            className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-amber-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Edad</label>
                                        <input
                                            type="number"
                                            value={patientAge}
                                            onChange={(e) => setPatientAge(e.target.value)}
                                            placeholder="Edad"
                                            className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-amber-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Diagnóstico</label>
                                        <input
                                            type="text"
                                            value={patientDiagnosis}
                                            onChange={(e) => setPatientDiagnosis(e.target.value)}
                                            placeholder="Diagnóstico presuntivo"
                                            className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-amber-400"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Tool Grid */}
                            <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">Elegí una herramienta:</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <button
                                    onClick={() => setActiveTool('summary')}
                                    className="p-6 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all text-left group"
                                >
                                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <Sparkles size={24} />
                                    </div>
                                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">Resumen Clínico IA</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Análisis rápido del perfil con IA</p>
                                </button>

                                <button
                                    onClick={() => setActiveTool('plan')}
                                    className="p-6 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-all text-left group"
                                >
                                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <ClipboardList size={24} />
                                    </div>
                                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">Plan de Tratamiento</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Generar plan con IA</p>
                                </button>

                                <button
                                    onClick={() => setActiveTool('report')}
                                    className="p-6 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/30 dark:hover:bg-purple-900/10 transition-all text-left group"
                                >
                                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <FileText size={24} />
                                    </div>
                                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">Informe</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Generar informe clínico</p>
                                </button>
                            </div>

                            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center italic">
                                Los datos no se guardan en la base hasta que hagas clic en "Guardar Paciente"
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <button
                                onClick={() => setActiveTool(null)}
                                className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            >
                                <ArrowRight size={14} className="rotate-180" /> Volver al menú
                            </button>

                            {activeTool === 'summary' && (
                                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                                    <ClinicalPlanningModule
                                        patient={getTempPatient()}
                                        onAnalysisComplete={() => {}}
                                        onSaveToPlan={() => {
                                            addToast({ message: 'Plan generado. Copiá el contenido para usarlo.', type: 'success' });
                                        }}
                                    />
                                </div>
                            )}

                            {activeTool === 'plan' && (
                                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                                    <ClinicalPlanningModule
                                        patient={getTempPatient()}
                                        onAnalysisComplete={() => {}}
                                        onSaveToPlan={(content) => {
                                            addToast({ message: 'Plan generado. Copiá el contenido para usarlo.', type: 'success' });
                                        }}
                                    />
                                </div>
                            )}

                            {activeTool === 'report' && (
                                <ReportBuilder
                                    patient={getTempPatient()}
                                    onClose={() => setActiveTool(null)}
                                    onSave={async () => {
                                        addToast({ message: 'Informe generado. Exportá como PDF.', type: 'success' });
                                    }}
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {activeTool && (
                    <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Modo rápido — los datos no se persisten</p>
                        {onSavePatient && (
                            <button
                                onClick={() => {
                                    const p = getTempPatient();
                                    onSavePatient(p);
                                    addToast({ message: 'Paciente guardado en la base de datos', type: 'success' });
                                    onClose();
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
                            >
                                <Save size={14} /> Guardar Paciente
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuickModePanel;
