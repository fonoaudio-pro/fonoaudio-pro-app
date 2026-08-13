import React, { useEffect, useState } from 'react';
import { analyticsService, NBAMetrics } from '../src/services/AnalyticsService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertTriangle } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const NBADashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<NBAMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analyticsService.getNBAMetrics()
      .then(setMetrics)
      .catch((err) => {
        console.error('[NBADashboard] Error:', err);
        setError('No se pudieron cargar las métricas NBA. La tabla puede no existir aún.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div className="p-8 text-center text-slate-500">Cargando métricas NBA...</div>;
  
  if (error) return (
    <div className="p-8 text-center">
      <div className="inline-flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-700 dark:text-amber-400 text-sm">
        <AlertTriangle size={16} />
        {error}
      </div>
    </div>
  );

  if (!metrics) return <div className="p-8 text-center text-slate-500">No hay datos NBA disponibles.</div>;

  const moduleData = Object.entries(metrics.distributionByModule).map(([name, value]) => ({ name, value }));
  const categoryData = Object.entries(metrics.distributionByCategory).map(([name, value]) => ({ name, value }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Sugerencias Clínicas (NBA)</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Next Best Action — Qué sugerencias automáticas ofreció la IA y cuáles aceptaste</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Sugerencias</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.totalSuggestions}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tasa de Aceptación</p>
          <p className="text-2xl font-bold text-emerald-600">{metrics.acceptanceRate.toFixed(1)}%</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tasa de Rechazo</p>
          <p className="text-2xl font-bold text-rose-600">{metrics.rejectionRate.toFixed(1)}%</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tasa de Edición</p>
          <p className="text-2xl font-bold text-amber-600">{metrics.editRate.toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Distribución por Módulo</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moduleData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Distribución por Categoría</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NBADashboard;
