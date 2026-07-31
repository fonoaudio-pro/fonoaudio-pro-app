import React, { useState, useMemo } from 'react';
import { Trash2, ChevronRight, Plus, Zap, Search, X, Building2, Filter } from 'lucide-react';
import { Patient, Material } from '../types';
import PatientDetailView from './PatientDetailView';
import { ErrorBoundary } from './ErrorBoundary';
import { ConsultorioConfigService } from '../services/ConsultorioConfigService';

interface PatientsSectionProps {
  patients: Patient[];
  selectedPatient: Patient | null;
  selectedConsultorio: string | null;
  materials: Material[];
  onSelectPatient: (p: Patient | null) => void;
  onSelectConsultorio: (id: string | null) => void;
  onCreatePatient: () => void;
  onDeletePatient: (id: string) => void;
  onFormalizeQuick: (id: string, data: any) => void;
  onDiscardQuick: (id: string) => void;
  onSessionComplete: (patientId: string, session: any) => void;
  onStartReport: (patient: Patient) => void;
  onGenerateHomeGuideDraft: (patient: Patient) => void;
  onSaveHomeGuide: (guide: any) => void;
  onScheduleAppointment: (patient: Patient) => void;
  consultorioConfigVersion: number;
  setShowNewPatientModal: (v: boolean) => void;
  setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
}

const PatientsSection: React.FC<PatientsSectionProps> = ({
  patients,
  selectedPatient,
  selectedConsultorio,
  materials,
  onSelectPatient,
  onSelectConsultorio,
  onCreatePatient,
  onDeletePatient,
  onFormalizeQuick,
  onDiscardQuick,
  onSessionComplete,
  onStartReport,
  onGenerateHomeGuideDraft,
  onSaveHomeGuide,
  onScheduleAppointment,
  consultorioConfigVersion,
  setShowNewPatientModal,
  setPatients,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const consultorios = ConsultorioConfigService.getAll();

  const activePatients = useMemo(() =>
    patients.filter(p => p.quick_status !== 'active_quick'),
    [patients]
  );

  const quickDrafts = useMemo(() =>
    patients.filter(p => p.quick_status === 'active_quick'),
    [patients]
  );

  const filteredPatients = useMemo(() => {
    let list = activePatients;
    if (selectedConsultorio) {
      list = list.filter(p => p.consultorio === selectedConsultorio);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.diagnosis || '').toLowerCase().includes(q) ||
        (p.notes || '').toLowerCase().includes(q) ||
        (p.phone || '').includes(q)
      );
    }
    return list;
  }, [activePatients, selectedConsultorio, searchQuery]);

  const consultorioName = selectedConsultorio
    ? ConsultorioConfigService.getById(selectedConsultorio)?.name || selectedConsultorio
    : null;

  const getConsultorioCount = (cId: string) =>
    activePatients.filter(p => p.consultorio === cId).length;

  // Sub-view: Selected patient detail
  if (selectedPatient) {
    return (
      <ErrorBoundary moduleName="Detalle del Paciente">
        <PatientDetailView
          patient={selectedPatient}
          setPatients={setPatients}
          materials={materials}
          onGenerateHomeGuideDraft={onGenerateHomeGuideDraft}
          onSaveHomeGuide={onSaveHomeGuide}
          onStartReport={onStartReport}
          onSessionComplete={(session) => onSessionComplete(selectedPatient.id, session)}
          onBack={() => onSelectPatient(null)}
          onScheduleAppointment={onScheduleAppointment}
          onDeletePatient={onDeletePatient}
          onFormalizeQuick={onFormalizeQuick}
          onDiscardQuick={onDiscardQuick}
        />
      </ErrorBoundary>
    );
  }

  // Main view: Patient list with search + filters
  return (
    <div className="p-6 h-full flex flex-col max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Pacientes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {filteredPatients.length} paciente{filteredPatients.length !== 1 ? 's' : ''}
            {consultorioName && ` en ${consultorioName}`}
            {searchQuery && ` · buscando "${searchQuery}"`}
          </p>
        </div>
        <button
          onClick={() => setShowNewPatientModal(true)}
          className="bg-blue-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-blue-700 font-medium text-sm shadow-sm transition-colors"
        >
          <Plus size={18} /> Nuevo Paciente
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, diagnóstico, teléfono..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Consultorio filter chips */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => onSelectConsultorio(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            !selectedConsultorio
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Todos ({activePatients.length})
        </button>
        {consultorios.map(c => {
          const count = getConsultorioCount(c.id);
          if (count === 0 && selectedConsultorio !== c.id) return null;
          return (
            <button
              key={c.id}
              onClick={() => onSelectConsultorio(selectedConsultorio === c.id ? null : c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedConsultorio === c.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>{c.icon}</span> {c.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Quick Drafts */}
      {quickDrafts.length > 0 && (
        <div className="mb-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-amber-100/50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2">
              <Zap size={15} className="text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                Borradores Rápidos ({quickDrafts.length})
              </span>
            </div>
            <table className="w-full text-left">
              <tbody className="divide-y divide-amber-200/50 dark:divide-amber-800/50">
                {quickDrafts.map(p => (
                  <tr key={p.id} className="hover:bg-amber-100/30 dark:hover:bg-amber-900/20 cursor-pointer group" onClick={() => onSelectPatient(p)}>
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white text-sm">{p.name}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 text-sm">{p.age} años</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 text-sm">{p.diagnosis || '-'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); onFormalizeQuick(p.id, {}); }}
                          className="px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          Formalizar
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDiscardQuick(p.id); }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Patient table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex-1 overflow-y-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-medium text-sm sticky top-0 z-10">
            <tr>
              <th className="p-4">Nombre</th>
              <th className="p-4">Edad</th>
              <th className="p-4">Diagnóstico</th>
              <th className="p-4">Consultorio</th>
              <th className="p-4">Teléfono</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredPatients.map(p => {
              const c = consultorios.find(c => c.id === p.consultorio);
              return (
                <tr key={p.id} onClick={() => onSelectPatient(p)} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer group transition-colors">
                  <td className="p-4 font-medium text-slate-900 dark:text-white">{p.name}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">{p.age}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">{p.diagnosis || '-'}</td>
                  <td className="p-4">
                    {c ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {c.icon} {c.name}
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 text-xs">-</span>
                    )}
                  </td>
                  <td className="p-4 text-slate-500 dark:text-slate-400 text-sm">{p.phone || '-'}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeletePatient(p.id); }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                      <ChevronRight className="text-slate-300 group-hover:text-blue-500" size={16} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredPatients.length === 0 && (
              <tr>
                <td colSpan={6} className="p-12 text-center">
                  <div className="text-slate-400 dark:text-slate-500">
                    <Search size={32} className="mx-auto mb-3 opacity-50" />
                    <p className="font-medium">
                      {searchQuery
                        ? `No se encontraron pacientes para "${searchQuery}"`
                        : consultorioName
                          ? `No hay pacientes en ${consultorioName}`
                          : 'No hay pacientes cargados'
                      }
                    </p>
                    <p className="text-sm mt-1">
                      {searchQuery ? 'Probá con otro término' : 'Creá un paciente nuevo con el botón "Nuevo Paciente"'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PatientsSection;
