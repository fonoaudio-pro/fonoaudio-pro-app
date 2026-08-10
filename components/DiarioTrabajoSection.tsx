import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock, Users, ClipboardList, FileText, AlertTriangle, Brain,
  Send, Activity, Loader2, Filter, ChevronDown, User, RefreshCw
} from 'lucide-react';

interface DiarioTrabajoSectionProps {
  userId?: string;
  patients: any[];
  onSelectPatient?: (patient: any) => void;
}

interface JournalEvent {
  event_type: string;
  category: string;
  description: string;
  patient_id: string;
  patient_name: string;
  detail: string;
  created_at: string;
}

interface JournalStats {
  total: number;
  today: number;
  thisWeek: number;
  byType: Record<string, number>;
}

const EVENT_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  paciente_creado: { icon: <Users size={16} />, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
  sesion: { icon: <ClipboardList size={16} />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  informe: { icon: <FileText size={16} />, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  alerta_gestionada: { icon: <AlertTriangle size={16} />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  decision_nba: { icon: <Brain size={16} />, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
  guia_enviada: { icon: <Send size={16} />, color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-900/30' },
  evolucion: { icon: <Activity size={16} />, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-900/30' },
};

const EVENT_LABELS: Record<string, string> = {
  paciente_creado: 'Paciente',
  sesion: 'Sesion',
  informe: 'Informe',
  alerta_gestionada: 'Alerta',
  decision_nba: 'Decision IA',
  guia_enviada: 'Guia',
  evolucion: 'Evolucion',
};

export default function DiarioTrabajoSection({ userId, patients, onSelectPatient }: DiarioTrabajoSectionProps) {
  const [events, setEvents] = useState<JournalEvent[]>([]);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [days, setDays] = useState('30');
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ days, limit: '100' });
      if (selectedPatient) params.set('patient_id', selectedPatient);
      if (selectedType) params.set('event_type', selectedType);

      const resp = await fetch(`/api/work-journal?${params}`);
      if (!resp.ok) { setEvents([]); setStats(null); return; }
      const text = await resp.text();
      let data: any;
      try { data = JSON.parse(text); } catch { setEvents([]); setStats(null); return; }
      setEvents(data.events || []);
      setStats(data.stats || null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [days, selectedPatient, selectedType]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Group events by day
  const groupedEvents: Record<string, JournalEvent[]> = {};
  for (const event of events) {
    const date = new Date(event.created_at).toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!groupedEvents[date]) groupedEvents[date] = [];
    groupedEvents[date].push(event);
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  const activeFilters = [selectedPatient, selectedType, days !== '30' ? days : null].filter(Boolean);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="text-blue-600 dark:text-blue-400" size={24} />
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Diario de Trabajo</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Actividad clinica unificada</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showFilters || activeFilters.length > 0
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Filter size={16} />
            Filtros {activeFilters.length > 0 && `(${activeFilters.length})`}
          </button>
          <button
            onClick={loadEvents}
            disabled={isLoading}
            className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex flex-wrap gap-4">
            {/* Days filter */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Periodo</label>
              <select
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="7">Ultimos 7 dias</option>
                <option value="30">Ultimos 30 dias</option>
                <option value="90">Ultimos 90 dias</option>
                <option value="all">Todo</option>
              </select>
            </div>

            {/* Patient filter */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Paciente</label>
              <select
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="">Todos</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Event type filter */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Tipo de evento</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="">Todos</option>
                {Object.entries(EVENT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Clear filters */}
            {activeFilters.length > 0 && (
              <div className="flex items-end">
                <button
                  onClick={() => { setSelectedPatient(''); setSelectedType(''); setDays('30'); }}
                  className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats Bar */}
      {stats && (
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex gap-6 text-sm">
          <div>
            <span className="text-slate-500 dark:text-slate-400">Total: </span>
            <span className="font-bold text-slate-900 dark:text-white">{stats.total}</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">Hoy: </span>
            <span className="font-bold text-blue-600 dark:text-blue-400">{stats.today}</span>
          </div>
          <div className="hidden sm:block">
            <span className="text-slate-500 dark:text-slate-400">Esta semana: </span>
            <span className="font-bold text-slate-900 dark:text-white">{stats.thisWeek}</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="p-4 text-red-600 dark:text-red-400 text-sm">{error}</div>
        )}

        {isLoading && events.length === 0 && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-blue-500" size={24} />
          </div>
        )}

        {!isLoading && events.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 dark:text-slate-400">
            <Clock size={48} className="mb-4 opacity-50" />
            <p className="font-medium">Sin actividad registrada</p>
            <p className="text-sm mt-1">Los eventos clinicos apareceran aqui</p>
          </div>
        )}

        {/* Timeline */}
        {Object.entries(groupedEvents).map(([day, dayEvents]) => (
          <div key={day}>
            {/* Day Header */}
            <div className="sticky top-0 z-10 px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{day}</span>
            </div>

            {/* Events for this day */}
            {dayEvents.map((event, idx) => {
              const config = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.sesion;
              return (
                <div
                  key={`${event.event_type}-${idx}`}
                  className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.bg} ${config.color}`}>
                      {config.icon}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                          {formatTime(event.created_at)}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
                          {event.category}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white mt-0.5">
                        {event.description}
                      </p>
                      {event.detail && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {event.detail}
                        </p>
                      )}
                    </div>

                    {/* Patient badge */}
                    {event.patient_name && (
                      <button
                        onClick={() => {
                          const patient = patients.find(p => p.id === event.patient_id);
                          if (patient) onSelectPatient?.(patient);
                        }}
                        className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
                      >
                        <User size={12} />
                        {event.patient_name}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
