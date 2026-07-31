import React from 'react';
import { FileText, Activity, FileBarChart, Check, ChevronRight, Users } from 'lucide-react';

interface ReportsSectionProps {
  onStartReport: (type: string) => void;
}

const reports = [
  { type: 'evaluacion', icon: FileText, color: 'blue', title: 'Evaluación', desc: 'Valoración fonoaudiológica completa' },
  { type: 'seguimiento', icon: Activity, color: 'purple', title: 'Seguimiento', desc: 'Avances y evolución del período' },
  { type: 'proceso', icon: FileBarChart, color: 'emerald', title: 'Proceso Terapéutico', desc: 'Evolución detallada del tratamiento' },
  { type: 'alta', icon: Check, color: 'amber', title: 'Alta', desc: 'Finalización del tratamiento' },
  { type: 'derivacion', icon: ChevronRight, color: 'rose', title: 'Derivación', desc: 'Referencia a otro profesional' },
  { type: 'interconsulta', icon: Users, color: 'cyan', title: 'Interconsulta', desc: 'Coordinación interdisciplinaria' },
];

const colorMap: Record<string, { bg: string; text: string; hover: string; iconBg: string; iconText: string }> = {
  blue: { bg: 'bg-white dark:bg-slate-800', text: 'text-slate-800 dark:text-white', hover: 'hover:border-blue-500', iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconText: 'text-blue-600 dark:text-blue-400' },
  purple: { bg: 'bg-white dark:bg-slate-800', text: 'text-slate-800 dark:text-white', hover: 'hover:border-purple-500', iconBg: 'bg-purple-100 dark:bg-purple-900/30', iconText: 'text-purple-600 dark:text-purple-400' },
  emerald: { bg: 'bg-white dark:bg-slate-800', text: 'text-slate-800 dark:text-white', hover: 'hover:border-emerald-500', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconText: 'text-emerald-600 dark:text-emerald-400' },
  amber: { bg: 'bg-white dark:bg-slate-800', text: 'text-slate-800 dark:text-white', hover: 'hover:border-amber-500', iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconText: 'text-amber-600 dark:text-amber-400' },
  rose: { bg: 'bg-white dark:bg-slate-800', text: 'text-slate-800 dark:text-white', hover: 'hover:border-rose-500', iconBg: 'bg-rose-100 dark:bg-rose-900/30', iconText: 'text-rose-600 dark:text-rose-400' },
  cyan: { bg: 'bg-white dark:bg-slate-800', text: 'text-slate-800 dark:text-white', hover: 'hover:border-cyan-500', iconBg: 'bg-cyan-100 dark:bg-cyan-900/30', iconText: 'text-cyan-600 dark:text-cyan-400' },
};

const ReportsSection: React.FC<ReportsSectionProps> = ({ onStartReport }) => {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-white">Centro de Informes</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reports.map(({ type, icon: Icon, color, title, desc }) => {
          const c = colorMap[color];
          return (
            <button
              key={type}
              onClick={() => onStartReport(type)}
              className={`${c.bg} p-8 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm ${c.hover} transition-all text-left group`}
            >
              <div className={`w-12 h-12 ${c.iconBg} ${c.iconText} rounded-lg flex items-center justify-center mb-4`}>
                <Icon size={24} />
              </div>
              <h3 className={`font-bold text-lg ${c.text}`}>{title}</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ReportsSection;
