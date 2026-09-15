import React from 'react';
import { 
  Check, 
  X, 
  Edit3, 
  Info, 
  AlertCircle,
  Sparkles 
} from 'lucide-react';
import { NextBestAction } from '../src/intelligence/types';

interface NBASuggestionCardProps {
  action: NextBestAction;
  onAccept: (action: NextBestAction) => Promise<void>;
  onReject: (action: NextBestAction) => Promise<void>;
  onEdit: (action: NextBestAction) => void;
}

const NBASuggestionCard: React.FC<NBASuggestionCardProps> = ({ 
  action, 
  onAccept, 
  onReject, 
  onEdit 
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-lg border-l-4 border-l-indigo-500 border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-indigo-600">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <Sparkles size={20} />
            </div>
            <span className="text-sm font-bold uppercase tracking-wider">Sugerencia de Inteligencia</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400 text-xs">
            <Info size={14} />
            <span>NBA Engine</span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">{action.title}</h3>
            <p className="text-slate-600 leading-relaxed">{action.description}</p>
          </div>

          {action.rationale && (
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <p className="text-xs text-slate-500 italic flex items-start gap-2">
                <span className="font-semibold not-italic text-slate-400">Justificación:</span>
                {action.rationale}
              </p>
            </div>
          )}

          {action.metadata?.sourceId && (
             <div className="flex items-center gap-2 text-xs text-slate-400">
               <AlertCircle size={12} />
               <span>Fuente: {action.metadata.sourceId}</span>
             </div>
          )}

          <div className="pt-2">
            <p className="text-sm font-semibold text-slate-700 mb-3">Acción sugerida:</p>
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 text-indigo-900 text-sm font-medium">
              {action.action.toUpperCase().replace('_', ' ')}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button 
            onClick={() => onReject(action)}
            className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-xl transition-all flex items-center gap-2"
          >
            <X size={18} /> Rechazar
          </button>
          <button 
            onClick={() => onEdit(action)}
            className="px-4 py-2 text-sm font-medium text-amber-600 hover:bg-amber-50 rounded-xl transition-all flex items-center gap-2"
          >
            <Edit3 size={18} /> Editar
          </button>
          <button 
            onClick={() => onAccept(action)}
            className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-200 transition-all flex items-center gap-2"
          >
            <Check size={18} /> Aceptar
          </button>
        </div>
      </div>
    </div>
  );
};

export default NBASuggestionCard;
