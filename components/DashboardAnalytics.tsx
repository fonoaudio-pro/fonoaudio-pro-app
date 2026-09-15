import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Users, Calendar, FileText, Brain, Activity, TrendingUp, BarChart3, CheckCircle2, Clock, AlertTriangle, Send } from 'lucide-react';
import { AnalyticsDashboardService, DashboardData } from '../services/AnalyticsDashboardService';

interface DashboardAnalyticsProps {
  consultorioId?: string;
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={18} />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
          {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ label, current, total, color }: { label: string; current: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600 font-medium">{label}</span>
        <span className="text-slate-400">{current}/{total} ({pct}%)</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MiniBarChart({ data, labelKey, valueKey }: { data: Record<string, any>[]; labelKey: string; valueKey: string }) {
  const max = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-24 truncate" title={d[labelKey]}>{d[labelKey]}</span>
          <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
            <div className="h-full bg-blue-500 rounded" style={{ width: `${((Number(d[valueKey]) || 0) / max) * 100}%` }} />
          </div>
          <span className="text-xs font-bold text-slate-700 w-8 text-right">{d[valueKey]}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardAnalytics({ consultorioId }: DashboardAnalyticsProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, [consultorioId]);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const result = await AnalyticsDashboardService.getAll(consultorioId);
      setData(result);
    } catch (e: any) {
      console.error('[DashboardAnalytics] Error:', e);
      setError(e?.message || 'Error al cargar dashboard');
    }
    setLoading(false);
  }

  const pipelineTotal = useMemo(() => {
    if (!data?.historyPipeline) return { draft: 0, reviewed: 0, approved: 0 };
    const grouped: Record<string, number> = {};
    data.historyPipeline.forEach(item => {
      grouped[item.status] = (grouped[item.status] || 0) + item.total;
    });
    return { draft: grouped['draft'] || 0, reviewed: grouped['reviewed'] || 0, approved: grouped['approved'] || 0 };
  }, [data?.historyPipeline]);

  const nbaTotals = useMemo(() => {
    if (!data?.nbaAcceptance) return { total: 0, accepted: 0, rejected: 0, edited: 0, rate: 0 };
    const t = data.nbaAcceptance.reduce((acc, r) => ({
      total: acc.total + r.total_decisions,
      accepted: acc.accepted + r.accepted,
      rejected: acc.rejected + r.rejected,
      edited: acc.edited + r.edited,
    }), { total: 0, accepted: 0, rejected: 0, edited: 0 });
    return { ...t, rate: t.total > 0 ? Math.round((t.accepted / t.total) * 100) : 0 };
  }, [data?.nbaAcceptance]);

