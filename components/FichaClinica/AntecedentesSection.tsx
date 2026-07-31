import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { PersonalHistory, FamilyHistory, MedicalHistory } from '../../types/clinical';
import { VoiceDictationButton } from '../VoiceDictationButton';

interface AntecedentesSectionProps {
  personal: PersonalHistory;
  family: FamilyHistory;
  medical: MedicalHistory;
  onChange: (key: string, value: any) => void;
}

type Tab = 'personal' | 'familiar' | 'medico';

const TABS: { key: Tab; label: string }[] = [
  { key: 'personal', label: 'Personales' },
  { key: 'familiar', label: 'Familiares' },
  { key: 'medico', label: 'Médicos' },
];

export const AntecedentesSection: React.FC<AntecedentesSectionProps> = ({
  personal,
  family,
  medical,
  onChange,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('personal');

  const renderPersonal = () => (
    <div className="space-y-4">
      <TextAreaField
        label="Historia médica general"
        value={personal.historiaMedica || ''}
        onChange={v => onChange('personal_history', { ...personal, historiaMedica: v })}
        placeholder="Enfermedades, internaciones, cirugías..."
      />
      <TextAreaField
        label="Antecedentes otológicos"
        value={personal.antecedentesOtologicos || ''}
        onChange={v => onChange('personal_history', { ...personal, antecedentesOtologicos: v })}
        placeholder="Otitis, perforaciones, uso de audífonos..."
      />
      <TextAreaField
        label="Desarrollo psicomotor"
        value={personal.desarrolloPsicomotor || ''}
        onChange={v => onChange('personal_history', { ...personal, desarrolloPsicomotor: v })}
        placeholder="Control céflico, sentarse, gatear, caminar..."
      />
      <TextAreaField
        label="Alimentación"
        value={personal.feedingHistory || ''}
        onChange={v => onChange('personal_history', { ...personal, feedingHistory: v })}
        placeholder="Lactancia, transición a sólidos..."
      />
      <TextAreaField
        label="Sueño"
        value={personal.sueno || ''}
        onChange={v => onChange('personal_history', { ...personal, sueno: v })}
        placeholder="Hábitos de sueño, dificultades..."
      />
      <TextAreaField
        label="Cirugías previas"
        value={personal.previousSurgeries || ''}
        onChange={v => onChange('personal_history', { ...personal, previousSurgeries: v })}
        placeholder="Tipo de cirugía, edad al momento..."
      />
      <TextAreaField
        label="Medicación actual"
        value={personal.medications || ''}
        onChange={v => onChange('personal_history', { ...personal, medications: v })}
      />
      <TextAreaField
        label="Alergias"
        value={personal.allergies || ''}
        onChange={v => onChange('personal_history', { ...personal, allergies: v })}
      />
    </div>
  );

  const renderFamiliar = () => (
    <div className="space-y-4">
      <TextAreaField
        label="Antecedentes familiares relevantes"
        value={family.familyDiseases || ''}
        onChange={v => onChange('family_history', { ...family, familyDiseases: v })}
        placeholder="Enfermedades, problemas del habla/lenguaje en la familia..."
      />
      <TextAreaField
        label="Historia del lenguaje en la familia"
        value={family.speechLanguageHistory || ''}
        onChange={v => onChange('family_history', { ...family, speechLanguageHistory: v })}
      />
      <TextAreaField
        label="Dinámica familiar"
        value={family.familyDynamics || ''}
        onChange={v => onChange('family_history', { ...family, familyDynamics: v })}
        placeholder="Relaciones, rutinas, situaciones de estrés..."
      />
    </div>
  );

  const renderMedico = () => (
    <div className="space-y-4">
      <TextAreaField
        label="Antecedentes otológicos (médicos)"
        value={medical.otologicalHistory || ''}
        onChange={v => onChange('medical_history', { ...medical, otologicalHistory: v })}
      />
      <TextAreaField
        label="Antecedentes otorrinolaringológicos"
        value={medical.ENTHistory || ''}
        onChange={v => onChange('medical_history', { ...medical, ENTHistory: v })}
      />
      <TextAreaField
        label="Antecedentes neurológicos"
        value={medical.neurologicalHistory || ''}
        onChange={v => onChange('medical_history', { ...medical, neurologicalHistory: v })}
      />
      <TextAreaField
        label="Antecedentes pediátricos"
        value={medical.pediatricHistory || ''}
        onChange={v => onChange('medical_history', { ...medical, pediatricHistory: v })}
      />
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h4 className="flex items-center gap-2 font-bold text-slate-700 mb-4">
        <BookOpen size={18} className="text-blue-600" />
        Antecedentes
      </h4>

      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'personal' && renderPersonal()}
      {activeTab === 'familiar' && renderFamiliar()}
      {activeTab === 'medico' && renderMedico()}
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

export default AntecedentesSection;
