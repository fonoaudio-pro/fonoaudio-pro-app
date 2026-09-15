import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle, ChevronRight, RefreshCw, Search, Filter,
  AlertTriangle, Clock, CheckCircle2, ArrowRight, TrendingUp,
  Lightbulb, Shield, Activity, Calendar, FileText, User,
  CheckCircle, Bell, BarChart3, Zap, Target, Eye
} from 'lucide-react';
import followUpService from '../services/followUpService';
import { FollowUpAlert, FollowUpSeverity, FollowUpType } from '../types';

interface FollowUpWorklistProps {
  onPatientSelect: (patientId: string) => void;
}

interface WorklistItem {
  patientId: string;
  patientName: string;
  alerts: FollowUpAlert[];
  clinicalSignals?: FollowUpAlert[];
}

// ═══ HELPER: human-readable type labels ═══
const TYPE_LABELS: Record<FollowUpType, string> = {
  REPEATED_FAILURE: 'Entrega fallida',
  MISSING_DELIVERY: 'Entrega pendiente',
  FOLLOW_UP_NEEDED: 'Seguimiento requerido',
  CLINICAL_TREND: 'Señal clínica',
  PROACTIVE_SUGGESTION: 'Sugerencia IA',
};

const TYPE_LABELS_SHORT: Record<FollowUpType, string> = {
  REPEATED_FAILURE: 'Fallida',
  MISSING_DELIVERY: 'Pendiente',
  FOLLOW_UP_NEEDED: 'Seguimiento',
  CLINICAL_TREND: 'Tendencia',
  PROACTIVE_SUGGESTION: 'Sugerencia',
};

