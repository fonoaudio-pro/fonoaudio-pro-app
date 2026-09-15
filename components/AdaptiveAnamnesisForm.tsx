import React, { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Save, Check, AlertCircle } from 'lucide-react';
import {
  AdaptiveAnamnesisResponse,
  getAgeGroup,
  CLINICAL_AXES,
  ClinicalAxis
} from '../types/clinical_history';
import { getAdaptiveTemplate, getAffectedAreasFromMotivo } from '../services/AnamnesisTemplates';
import { AdaptiveField } from '../types/clinical_history';
import { useAnamnesisAlerts } from '../hooks/useAnamnesisAlerts';

interface AdaptiveAnamnesisFormProps {
  patientId: string;
  patientName: string;
  birthDate: string;
  motivoConsulta: string;
  onSave: (response: AdaptiveAnamnesisResponse) => Promise<boolean>;
  onCancel?: () => void;
}

const AGE_GROUP_LABELS = {
  neonato: 'Neonato (0-1 mes)',
  lactante: 'Lactante (1-12 meses)',
  preescolar: 'Preescolar (1-4 años)',
  escolar: 'Escolar (5-11 años)',
  adolescente: 'Adolescente (12-17 años)',
  adulto: 'Adulto (18-64 años)',
  adulto_mayor: 'Adulto Mayor (65+ años)'
};

