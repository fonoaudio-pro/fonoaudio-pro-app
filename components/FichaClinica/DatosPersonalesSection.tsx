import React from 'react';
import { User } from 'lucide-react';
import { ConsultorioConfigService } from '../../services/ConsultorioConfigService';

interface DatosPersonalesSectionProps {
  patientData: any;
  onUpdate: (field: string, value: string) => void;
}

export const DatosPersonalesSection: React.FC<DatosPersonalesSectionProps> = ({
  patientData,
  onUpdate,
}) => {
  const handleChange = (field: string, value: string) => {
    onUpdate(field, value);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
      <h4 className="flex items-center gap-2 font-bold text-slate-700 dark:text-white mb-4">
        <User size={18} className="text-blue-600" />
        Datos Personales
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nombre completo" value={patientData.name || ''} onChange={v => handleChange('name', v)} />
        <Field label="Documento" value={patientData.document || ''} onChange={v => handleChange('document', v)} />
        <Field label="Fecha de nacimiento" value={patientData.date_of_birth || ''} onChange={v => handleChange('date_of_birth', v)} type="date" />
        <Field label="Género" value={patientData.gender || ''} onChange={v => handleChange('gender', v)} type="select" options={['Masculino', 'Femenino', 'Otro']} />
        <Field label="Teléfono" value={patientData.phone || ''} onChange={v => handleChange('phone', v)} />
        <Field label="Email" value={patientData.email || ''} onChange={v => handleChange('email', v)} type="email" />
        <Field label="Dirección" value={patientData.address || ''} onChange={v => handleChange('address', v)} />
        <Field label="Obra Social" value={patientData.obra_social || ''} onChange={v => handleChange('obra_social', v)} />
        <Field label="Responsable" value={patientData.responsable || ''} onChange={v => handleChange('responsable', v)} />
        <Field label="Derivante" value={patientData.derivante || ''} onChange={v => handleChange('derivante', v)} />
        <Field label="Contacto de emergencia" value={patientData.emergency_contact || ''} onChange={v => handleChange('emergency_contact', v)} />
        <Field label="Tel. emergencia" value={patientData.emergency_phone || ''} onChange={v => handleChange('emergency_phone', v)} />
        <Field 
          label="Consultorio" 
          value={patientData.consultorio || ''} 
          onChange={v => handleChange('consultorio', v)} 
          type="select" 
          options={ConsultorioConfigService.getAll().map(c => c.id)}
          optionLabels={ConsultorioConfigService.getAll().map(c => `${c.icon} ${c.name}`)}
        />
      </div>
    </div>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  options?: string[];
  optionLabels?: string[];
}> = ({ label, value, onChange, type = 'text', options, optionLabels }) => {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-slate-400 uppercase">{label}</label>
      {type === 'select' && options ? (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none focus:border-blue-400 text-slate-900 dark:text-white"
        >
          <option value="">Seleccionar...</option>
          {options.map((opt, idx) => (
            <option key={opt} value={opt}>{optionLabels?.[idx] || opt}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none focus:border-blue-400 text-slate-900 dark:text-white"
        />
      )}
    </div>
  );
};

export default DatosPersonalesSection;
