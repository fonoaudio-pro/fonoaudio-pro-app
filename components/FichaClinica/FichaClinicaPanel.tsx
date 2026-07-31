import React, { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle } from 'lucide-react';
import { ClinicalRecord, ClinicalRecordInput, createEmptyAffectedAreas } from '../../types/clinical';
import { ClinicalRecordService } from '../../services/ClinicalRecordService';
import { PatientService, PatientIdentityUpdate } from '../../services/PatientService';
import { DatosPersonalesSection } from './DatosPersonalesSection';
import { MotivoConsultaSection } from './MotivoConsultaSection';
import { AntecedentesSection } from './AntecedentesSection';
import { DesarrolloSection } from './DesarrolloSection';
import { AreasFonoSection } from './AreasFonoSection';

interface FichaClinicaPanelProps {
  patientId: string;
  patientData: any;
  onPatientUpdate: (data: any) => void;
  userId?: string;
}

export const FichaClinicaPanel: React.FC<FichaClinicaPanelProps> = ({
  patientId,
  patientData,
  onPatientUpdate,
  userId,
}) => {
  const [record, setRecord] = useState<ClinicalRecordInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingIdentity, setPendingIdentity] = useState<PatientIdentityUpdate>({});
  const [currentPatient, setCurrentPatient] = useState(patientData);

  useEffect(() => {
    loadRecord();
  }, [patientId]);

  const loadRecord = async () => {
    try {
      setLoading(true);
      setError(null);
      const existing = await ClinicalRecordService.getByPatientId(patientId);
      if (existing) {
        setRecord({
          patient_id: patientId,
          chief_complaint: existing.chief_complaint || '',
          chief_complaint_onset: existing.chief_complaint_onset || '',
          personal_history: existing.personal_history || {},
          family_history: existing.family_history || {},
          medical_history: existing.medical_history || {},
          developmental_history: existing.developmental_history || {},
          clinical_observations: existing.clinical_observations || '',
          affected_areas: existing.affected_areas || createEmptyAffectedAreas(),
          primary_diagnosis_code: existing.primary_diagnosis_code,
          primary_diagnosis_name: existing.primary_diagnosis_name,
          secondary_diagnosis_codes: existing.secondary_diagnosis_codes || [],
        });
      } else {
        setRecord({
          patient_id: patientId,
          chief_complaint: '',
          chief_complaint_onset: '',
          personal_history: {},
          family_history: {},
          medical_history: {},
          developmental_history: {},
          clinical_observations: '',
          affected_areas: createEmptyAffectedAreas(),
          primary_diagnosis_code: null,
          primary_diagnosis_name: null,
          secondary_diagnosis_codes: [],
        });
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar la ficha clínica');
      console.error('Error loading clinical record:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!record) return;
    try {
      setSaving(true);
      setError(null);
      await ClinicalRecordService.upsert(record, userId);

      if (Object.keys(pendingIdentity).length > 0) {
        await PatientService.updateIdentity(patientId, pendingIdentity);
        onPatientUpdate(currentPatient);
        setPendingIdentity({});
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Error al guardar la ficha clínica');
      console.error('Error saving clinical record:', err);
    } finally {
      setSaving(false);
    }
  };

  const updateRecord = (updates: Partial<ClinicalRecordInput>) => {
    setRecord(prev => prev ? { ...prev, ...updates } : null);
  };

  const handlePatientIdentityChange = (field: string, value: string) => {
    setCurrentPatient((prev: any) => ({ ...prev, [field]: value }));
    setPendingIdentity(prev => ({ ...prev, [field]: value || undefined }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-blue-500" size={24} />
      </div>
    );
  }

  if (!record) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800">Ficha Clínica</h3>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saved ? 'Guardado' : 'Guardar Ficha'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <DatosPersonalesSection
        patientData={currentPatient}
        onUpdate={handlePatientIdentityChange}
      />

      <MotivoConsultaSection
        chiefComplaint={record.chief_complaint || ''}
        onset={record.chief_complaint_onset || ''}
        onChange={(complaint, onset) =>
          updateRecord({ chief_complaint: complaint, chief_complaint_onset: onset })
        }
      />

      <AntecedentesSection
        personal={record.personal_history || {}}
        family={record.family_history || {}}
        medical={record.medical_history || {}}
        onChange={(key, value) =>
          updateRecord({ [key]: value } as any)
        }
      />

      <DesarrolloSection
        developmental={record.developmental_history || {}}
        onChange={(value) => updateRecord({ developmental_history: value })}
      />

      <AreasFonoSection
        areas={record.affected_areas || createEmptyAffectedAreas()}
        onChange={(areas) => updateRecord({ affected_areas: areas })}
      />

      {/* Diagnosis fields */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h4 className="flex items-center gap-2 font-bold text-slate-700 mb-4">
          <AlertCircle size={18} className="text-blue-600" />
          Diagnóstico
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Código Diagnóstico Principal</label>
            <input
              type="text"
              value={record.primary_diagnosis_code || ''}
              onChange={e => updateRecord({ primary_diagnosis_code: e.target.value || null })}
              placeholder="Ej: CIE-11 o SNOMED-CT"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre Diagnóstico Principal</label>
            <input
              type="text"
              value={record.primary_diagnosis_name || ''}
              onChange={e => updateRecord({ primary_diagnosis_name: e.target.value || null })}
              placeholder="Ej: Disfagia orofaríngea"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
            />
          </div>
        </div>
      </div>

      {/* Clinical Observations */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h4 className="flex items-center gap-2 font-bold text-slate-700 mb-4">
          <AlertCircle size={18} className="text-blue-600" />
          Observaciones Clínicas
        </h4>
        <div className="space-y-1">
          <textarea
            value={record.clinical_observations || ''}
            onChange={e => updateRecord({ clinical_observations: e.target.value })}
            placeholder="Observaciones generales del paciente..."
            rows={4}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 resize-none"
          />
        </div>
      </div>
    </div>
  );
};

export default FichaClinicaPanel;
