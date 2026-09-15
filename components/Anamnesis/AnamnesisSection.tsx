import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { AnamnesisSectionTemplate, AnamnesisQuestion } from '../../types/clinical';
import { AnamnesisQuestionComponent } from './AnamnesisQuestion';
import { shouldShowQuestion } from '../../templates/anamnesisTemplate';

interface AnamnesisSectionProps {
  template: AnamnesisSectionTemplate;
  answers: Record<string, any>;
  allAnswers: Record<string, Record<string, any>>;
  onChange: (answers: Record<string, any>) => void;
}

export const AnamnesisSection: React.FC<AnamnesisSectionProps> = ({
  template,
  answers,
  allAnswers,
  onChange,
}) => {
  const [expanded, setExpanded] = useState(true);

  const handleQuestionChange = (questionId: string, value: any) => {
    onChange({ ...answers, [questionId]: value });
  };

  const visibleQuestions = template.questions.filter(q =>
    shouldShowQuestion(q.id, [template], allAnswers)
  );

  const answeredCount = visibleQuestions.filter(
    q => answers[q.id] !== undefined && answers[q.id] !== ''
  ).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown size={18} className="text-slate-400" />
          ) : (
            <ChevronRight size={18} className="text-slate-400" />
          )}
          <div className="text-left">
            <h4 className="font-bold text-slate-700 text-sm">{template.title}</h4>
            {template.description && (
              <p className="text-xs text-slate-400 mt-0.5">{template.description}</p>
            )}
          </div>
        </div>
        <span className="text-xs font-bold text-slate-400">
          {answeredCount}/{visibleQuestions.length}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4">
          {visibleQuestions.map(question => (
            <AnamnesisQuestionComponent
              key={question.id}
              question={question}
              value={answers[question.id]}
              onChange={(value) => handleQuestionChange(question.id, value)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AnamnesisSection;
