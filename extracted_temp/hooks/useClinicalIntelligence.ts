import { useState, useEffect } from "react";
import { Patient, ProactiveSuggestion } from "../types";
import { RedFlag } from "../types/clinical_observation";
import ClinicalIntelligenceService from "../services/ClinicalIntelligenceService";
import { useSettings } from "../context/SettingsContext";

interface UseClinicalIntelligenceResult {
  proactiveSuggestions: ProactiveSuggestion[];
  redFlags: RedFlag[];
  dismissRedFlag: (id: string) => void;
}

export function useClinicalIntelligence(patients: Patient[]): UseClinicalIntelligenceResult {
  const [proactiveSuggestions, setProactiveSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const { settings } = useSettings();
  const proactivity = settings.assistant.proactivity;

  useEffect(() => {
    const fetchSuggestions = async () => {
      const suggestions = await ClinicalIntelligenceService.getDashboardSuggestions();
      setProactiveSuggestions(suggestions);
    };
    const fetchFlags = async () => {
      const flags = await ClinicalIntelligenceService.getDashboardRedFlags();
      setRedFlags(flags);
    };
    fetchSuggestions();
    fetchFlags();
  }, [patients]);

  const dismissRedFlag = (id: string) => {
    setRedFlags(prev => prev.filter(f => f.id !== id));
  };

  const filteredSuggestions = proactivity === 'minimal'
    ? [] // minimal: no proactive suggestions on dashboard
    : proactivity === 'balanced'
      ? proactiveSuggestions.filter(s => s.priority === 'high') // balanced: only high priority
      : proactiveSuggestions; // proactive: all suggestions

  return { proactiveSuggestions: filteredSuggestions, redFlags, dismissRedFlag };
}
