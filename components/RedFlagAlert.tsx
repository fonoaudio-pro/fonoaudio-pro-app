import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { RedFlag } from '../types/clinical_observation';

interface RedFlagAlertProps {
  redFlag: RedFlag;
  onDismiss: (id: string) => void;
}

const RedFlagAlert: React.FC<RedFlagAlertProps> = ({ redFlag, onDismiss }) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-red-500 text-white';
      case 'medium': return 'bg-amber-500 text-white';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  return (
    <div className={`relative flex items-start gap-4 p-4 rounded-2xl shadow-lg border-l-4 border-l-red-600 animate-in slide-in-from-right-4 duration-300 ${getSeverityColor(redFlag.severity)} bg-opacity-10 backdrop-blur-sm border-red-200 bg-red-50`}>
      <div className={`p-2 rounded-xl ${getSeverityColor(redFlag.severity)} bg-opacity-100 shadow-sm`}>
        <AlertTriangle size={24} />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-red-800 text-sm uppercase tracking-wider">Alerta Crítica: {redFlag.type}</h4>
          <button 
            onClick={() => onDismiss(redFlag.id)}
            className="text-red-400 hover:text-red-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-red-700 font-bold mt-1">{redFlag.sign}</p>
        <div className="mt-3 p-3 bg-white/50 rounded-xl border border-red-100">
          <p className="text-xs font-bold text-red-800 mb-1">Acción Inmediata Requerida:</p>
          <p className="text-sm text-red-700 italic">{redFlag.immediateActionRequired}</p>
        </div>
      </div>
    </div>
  );
};

export default RedFlagAlert;