const FollowUpWorklist: React.FC<FollowUpWorklistProps> = ({ onPatientSelect }) => {
  const [items, setItems] = useState<WorklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<FollowUpSeverity | 'all'>('all');
  const [filterType, setFilterType] = useState<FollowUpType | 'all'>('all');
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Source 1: backend API (service role) — reliable, bypasses browser RLS
      let missingData: { patientId: string; patientName: string; alerts: FollowUpAlert[] }[] = [];
      try {
        const resp = await fetch('/api/followup/missing-data');
        if (resp.ok) {
          const json = await resp.json();
          if (json.status === 'ok' && Array.isArray(json.results)) {
            missingData = json.results.map((r: any) => ({
              patientId: r.patientId,
              patientName: r.patientName,
              alerts: r.missing.map((field: string) => ({
                type: 'FOLLOW_UP_NEEDED' as FollowUpType,
                severity: 'medium' as FollowUpSeverity,
                reason: `Ficha incompleta — falta: ${field}`,
                suggestedAction: 'Completar el campo en la Ficha Clínica antes de aprobar la historia.',
                reasonHash: btoa(`FOLLOW_UP_NEEDED|dato_faltante_${field.replace(/ /g, '_')}`).replace(/=/g, ''),
                detectedAt: new Date().toISOString(),
              })),
            }));
          }
        }
      } catch (e) {
        console.error('[FollowUpWorklist] /api/followup/missing-data failed:', e);
      }

      // Source 2: followUpService alerts (entregas fallidas, señales clínicas)
      let alertData: Awaited<ReturnType<typeof followUpService.getPatientsWithAlerts>> = [];
      try {
        alertData = await followUpService.getPatientsWithAlerts();
      } catch (e) {
        console.error('[FollowUpWorklist] getPatientsWithAlerts failed:', e);
      }

      if (missingData.length === 0 && alertData.length === 0) {
        setItems([]);
        return;
      }

      // Merge by patient: combine alerts from both sources, dedupe by reasonHash
      const byPatient: Record<string, WorklistItem> = {};

      const mergeInto = (entry: WorklistItem) => {
        const existing = byPatient[entry.patientId];
        if (existing) {
          const seen = new Set(existing.alerts.map(a => a.reasonHash));
          entry.alerts.forEach(a => { if (!seen.has(a.reasonHash)) { existing.alerts.push(a); seen.add(a.reasonHash); } });
          if (entry.clinicalSignals) {
            const seenC = new Set((existing.clinicalSignals || []).map(a => a.reasonHash));
            entry.clinicalSignals.forEach(a => { if (!seenC.has(a.reasonHash)) existing.clinicalSignals!.push(a); });
          }
        } else {
          byPatient[entry.patientId] = { ...entry, clinicalSignals: entry.clinicalSignals || [] };
        }
      };

      alertData.forEach(mergeInto);
      missingData.forEach(mergeInto);

      setItems(Object.values(byPatient));
    } catch (err: any) {
      console.error('Error loading follow-up worklist:', err);
      setError(`No se pudieron cargar las alertas de seguimiento. Detalle: ${err?.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Filter + sort
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.patientName.toLowerCase().includes(searchTerm.toLowerCase());
      const allAlerts = [...item.alerts, ...(item.clinicalSignals || [])];
      const matchesSeverity = filterSeverity === 'all' || allAlerts.some(a => a.severity === filterSeverity);
      const matchesType = filterType === 'all' || allAlerts.some(a => a.type === filterType);
      return matchesSearch && matchesSeverity && matchesType;
    }).sort((a, b) => {
      const score = (item: WorklistItem) => {
        const all = [...item.alerts, ...(item.clinicalSignals || [])];
        const maxSev = all.reduce((max, al) => {
          const s = al.severity === 'high' ? 3 : al.severity === 'medium' ? 2 : 1;
          return Math.max(max, s);
        }, 0);
        return maxSev * 100 + all.length;
      };
      return score(b) - score(a);
    });
  }, [items, searchTerm, filterSeverity, filterType]);

  // Stats
  const stats = useMemo(() => {
    const allAlerts = items.flatMap(i => [...i.alerts, ...(i.clinicalSignals || [])]);
    return {
      total: allAlerts.length,
      high: allAlerts.filter(a => a.severity === 'high').length,
      medium: allAlerts.filter(a => a.severity === 'medium').length,
      low: allAlerts.filter(a => a.severity === 'low').length,
      patients: items.length,
    };
  }, [items]);

  const getSeverityColor = (severity: FollowUpSeverity) => {
    switch (severity) {
      case 'high': return {
        bg: 'bg-red-50 dark:bg-red-950/40',
        border: 'border-red-200 dark:border-red-800',
        text: 'text-red-700 dark:text-red-300',
        badge: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
        dot: 'bg-red-500',
        icon: 'text-red-500',
      };
      case 'medium': return {
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        border: 'border-amber-200 dark:border-amber-800',
        text: 'text-amber-700 dark:text-amber-300',
        badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
        dot: 'bg-amber-500',
        icon: 'text-amber-500',
      };
      case 'low': return {
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        border: 'border-blue-200 dark:border-blue-800',
        text: 'text-blue-700 dark:text-blue-300',
        badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
        dot: 'bg-blue-500',
        icon: 'text-blue-500',
      };
      default: return {
        bg: 'bg-slate-50 dark:bg-slate-950/40',
        border: 'border-slate-200 dark:border-slate-800',
        text: 'text-slate-700 dark:text-slate-300',
        badge: 'bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300',
        dot: 'bg-slate-500',
        icon: 'text-slate-500',
      };
    }
  };

  const getTypeIcon = (type: FollowUpType) => {
    switch (type) {
      case 'REPEATED_FAILURE': return <AlertTriangle size={14} />;
      case 'MISSING_DELIVERY': return <Clock size={14} />;
      case 'FOLLOW_UP_NEEDED': return <AlertCircle size={14} />;
      case 'CLINICAL_TREND': return <TrendingUp size={14} />;
      case 'PROACTIVE_SUGGESTION': return <Lightbulb size={14} />;
      default: return <AlertCircle size={14} />;
    }
  };

  const handleResolve = async (patientId: string, alertIdx: number, type: 'logistics' | 'clinical', reasonHash?: string) => {
    const key = `${patientId}-${type}-${alertIdx}`;
    setResolvedIds(prev => new Set([...prev, key]));
    if (reasonHash) {
      try {
        await followUpService.recordDecision(patientId, {
          reasonHash,
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[FollowUpWorklist] Error persisting resolve:', err);
      }
    }
  };

  // ═══ ERROR STATE ═══
  if (error) {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 items-center justify-center p-8">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mb-4">
          <AlertTriangle size={28} className="text-red-500 dark:text-red-400" />
        </div>
        <p className="text-red-600 dark:text-red-400 text-sm font-medium mb-4 text-center">{error}</p>
        <button onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium">
          <RefreshCw size={16} /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* ─── HEADER ─── */}
      <div className="p-4 lg:p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Shield size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Seguimiento Clínico</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {stats.patients} pacientes · {stats.total} alertas activas
              </p>
            </div>
          </div>
          <button onClick={loadData} disabled={isLoading}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50">
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex gap-2 flex-wrap">
          <StatChip icon={<AlertTriangle size={12} />} label="Alta" value={stats.high} color="red" />
          <StatChip icon={<AlertCircle size={12} />} label="Media" value={stats.medium} color="amber" />
          <StatChip icon={<CheckCircle size={12} />} label="Baja" value={stats.low} color="blue" />
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
          <StatChip icon={<User size={12} />} label="Pacientes" value={stats.patients} color="slate" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Buscar paciente..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value as any)}
            className="text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="all">Severidad</option>
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}
            className="text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="all">Tipo</option>
            <option value="REPEATED_FAILURE">Entrega fallida</option>
            <option value="MISSING_DELIVERY">Entrega pendiente</option>
            <option value="FOLLOW_UP_NEEDED">Seguimiento</option>
            <option value="CLINICAL_TREND">Señal clínica</option>
            <option value="PROACTIVE_SUGGESTION">Sugerencia IA</option>
          </select>
        </div>
      </div>

      {/* ─── CONTENT ─── */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-3">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
              <RefreshCw size={24} className="animate-spin text-slate-400" />
            </div>
            <p className="text-sm text-slate-400 dark:text-slate-500">Cargando alertas...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          /* ─── DESIGNED EMPTY STATE ─── */
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-3xl flex items-center justify-center mb-5">
              <CheckCircle2 size={40} className="text-emerald-500 dark:text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">
              {items.length === 0 ? 'Sin alertas activas' : 'Sin resultados'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
              {items.length === 0
                ? 'Todos los pacientes están al día. Las alertas aparecerán aquí cuando haya entregas fallidas, seguimientos pendientes o señales clínicas detectadas.'
                : 'No se encontraron alertas con los filtros seleccionados. Probá ajustando la búsqueda.'
              }
            </p>
            {items.length === 0 && (
              <div className="flex gap-2">
                <button onClick={() => onPatientSelect('')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">
                  <User size={14} /> Ver pacientes
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ─── ALERT CARDS ─── */
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const allAlerts = [...item.alerts, ...(item.clinicalSignals || [])];
              const maxSeverity = allAlerts.reduce((max, a) => {
                const s = a.severity === 'high' ? 3 : a.severity === 'medium' ? 2 : 1;
                return Math.max(max, s);
              }, 0);
              const colors = getSeverityColor(maxSeverity === 3 ? 'high' : maxSeverity === 2 ? 'medium' : 'low');

              return (
                <div key={item.patientId}
                  className={`bg-white dark:bg-slate-900 border ${colors.border} rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all`}>
                  {/* Card header */}
                  <div className={`px-4 py-3 ${colors.bg} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                      <div>
                        <h3 className={`font-bold text-sm ${colors.text}`}>{item.patientName}</h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {allAlerts.length} alerta{allAlerts.length !== 1 ? 's' : ''} activa{allAlerts.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => onPatientSelect(item.patientId)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700 transition-all">
                      <Eye size={12} /> Ver paciente <ChevronRight size={12} />
                    </button>
                  </div>

                  {/* Alert items */}
                  <div className="px-4 py-3 space-y-2">
                    {allAlerts.map((alert, idx) => {
                      const alertKey = `${item.patientId}-${idx < item.alerts.length ? 'logistics' : 'clinical'}-${idx}`;
                      const isResolved = resolvedIds.has(alertKey);
                      const aColors = getSeverityColor(alert.severity);

                      if (isResolved) return null;

                      return (
                        <div key={idx} className={`flex items-start gap-3 p-2.5 rounded-xl ${aColors.bg} border ${aColors.border} group`}>
                          <div className={`mt-0.5 ${aColors.icon}`}>
                            {getTypeIcon(alert.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${aColors.badge}`}>
                                {TYPE_LABELS_SHORT[alert.type]}
                              </span>
                              {alert.severity === 'high' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400">
                                  URGENTE
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{alert.reason}</p>
                            {alert.suggestedAction && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 italic">
                                Acción sugerida: {alert.suggestedAction}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => handleResolve(item.patientId, idx, idx < item.alerts.length ? 'logistics' : 'clinical', alert.reasonHash)}
                              className="p-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                              title="Marcar resuelto">
                              <CheckCircle size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Card footer: quick actions */}
                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex gap-1">
                      <QuickAction icon={<Calendar size={10} />} label="Agendar" onClick={() => onPatientSelect(item.patientId)} />
                      <QuickAction icon={<FileText size={10} />} label="Historia" onClick={() => onPatientSelect(item.patientId)} />
                      <QuickAction icon={<Activity size={10} />} label="Evaluar" onClick={() => onPatientSelect(item.patientId)} />
                    </div>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500">
                      {allAlerts.length > 0 && allAlerts[0].detectedAt && (
                        <>Detectado: {new Date(allAlerts[0].detectedAt).toLocaleDateString('es-AR')}</>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══ SUB-COMPONENTS ═══

function StatChip({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number; color: string;
}) {
  const colorMap: Record<string, string> = {
    red: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  };
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold ${colorMap[color]}`}>
      {icon}
      <span>{value}</span>
      <span className="font-normal opacity-70">{label}</span>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void; }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors">
      {icon} {label}
    </button>
  );
}

export default FollowUpWorklist;
