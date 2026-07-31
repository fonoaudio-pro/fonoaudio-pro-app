import React, { useState, useEffect, useRef } from 'react';
import { 
    ChevronLeft, 
    ChevronRight, 
    CheckCircle2, 
    ClipboardList, 
    FileText, 
    Target, 
    Save,
    AlertCircle,
    Loader2,
    X,
    Sparkles,
    Info,
    Mic,
    MicOff
} from 'lucide-react';
import { Patient, Session } from '../types';
import { SessionService } from '../services/SessionService';
import { useToast } from '../context/ToastContext';
import { voiceService } from '../utils/voiceService';

interface SessionWizardProps {

    patientId: string;
    onComplete: (session: Session) => void;
    onCancel: () => void;
}

type WizardStep = 'objectives' | 'notes' | 'plan' | 'review';

const STEPS: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
    { id: 'objectives', label: 'Objetivos', icon: <Target size={18} /> },
    { id: 'notes', label: 'Notas', icon: <ClipboardList size={18} /> },
    { id: 'plan', label: 'Plan', icon: <FileText size={18} /> },
    { id: 'review', label: 'Revisión', icon: <CheckCircle2 size={18} /> },
];

export const SessionWizard: React.FC<SessionWizardProps> = ({ patientId, onComplete, onCancel }) => {
    const { addToast } = useToast();
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Voice Dictation State
    const [isListening, setIsListening] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [dictationTarget, setDictationTarget] = useState<'observations' | 'summary' | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const toggleListening = async (target: 'observations' | 'summary') => {
        if (isListening) {
            mediaRecorderRef.current?.stop();
            setIsListening(false);
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunksRef.current = [];
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
            });

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                setIsTranscribing(true);
                try {
                    const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
                    const text = await voiceService.transcribe(audioBlob);
                    
                    setDraft(prev => ({
                        ...prev,
                        [target]: (prev[target] || '') + (prev[target] ? ' ' : '') + text
                    }));
                    addToast({ message: 'Transcripción insertada', type: 'success' });
                } catch (err: any) {
                    addToast({ message: 'Error de dictado: ' + err.message, type: 'error' });
                } finally {
                    setIsTranscribing(false);
                }
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start();
            setIsListening(true);
            setDictationTarget(target);
        } catch (err: any) {
            addToast({ message: 'Error al acceder al micrófono: ' + err.message, type: 'error' });
        }
    };

    const [draft, setDraft] = useState<Partial<Session>>({
        objectives: '',
        observations: '',
        summary: '',
        planUpdates: '',
        nextAction: '',
        associatedMaterialIds: [],
    });

    const currentStep = STEPS[currentStepIndex].id;

    const handleGenerateAI = async () => {
        if (!draft.observations?.trim()) {
            addToast({ message: 'Escribe algunas notas primero para que la IA pueda trabajar.', type: 'error' });
            return;
        }
        
        setIsGenerating(true);
        setError(null);
        try {
            await new Promise(resolve => setTimeout(resolve, 800));

            const obs = draft.observations || '';
            const obj = draft.objectives || '';
            const generatedSummary = `Resumen de sesión clínica:\n\n${obs.split('\n').filter(Boolean).map(l => `• ${l.trim()}`).join('\n')}\n\nObjetivos abordados: ${obj || 'No especificados'}.\n\nSe recomienda continuar con el plan de intervención establecido y reevaluar progreso en la próxima sesión.`;

            setDraft(prev => ({
                ...prev,
                summary: generatedSummary,
                planUpdates: 'Continuar intervención según objetivos. Monitorear evolución semanal.',
                nextAction: 'Próxima sesión: reevaluación de progreso y ajuste de plan.'
            }));
            addToast({ message: 'Resumen generado (modo stub — backend no disponible).', type: 'success' });
        } catch (err: any) {
            addToast({ message: 'Error al generar resumen: ' + err.message, type: 'error' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleNext = () => {
        if (currentStepIndex < STEPS.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
            setError(null);
        }
    };

    const handleBack = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
            setError(null);
        }
    };

    const validateStep = (): boolean => {
        if (currentStep === 'objectives' && !draft.objectives?.trim()) {
            setError('Por favor, define los objetivos de la sesión.');
            return false;
        }
        if (currentStep === 'notes' && (!draft.observations?.trim() || !draft.summary?.trim())) {
            setError('Por favor, completa las observaciones y el resumen.');
            return false;
        }
        if (currentStep === 'plan' && (!draft.planUpdates?.trim() || !draft.nextAction?.trim())) {
            setError('Por favor, completa el plan y la próxima acción.');
            return false;
        }
        return true;
    };

    const handleComplete = async () => {
        setIsSubmitting(true);
        setError(null);
        try {
            const newSession = await SessionService.createSession(patientId, draft);
            await SessionService.completeSession(patientId, newSession.id);
            addToast({ message: 'Sesión completada y plan generado.', type: 'success' });
            onComplete(newSession);
        } catch (err: any) {
            console.error('Error completing session:', err);
            setError(err.message || 'Ocurrió un error al completar la sesión.');
            addToast({ message: 'Error al completar la sesión.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 'objectives':
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Objetivos de la Sesión</label>
                            <p className="text-xs text-slate-500">¿Qué se busca lograr en este encuentro terapéutico?</p>
                            <textarea
                                value={draft.objectives}
                                onChange={(e) => setDraft({ ...draft, objectives: e.target.value })}
                                placeholder="Ej: Trabajar la articulación del fonema /r/ en posición inicial..."
                                className="w-full h-48 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                            />
                        </div>
                    </div>
                );
            case 'notes':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Observaciones Clínicas</label>
                                 <div className="flex items-center gap-2">
                                     <button 
                                         onClick={() => toggleListening('observations')}
                                         disabled={isTranscribing}
                                         className={`p-2 rounded-lg transition-all ${
                                             isListening && dictationTarget === 'observations' 
                                             ? 'bg-red-100 text-red-600 animate-pulse' 
                                             : 'bg-slate-100 text-slate-400 hover:text-indigo-600 dark:bg-slate-800'
                                         }`}
                                     >
                                         {isListening && dictationTarget === 'observations' ? <MicOff size={14} /> : <Mic size={14} />}
                                     </button>
                                     {isTranscribing && dictationTarget === 'observations' && (
                                         <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-bold animate-pulse">
                                             <Loader2 size={10} className="animate-spin" /> Transcribiendo...
                                         </div>
                                     )}
                                     <button 
                                         onClick={handleGenerateAI}
                                         disabled={isGenerating || isTranscribing}
                                         className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2 py-1 rounded-lg transition-all disabled:opacity-50"
                                     >
                                         {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                         {isGenerating ? 'Generando...' : 'Generar con IA'}
                                     </button>
                                 </div>

                            </div>
                            <p className="text-xs text-slate-500">Notas detalladas sobre el desempeño del paciente.</p>
                            <textarea
                                value={draft.observations}
                                onChange={(e) => setDraft({ ...draft, observations: e.target.value })}
                                placeholder="Escribe aquí las observaciones de la sesión..."
                                className="w-full h-32 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                            />
                                 </div>

                                 <div className="space-y-2">
                                 <div className="flex items-center justify-between">
                                     <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Resumen de la Sesión</label>
                                     <div className="flex items-center gap-2">
                                         <button 
                                             onClick={() => toggleListening('summary')}
                                             disabled={isTranscribing}
                                             className={`p-2 rounded-lg transition-all ${
                                                 isListening && dictationTarget === 'summary' 
                                                 ? 'bg-red-100 text-red-600 animate-pulse' 
                                                 : 'bg-slate-100 text-slate-400 hover:text-indigo-600 dark:bg-slate-800'
                                             }`}
                                         >
                                             {isListening && dictationTarget === 'summary' ? <MicOff size={14} /> : <Mic size={14} />}
                                         </button>
                                         {isTranscribing && dictationTarget === 'summary' && (
                                             <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-bold animate-pulse">
                                                 <Loader2 size={10} className="animate-spin" /> Transcribiendo...
                                             </div>
                                         )}
                                     </div>
                                 </div>
                                 <p className="text-xs text-slate-500">Resumen conciso de lo trabajado en la sesión.</p>
                                 <textarea
                                     value={draft.summary}
                                     onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                                     placeholder="Escribe aquí el resumen de la sesión..."
                                     className="w-full h-32 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                                 />
                                 </div>
                    </div>
                );
            case 'plan':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Actualización del Plan de Tratamiento</label>
                            <p className="text-xs text-slate-500">Ajustes en el plan general tras esta sesión.</p>
                            <textarea
                                value={draft.planUpdates}
                                onChange={(e) => setDraft({ ...draft, planUpdates: e.target.value })}
                                placeholder="Ej: Se decide aumentar la frecuencia de ejercicios en casa..."
                                className="w-full h-32 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Próxima Acción Inmediata</label>
                            <p className="text-xs text-slate-500">¿Qué es lo primero que se hará en la siguiente sesión?</p>
                            <input
                                type="text"
                                value={draft.nextAction}
                                onChange={(e) => setDraft({ ...draft, nextAction: e.target.value })}
                                placeholder="Ej: Realizar evaluación de seguimiento..."
                                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                            />
                        </div>
                    </div>
                );
            case 'review':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-800/30 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <CheckCircle2 size={18} className="text-blue-600 dark:text-blue-400" />
                                <h3 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Revisión Final y Aprobación</h3>
                            </div>
                            <div className="space-y-4 text-sm">
                                <div>
                                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Objetivos</p>
                                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{draft.objectives}</p>
                                </div>
                                <div className="grid grid-cols-1 gap-4 pt-2 border-t border-blue-100 dark:border-blue-800/30">
                                    <div>
                                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Resumen de Sesión</p>
                                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{draft.summary}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Plan de Actualización</p>
                                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{draft.planUpdates}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Próxima Acción</p>
                                        <p className="text-slate-700 dark:text-slate-300 font-medium">{draft.nextAction}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-2xl text-amber-700 dark:text-amber-400">
                            <Info size={18} className="shrink-0 mt-0.5" />
                            <p className="text-xs font-medium leading-relaxed">
                                Al confirmar, la sesión se marcará como completada y se generará automáticamente la <strong>Guía de Hogar</strong> para el paciente basándose en estos datos.
                            </p>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                            <ClipboardList size={22} />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-900 dark:text-white text-base">Nueva Sesión Clínica</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Workflow Guiado</p>
                        </div>
                    </div>
                    <button 
                        onClick={onCancel}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="px-6 py-4 bg-white dark:bg-slate-900">
                    <div className="flex items-center justify-between relative">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 z-0" />
                        <div 
                            className="absolute top-1/2 left-0 h-0.5 bg-blue-500 -translate-y-1/2 transition-all duration-500 z-0" 
                            style={{ width: `${(currentStepIndex / (STEPS.length - 1)) * 100}%` }}
                        />
                        {STEPS.map((step, idx) => (
                            <div 
                                key={step.id}
                                className={`relative z-10 flex flex-col items-center gap-2 transition-colors duration-300 ${
                                    idx <= currentStepIndex ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-slate-900 border-2 transition-all duration-300 ${
                                    idx <= currentStepIndex ? 'border-blue-500 shadow-md shadow-blue-500/20' : 'border-slate-200 dark:border-slate-700'
                                }`}>
                                    {idx < currentStepIndex ? <CheckCircle2 size={18} /> : step.icon}
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-tighter hidden sm:block ${
                                    idx <= currentStepIndex ? 'opacity-100' : 'opacity-0'
                                }`}>
                                    {step.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-xs font-medium animate-in slide-in-from-top-2">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}
                    {renderStepContent()}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                    <button
                        onClick={handleBack}
                        disabled={currentStepIndex === 0 || isSubmitting}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all disabled:opacity-30"
                    >
                        <ChevronLeft size={18} />
                        Atrás
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        
                        {currentStepIndex < STEPS.length - 1 ? (
                            <button
                                onClick={() => {
                                    if (validateStep()) handleNext();
                                }}
                                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-blue-500/20"
                            >
                                Siguiente
                                <ChevronRight size={18} />
                            </button>
                        ) : (
                            <button
                                onClick={handleComplete}
                                disabled={isSubmitting}
                                className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-green-500/20 disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <>
                                        <Save size={18} />
                                        Finalizar y Generar Guía
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
