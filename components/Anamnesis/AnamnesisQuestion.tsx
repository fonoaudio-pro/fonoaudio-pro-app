import React from 'react';
import { AnamnesisQuestion } from '../../types/clinical';
import { VoiceDictationButton } from '../VoiceDictationButton';

interface AnamnesisQuestionProps {
  question: AnamnesisQuestion;
  value: any;
  onChange: (value: any) => void;
}

export const AnamnesisQuestionComponent: React.FC<AnamnesisQuestionProps> = ({
  question,
  value,
  onChange,
}) => {
  const stringValue = value !== undefined && value !== null ? String(value) : '';

  const handleDictation = (text: string) => {
    onChange(stringValue ? stringValue + ' ' + text : text);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-600">
          {question.label}
          {question.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {(question.type === 'textarea' || question.type === 'text') && (
          <VoiceDictationButton onTranscript={handleDictation} />
        )}
      </div>

      {question.type === 'textarea' && (
        <textarea
          value={stringValue}
          onChange={e => onChange(e.target.value)}
          placeholder={question.placeholder}
          rows={2}
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 resize-none"
        />
      )}

      {question.type === 'text' && (
        <input
          type="text"
          value={stringValue}
          onChange={e => onChange(e.target.value)}
          placeholder={question.placeholder}
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
        />
      )}

      {question.type === 'number' && (
        <input
          type="number"
          value={stringValue}
          onChange={e => onChange(e.target.value)}
          placeholder={question.placeholder}
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
        />
      )}

      {question.type === 'select' && question.options && (
        <select
          value={stringValue}
          onChange={e => onChange(e.target.value)}
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
        >
          <option value="">Seleccionar...</option>
          {question.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}
    </div>
  );
};

export default AnamnesisQuestionComponent;
