import React from 'react';
import { Settings, Users, ArrowRight } from 'lucide-react';
import { Patient } from '../types';
import { ConsultorioConfigService, ConsultorioConfig } from '../services/ConsultorioConfigService';

interface ConsultoriosSectionProps {
  patients: Patient[];
  onSelectConsultorio: (id: string) => void;
  onShowConfig: () => void;
}

const COLOR_MAP: Record<string, { border: string; bg: string; hover: string; text: string; badge: string }> = {
  blue:   { border: 'border-blue-300',   bg: 'bg-blue-50',   hover: 'hover:border-blue-500 hover:bg-blue-100',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700' },
  purple: { border: 'border-purple-300', bg: 'bg-purple-50', hover: 'hover:border-purple-500 hover:bg-purple-100', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
  emerald:{ border: 'border-emerald-300',bg: 'bg-emerald-50',hover: 'hover:border-emerald-500 hover:bg-emerald-100',text: 'text-emerald-700',badge: 'bg-emerald-100 text-emerald-700' },
  cyan:   { border: 'border-cyan-300',   bg: 'bg-cyan-50',   hover: 'hover:border-cyan-500 hover:bg-cyan-100',   text: 'text-cyan-700',   badge: 'bg-cyan-100 text-cyan-700' },
  amber:  { border: 'border-amber-300',  bg: 'bg-amber-50',  hover: 'hover:border-amber-500 hover:bg-amber-100',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700' },
  red:    { border: 'border-red-300',    bg: 'bg-red-50',    hover: 'hover:border-red-500 hover:bg-red-100',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700' },
  rose:   { border: 'border-rose-300',   bg: 'bg-rose-50',   hover: 'hover:border-rose-500 hover:bg-rose-100',   text: 'text-rose-700',   badge: 'bg-rose-100 text-rose-700' },
  orange: { border: 'border-orange-300', bg: 'bg-orange-50', hover: 'hover:border-orange-500 hover:bg-orange-100', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
  teal:   { border: 'border-teal-300',   bg: 'bg-teal-50',   hover: 'hover:border-teal-500 hover:bg-teal-100',   text: 'text-teal-700',   badge: 'bg-teal-100 text-teal-700' },
  indigo: { border: 'border-indigo-300', bg: 'bg-indigo-50', hover: 'hover:border-indigo-500 hover:bg-indigo-100', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700' },
};

const ConsultoriosSection: React.FC<ConsultoriosSectionProps> = ({
  patients,
  onSelectConsultorio,
  onShowConfig,
}) => {
  const consultorios = ConsultorioConfigService.getAll();

  const getPatientCount = (consultorioId: string) =>
    patients.filter(p => p.consultorio === consultorioId && p.quick_status !== 'active_quick').length;

  const totalPatients = patients.filter(p => p.quick_status !== 'active_quick').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Consultorios</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {consultorios.length} consultorio{consultorios.length !== 1 ? 's' : ''} · {totalPatients} paciente{totalPatients !== 1 ? 's' : ''} en total
            </p>
          </div>
          <button
            onClick={onShowConfig}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-medium text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Settings size={16} /> Configurar
          </button>
        </div>

        {/* Consultorios Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {consultorios.map(consultorio => {
            const count = getPatientCount(consultorio.id);
            const colors = COLOR_MAP[consultorio.color] || COLOR_MAP.blue;

            return (
              <button
                key={consultorio.id}
                onClick={() => onSelectConsultorio(consultorio.id)}
                className={`group relative p-6 bg-white dark:bg-slate-900 rounded-2xl border-2 ${colors.border} ${colors.hover} transition-all text-left shadow-sm hover:shadow-md`}
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-4xl">{consultorio.icon}</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${colors.badge}`}>
                    {count} paciente{count !== 1 ? 's' : ''}
                  </span>
                </div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-white group-hover:text-slate-900">
                  {consultorio.name}
                </h3>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Ver pacientes <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Users size={16} />
            <span>
              Distribución: {consultorios.map(c => {
                const cnt = getPatientCount(c.id);
                return cnt > 0 ? `${c.name}: ${cnt}` : null;
              }).filter(Boolean).join(' · ') || 'Sin pacientes asignados'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsultoriosSection;
