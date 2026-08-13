import React from 'react';
import { Activity } from 'lucide-react';
import { DevelopmentalHistory } from '../../types/clinical';
import { VoiceDictationButton } from '../VoiceDictationButton';

interface DesarrolloSectionProps {
  developmental: DevelopmentalHistory;
  onChange: (value: DevelopmentalHistory) => void;
}

export const DesarrolloSection: React.FC<DesarrolloSectionProps> = ({
  developmental,
  onChange,
}) => {
  const update = (field: keyof DevelopmentalHistory, value: string) => {
    onChange({ ...developmental, [field]: value });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h4 className="flex items-center gap-2 font-bold text-slate-700 mb-4">
        <Activity size={18} className="text-blue-600" />
        Desarrollo e Hitos
      </h4>

      <div className="space-y-4">
        <TextAreaField
          label="Desarrollo psicomotor"
          value={developmental.psychomotorDevelopment || ''}
          onChange={v => update('psychomotorDevelopment', v)}
          placeholder="Hitos motores: control céflico, sedestación, gateo, marcha..."
        />
        <TextAreaField
          label="Desarrollo del lenguaje"
          value={developmental.languageDevelopment || ''}
          onChange={v => update('languageDevelopment', v)}
          placeholder="Primeras palabras, combinaciones, frases..."
        />
        <TextAreaField
          label="Desarrollo de la alimentación"
          value={developmental.feedingDevelopment || ''}
          onChange={v => update('feedingDevelopment', v)}
          placeholder="Lactancia, introducción de sólidos, masticación..."
        />
        <TextAreaField
          label="Desarrollo social"
          value={developmental.socialDevelopment || ''}
          onChange={v => update('socialDevelopment', v)}
          placeholder="Interacción con pares, juego simbólico, autonomía..."
        />
        <TextAreaField
          label="Rendimiento escolar"
          value={developmental.schoolPerformance || ''}
          onChange={v => update('schoolPerformance', v)}
          placeholder="Adaptación, dificultades de aprendizaje..."
        />
      </div>
    </div>
  );
};

const TextAreaField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between">
      <label className="text-[10px] font-bold text-slate-400 uppercase">{label}</label>
      <VoiceDictationButton
        onTranscript={(text) => onChange(value ? value + ' ' + text : text)}
      />
    </div>
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 resize-none"
    />
  </div>
);

export default DesarrolloSection;
