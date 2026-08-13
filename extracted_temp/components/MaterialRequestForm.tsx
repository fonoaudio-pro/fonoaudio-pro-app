import React, { useState } from 'react';
import { Wand2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { MultimediaPipelineService } from '../services/MultimediaPipelineService';
import { MaterialType, MATERIAL_TYPE_LABELS, MATERIAL_TYPE_ICONS } from '../types/multimedia';

interface MaterialRequestFormProps {
  patientId: string;
  patientName: string;
  userId: string;
  userName: string;
  onRequestCreated?: () => void;
}

const MATERIAL_TYPES: { value: MaterialType; label: string; icon: string }[] = [
  { value: 'home_guide', label: MATERIAL_TYPE_LABELS.home_guide, icon: MATERIAL_TYPE_ICONS.home_guide },
  { value: 'pecs_sequence', label: MATERIAL_TYPE_LABELS.pecs_sequence, icon: MATERIAL_TYPE_ICONS.pecs_sequence },
  { value: 'therapy_sequence', label: MATERIAL_TYPE_LABELS.therapy_sequence, icon: MATERIAL_TYPE_ICONS.therapy_sequence },
  { value: 'vocabulary_cards', label: MATERIAL_TYPE_LABELS.vocabulary_cards, icon: MATERIAL_TYPE_ICONS.vocabulary_cards },
  { value: 'visual_resource', label: MATERIAL_TYPE_LABELS.visual_resource, icon: MATERIAL_TYPE_ICONS.visual_resource },
  { value: 'custom', label: MATERIAL_TYPE_LABELS.custom, icon: MATERIAL_TYPE_ICONS.custom },
];

export function MaterialRequestForm({
  patientId, patientName, userId, userName, onRequestCreated
}: MaterialRequestFormProps) {
  const [materialType, setMaterialType] = useState<MaterialType>('home_guide');
  const [clinicalGoal, setClinicalGoal] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicalGoal.trim() || !prompt.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await MultimediaPipelineService.requestMaterial({
        patientId,
        patientName,
        materialType,
        clinicalGoal: clinicalGoal.trim(),
        prompt: prompt.trim(),
        source: 'user_request',
        userId,
        userName,
      });
      setSuccess(true);
      setClinicalGoal('');
      setPrompt('');
      onRequestCreated?.();
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError('Error al crear la solicitud');
    }
    setLoading(false);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4" data-testid="material-request-form">
      <div className="flex items-center gap-2 mb-3">
        <Wand2 size={16} className="text-purple-600 dark:text-purple-400" />
        <h4 className="font-bold text-sm text-slate-800 dark:text-white">Solicitar Material</h4>
        <span className="px-1.5 py-0.5 text-[8px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded">STUB</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Tipo de Material</label>
          <select
            value={materialType}
            onChange={e => setMaterialType(e.target.value as MaterialType)}
            className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-white"
            data-testid="material-type-select"
          >
            {MATERIAL_TYPES.map(mt => (
              <option key={mt.value} value={mt.value}>{mt.icon} {mt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Objetivo Clínico</label>
          <input
            type="text"
            value={clinicalGoal}
            onChange={e => setClinicalGoal(e.target.value)}
            placeholder="Ej: Estimular vocabulario básico en casa"
            className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            data-testid="clinical-goal-input"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Descripción / Prompt</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describa el material que necesita para este paciente..."
            rows={3}
            className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm resize-y bg-white dark:bg-slate-800 text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            data-testid="material-prompt-input"
          />
        </div>

        {error && (
          <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertCircle size={12} /> {error}
          </div>
        )}

        {success && (
          <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 size={12} /> Solicitud creada exitosamente
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !clinicalGoal.trim() || !prompt.trim()}
          className="w-full px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          data-testid="submit-material-request"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          Solicitar Material
        </button>
      </form>
    </div>
  );
}
