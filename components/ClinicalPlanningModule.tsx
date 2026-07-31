import React, { useState } from 'react';
import { Sparkles, Loader2, Save, AlertTriangle, BrainCircuit, ListChecks, ClipboardList, FileQuestion, Target, Package, LayoutDashboard, Edit3, CheckCircle2 } from 'lucide-react';
import { Patient, ClinicalPlanningAnalysis } from '../types';

interface Props {
    patient: Patient;
    onAnalysisComplete: (analysis: ClinicalPlanningAnalysis) => void;
    onSaveToPlan: (content: string) => void;
    addToast?: (toast: { message: string; type: string }) => void;
}

const ClinicalPlanningModule: React.FC<Props> = ({ patient, onAnalysisComplete, onSaveToPlan, addToast }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [analysis, setAnalysis] = useState<ClinicalPlanningAnalysis | null>(null);
    const [error, setError] = useState<string | null>(null);

    const runAnalysis = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const patientName = patient.name || 'Paciente';
            const mockAnalysis: ClinicalPlanningAnalysis = {
                motivo_de_consulta_resumido: `Evaluación de ${patientName} para planificación de intervención en fonoaudiología.`,
                datos_clinicos_relevantes: 'Datos obtenidos de la historia clínica del paciente. Se recomienda completar con evaluaciones específicas.',
                hipotesis_o_focos_de_trabajo: 'Trabajo en progreso según los ejes clínicos activos del paciente.',
                evaluaciones_o_baterias_sugeridas: ['Evaluación articulatoria', 'Evaluación de fluidez', 'Screening auditivo'],
                que_observar_en_sesion: 'Observar producciones fonológicas, comprensión auditiva y habilidades pragmáticas.',
                objetivos_inmediatos: ['Mejorar intelligibilidad del habla', 'Aumentar vocabulario activo', 'Fomentar comunicación funcional'],
                materiales_necesarios: ['Pictogramas ARASAAC', 'Tableros de comunicación', 'Estímulos visuales'],
                estructura_de_sesion_30_min: 'Apertura (5 min) → Actividad principal (15 min) → Juego funcional (5 min) → Cierre (5 min)',
                riesgos_o_alertas: ['Verificar participación de la familia en las tareas domiciliarias'],
                preguntas_para_profundizar: ['¿Cómo es la comunicación en el hogar?', '¿Qué actividades genera más rechazo?'],
                borrador_de_plan: 'Plan de intervención de 3 meses con reevaluación mensual.'
            };

            setAnalysis(mockAnalysis);
            onAnalysisComplete(mockAnalysis);
            addToast?.({ message: 'Análisis generado (modo stub — backend no disponible).', type: 'success' });
        } catch (err: any) {
            console.error('[ClinicalPlanningModule] Error:', err);
            setError(err.message || 'Error al generar análisis.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = () => {
        if (analysis) {
            const formattedPlan = `
<h1>PLANIFICACIÓN CLÍNICA ASISTIDA POR IA</h1>
<p><em>Generada el: ${new Date().toLocaleDateString()}</em></p>

<h2>Resumen del Motivo de Consulta</h2>
<p>${analysis.motivo_de_consulta_resumido}</p>

<h2>Datos Clínicos Relevantes</h2>
<p>${analysis.datos_clinicos_relevantes}</p>

<h2>Hipótesis y Focos de Trabajo</h2>
<p>${analysis.hipotesis_o_focos_de_trabajo}</p>

<h2>Evaluaciones Sugeridas</h2>
<ul>${analysis.evaluaciones_o_baterias_sugeridas.map(e => `<li>${e}</li>`).join('')}</ul>

<h2>Qué observar en sesión</h2>
<p>${analysis.que_observar_en_sesion}</p>

<h2>Objetivos Inmediatos</h2>
<ul>${analysis.objetivos_inmediatos.map(o => `<li>${o}</li>`).join('')}</ul>

<h2>Materiales Necesarios</h2>
<ul>${analysis.materiales_necesarios.map(m => `<li>${m}</li>`).join('')}</ul>

<h2>Estructura de Sesión (30 min)</h2>
<p>${analysis.estructura_de_sesion_30_min}</p>

<h2>Riesgos o Alertas</h2>
<ul>${analysis.riesgos_o_alertas.map(r => `<li>${r}</li>`).join('')}</ul>

<h2>Preguntas para profundizar</h2>
<ul>${analysis.preguntas_para_profundizar.map(p => `<li>${p}</li>`).join('')}</ul>

<h2>Borrador de Plan de Tratamiento</h2>
<p>${analysis.borrador_de_plan}</p>
            `;
            onSaveToPlan(formattedPlan);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {!analysis && !isLoading && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-8 rounded-3xl border-2 border-dashed border-blue-200 dark:border-blue-800/50 text-center space-y-4">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-2xl flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
                        <BrainCircuit size={32} />
                    </div>
                    <div>
                        <h3 className="text-lg font-extrabold text-slate-800 dark:text-white">Modo Planificación Clínica</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1">
                            Analiza la ficha completa del paciente y documentos para generar un razonamiento clínico asistido.
                        </p>
                    </div>
                    <button 
                        onClick={runAnalysis}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 mx-auto text-sm"
                    >
                        <Sparkles size={18} /> Iniciar Análisis con IA
                        <span className="px-1.5 py-0.5 text-[8px] font-bold text-amber-200 bg-amber-600/30 rounded ml-1">STUB</span>
                    </button>
                </div>
            )}

            {isLoading && (
                <div className="bg-white dark:bg-slate-800/50 p-12 rounded-3xl border border-slate-100 dark:border-slate-800 text-center space-y-4">
                    <div className="relative w-20 h-20 mx-auto">
                        <div className="absolute inset-0 bg-blue-400/20 rounded-full animate-ping"></div>
                        <div className="relative w-full h-full bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                            <Loader2 size={32} className="animate-spin" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Analizando perfil clínico...</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Procesando historial, evaluaciones y documentos adjuntos.</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-rose-50 dark:bg-rose-950/20 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-sm flex items-center gap-3">
                    <AlertTriangle size={18} />
                    {error}
                </div>
            )}

            {analysis && (
                <div className="space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <BrainCircuit className="text-blue-500" /> Resultado del Análisis Clínico
                        </h3>
                        <button 
                            onClick={handleSave}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-md text-xs transition-all"
                        >
                            <Save size={16} /> Guardar en Plan de Tratamiento
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Summary Cards */}
                        <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-100 dark:border-slate-750 space-y-4 shadow-sm">
                            <div className="space-y-1">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <ClipboardList size={12} /> Motivo de Consulta
                                </h4>
                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                    {analysis.motivo_de_consulta_resumido}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <FileQuestion size={12} /> Datos Relevantes
                                </h4>
                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                    {analysis.datos_clinicos_relevantes}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-100 dark:border-slate-750 space-y-4 shadow-sm">
                            <div className="space-y-1">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <Target size={12} /> Hipótesis y Focos
                                </h4>
                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                    {analysis.hipotesis_o_focos_de_trabajo}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <AlertTriangle size={12} /> Riesgos / Alertas
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {analysis.riesgos_o_alertas.length > 0 ? analysis.riesgos_o_alertas.map((r, i) => (
                                        <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30">
                                            {r}
                                        </span>
                                    )) : <span className="text-xs text-slate-400 italic">Sin riesgos detectados</span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detailed List Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-100 dark:border-slate-750 space-y-3">
                            <h4 className="text-xs font-black text-slate-400 uppercase flex items-center gap-1.5">
                                <ListChecks size={14} className="text-blue-500" /> Objetivos Inmediatos
                            </h4>
                            <ul className="space-y-2">
                                {analysis.objetivos_inmediatos.map((obj, i) => (
                                    <li key={i} className="text-xs font-bold text-slate-700 dark:text-slate-300 flex gap-2 items-start">
                                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" /> {obj}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-100 dark:border-slate-750 space-y-3">
                            <h4 className="text-xs font-black text-slate-400 uppercase flex items-center gap-1.5">
                                <Package size={14} className="text-amber-500" /> Materiales
                            </h4>
                            <ul className="space-y-2">
                                {analysis.materiales_necesarios.map((mat, i) => (
                                    <li key={i} className="text-xs font-bold text-slate-700 dark:text-slate-300 flex gap-2 items-start">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" /> {mat}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-100 dark:border-slate-750 space-y-3">
                            <h4 className="text-xs font-black text-slate-400 uppercase flex items-center gap-1.5">
                                <LayoutDashboard size={14} className="text-indigo-500" /> Estructura Sesión
                            </h4>
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                                {analysis.estructura_de_sesion_30_min}
                            </p>
                        </div>
                    </div>

                    {/* Bottom Section */}
                    <div className="bg-slate-900 dark:bg-blue-950/30 p-6 rounded-3xl border border-slate-800 dark:border-blue-900/50 space-y-4">
                        <div className="flex items-center gap-2">
                            <Edit3 size={18} className="text-blue-400" />
                            <h4 className="text-sm font-bold text-white">Preguntas para profundizar en sesión</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                            {analysis.preguntas_para_profundizar.map((q, i) => (
                                <div key={i} className="text-xs text-blue-100/70 dark:text-blue-300/70 flex gap-2 italic">
                                    <span className="text-blue-400">•</span> {q}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-center pt-4">
                        <button 
                            onClick={() => onSaveToPlan(`<h2>Borrador de Plan de Tratamiento</h2><p>${analysis.borrador_de_plan}</p>`)}
                            className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold px-8 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl hover:scale-105 transition-all text-sm flex items-center gap-2"
                        >
                            <CheckCircle2 size={18} className="text-emerald-500" />
                            Usar Borrador para Plan de Tratamiento
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClinicalPlanningModule;
