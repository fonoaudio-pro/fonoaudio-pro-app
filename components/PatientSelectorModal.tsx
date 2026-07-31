import React from "react";
import { X } from "lucide-react";
import { Patient } from "../types";

interface PatientSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (p: Patient) => void;
  patients: Patient[];
}

const PatientSelectorModal = ({ isOpen, onClose, onSelect, patients }: PatientSelectorModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
          <h3 className="font-bold text-slate-800 dark:text-white">Seleccionar Paciente</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500"><X size={20} /></button>
        </div>
        <div className="p-2 max-h-96 overflow-y-auto">
          {patients.map(p => (
            <button key={p.id} onClick={() => onSelect(p)} className="w-full text-left p-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border-b border-slate-50 dark:border-slate-800 last:border-0">
              <p className="font-medium text-slate-800 dark:text-white">{p.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{p.diagnosis || 'Sin diagnóstico'}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PatientSelectorModal;
