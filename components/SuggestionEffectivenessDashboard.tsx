import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Target,
  Zap,
  Eye
} from 'lucide-react';
import followUpService from '../services/followUpService';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

interface SuggestionEffectivenessDashboardProps {}

const SuggestionEffectivenessDashboard: React.FC<SuggestionEffectivenessDashboardProps> = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const data = await followUpService.getSuggestionMetrics();
      setMetrics(data);
    } catch (err) {
      console.error("Error loading metrics:", err);
      setError("No se pudieron cargar las métricas. Asegúrate de que la tabla 'clinical_suggestion_events' exista.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  if (loading) return <div className="p-8 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  if (error) return <div className="p-8 text-red-500 text-center">{error}</div>;
  if (!metrics || !metrics.rules?.length) return <div className="p-8 text-center text-slate-500">No hay datos de sugerencias suficientes para analizar.</div>;

  const { rules, severity: rawSeverity = [], totals = {} } = metrics;
  const severity = Array.isArray(rawSeverity) ? rawSeverity : [];

  const totalEvents = Object.values(totals).reduce((a: number, b: number) => a + b, 0);
  const pieData = Object.entries(totals).map(([name, value]) => ({ name, value }));

  const ruleChartData = rules.map((r: any) => ({
    name: r.signal.length > 15 ? r.signal.substring(0, 12) + '...' : r.signal,
    ctr: r.ctr * 100,
    fullSignal: r.signal
  })).sort((a: any, b: any) => b.ctr - a.ctr);

  const severityChartData = severity.map((s: any) => ({
    name: s.severity.toUpperCase(),
    rate: s.acceptanceRate * 100
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 bg-slate-50 min-h-screen overflow-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Métricas de IA Clínica</h1>
          <p className="text-slate-500">Monitoreá qué tan útiles son las sugerencias automáticas del sistema para tu práctica clínica</p>
        </div>
        <button onClick={loadMetrics} className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2">
          <Zap size={18} className="text-amber-500" /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Mostradas', value: totals.shown, icon: <Eye size={20}/>, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Aplicadas', value: totals.applied, icon: <CheckCircle2 size={20}/>, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Pospuestas', value: totals.snoozed, icon: <Clock size={20}/>, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Ignoradas', value: totals.ignored, icon: <XCircle size={20}/>, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className={`${kpi.bg} ${kpi.color} p-3 rounded-xl`}>{kpi.icon}</div>
            <div>
              <p className="text-sm font-medium text-slate-500">{kpi.label}</p>
              <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="text-indigo-600" size={20} />
            <h3 className="font-bold text-slate-800">CTR por Regla (Aceptación %)</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ruleChartData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" domain={[0, 100]} unit="%" />
                <YAxis dataKey="name" type="category" width={100} style={{ fontSize: '12px' }} />
                <Tooltip />
                <Bar dataKey="ctr" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <Target className="text-indigo-600" size={20} />
            <h3 className="font-bold text-slate-800">Distribución de Interacciones</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Detalle de Rendimiento por Regla</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Señal / Regla</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4 text-center">Mostradas</th>
                <th className="px-6 py-4 text-center">Aplicadas</th>
                <th className="px-6 py-4 text-center">CTR (%)</th>
                <th className="px-6 py-4 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((rule: any) => (
                <tr key={rule.hash} className="hover:bg-slate-50 transition-colors text-sm">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">{rule.signal}</p>
                    <p className="text-xs text-slate-500">{rule.type}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{rule.type}</td>
                  <td className="px-6 py-4 text-center font-medium">{rule.shown}</td>
                  <td className="px-6 py-4 text-center font-medium text-emerald-600">{rule.applied}</td>
                  <td className="px-6 py-4 text-center font-bold">
                    {rule.shown > 0 ? `${((rule.applied / rule.shown) * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {rule.ctr < 0.1 ? (
                      <span className="px-2 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-bold uppercase">Ruido</span>
                    ) : rule.ctr > 0.5 ? (
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase">Alto Valor</span>
                    ) : (
                      <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase">Neutro</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SuggestionEffectivenessDashboard;
