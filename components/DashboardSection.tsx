import React, { useEffect, useState } from 'react';
import { Users, Calendar, Activity, FileText, AlertTriangle, Sparkles, ChevronRight, BookOpen, BookMarked, ChevronDown, ChevronUp } from 'lucide-react';
import { Patient, Material } from '../types';
import { RedFlag } from '../types/clinical_observation';
import { Appointment } from '../types/appointment';
import { useClinicalAlerts } from '../context/ClinicalAlertBus';
import { useSettings } from '../context/SettingsContext';
import { TelegramService } from '../services/TelegramService';
import RedFlagAlert from './RedFlagAlert';
import ClinicalInsightCard from './ClinicalInsightCard';
import CalendarModule from './CalendarModule';
import ResourceReviewTray from './ResourceReviewTray';
import { ErrorBoundary } from './ErrorBoundary';

interface DashboardSectionProps {
  patients: Patient[];
  appointments: Appointment[];
  proactiveSuggestions: any[];
  redFlags: RedFlag[];
  activePatients: number;
  pendingReports: number;
  todayAppointments: number;
  totalSessions: number;
  patientsWithPlan: number;
  recentSessions: number;
  onSelectPatient: (p: Patient) => void;
  onNavigate: (view: string) => void;
  onDismissRedFlag: (id: string) => void;
  fetchMaterials: () => void;
  isGoogleConnected?: boolean;
  onNavigateToSettings?: () => void;
  userId?: string;
}

