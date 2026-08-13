import React, { useState, useEffect, useCallback } from 'react';
import { Save, Loader2, Wand2, FileText, ChevronDown, ChevronUp, CheckCircle2, Clock, Eye, AlertTriangle, Sparkles, RotateCcw } from 'lucide-react';
import { ClinicalHistoryService } from '../services/ClinicalHistoryService';
import { ClinicalHistoryTemplate, ClinicalHistorySection, ClinicalHistoryField, ClinicalHistoryRecord, Patient } from '../types';
import { generateText } from '../utils/geminiHelpers';
import { supabase } from '../utils/supabaseClient';
import { AdaptiveAnamnesisForm } from './AdaptiveAnamnesisForm';
import { AdaptiveAnamnesisResponse } from '../types/clinical_history';
import { ChannelActions, ScannedDocumentsList } from './ChannelActions';
import { ScannedDocument } from '../types/channels';
import { MaterialRequestForm } from './MaterialRequestForm';
import { MaterialReviewTray } from './MaterialReviewTray';

interface ClinicalHistoryPanelProps {
  patientId: string;
  consultorioId: string;
  currentUserId: string;
  patient: Patient;
  onSaved?: () => void;
}

type FieldKey = string; // `${sectionId}__${fieldId}`

export default function ClinicalHistoryPanel({
  patientId, consultorioId, currentUserId, patient, onSaved
}: ClinicalHistoryPanelProps) {
  const [templates, setTemplates] = useState<ClinicalHistoryTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ClinicalHistoryTemplate | null>(null);
  const [record, setRecord] = useState<ClinicalHistoryRecord | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<FieldKey, string>>({});
  const [aiSuggestions, setAiSuggestions] = useState<Record<FieldKey, string>>({});
  const [aiLoading, setAiLoading] = useState<Record<FieldKey, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [scannedDocs, setScannedDocs] = useState<ScannedDocument[]>([]);

  useEffect(() => {
    loadTemplates();
  }, [consultorioId]);

  useEffect(() => {
    if (selectedTemplate) loadOrCreateRecord();
  }, [selectedTemplate, patientId]);

  async function loadTemplates() {
    setLoading(true);
    try {
      const data = await ClinicalHistoryService.getTemplates(consultorioId);
      setTemplates(data);
      if (data.length > 0) setSelectedTemplate(data[0]);
    } catch (e) {
      console.error('[ClinicalHistoryPanel] Error loading templates:', e);
    }
    setLoading(false);
  }

  async function loadOrCreateRecord() {
    if (!selectedTemplate) return;
    try {
      let existing = await ClinicalHistoryService.getLatestRecord(patientId, selectedTemplate.id);

      if (existing && existing.template_version < selectedTemplate.version) {
        const baseData = existing.final_data_json || existing.base_data_json || {};
        existing = await ClinicalHistoryService.saveRecord({
          ...existing,
          template_id: selectedTemplate.id,
          template_version: selectedTemplate.version,
          status: 'draft',
          ai_suggestions_json: {},
          ai_metadata: [],
          author_id: currentUserId,
        });
      } else if (!existing) {
        const autoFill = await buildAutoFillData(selectedTemplate);
        existing = await ClinicalHistoryService.saveRecord({
          clinic_id: consultorioId,
          patient_id: patientId,
          template_id: selectedTemplate.id,
          template_version: selectedTemplate.version,
          status: 'draft',
          base_data_json: autoFill,
          ai_suggestions_json: {},
          final_data_json: {},
          ai_metadata: [],
          author_id: currentUserId,
        });
      }

      setRecord(existing);
      const merged = { ...(existing.base_data_json || {}), ...(existing.final_data_json || {}) };
      setFieldValues(merged);
      setAiSuggestions(existing.ai_suggestions_json || {});
    } catch (e) {
      console.error('[ClinicalHistoryPanel] Error loading record:', e);
    }
  }

  async function buildAutoFillData(template: ClinicalHistoryTemplate): Promise<Record<string, string>> {
    const data: Record<string, string> = {};

    for (const section of template.schema_json) {
      for (const field of section.fields) {
        const key = `${section.section_id}__${field.id}`;
        const populated = autoFillField(field, section.section_id);
        if (populated) data[key] = populated;
      }
    }
    return data;
  }

  function autoFillField(field: ClinicalHistoryField, sectionId: string): string {
    const name = patient.name || '';
    const age = patient.age || '';
    const gender = patient.gender || '';
    const phone = patient.phone || '';
    const email = patient.email || '';
    const lf = (field.label || '').toLowerCase();
    const sf = (sectionId || '').toLowerCase();

    if (lf.includes('nombre') || lf.includes('paciente')) return name;
    if (lf.includes('edad') || lf.includes('año')) return age ? String(age) : '';
    if (lf.includes('sexo') || lf.includes('género')) return gender;
    if (lf.includes('teléfono') || lf.includes('contacto')) return phone;
    if (lf.includes('email') || lf.includes('correo')) return email;
    if (lf.includes('fecha de nacimiento') || lf.includes('nacimiento')) return patient.date_of_birth || '';
    if (lf.includes('diagnóstico') || lf.includes('diagnostico')) return patient.diagnosis || '';
    if (lf.includes('derivad') || lf.includes('derivante')) return (patient as any).derivante || '';
    if (lf.includes('obra social') || lf.includes('cobertura')) return patient.obra_social || '';

    const anamnesis = patient.anamnesis;
    if (anamnesis?.sections) {
      if (lf.includes('motivo') && (sf.includes('motivo') || sf.includes('consult'))) {
        return anamnesis.sections.reasonForConsultation || '';
      }
      if (lf.includes('personales')) return anamnesis.sections.personalHistory || '';
      if (lf.includes('familia')) return anamnesis.sections.familyHistory || '';
      if (lf.includes('médico') || lf.includes('patológ')) return anamnesis.sections.medicalHistory || '';
      if (lf.includes('escolar') || lf.includes('educ')) return anamnesis.sections.educationHistory || '';
    }

    if (lf.includes('document') || lf.includes('doc')) return (patient as any).document || '';
    if (lf.includes('dirección') || lf.includes('domicilio') || lf.includes('direccion')) return patient.address || '';

    return '';
  }

  function handleFieldChange(key: string, value: string) {
    setFieldValues(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function handleAcceptSuggestion(key: string) {
    const suggestion = aiSuggestions[key];
    if (!suggestion) return;
    setFieldValues(prev => ({ ...prev, [key]: suggestion }));
    setAiSuggestions(prev => { const n = { ...prev }; delete n[key]; return n; });
    setDirty(true);
  }

  function handleDiscardSuggestion(key: string) {
    setAiSuggestions(prev => { const n = { ...prev }; delete n[key]; return n; });
  }

  async function handleAIAction(key: string, action: 'refine' | 'summarize' | 'clinical') {
    const currentValue = fieldValues[key] || '';
    if (!currentValue.trim()) return;

    setAiLoading(prev => ({ ...prev, [key]: true }));
    try {
      let prompt = '';
      if (action === 'refine') {
        prompt = `Refina este texto clínico manteniendo precisión técnica y claridad. Solo devuelve el texto refinado:\n\n"${currentValue}"`;
      } else if (action === 'summarize') {
        prompt = `Resume este texto clínico en 1-2 oraciones concisas. Solo devuelve el resumen:\n\n"${currentValue}"`;
      } else {
        prompt = `Reescribe este texto en lenguaje clínico profesional para una historia clínica de logopedia. Mantén los datos objetivos, usa terminología técnica apropiada y formato formal. Solo devuelve el texto reescrito:\n\n"${currentValue}"`;
      }

      const result = await generateText(prompt);
      const cleaned = result.replace(/^["']|["']$/g, '').trim();

      if (cleaned && cleaned !== currentValue) {
        setAiSuggestions(prev => ({ ...prev, [key]: cleaned }));
      }

      if (record) {
        await ClinicalHistoryService.addAIMetadata(record.id, {
          prompt,
          response: cleaned,
          user_id: currentUserId,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('[ClinicalHistoryPanel] AI action error:', e);
    }
    setAiLoading(prev => ({ ...prev, [key]: false }));
  }

  async function handleSave() {
    if (!record || !selectedTemplate) return;
    setSaving(true);
    try {
      const baseData = record.base_data_json || {};
      const finalData: Record<string, string> = {};
      const baseDataUpdated: Record<string, string> = {};

      for (const section of selectedTemplate.schema_json) {
        for (const field of section.fields) {
          const key = `${section.section_id}__${field.id}`;
          const val = fieldValues[key] || '';
          if (val) {
            if (val !== (baseData[key] || '')) {
              finalData[key] = val;
            } else {
              baseDataUpdated[key] = val;
            }
          }
        }
      }

      const saved = await ClinicalHistoryService.saveRecord({
        ...record,
        base_data_json: { ...baseData, ...baseDataUpdated },
        final_data_json: finalData,
        ai_suggestions_json: aiSuggestions,
        author_id: currentUserId,
      });
      setRecord(saved);
      setDirty(false);
      onSaved?.();
    } catch (e) {
      console.error('[ClinicalHistoryPanel] Save error:', e);
    }
    setSaving(false);
  }

  async function handleStatusChange(newStatus: 'draft' | 'reviewed' | 'approved') {
    if (!record) return;
    try {
      const approvedBy = newStatus === 'approved' ? currentUserId : undefined;
      const saved = await ClinicalHistoryService.updateStatus(record.id, newStatus, approvedBy);
      setRecord(saved);
      if (newStatus === 'approved') onSaved?.();
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('required fields are empty')) {
        alert('No se puede aprobar: faltan campos requeridos. Completá todos los campos marcados con (*) antes de aprobar.');
      } else {
        console.error('[ClinicalHistoryPanel] Status change error:', e);
      }
    }
  }

  function toggleSection(sectionId: string) {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }

  const statusConfig = {
    draft: { label: 'Borrador', icon: Clock, color: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800' },
    reviewed: { label: 'Revisado', icon: Eye, color: 'text-amber-600 bg-amber-100' },
    approved: { label: 'Aprobado', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-100' },
  };

  const isReadOnly = record?.status === 'approved';

  const hasRequiredFieldsEmpty = selectedTemplate?.schema_json.some(section =>
    section.fields.some(field => {
      if (!field.required) return false;
      const key = `${section.section_id}__${field.id}`;
      const val = fieldValues[key];
      return !val || !val.trim();
    })
  ) ?? false;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (templates.length === 0) {
    let birthDate = patient.date_of_birth || '';
    if (!birthDate && patient.age !== undefined && patient.age !== null) {
      const now = new Date();
      if (patient.age === 0) {
        now.setDate(now.getDate() - 7);
      } else {
        now.setFullYear(now.getFullYear() - patient.age);
      }
      birthDate = now.toISOString().split('T')[0];
    }

    return (
      <AdaptiveAnamnesisForm
        patientId={patientId}
        patientName={patient.name}
        birthDate={birthDate}
        motivoConsulta={patient.diagnosis || ''}
        onSave={async (response: AdaptiveAnamnesisResponse) => {
          console.log('[ClinicalHistoryPanel] AdaptiveAnamnesisForm saved:', response);
          if (onSaved) onSaved();
          return true;
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FileText size={20} className="text-blue-600" />
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white text-sm">Historia Clínica</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {patient.name} — v{selectedTemplate?.version}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Channel Actions */}
          <ChannelActions
            patientId={patientId}
            patientName={patient.name}
            userId={currentUserId}
            userName="Profesional"
            onDocumentScanned={(doc) => setScannedDocs(prev => [doc, ...prev])}
            onMessageSent={(msg) => console.log('[ClinicalHistoryPanel] Telegram message sent:', msg.id)}
          />

          {record && (
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${statusConfig[record.status].color}`}>
              {React.createElement(statusConfig[record.status].icon, { size: 12 })}
              {statusConfig[record.status].label}
            </span>
          )}

          <select
            value={selectedTemplate?.id || ''}
            onChange={e => {
              const t = templates.find(t => t.id === e.target.value);
              if (t) setSelectedTemplate(t);
            }}
            className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900"
          >
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>
            ))}
          </select>

          {record?.status === 'draft' && (
            <>
              <button
                onClick={() => handleStatusChange('reviewed')}
                className="px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1"
              >
                <Eye size={12} /> Marcar Revisado
              </button>
              <button
                onClick={() => handleStatusChange('approved')}
                disabled={hasRequiredFieldsEmpty}
                title={hasRequiredFieldsEmpty ? 'Completá todos los campos requeridos (*) antes de aprobar' : 'Aprobar historia clínica'}
                className="px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle2 size={12} /> Aprobar
              </button>
            </>
          )}

          {record?.status === 'reviewed' && (
            <button
              onClick={() => handleStatusChange('approved')}
              disabled={hasRequiredFieldsEmpty}
              title={hasRequiredFieldsEmpty ? 'Completá todos los campos requeridos (*) antes de aprobar' : 'Aprobar historia clínica'}
              className="px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={12} /> Aprobar
            </button>
          )}

          {record?.status === 'approved' && (
            <button
              onClick={() => handleStatusChange('draft')}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
            >
              <RotateCcw size={12} /> Volver a Borrador
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={isReadOnly || !dirty || saving}
            className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Guardar
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Scanned Documents */}
        <ScannedDocumentsList patientId={patientId} />

        {/* Material Request Form */}
        <MaterialRequestForm
          patientId={patientId}
          patientName={patient.name}
          userId={currentUserId}
          userName="Profesional"
          onRequestCreated={() => console.log('[ClinicalHistoryPanel] Material request created')}
        />

        {/* Material Review Tray */}
        <MaterialReviewTray
          userId={currentUserId}
          userName="Profesional"
          patientId={patientId}
          onMaterialApproved={(m) => console.log('[ClinicalHistoryPanel] Material approved:', m.id)}
          onMaterialRejected={(m) => console.log('[ClinicalHistoryPanel] Material rejected:', m.id)}
        />

        {(selectedTemplate?.schema_json || []).map(section => {
          const isExpanded = expandedSections[section.section_id] !== false;
          const filledCount = section.fields.filter(f => fieldValues[`${section.section_id}__${f.id}`]?.trim()).length;

          return (
            <div key={section.section_id} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
              <button
                onClick={() => toggleSection(section.section_id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{section.title}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                    {filledCount}/{section.fields.length}
                  </span>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-slate-400 dark:text-slate-500" /> : <ChevronDown size={16} className="text-slate-400 dark:text-slate-500" />}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-800">
                  {section.fields.map(field => {
                    const key = `${section.section_id}__${field.id}`;
                    const value = fieldValues[key] || '';
                    const suggestion = aiSuggestions[key];
                    const isLoading = aiLoading[key];

                    return (
                      <div key={field.id} className="pt-3">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                          {field.label}
                          {field.required && <span className="text-red-400">*</span>}
                        </label>

                        <div className="flex gap-2">
                          <div className="flex-1">
                            {field.type === 'textarea' ? (
                              <textarea
                                value={value}
                                onChange={e => handleFieldChange(key, e.target.value)}
                                rows={3}
                                disabled={isReadOnly}
                                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm resize-y focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none transition-all disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:cursor-not-allowed"
                                placeholder={isReadOnly ? '' : `Completar ${field.label}...`}
                              />
                            ) : field.type === 'select' ? (
                              <select
                                value={value}
                                onChange={e => handleFieldChange(key, e.target.value)}
                                disabled={isReadOnly}
                                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:border-blue-400 outline-none disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:cursor-not-allowed"
                              >
                                <option value="">Seleccionar...</option>
                                {(field.options || []).map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : field.type === 'checkbox' ? (
                              <label className={`flex items-center gap-2 ${isReadOnly ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                <input
                                  type="checkbox"
                                  checked={value === 'true'}
                                  onChange={e => handleFieldChange(key, e.target.checked ? 'true' : 'false')}
                                  disabled={isReadOnly}
                                  className="rounded border-slate-300 dark:border-slate-600 disabled:opacity-50"
                                />
                                <span className="text-sm text-slate-600 dark:text-slate-300">{field.label}</span>
                              </label>
                            ) : field.type === 'date' ? (
                              <input
                                type="date"
                                value={value}
                                onChange={e => handleFieldChange(key, e.target.value)}
                                disabled={isReadOnly}
                                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-blue-400 outline-none disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:cursor-not-allowed"
                              />
                            ) : (
                              <input
                                type="text"
                                value={value}
                                onChange={e => handleFieldChange(key, e.target.value)}
                                disabled={isReadOnly}
                                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none transition-all disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:cursor-not-allowed"
                                placeholder={isReadOnly ? '' : `Completar ${field.label}...`}
                              />
                            )}
                          </div>

                          {field.type !== 'checkbox' && field.type !== 'select' && field.type !== 'date' && (
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => handleAIAction(key, 'refine')}
                                disabled={isReadOnly || isLoading || !value.trim()}
                                title="Refinar con IA"
                                className="p-1 text-purple-400 hover:bg-purple-50 rounded disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                              >
                                {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                              </button>
                              <button
                                onClick={() => handleAIAction(key, 'summarize')}
                                disabled={isReadOnly || isLoading || !value.trim()}
                                title="Resumir"
                                className="p-1 text-blue-400 hover:bg-blue-50 rounded disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                              >
                                <FileText size={12} />
                              </button>
                              <button
                                onClick={() => handleAIAction(key, 'clinical')}
                                disabled={isReadOnly || isLoading || !value.trim()}
                                title="Redacción clínica"
                                className="p-1 text-emerald-400 hover:bg-emerald-50 rounded disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                              >
                                <Sparkles size={12} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* AI Suggestion */}
                        {suggestion && !isReadOnly && (
                          <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded-lg">
                            <p className="text-[10px] font-bold text-purple-600 mb-1 flex items-center gap-1">
                              <Sparkles size={10} /> Sugerencia IA
                            </p>
                            <p className="text-xs text-slate-700 dark:text-slate-200 mb-2 whitespace-pre-wrap">{suggestion}</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAcceptSuggestion(key)}
                                className="px-2 py-1 bg-purple-600 text-white text-[10px] font-bold rounded hover:bg-purple-700 transition-colors"
                              >
                                Aceptar
                              </button>
                              <button
                                onClick={() => handleDiscardSuggestion(key)}
                                className="px-2 py-1 text-slate-400 dark:text-slate-500 text-[10px] font-bold rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              >
                                Descartar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
