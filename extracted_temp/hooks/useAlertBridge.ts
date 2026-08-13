import { useEffect, useRef } from 'react';
import { useClinicalAlerts } from '../context/ClinicalAlertBus';
import { useSettings } from '../context/SettingsContext';
import { Patient, ProactiveSuggestion } from '../types';
import { RedFlag } from '../types/clinical_observation';

interface SourceAlert {
  patientId?: string;
  patientName?: string;
  category: string;
  severity: string;
  source: string;
  title: string;
  description: string;
  suggestedAction?: string;
  immediateAction?: string;
  evidence?: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

export function useAlertBridge(
  proactiveSuggestions: ProactiveSuggestion[],
  redFlags: RedFlag[],
  patients: Patient[]
) {
  const { addAlert } = useClinicalAlerts();
  const { settings } = useSettings();
  const prevSuggestionIds = useRef<Set<string>>(new Set());
  const prevRedFlagIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (settings.assistant.proactivity === 'minimal') return;

    for (const suggestion of proactiveSuggestions) {
      if (prevSuggestionIds.current.has(suggestion.id)) continue;
      prevSuggestionIds.current.add(suggestion.id);

      const patient = patients.find(p => p.id === suggestion.patientId);
      addAlert({
        patientId: suggestion.patientId,
        patientName: patient?.name,
        category: 'suggestion',
        severity: suggestion.priority,
        source: 'clinical_intelligence',
        title: suggestion.title,
        description: suggestion.reasoning,
        suggestedAction: suggestion.suggestedAction,
        confidence: 0.8,
      });
    }
  }, [proactiveSuggestions, patients, addAlert, settings.assistant.proactivity]);

  useEffect(() => {
    for (const flag of redFlags) {
      if (prevRedFlagIds.current.has(flag.id)) continue;
      prevRedFlagIds.current.add(flag.id);

      addAlert({
        patientId: flag.patientId,
        patientName: flag.patientName,
        category: 'red_flag',
        severity: flag.severity,
        source: 'clinical_intelligence',
        title: `Alerta: ${flag.sign}`,
        description: flag.sign,
        immediateAction: flag.immediateActionRequired,
        evidence: flag.evidence,
        confidence: flag.confidence,
      });
    }
  }, [redFlags, addAlert]);
}
