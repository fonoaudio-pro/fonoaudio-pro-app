import React, { useState, useEffect } from 'react';
import { Save, Loader2, History, FileText, Filter } from 'lucide-react';
import {
  PatientAnamnesis,
  AnamnesisSections,
  AnamnesisSectionTemplate,
  AffectedAreaKey,
} from '../../types/clinical';
import { AnamnesisService } from '../../services/AnamnesisService';
import { getTemplate, getTemplateForAreas } from '../../templates/anamnesisTemplate';
import { AnamnesisSection } from './AnamnesisSection';

interface AnamnesisPanelProps {
  patientId: string;
  userId?: string;
  affectedAreas?: AffectedAreaKey[];
  patientDiagnosis?: string;
}

export const AnamnesisPanel: React.FC<AnamnesisPanelProps> = ({
  patientId,
  userId,
  affectedAreas,
  patientDiagnosis,
}) => {
  const [currentDraft, setCurrentDraft] = useState<PatientAnamnesis | null>(null);
  const [history, setHistory] = useState<PatientAnamnesis[]>([]);
  const [sections, setSections] = useState<AnamnesisSections>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingHistory, setViewingHistory] = useState<PatientAnamnesis | null>(null);
  const [showAreaFilter, setShowAreaFilter] = useState(false);

  const template = affectedAreas && affectedAreas.length > 0
    ? getTemplateForAreas(affectedAreas)
    : getTemplate();

  useEffect(() => {
    loadData();
  }, [patientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [draft, allVersions] = await Promise.all([
        AnamnesisService.getCurrent(patientId),
        AnamnesisService.getAllByPatientId(patientId),
      ]);

      setCurrentDraft(draft);
      setHistory(allVersions);
      setSections(draft?.sections || {});
    } catch (err: any) {
      console.error('Error loading anamnesis:', err);
      setError('Error al cargar la anamnesis. Por favor, intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSectionChange = (sectionId: string, answers: Record<string, any>) => {
    setSections(prev => ({ ...prev, [sectionId]: answers }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const savedDraft = await AnamnesisService.saveAsNewDraft(
        patientId,
        sections,
        userId
      );
      setCurrentDraft(savedDraft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await loadData();
    } catch (err: any) {
      console.error('Error saving anamnesis:', err);
      setError('Error al guardar la anamnesis. Verificá tu conexión e intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleViewVersion = async (version: PatientAnamnesis) => {
    setViewingHistory(version);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-blue-500" size={24} />
      </div>
    );
  }

  if (error && !sections) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button onClick={loadData} className="mt-2 text-xs text-red-700 dark:text-red-300 underline hover:no-underline">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Anamnesis</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {template.label} — {history.length} versión(es)
            {affectedAreas && affectedAreas.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold">
                <Filter size={10} /> {affectedAreas.length} área(s) específicas
              </span>
            )}
          </p>
          {patientDiagnosis && (
            <p className="text-[10px] text-slate-500 mt-0.5">
              Diagnóstico: {patientDiagnosis}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {history.length > 0 && (
            <button
              onClick={() => setViewingHistory(viewingHistory ? null : history[0])}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              <History size={14} />
              Historial
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saved ? 'Guardado' : 'Guardar Anamnesis'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {viewingHistory && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-amber-600" />
              <span className="text-sm font-bold text-amber-800">
                Versión {viewingHistory.version} — {viewingHistory.status}
              </span>
              <span className="text-xs text-amber-600">
                {new Date(viewingHistory.created_at).toLocaleDateString('es-AR')}
              </span>
            </div>
            <button
              onClick={() => setViewingHistory(null)}
              className="text-xs text-amber-600 hover:text-amber-800"
            >
              Cerrar
            </button>
          </div>
          <div className="space-y-2">
            {Object.entries(viewingHistory.sections).map(([sectionId, answers]) => {
              const section = template.sections.find(s => s.id === sectionId);
              return (
                <div key={sectionId} className="bg-white rounded-lg p-3">
                  <p className="text-xs font-bold text-slate-600 mb-2">
                    {section?.title || sectionId}
                  </p>
                  {Object.entries(answers as Record<string, any>).map(([qId, value]) => (
                    <p key={qId} className="text-xs text-slate-500">
                      <span className="font-medium">{qId}:</span> {String(value)}
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {template.sections.map((section: AnamnesisSectionTemplate) => (
        <AnamnesisSection
          key={section.id}
          template={section}
          answers={sections[section.id] || {}}
          allAnswers={sections}
          onChange={(answers) => handleSectionChange(section.id, answers)}
        />
      ))}
    </div>
  );
};

export default AnamnesisPanel;