export const AdaptiveAnamnesisForm: React.FC<AdaptiveAnamnesisFormProps> = ({
  patientId,
  patientName,
  birthDate,
  motivoConsulta,
  onSave,
  onCancel
}) => {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Map<string, string[]>>(new Map());
  const { processAnamnesisAlerts } = useAnamnesisAlerts();

  const ageGroup = useMemo(() => getAgeGroup(birthDate), [birthDate]);
  const affectedAreas = useMemo(() => getAffectedAreasFromMotivo(motivoConsulta), [motivoConsulta]);

  const template = useMemo(() => {
    return getAdaptiveTemplate(ageGroup, affectedAreas);
  }, [ageGroup, affectedAreas]);

  const allSections = useMemo(() => {
    return template.sections.map(section => ({
      id: section.id,
      title: section.title,
      required: section.required,
      description: section.description,
      fields: section.fields
    }));
  }, [template]);

  const currentSection = allSections[currentSectionIndex] || null;
  const totalRequiredFields = allSections.reduce((count, section) => {
    return count + section.fields.filter(f => f.required).length;
  }, 0);
  const completedRequiredFields = Object.keys(formData).filter(key => {
    const field = allSections
      .flatMap(s => s.fields)
      .find(f => f.id === key);
    return field?.required && formData[key] !== undefined && formData[key] !== '';
  }).length;
  const progress = totalRequiredFields > 0 ? (completedRequiredFields / totalRequiredFields) * 100 : 0;

  const validateCurrentSection = useCallback((): boolean => {
    if (!currentSection) return true;

    const errors: string[] = [];
    currentSection.fields.forEach(field => {
      if (field.required) {
        const value = formData[field.id];
        if (value === undefined || value === null || value === '') {
          errors.push(`${field.label} es requerido`);
        }
      }
    });

    setValidationErrors(prev => {
      const next = new Map(prev);
      if (errors.length > 0) {
        next.set(currentSection.id, errors);
      } else {
        next.delete(currentSection.id);
      }
      return next;
    });

    return errors.length === 0;
  }, [currentSection, formData]);

  const handleNext = useCallback(() => {
    if (!validateCurrentSection()) return;

    setCompletedSections(prev => new Set(prev).add(currentSection?.id || ''));

    if (currentSectionIndex < allSections.length - 1) {
      setCurrentSectionIndex(prev => prev + 1);
    }
  }, [currentSectionIndex, allSections.length, currentSection?.id, validateCurrentSection]);

  const handlePrevious = useCallback(() => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1);
    }
  }, [currentSectionIndex]);

  const handleFieldChange = useCallback((fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));

    if (validationErrors.has(currentSection?.id || '')) {
      validateCurrentSection();
    }
  }, [currentSection?.id, validationErrors, validateCurrentSection]);

  const handleSave = useCallback(async () => {
    const errorsBySection = new Map<string, string[]>();
    let firstErrorIndex = -1;

    allSections.forEach((section, index) => {
      const errors: string[] = [];
      section.fields.forEach(field => {
        if (field.required) {
          const value = formData[field.id];
          if (value === undefined || value === null || value === '') {
            errors.push(`${field.label} es requerido`);
          }
        }
      });
      if (errors.length > 0) {
        errorsBySection.set(section.id, errors);
        if (firstErrorIndex === -1) firstErrorIndex = index;
      }
    });

    if (errorsBySection.size > 0) {
      setValidationErrors(errorsBySection);
      if (firstErrorIndex >= 0) setCurrentSectionIndex(firstErrorIndex);
      window.dispatchEvent(new CustomEvent('fonoaudio-toast', {
        detail: { message: 'Completá los campos obligatorios antes de guardar', type: 'error' }
      }));
      return;
    }

    setIsSaving(true);
    try {
      const response: AdaptiveAnamnesisResponse = {
        patientId,
        templateId: `${ageGroup}_${affectedAreas.join('_')}`,
        answers: formData,
        affectedAreas,
        metadata: {
          ageGroup,
          motivoConsulta,
          completedAt: new Date().toISOString()
        }
      };
      
      const saved = await onSave(response);
      if (saved) {
        processAnamnesisAlerts(response, patientName);
      }
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('fonoaudio-toast', {
        detail: { message: `Error inesperado: ${err?.message || err}`, type: 'error' }
      }));
    } finally {
      setIsSaving(false);
    }
  }, [allSections, formData, patientId, ageGroup, affectedAreas, motivoConsulta, onSave, patientName, processAnamnesisAlerts]);

  const renderField = (field: AdaptiveField) => {
    const value = formData[field.id];
    const hasError = validationErrors.has(currentSection?.id || '') && field.required && !value;
    const inputClass = `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${hasError ? 'border-red-500' : 'border-slate-300'}`;

    switch (field.type) {
      case 'text':
        return (
          <input
            key={field.id}
            type="text"
            value={value || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={inputClass}
          />
        );

      case 'textarea':
        return (
          <textarea
            key={field.id}
            value={value || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className={inputClass}
          />
        );

      case 'number':
        return (
          <input
            key={field.id}
            type="number"
            value={value || ''}
            onChange={(e) => handleFieldChange(field.id, Number(e.target.value))}
            min={field.min}
            max={field.max}
            className={inputClass}
          />
        );

      case 'date':
        return (
          <input
            key={field.id}
            type="date"
            value={value || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className={inputClass}
          />
        );

      case 'select':
        return (
          <select
            key={field.id}
            value={value || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className={inputClass}
          >
            <option value="">Seleccionar...</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <div key={field.id} className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={field.id}
              checked={value || false}
              onChange={(e) => handleFieldChange(field.id, e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor={field.id} className="text-sm">{field.label}</label>
          </div>
        );

      case 'multiselect':
        const selectedValues: string[] = Array.isArray(value) ? value : [];
        return (
          <div key={field.id} className="flex flex-wrap gap-2">
            {field.options?.map((option) => {
              const isSelected = selectedValues.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    const next = isSelected
                      ? selectedValues.filter(v => v !== option)
                      : [...selectedValues, option];
                    handleFieldChange(field.id, next);
                  }}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        );

      case 'scale':
        const scaleMin = field.min || 1;
        const scaleMax = field.max || 10;
        const scaleValue = typeof value === 'number' ? value : scaleMin;
        return (
          <div key={field.id} className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{scaleMin}</span>
            <input
              type="range"
              min={scaleMin}
              max={scaleMax}
              value={scaleValue}
              onChange={(e) => handleFieldChange(field.id, Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-slate-500">{scaleMax}</span>
            <span className="ml-2 px-2 py-0.5 text-xs border rounded">{scaleValue}</span>
          </div>
        );

      default:
        return null;
    }
  };

  if (allSections.length === 0) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-lg">No hay secciones disponibles para este perfil</p>
        {onCancel && (
          <button onClick={onCancel} className="mt-4 px-4 py-2 bg-slate-200 rounded-lg text-sm">
            Cerrar
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Anamnesis Adaptativa</h2>
          <p className="text-sm text-slate-500">
            Perfil: {AGE_GROUP_LABELS[ageGroup as keyof typeof AGE_GROUP_LABELS] || ageGroup} |
            Áreas: {affectedAreas.length > 0 ? affectedAreas.join(', ') : 'General'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">
            {completedRequiredFields}/{totalRequiredFields} campos requeridos
          </span>
          <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 border-r border-slate-200 p-4 bg-slate-50">
          <h3 className="font-medium mb-4 text-slate-700">Secciones</h3>
          <div className="space-y-2 overflow-y-auto h-[calc(100vh-300px)]">
            {allSections.map((section, index) => (
              <button
                key={section.id}
                onClick={() => {
                  if (index <= currentSectionIndex || completedSections.has(section.id)) {
                    setCurrentSectionIndex(index);
                  }
                }}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  index === currentSectionIndex
                    ? 'bg-blue-600 text-white'
                    : completedSections.has(section.id)
                    ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                } ${
                  index > currentSectionIndex && !completedSections.has(section.id)
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-2">
                  {completedSections.has(section.id) && (
                    <Check className="w-4 h-4 text-green-500" />
                  )}
                  <span className="text-sm">{section.title}</span>
                </div>
                {section.required && (
                  <span className="text-xs opacity-70">Requerido</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {currentSection && (
            <div className="border border-slate-200 rounded-lg">
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <h3 className="font-semibold text-slate-800">{currentSection.title}</h3>
                {currentSection.description && (
                  <p className="text-sm text-slate-500 mt-1">{currentSection.description}</p>
                )}
              </div>
              <div className="p-4 space-y-6">
                {currentSection.fields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    {field.type !== 'checkbox' && (
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        {field.label}
                        {field.required && (
                          <span className="text-red-500">*</span>
                        )}
                      </label>
                    )}
                    {renderField(field)}
                    {field.helpText && (
                      <p className="text-xs text-slate-500">{field.helpText}</p>
                    )}
                    {validationErrors.has(currentSection.id) && field.required && !formData[field.id] && (
                      <p className="text-xs text-red-500">Este campo es requerido</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-white">
        <button
          onClick={handlePrevious}
          disabled={currentSectionIndex === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </button>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
          )}
          {currentSectionIndex < allSections.length - 1 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="animate-spin">○</span>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar Anamnesis
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
