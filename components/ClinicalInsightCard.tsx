import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Check,
  Clock,
  X,
  Info
} from 'lucide-react';
import { clinicalContextManager } from '../services/ClinicalContextManager';
import followUpService from '../services/followUpService';
import { useClinicalAlerts } from '../context/ClinicalAlertBus';
import { FollowUpAlert, ClinicalSuggestionEventType } from '../types';

interface ClinicalInsightCardProps {
  mode?: 'dashboard' | 'compact';
}

const ClinicalInsightCard: React.FC<ClinicalInsightCardProps> = ({ mode = 'dashboard' }) => {
  const [context, setContext] = useState(clinicalContextManager.getSnapshot());
  const hasLoggedShown = useRef<Record<string, boolean>>({});
  const { getAlerts, applyAlert, snoozeAlert, ignoreAlert } = useClinicalAlerts();

  // Bus as primary source, contextManager as fallback
  const busSuggestions = getAlerts({ categories: ['suggestion'], severities: ['high'] });
  const busSuggestion = busSuggestions[0];
  const contextSuggestion = context.proactiveClinicalSuggestions?.[0];

  const suggestion = busSuggestion
    ? {
        signal: busSuggestion.title,
        reason: busSuggestion.description,
        suggestedAction: busSuggestion.suggestedAction,
        evidenceSummary: busSuggestion.evidence,
        severity: busSuggestion.severity,
        confidence: busSuggestion.confidence,
        type: busSuggestion.category,
        reasonHash: busSuggestion.id,
      }
    : contextSuggestion;

  useEffect(() => {
    const unsubscribe = clinicalContextManager.subscribe((newContext) => {
      setContext(newContext);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (suggestion && context.activePatientId && !hasLoggedShown.current[suggestion.reasonHash]) {
      followUpService.logSuggestionEvent({
        eventType: 'shown',
        suggestionType: suggestion.type,
        signal: suggestion.signal || '',
        severity: suggestion.severity,
        confidence: suggestion.confidence || 0,
        reasonHash: suggestion.reasonHash,
        patientId: context.activePatientId,
        sourceSurface: mode === 'dashboard' ? 'dashboard' : 'patient_card',
        timestamp: new Date().toISOString(),
        schemaVersion: '1.0',
      });
      hasLoggedShown.current[suggestion.reasonHash] = true;
    }
  }, [suggestion, context.activePatientId, mode]);

  if (!suggestion) return null;

  const handleAction = async (status: 'resolved' | 'snoozed' | 'ignored') => {
    if (!suggestion?.reasonHash) return;

    // Update bus if suggestion came from bus
    if (busSuggestion) {
      if (status === 'resolved') applyAlert(busSuggestion.id);
      else if (status === 'snoozed') snoozeAlert(busSuggestion.id, 24);
      else if (status === 'ignored') ignoreAlert(busSuggestion.id);
    }

    // Also record in followUpService for analytics (if we have activePatientId)
    if (!context.activePatientId) return;

    const eventTypeMap: Record<string, ClinicalSuggestionEventType> = {
      resolved: 'applied',
      snoozed: 'snoozed',
      ignored: 'ignored',
    };

    try {
      await followUpService.recordDecision(context.activePatientId, {
        reasonHash: suggestion.reasonHash,
        status,
        snoozedUntil: status === 'snoozed' ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : undefined,
      });

      await followUpService.logSuggestionEvent({
        eventType: eventTypeMap[status],
        suggestionType: suggestion.type,
        signal: suggestion.signal || '',
        severity: suggestion.severity,
        confidence: suggestion.confidence || 0,
        reasonHash: suggestion.reasonHash,
        patientId: context.activePatientId,
        sourceSurface: mode === 'dashboard' ? 'dashboard' : 'patient_card',
        timestamp: new Date().toISOString(),
        schemaVersion: '1.0',
      });
    } catch (error) {
      console.error("Error recording decision/event:", error);
    }
  };

  if (mode === 'compact') {
    return (
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 border border-indigo-100 dark:border-indigo-800 rounded-xl p-3 shadow-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
        <div className="mt-1 bg-indigo-100 dark:bg-indigo-900/50 p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400">
          <Sparkles size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200 truncate">{suggestion.signal}</p>
          <p className="text-[11px] text-indigo-700/70 dark:text-indigo-300/70 line-clamp-1">{suggestion.reason}</p>
          <div className="flex gap-2 mt-2">
            <button 
              onClick={() => handleAction('resolved')}
              className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200/50 dark:hover:bg-indigo-800/50 px-2 py-0.5 rounded transition-colors"
            >
              Aplicar
            </button>
            <button 
              onClick={() => handleAction('ignored')}
              className="text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-0.5 rounded transition-colors"
            >
              Ignorar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border-l-4 border-l-indigo-500 border border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-4">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-lg">
              <Sparkles size={20} />
            </div>
            <span className="text-sm font-bold uppercase tracking-wider">Sugerencia Clínica</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-xs">
            <Info size={14} />
            <span>Basado en evidencia de sesión</span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{suggestion.signal}</h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{suggestion.reason}</p>
          </div>

          {suggestion.evidenceSummary && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 italic flex items-start gap-2">
                <span className="font-semibold not-italic text-slate-400 dark:text-slate-500">Evidencia:</span>
                {suggestion.evidenceSummary}
              </p>
            </div>
          )}

          <div className="pt-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Acción sugerida:</p>
            <div className="bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4 text-indigo-900 dark:text-indigo-200 text-sm font-medium">
              {suggestion.suggestedAction}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <button 
            onClick={() => handleAction('ignored')}
            className="px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all flex items-center gap-2"
          >
            <X size={18} /> Ignorar
          </button>
          <button 
            onClick={() => handleAction('snoozed')}
            className="px-4 py-2 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl transition-all flex items-center gap-2"
          >
            <Clock size={18} /> Posponer
          </button>
          <button 
            onClick={() => handleAction('resolved')}
            className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-200 dark:shadow-indigo-900/30 transition-all flex items-center gap-2"
          >
            <Check size={18} /> Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClinicalInsightCard;
