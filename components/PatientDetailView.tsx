import React, { useState, useEffect } from 'react';
import { 
    ArrowLeft, 
    ArrowRight,
    FileText, 
    Sparkles, 
    ClipboardList, 
    History, 
    Target, 
    ChevronRight,
    Info,
    AlertCircle,
    X,
    FilePlus,
    Stethoscope,
    BookOpen,
    Edit3,
    Save,
    Calendar,
    Printer,
    Trash2,
    CheckCircle2
} from 'lucide-react';
import { Patient, Session, HomeGuide } from '../types';
import { AffectedAreaKey } from '../types/clinical';
import { ClinicalRecordService } from '../services/ClinicalRecordService';
import { SessionWizard } from './SessionWizard';
import ClinicalInsightCard from './ClinicalInsightCard';
import FollowUpPanel from './FollowUpPanel';
import HomeGuideHistoryList from './HomeGuideHistoryList';
import DistributionHistory from './DistributionHistory';
import UnifiedEvolutionTimeline from './UnifiedEvolutionTimeline';
import { ReportBuilderPro as ReportBuilder } from './ReportBuilderPro';
import { FichaClinicaPanel } from './FichaClinica/FichaClinicaPanel';
import { AnamnesisPanel } from './Anamnesis/AnamnesisPanel';
import { TreatmentPlanEditor } from './TreatmentPlanEditor';
import { SessionEditModal } from './SessionEditModal';
import ClinicalPlanningModule from './ClinicalPlanningModule';
import { TestScoringPanel } from './TestScoringPanel';
import { TestResultsService } from '../services/TestResultsService';
import AudiologyAnalysisPanel from './AudiologyAnalysisPanel';
import { markdownToHtml } from '../utils/markdownToHtml';
import ClinicalHistoryPanel from './ClinicalHistoryPanel';
import LanguageAnalysisPanel from './LanguageAnalysisPanel';
import VoiceAnalysisPanel from './VoiceAnalysisPanel';
import SwallowingAnalysisPanel from './SwallowingAnalysisPanel';
import CognitionAnalysisPanel from './CognitionAnalysisPanel';
import MotricityAnalysisPanel from './MotricityAnalysisPanel';
import AuditLogView from './AuditLogView';
import { supabase } from '../utils/supabaseClient';

interface PatientDetailViewProps {
    patient: Patient;
    setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
    materials: any[];
    onGenerateHomeGuideDraft: (p: Patient) => Promise<void>;
    onSaveHomeGuide: (updated: HomeGuide) => Promise<void>;
    onStartReport: (type: string) => void;
    onSessionComplete: (session: Session) => void;
    onBack?: () => void;
    onScheduleAppointment?: (patient: Patient) => void;
    onDeletePatient?: (patientId: string) => void;
    onFormalizeQuick?: (patientId: string, completedFields: Partial<Patient>) => void;
    onDiscardQuick?: (patientId: string) => void;
    proactiveSuggestions?: any[];
}