  const attendanceTotals = useMemo(() => {
    if (!data?.appointmentAttendance) return { total: 0, attended: 0, cancelled: 0, rate: 0 };
    const t = data.appointmentAttendance.reduce((acc, r) => ({
      total: acc.total + r.total,
      attended: acc.attended + r.attended,
      cancelled: acc.cancelled + r.cancelled,
    }), { total: 0, attended: 0, cancelled: 0 });
    return { ...t, rate: t.total > 0 ? Math.round((t.attended / t.total) * 100) : 0 };
  }, [data?.appointmentAttendance]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3 text-center">
        <AlertTriangle className="text-amber-400" size={48} />
        <p className="text-slate-500 text-sm">{error}</p>
        <button onClick={loadDashboard} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          Reintentar
        </button>
      </div>
    );
  }

  const s = data?.summary;

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 size={22} className="text-blue-600" />
            Dashboard Analytics
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Métricas de uso de la plataforma</p>
        </div>
        <button onClick={loadDashboard} className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
          Actualizar
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Pacientes" value={s?.patients_total ?? 0} sub={`+${s?.patients_this_month ?? 0} este mes`} color="bg-blue-50 text-blue-600" />
        <StatCard icon={Calendar} label="Sesiones" value={s?.sessions_total ?? 0} sub={`+${s?.sessions_this_month ?? 0} este mes`} color="bg-emerald-50 text-emerald-600" />
        <StatCard icon={FileText} label="Citas Hoy" value={s?.appointments_today ?? 0} sub={`${s?.appointments_this_week ?? 0} esta semana`} color="bg-amber-50 text-amber-600" />
        <StatCard icon={CheckCircle2} label="Historias Aprobadas" value={s?.histories_approved ?? 0} sub={`${s?.histories_draft ?? 0} borradores`} color="bg-purple-50 text-purple-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pipeline Historia Clínica */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <FileText size={14} /> Pipeline Historia Clínica
          </h3>
          <ProgressBar label="Borradores" current={pipelineTotal.draft} total={pipelineTotal.draft + pipelineTotal.reviewed + pipelineTotal.approved} color="bg-slate-400" />
          <ProgressBar label="Revisados" current={pipelineTotal.reviewed} total={pipelineTotal.draft + pipelineTotal.reviewed + pipelineTotal.approved} color="bg-amber-400" />
          <ProgressBar label="Aprobados" current={pipelineTotal.approved} total={pipelineTotal.draft + pipelineTotal.reviewed + pipelineTotal.approved} color="bg-emerald-500" />
          <div className="text-center pt-2">
            <span className="text-2xl font-bold text-emerald-600">
              {pipelineTotal.draft + pipelineTotal.reviewed + pipelineTotal.approved > 0
                ? Math.round((pipelineTotal.approved / (pipelineTotal.draft + pipelineTotal.reviewed + pipelineTotal.approved)) * 100)
                : 0}%
            </span>
            <p className="text-[10px] text-slate-400">tasa de completado</p>
          </div>
        </div>

        {/* Aceptación NBA */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Brain size={14} /> Aceptación de Sugerencias IA
          </h3>
          <ProgressBar label="Aceptadas" current={nbaTotals.accepted} total={nbaTotals.total} color="bg-emerald-500" />
          <ProgressBar label="Rechazadas" current={nbaTotals.rejected} total={nbaTotals.total} color="bg-red-400" />
          <ProgressBar label="Editadas" current={nbaTotals.edited} total={nbaTotals.total} color="bg-amber-400" />
          <div className="text-center pt-2">
            <span className="text-2xl font-bold text-blue-600">{nbaTotals.rate}%</span>
            <p className="text-[10px] text-slate-400">tasa de aceptación</p>
          </div>
        </div>

        {/* Asistencia Citas */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Calendar size={14} /> Asistencia de Citas
          </h3>
          <ProgressBar label="Asistidas" current={attendanceTotals.attended} total={attendanceTotals.total} color="bg-emerald-500" />
          <ProgressBar label="Canceladas" current={attendanceTotals.cancelled} total={attendanceTotals.total} color="bg-red-400" />
          <div className="text-center pt-2">
            <span className="text-2xl font-bold text-emerald-600">{attendanceTotals.rate}%</span>
            <p className="text-[10px] text-slate-400">tasa de asistencia</p>
          </div>
        </div>

        {/* Tests por Área */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Activity size={14} /> Tests por Área
          </h3>
          {data?.testsByArea && data.testsByArea.length > 0 ? (
            <MiniBarChart data={data.testsByArea} labelKey="area" valueKey="total" />
          ) : (
            <p className="text-xs text-slate-400 text-center py-4">Sin datos de tests</p>
          )}
        </div>
      </div>

      {/* Guías Hogar + Distribución */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Send size={14} /> Guías Hogar
          </h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            {data?.homeGuideDelivery && data.homeGuideDelivery.length > 0 ? (
              Object.entries(
                data.homeGuideDelivery.reduce((acc, g) => {
                  acc[g.status] = (acc[g.status] || 0) + g.total;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([status, count]) => (
                <div key={status} className="p-2 bg-slate-50 rounded-lg">
                  <p className="text-lg font-bold text-slate-700">{count}</p>
                  <p className="text-[10px] text-slate-400 capitalize">{status}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 col-span-3 py-4">Sin datos</p>
            )}
          </div>
        </div>

        {/* Actividad Reciente */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Clock size={14} /> Actividad Reciente
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data?.recentActivity && data.recentActivity.length > 0 ? (
              data.recentActivity.map((activity, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-slate-400 shrink-0">{new Date(activity.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-slate-600">{activity.description}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">Sin actividad reciente</p>
            )}
          </div>
        </div>
      </div>

      {/* Pacientes por Consultorio */}
      {data?.patientsByConsultorio && data.patientsByConsultorio.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Users size={14} /> Pacientes por Consultorio
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="text-left py-2 font-medium">Consultorio</th>
                  <th className="text-right py-2 font-medium">Total</th>
                  <th className="text-right py-2 font-medium">Activos</th>
                  <th className="text-right py-2 font-medium">Formalizados</th>
                  <th className="text-right py-2 font-medium">Descartados</th>
                  <th className="text-right py-2 font-medium">Nuevos/Mes</th>
                </tr>
              </thead>
              <tbody>
                {data.patientsByConsultorio.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 font-medium text-slate-700">{row.consultorio_id}</td>
                    <td className="py-2 text-right font-bold">{row.total}</td>
                    <td className="py-2 text-right text-blue-600">{row.quick_active}</td>
                    <td className="py-2 text-right text-emerald-600">{row.formalized}</td>
                    <td className="py-2 text-right text-slate-400">{row.discarded}</td>
                    <td className="py-2 text-right text-amber-600">{row.new_this_month}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