const DashboardSection: React.FC<DashboardSectionProps> = ({
  patients,
  appointments,
  proactiveSuggestions: propSuggestions,
  redFlags: propRedFlags,
  activePatients,
  pendingReports,
  todayAppointments,
  totalSessions,
  patientsWithPlan,
  recentSessions,
  onSelectPatient,
  onNavigate,
  onDismissRedFlag,
  fetchMaterials,
  isGoogleConnected = false,
  onNavigateToSettings,
  userId,
}) => {
  const { getAlerts, dismissAlert } = useClinicalAlerts();
  const { settings } = useSettings();

  // Configure TelegramService on mount and when settings change
  useEffect(() => {
    const tg = settings.integrations?.telegram;
    if (tg?.botToken && tg.connected) {
      TelegramService.configure(tg.botToken, tg.chatId);
    }
  }, [settings.integrations?.telegram?.botToken, settings.integrations?.telegram?.connected, settings.integrations?.telegram?.chatId]);

  // Bus as primary source, props as fallback
  const busSuggestions = getAlerts({ categories: ['suggestion'] });
  const busRedFlags = getAlerts({ categories: ['red_flag'] });

  const proactiveSuggestions = busSuggestions.length > 0
    ? busSuggestions.map(a => ({ id: a.id, title: a.title, priority: a.severity, reasoning: a.description, suggestedAction: a.suggestedAction, patientId: a.patientId }))
    : propSuggestions;

  const redFlags = busRedFlags.length > 0
    ? busRedFlags.map(a => ({ id: a.id, sign: a.title, severity: a.severity, immediateActionRequired: a.immediateAction || a.description, patientId: a.patientId, patientName: a.patientName, type: 'RED_FLAG' as const }))
    : propRedFlags;

  const handleDismiss = (id: string) => {
    dismissAlert(id);
    onDismissRedFlag(id);
  };
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">Resumen General</h2>
      </div>

      {proactiveSuggestions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
            <Sparkles size={20} /> Foco del Día
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {proactiveSuggestions.map(sug => (
              <div key={sug.id} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-2xl shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-blue-800 dark:text-blue-300 text-sm">{sug.title}</h4>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    sug.priority === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 
                    sug.priority === 'medium' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  }`}>
                    {sug.priority}
                  </span>
                </div>
                <p className="text-xs text-blue-700/80 dark:text-blue-300/70 mb-3 italic leading-relaxed">"{sug.reasoning}"</p>
                <div className="text-xs font-medium text-blue-900 dark:text-blue-200 bg-white/50 dark:bg-black/20 p-2 rounded-lg">
                  {sug.suggestedAction}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {redFlags.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
            <AlertTriangle size={20} /> Alertas Críticas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {redFlags.map(flag => (
              <RedFlagAlert
                key={flag.id}
                redFlag={flag}
                onDismiss={() => handleDismiss(flag.id)}
              />
            ))}
          </div>
        </div>
      )}

      <ClinicalInsightCard mode="dashboard" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4">
          <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg"><Users className="text-blue-600 dark:text-blue-400" /></div>
          <div><p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pacientes</p><p className="text-2xl font-bold dark:text-white">{activePatients}</p></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4">
          <div className="bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-lg"><Calendar className="text-emerald-600 dark:text-emerald-400" /></div>
          <div><p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Citas Hoy</p><p className="text-2xl font-bold dark:text-white">{todayAppointments}</p></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4">
          <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg"><Activity className="text-purple-600 dark:text-purple-400" /></div>
          <div><p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Sesiones Totales</p><p className="text-2xl font-bold dark:text-white">{totalSessions}</p></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4">
          <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-lg"><FileText className="text-amber-600 dark:text-amber-400" /></div>
          <div><p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Informes Pend.</p><p className="text-2xl font-bold dark:text-white">{pendingReports}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Sesiones esta semana</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{recentSessions}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Con plan activo</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{patientsWithPlan}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Sin informes</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{pendingReports}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Alertas activas</p>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">{redFlags.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Users size={18} className="text-blue-600 dark:text-blue-400" /> Pacientes Recientes
            </h3>
            <button onClick={() => onNavigate("patients")} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">Ver todos</button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[320px] overflow-y-auto">
            {patients.filter(p => p.quick_status !== 'active_quick').length > 0 ? patients.filter(p => p.quick_status !== 'active_quick').slice(0, 8).map(p => (
              <button key={p.id} onClick={() => onSelectPatient(p)} className="w-full p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-3 text-left">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-bold shrink-0">{p.name?.charAt(0) || '?'}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{p.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{p.age} años · {p.diagnosis || 'Sin diagnóstico'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{p.history?.length || 0} sesiones</p>
                  {p.reports?.length === 0 && <span className="text-[9px] font-bold text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full">Sin informe</span>}
                </div>
              </button>
            )) : (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">No hay pacientes registrados</div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Activity size={18} className="text-purple-600 dark:text-purple-400" /> Últimas Sesiones
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[320px] overflow-y-auto">
            {(() => {
              const allSessions = patients.filter(p => p.quick_status !== 'active_quick').flatMap(p => 
                (p.history || []).map(s => ({ ...s, patientName: p.name, patientId: p.id }))
              ).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
              return allSessions.length > 0 ? allSessions.map(s => (
                <button key={s.id} onClick={() => { const p = patients.find(pat => pat.id === s.patientId); if (p) { onSelectPatient(p); } }} className="w-full p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-slate-800 dark:text-white">{s.patientName}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{s.date}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 italic">"{s.summary}"</p>
                </button>
              )) : (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">No hay sesiones registradas</div>
              );
            })()}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 overflow-hidden">
          <CalendarModule 
            patients={patients} 
            appointments={appointments}
            isGoogleConnected={isGoogleConnected}
            onNavigate={onNavigate}
            onStartSession={(patientId) => {
              const p = patients.find(pt => pt.id === patientId);
              if (p) {
                onSelectPatient(p);
              }
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              <BookMarked size={20} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">Fuentes Clínicas</h3>
              <p className="text-xs text-slate-400">Base de conocimiento + IA</p>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Administrá tus fuentes clínicas, generá contenido con IA y compartí material.
          </p>
          <button onClick={() => onNavigate("sources")}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-medium text-sm hover:bg-emerald-700 transition-colors">
            Abrir Fuentes Clínicas
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <BookOpen size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">NotebookLM</h3>
              <p className="text-xs text-slate-400">Investigación con IA de Google</p>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Consultá fuentes, generá podcasts, diapositivas, quizzes y descargá materiales.
          </p>
          <button onClick={() => onNavigate("notebooklm")}
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors">
            Abrir NotebookLM
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <span className="text-lg">📱</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">Canal Clínico</h3>
              <p className="text-xs text-slate-400">Telegram con pacientes</p>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Recibí mensajes, audios y fotos de tus pacientes por Telegram.
          </p>
          <button onClick={() => onNavigate("telegram")}
            className="w-full py-2.5 bg-purple-600 text-white rounded-xl font-medium text-sm hover:bg-purple-700 transition-colors">
            Abrir Canal Clínico
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardSection;