const PatientDetailView: React.FC<PatientDetailViewProps> = ({
    patient,
    setPatients,
    materials,
    onGenerateHomeGuideDraft,
    onSaveHomeGuide,
    onStartReport,
    onSessionComplete,
    onBack,
    onScheduleAppointment,
    onDeletePatient,
    onFormalizeQuick,
    onDiscardQuick,
    proactiveSuggestions = []
}) => {
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [reports, setReports] = useState<any[]>([]);
    const [viewingReport, setViewingReport] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'resumen' | 'ficha' | 'tests' | 'analisis' | 'historia'>('resumen');
    const [showPlanningAI, setShowPlanningAI] = useState(false);
    const [affectedAreas, setAffectedAreas] = useState<AffectedAreaKey[]>([]);
    const [isEditingPlan, setIsEditingPlan] = useState(false);
    const [editingPlanContent, setEditingPlanContent] = useState('');
    const [clinicalRecord, setClinicalRecord] = useState<any>(null);
    const [anamnesisData, setAnamnesisData] = useState<any>(null);
    const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
    const [testHistory, setTestHistory] = useState<any[]>([]);
    const [loadingTests, setLoadingTests] = useState(false);
    const [showFormalizeModal, setShowFormalizeModal] = useState(false);
    const [formalizeFields, setFormalizeFields] = useState({
        document: '', phone: '', email: '', obra_social: '', responsable: '', derivante: ''
    });
    // Session editing & filtering
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [sessionFilter, setSessionFilter] = useState<'all' | 'month' | 'week'>('all');
    const [sessionSearchDate, setSessionSearchDate] = useState('');

    useEffect(() => {
        const fetchReports = async () => {
            const { data, error } = await supabase
                .from('reports')
                .select('*')
                .eq('patient_id', patient.id)
                .order('created_at', { ascending: false });
            
            if (!error && data) {
                setReports(data);
            }
        };
        fetchReports();

        const fetchAffectedAreas = async () => {
            try {
                const record = await ClinicalRecordService.getByPatientId(patient.id);
                if (record) {
                    setClinicalRecord(record);
                    if (record.affected_areas && Array.isArray(record.affected_areas)) {
                        const areas = record.affected_areas
                            .filter(a => a && a.affected)
                            .map(a => a.area as AffectedAreaKey);
                        setAffectedAreas(areas);
                    }
                }
            } catch (err) {
                console.error('Error fetching clinical record:', err);
            }
        };
        fetchAffectedAreas();

        const fetchAnamnesis = async () => {
            try {
                const { data } = await supabase
                    .from('patient_anamnesis')
                    .select('*')
                    .eq('patient_id', patient.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (data) setAnamnesisData(data);
            } catch {
                // anamnesis table may not exist
            }
        };
        fetchAnamnesis();
    }, [patient.id]);

    useEffect(() => {
        const fetchUserId = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) setCurrentUserId(user.id);
            } catch {}
        };
        fetchUserId();
    }, []);

    useEffect(() => {
        if (activeTab === 'tests') {
            const fetchTestHistory = async () => {
                setLoadingTests(true);
                try {
                    const history = await TestResultsService.getByPatientId(patient.id);
                    setTestHistory(history);
                } catch (err) {
                    console.error('Error fetching test history:', err);
                } finally {
                    setLoadingTests(false);
                }
            };
            fetchTestHistory();
        }
    }, [activeTab, patient.id]);

    const handleWizardOpen = (_id: string) => {
        setIsWizardOpen(true);
    };

    const handleCompleteSessionFromWizard = (session: Session) => {
        onSessionComplete(session);
        setIsWizardOpen(false);
    };

    const handleUpdatePatient = (updatedPatient: Patient) => {
        setPatients(prev => prev.map(p => p.id === patient.id ? updatedPatient : p));
    };

    return (
        <div className="p-4 sm:p-8 h-full flex flex-col overflow-y-auto bg-[#f3f4f6] dark:bg-slate-950">
            <button 
                onClick={onBack || (() => window.history.back())} 
                className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-4 hover:text-blue-600 w-fit transition-colors"
            >
                <ArrowLeft size={18} /> Volver a la lista
            </button>

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
                <div className="space-y-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{patient.name}</h1>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-slate-500 dark:text-slate-400 text-sm">
                        <span className="flex items-center gap-1"><Info size={14} /> {patient.diagnosis || 'Sin diagnóstico'}</span>
                        <span className="hidden sm:inline">•</span>
                        <span>{patient.age} años</span>
                        {patient.phone && <><span className="hidden sm:inline">•</span> <span>{patient.phone}</span></>}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button 
                        onClick={() => onScheduleAppointment?.(patient)} 
                        className="bg-emerald-600 text-white px-3 sm:px-4 py-2 min-h-[44px] rounded-lg hover:bg-emerald-700 flex items-center gap-2 shadow-sm transition-all text-sm"
                    >
                        <Calendar size={16} /> <span className="hidden sm:inline">Agendar</span> Cita
                    </button>
                    <button 
                        onClick={() => handleWizardOpen(patient.id)} 
                        className="bg-blue-600 text-white px-3 sm:px-4 py-2 min-h-[44px] rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-all text-sm"
                    >
                        <ClipboardList size={16} /> Nueva Sesión
                    </button>
                    <button onClick={() => setIsReportOpen(true)} className="border border-slate-300 dark:border-slate-600 px-3 sm:px-4 py-2 min-h-[44px] rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-all text-sm">
                        <FilePlus size={16} /> Informe
                    </button>
                    <button 
                        onClick={() => onGenerateHomeGuideDraft(patient)} 
                        className="bg-purple-600 text-white px-3 sm:px-4 py-2 min-h-[44px] rounded-lg hover:bg-purple-700 flex items-center gap-2 shadow-sm transition-all text-sm"
                    >
                        <Sparkles size={16} /> Guía
                    </button>
                     {onDeletePatient && patient.quick_status !== 'active_quick' && (
                     <button 
                         onClick={() => { if (window.confirm(`¿Eliminar al paciente ${patient.name}?`)) onDeletePatient(patient.id); }} 
                         className="border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-3 py-2 min-h-[44px] min-w-[44px] rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center gap-2 transition-all"
                         title="Eliminar paciente"
                     >
                         <Trash2 size={16} />
                     </button>
                 )}
                     {patient.quick_status === 'active_quick' && (
                         <>
                             <button
                                 onClick={() => setShowFormalizeModal(true)}
                                 className="bg-emerald-600 text-white px-3 sm:px-4 py-2 min-h-[44px] rounded-lg hover:bg-emerald-700 flex items-center gap-2 shadow-sm transition-all text-sm"
                             >
                                 <CheckCircle2 size={16} /> Formalizar
                             </button>
                             {onDiscardQuick && (
                                 <button
                                     onClick={() => {
                                         if (window.confirm(`¿Descartar borrador de "${patient.name}"? Se eliminarán el borrador y sus informes.`)) {
                                             onDiscardQuick(patient.id);
                                         }
                                     }}
                                     className="border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-3 py-2 min-h-[44px] min-w-[44px] rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center gap-2 transition-all"
                                     title="Descartar borrador"
                                 >
                                     <Trash2 size={16} />
                                 </button>
                             )}
                         </>
                     )}
                    </div>

                    {proactiveSuggestions && proactiveSuggestions.length > 0 && (
    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/20">
            <Sparkles size={20} />
        </div>
        <div className="flex-1">
            <h4 className="font-bold text-blue-800 dark:text-blue-300 text-sm">Sugerencia Proactiva</h4>
            <p className="text-xs text-blue-700/80 dark:text-blue-300/70 font-medium">{proactiveSuggestions[0]?.reasoning || 'Sugerencia basada en el análisis clínico.'}</p>
            <div className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 rounded-full">{proactiveSuggestions[0]?.title || 'Atención'}</span>
                <span className="text-slate-400 dark:text-slate-500">•</span>
                <span>{proactiveSuggestions[0]?.suggestedAction || 'Verificar plan de tratamiento'}</span>
            </div>
        </div>
    </div>
                    )}
                </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-white dark:bg-slate-900 rounded-xl p-1 mb-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => setActiveTab('resumen')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                        activeTab === 'resumen'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                    <ClipboardList size={14} />
                    Resumen
                </button>
                <button
                    onClick={() => setActiveTab('ficha')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                        activeTab === 'ficha'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                    <Stethoscope size={14} />
                    Ficha
                </button>
                <button
                    onClick={() => setActiveTab('tests')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                        activeTab === 'tests'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                    <Target size={14} />
                    Tests
                </button>
                <button
                    onClick={() => setActiveTab('analisis')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                        activeTab === 'analisis'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                    <Stethoscope size={14} />
                    Análisis
                </button>
                <button
                    onClick={() => setActiveTab('historia')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                        activeTab === 'historia'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                    <FileText size={14} />
                    Historia
                </button>
            </div>


            {/* Tab Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Column */}
                <div className="lg:col-span-2 space-y-6">
                    {activeTab === 'resumen' && (
                        <>
                            {/* Summary Card */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <ClipboardList size={18} className="text-blue-600" />
                                        Resumen Clínico Actual
                                    </h3>
                                    <ClinicalInsightCard mode="compact" />
                                </div>
                                <div className="space-y-4">
                                    <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100/50">
                                        <p className="text-xs font-bold text-blue-600 uppercase mb-1">Última Observación</p>
                                        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                                            {patient.history.length > 0 
                                                ? patient.history[0].observations || "Sin observaciones en la última sesión."
                                                : "No se han registrado sesiones aún."}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Diagnóstico Principal</p>
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{patient.diagnosis || 'Sin diagnóstico'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Estado de Plan</p>
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                {patient.history.length > 0 ? "En curso" : "Pendiente"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Ficha Clínica & Anamnesis Summary - Data Interconnection */}
                            {(clinicalRecord || anamnesisData) && (
                                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                                    <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                        <Stethoscope size={18} className="text-blue-600" />
                                        Datos de Ficha y Anamnesis
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {clinicalRecord && (
                                            <div className="space-y-3">
                                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Ficha Clínica</p>
                                                {clinicalRecord.chief_complaint && (
                                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Motivo de Consulta</p>
                                                        <p className="text-sm text-slate-700 dark:text-slate-200">{clinicalRecord.chief_complaint}</p>
                                                    </div>
                                                )}
                                                {clinicalRecord.primary_diagnosis_name && (
                                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Diagnóstico Fonoaudiológico</p>
                                                        <p className="text-sm text-slate-700 dark:text-slate-200">{clinicalRecord.primary_diagnosis_name}</p>
                                                    </div>
                                                )}
                                                {Array.isArray(clinicalRecord.affected_areas) && clinicalRecord.affected_areas.filter((a: any) => a && a.affected).length > 0 && (
                                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Áreas Afectadas</p>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {clinicalRecord.affected_areas.filter((a: any) => a && a.affected).map((a: any, i: number) => (
                                                                <span key={i} className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">{a.area}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {anamnesisData && (
                                            <div className="space-y-3">
                                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Anamnesis</p>
                                                {anamnesisData.chief_complaint && (
                                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Motivo (Anamnesis)</p>
                                                        <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-3">{anamnesisData.chief_complaint}</p>
                                                    </div>
                                                )}
                                                {anamnesisData.personal_history && (
                                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Antecedentes Personales</p>
                                                        <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-3">{typeof anamnesisData.personal_history === 'string' ? anamnesisData.personal_history : JSON.stringify(anamnesisData.personal_history).slice(0, 200)}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Unified Evolución Temporal */}
                            <UnifiedEvolutionTimeline patientId={patient.id} />

                            {/* Timeline of Sessions */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <History size={18} className="text-blue-600" />
                                        Historial de Sesiones
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value as any)}
                                            className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-200/50 dark:bg-slate-700/50 px-2 py-1 rounded-full border-0 focus:ring-0">
                                            <option value="all">Todas</option>
                                            <option value="week">Última semana</option>
                                            <option value="month">Último mes</option>
                                        </select>
                                        <input type="date" value={sessionSearchDate} onChange={(e) => setSessionSearchDate(e.target.value)}
                                            className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-200/50 dark:bg-slate-700/50 px-2 py-1 rounded-full border-0 focus:ring-0 w-28" />
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-700/50 px-2 py-1 rounded-full">
                                            {patient.history.length} sesiones
                                        </span>
                                    </div>
                                </div>
                                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[400px] overflow-y-auto">
                                    {(() => {
                                        const now = new Date();
                                        const filtered = patient.history.filter(s => {
                                            if (sessionSearchDate) return s.date === sessionSearchDate;
                                            if (sessionFilter === 'week') {
                                                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                                                return new Date(s.date) >= weekAgo;
                                            }
                                            if (sessionFilter === 'month') {
                                                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                                                return new Date(s.date) >= monthAgo;
                                            }
                                            return true;
                                        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                        return filtered.length > 0 ? filtered.map((session) => (
                                            <div key={session.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group cursor-pointer"
                                                onClick={() => setEditingSession(session)}>
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{session.date}</span>
                                                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                                                                {session.status}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 italic">"{session.summary}"</p>
                                                    </div>
                                                    <button className="p-2 opacity-0 group-hover:opacity-100 text-slate-400 dark:text-slate-500 hover:text-blue-600 transition-all">
                                                        <Edit3 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm italic">
                                                No hay sesiones registradas para este filtro.
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Treatment Plan & Next Actions */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                                    <h3 className="font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                                        <Target size={18} className="text-blue-600" />
                                        Plan de Tratamiento
                                    </h3>
                                    <div className="space-y-3 text-sm">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Contenido del Plan</p>
                                            {patient.treatmentPlan.strategies ? (
                                                <div 
                                                    className="mt-2 border border-slate-100 dark:border-slate-800 rounded-lg p-3 bg-slate-50 dark:bg-slate-800 text-sm prose prose-sm dark:prose-invert max-w-none"
                                                    dangerouslySetInnerHTML={{ __html: patient.treatmentPlan.strategies.trim().startsWith('<') ? patient.treatmentPlan.strategies : markdownToHtml(patient.treatmentPlan.strategies) }}
                                                />
                                            ) : (
                                                <p className="text-slate-400 dark:text-slate-500 italic mt-1">Sin plan definido. Hacé clic en editar para comenzar.</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-4 flex gap-2">
                                        <button
                                            onClick={() => {
                                                setEditingPlanContent(patient.treatmentPlan.strategies || '');
                                                setIsEditingPlan(true);
                                            }}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                        >
                                            <Edit3 size={16} /> Editar
                                        </button>
                                        <button
                                            onClick={() => {
                                                const win = window.open('', '_blank');
                                                win?.document.write(`<html><head><title>Plan de Tratamiento - ${patient.name}</title><style>@media print{body{margin:0;}}</style></head><body>${patient.treatmentPlan.strategies || ''}</body></html>`);
                                                win?.document.close();
                                                win?.print();
                                            }}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                        >
                                            <Printer size={16} /> Imprimir
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setShowPlanningAI(!showPlanningAI)}
                                        className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-sm font-bold hover:from-blue-600 hover:to-indigo-600 transition-all shadow-md"
                                    >
                                        <Sparkles size={16} /> {showPlanningAI ? 'Cerrar Planificación IA' : 'Planificación con IA'}
                                    </button>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                                    <h3 className="font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                                        <ArrowRight size={18} className="text-emerald-600" />
                                        Próximas Acciones
                                    </h3>
                                    <div className="space-y-3 text-sm">
                                         <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                                             <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase mb-1">Desde última sesión</p>
                                            <p className="font-medium">
                                                {patient.history.length > 0 ? patient.history[0].nextAction || "Sin acción definida." : "No hay acciones pendientes."}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* AI Clinical Planning Module */}
                            {showPlanningAI && (
                                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                                    <ClinicalPlanningModule
                                        patient={patient}
                                        onAnalysisComplete={(analysis) => {
                                            console.log('Analysis complete:', analysis);
                                        }}
                                        onSaveToPlan={(content) => {
                                            const updatedPlan = { ...patient.treatmentPlan, strategies: content };
                                            const updatedPatient = { ...patient, treatmentPlan: updatedPlan };
                                            handleUpdatePatient(updatedPatient);
                                            supabase.from('patients').update({ treatmentPlan: updatedPlan }).eq('id', patient.id)
                                                .then(({ error }) => { if (error) console.error('Error saving plan:', error); });
                                            setShowPlanningAI(false);
                                        }}
                                    />
                                </div>
                            )}

                            {/* Resources Section */}
                            <div className="space-y-6">
                                <HomeGuideHistoryList 
                                    patientId={patient.id} 
                                    patientName={patient.name}
                                    materials={materials} 
                                    onRefresh={() => {}} 
                                    onSaveGuide={onSaveHomeGuide || (async () => {})}
                                />
                                <DistributionHistory 
                                    patientId={patient.id} 
                                    onRefresh={() => {}} 
                                />
                            </div>
                        </>
                    )}

                    {activeTab === 'ficha' && (
                        <FichaClinicaPanel
                            patientId={patient.id}
                            patientData={patient}
                            onPatientUpdate={handleUpdatePatient}
                            userId={currentUserId}
                        />
                    )}

                    {activeTab === 'tests' && (
                        <div className="space-y-4">
                            <TestScoringPanel
                                patient={patient}
                                onApplyResults={async (results, summary) => {
                                    const newEvaluation = {
                                        id: `eval_${Date.now()}`,
                                        date: new Date().toISOString().split('T')[0],
                                        testName: results[0]?.testName || 'Test',
                                        score: results.reduce((sum, r) => sum + r.rawScore, 0),
                                        maxScore: results.reduce((sum, r) => sum + r.maxScore, 0),
                                        details: { results, summary }
                                    };
                                    setPatients(prev => prev.map(p =>
                                        p.id === patient.id
                                            ? { ...p, evaluations: [...p.evaluations, newEvaluation] }
                                            : p
                                    ));
                                    try {
                                        const updatedEvaluations = [...(patient.evaluations || []), newEvaluation];
                                        await supabase.from('patients').update({ evaluations: updatedEvaluations }).eq('id', patient.id);
                                    } catch (err) {
                                        console.error('Error persisting evaluation:', err);
                                    }
                                    try {
                                        const testDate = new Date().toISOString().split('T')[0];
                                        const firstResult = results[0] || {};
                                        await TestResultsService.insert({
                                            patient_id: patient.id,
                                            test_id: firstResult.testId || 'unknown',
                                            test_name: firstResult.testName || 'Test',
                                            test_acronym: firstResult.testAcronym || '',
                                            area: firstResult.area || '',
                                            subtest_scores: results,
                                            raw_score: firstResult.rawScore,
                                            max_score: firstResult.maxScore,
                                            percentage: firstResult.percentage,
                                            percentile: firstResult.percentile,
                                            classification: firstResult.classification,
                                            age_at_test: patient.age,
                                            test_date: testDate,
                                        });
                                        // Refresh history
                                        const history = await TestResultsService.getByPatientId(patient.id);
                                        setTestHistory(history);
                                    } catch (err) {
                                        console.error('Error persisting to test_results:', err);
                                    }
                                }}
                            />

                            {/* Test History */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                                <h4 className="font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                                    <History size={16} className="text-indigo-600" />
                                    Historial de Tests Aplicados
                                </h4>
                                {loadingTests ? (
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Cargando historial...</p>
                                ) : testHistory.length === 0 ? (
                                    <p className="text-sm text-slate-400 dark:text-slate-500">No hay tests registrados para este paciente.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                                    <th className="pb-2 font-medium">Fecha</th>
                                                    <th className="pb-2 font-medium">Test</th>
                                                    <th className="pb-2 font-medium">Puntaje</th>
                                                    <th className="pb-2 font-medium">Percentil</th>
                                                    <th className="pb-2 font-medium">Clasificación</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {testHistory.map((t) => (
                                                    <tr key={t.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
                                                        <td className="py-2 text-slate-600 dark:text-slate-300">{t.test_date}</td>
                                                        <td className="py-2 font-medium text-slate-800 dark:text-white">{t.test_name}</td>
                                                        <td className="py-2 text-slate-600 dark:text-slate-300">
                                                            {t.raw_score != null && t.max_score != null
                                                                ? `${t.raw_score}/${t.max_score}`
                                                                : '-'}
                                                        </td>
                                                        <td className="py-2">
                                                             <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                                                (t.percentile || 0) >= 84 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                                                                (t.percentile || 0) >= 50 ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                                                (t.percentile || 0) >= 16 ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                                                                'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                            }`}>
                                                                {t.percentile != null ? `P${t.percentile}` : '-'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 text-slate-600 dark:text-slate-300">{t.classification || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'analisis' && (
                        <div className="space-y-4">
                            <AudiologyAnalysisPanel patientId={patient.id} />
                            <LanguageAnalysisPanel patientId={patient.id} />
                            <VoiceAnalysisPanel patientId={patient.id} />
                            <SwallowingAnalysisPanel patientId={patient.id} />
                            <CognitionAnalysisPanel patientId={patient.id} />
                            <MotricityAnalysisPanel patientId={patient.id} />
                        </div>
                    )}

                    {activeTab === 'historia' && (
                        <ClinicalHistoryPanel
                            patientId={patient.id}
                            consultorioId={patient.consultorio || 'consultorio_1'}
                            currentUserId={currentUserId}
                            patient={patient}
                            onSaved={() => {
                                // Trigger a soft refresh of patient data
                                setPatients?.(prev => Array.isArray(prev) ? [...prev] : prev);
                            }}
                        />
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <FollowUpPanel patientId={patient.id} />

                    {/* NBA Audit Log */}
                    <AuditLogView patientId={patient.id} />
                    
                    {/* Reports Quick Access */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                            <FileText size={18} className="text-blue-600" />
                            Informes y Evaluaciones
                        </h3>
                        <div className="space-y-2">
                            {reports && reports.length > 0 ? (
                                reports.map(r => (
                                         <div key={r.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between group cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" onClick={() => setViewingReport(r)}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center text-blue-600 shadow-sm">
                                                <FileText size={16} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-800 dark:text-white">{r.title}</p>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400">{new Date(r.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-blue-500" />
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-4">No hay informes registrados.</p>
                            )}
                        </div>
                    </div>

                    {/* Patient Demographics */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-3">Información de Contacto</h3>
                        <div className="space-y-3 text-sm">
                             <div className="flex justify-between">
                                 <span className="text-slate-500 dark:text-slate-400">Teléfono</span>
                                 <span className="font-medium text-slate-700 dark:text-slate-200">{patient.phone || "N/A"}</span>
                             </div>
                             <div className="flex justify-between">
                                 <span className="text-slate-500 dark:text-slate-400">Email</span>
                                 <span className="font-medium text-slate-700 dark:text-slate-200">{patient.email || "N/A"}</span>
                             </div>
                             <div className="flex justify-between">
                                 <span className="text-slate-500 dark:text-slate-400">DNI/Documento</span>
                                 <span className="font-medium text-slate-700 dark:text-slate-200">{patient.document || "N/A"}</span>
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            {isWizardOpen && (
                <SessionWizard 
                    patientId={patient.id} 
                    onComplete={handleCompleteSessionFromWizard}
                    onCancel={() => setIsWizardOpen(false)}
                />
            )}

            {isReportOpen && (
                <ReportBuilder 
                    patient={patient}
                    onClose={() => setIsReportOpen(false)}
                    onSave={async (report) => {
                        const updatedReports = [...(patient.reports || []), report];
                        handleUpdatePatient({ ...patient, reports: updatedReports });
                        setIsReportOpen(false);
                    }}
                />
            )}

            {isEditingPlan && (
                <TreatmentPlanEditor
                    content={editingPlanContent}
                    onSave={(html) => {
                        setEditingPlanContent(html);
                        const updatedPlan = { ...patient.treatmentPlan, strategies: html };
                        const updatedPatient = { ...patient, treatmentPlan: updatedPlan };
                        handleUpdatePatient(updatedPatient);
                        supabase.from('patients').update({ treatmentPlan: updatedPlan }).eq('id', patient.id)
                            .then(({ error }) => { if (error) console.error('Error saving plan:', error); });
                        setIsEditingPlan(false);
                    }}
                    onCancel={() => setIsEditingPlan(false)}
                    patientName={patient.name}
                />
            )}

            {/* Session Edit Modal */}
            {editingSession && (
                <SessionEditModal
                    session={editingSession}
                    patientId={patient.id}
                    onSave={(updatedSession) => {
                        const newHistory = patient.history.map(s => s.id === updatedSession.id ? updatedSession : s);
                        handleUpdatePatient({ ...patient, history: newHistory });
                        supabase.from('patients').update({ history: newHistory }).eq('id', patient.id)
                            .then(({ error }) => { if (error) console.error('Error saving session:', error); });
                        setEditingSession(null);
                    }}
                    onClose={() => setEditingSession(null)}
                />
            )}

            {/* Formalize Quick Patient Modal */}
            {showFormalizeModal && onFormalizeQuick && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <CheckCircle2 size={20} className="text-emerald-600" />
                                Formalizar Caso
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Completa los datos para convertir este borrador en paciente clínico.
                            </p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Nombre</label>
                                <input
                                    type="text"
                                    value={patient.name}
                                    disabled
                                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Documento *</label>
                                    <input
                                        type="text"
                                        value={formalizeFields.document}
                                        onChange={(e) => setFormalizeFields(prev => ({ ...prev, document: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        placeholder="DNI/Pasaporte"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Teléfono</label>
                                    <input
                                        type="text"
                                        value={formalizeFields.phone}
                                        onChange={(e) => setFormalizeFields(prev => ({ ...prev, phone: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Email</label>
                                <input
                                    type="email"
                                    value={formalizeFields.email}
                                    onChange={(e) => setFormalizeFields(prev => ({ ...prev, email: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Obra Social</label>
                                <input
                                    type="text"
                                    value={formalizeFields.obra_social}
                                    onChange={(e) => setFormalizeFields(prev => ({ ...prev, obra_social: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Responsable/Tutor</label>
                                    <input
                                        type="text"
                                        value={formalizeFields.responsable}
                                        onChange={(e) => setFormalizeFields(prev => ({ ...prev, responsable: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Derivante</label>
                                    <input
                                        type="text"
                                        value={formalizeFields.derivante}
                                        onChange={(e) => setFormalizeFields(prev => ({ ...prev, derivante: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={() => setShowFormalizeModal(false)}
                                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    onFormalizeQuick(patient.id, formalizeFields);
                                    setShowFormalizeModal(false);
                                }}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                            >
                                Formalizar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Viewer Modal */}
            {viewingReport && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">{viewingReport.title}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(viewingReport.created_at).toLocaleDateString()} — v{viewingReport.version || 1}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setViewingReport(null)} className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-300">Cerrar</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                            <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: viewingReport.content || '<p class="text-slate-400 italic">Sin contenido</p>' }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientDetailView;
