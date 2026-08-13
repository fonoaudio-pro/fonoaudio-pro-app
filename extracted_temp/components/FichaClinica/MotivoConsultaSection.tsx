import React from 'react';
import { MessageSquare } from 'lucide-react';
import { VoiceDictationButton } from '../VoiceDictationButton';

interface MotivoConsultaSectionProps {
  chiefComplaint: string;
  onset: string;
  onChange: (complaint: string, onset: string) => void;
}

export const MotivoConsultaSection: React.FC<MotivoConsultaSectionProps> = ({
  chiefComplaint,
  onset,
  onChange,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h4 className="flex items-center gap-2 font-bold text-slate-700 mb-4">
        <MessageSquare size={18} className="text-blue-600" />
        Motivo de Consulta
      </h4>

      <div className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-400 uppercase">
              Motivo principal <span className="text-red-400">*</span>
            </label>
            <VoiceDictationButton
              onTranscript={(text) => onChange(chiefComplaint ? chiefComplaint + ' ' + text : text, onset)}
            />
          </div>
          <textarea
            value={chiefComplaint}
            onChange={e => onChange(e.target.value, onset)}
            placeholder="Describir el motivo principal de la derivación..."
            rows={3}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 resize-none"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-400 uppercase">
              Cronología
            </label>
            <VoiceDictationButton
              onTranscript={(text) => onChange(chiefComplaint, onset ? onset + ' ' + text : text)}
            />
          </div>
          <textarea
            value={onset}
            onChange={e => onChange(chiefComplaint, e.target.value)}
            placeholder="Desde cuándo se observan las dificultades..."
            rows={2}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 resize-none"
          />
        </div>
      </div>
    </div>
  );
};

export default MotivoConsultaSection;
