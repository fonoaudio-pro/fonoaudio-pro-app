import { useState, useCallback, useEffect } from 'react';
import { LongitudinalContextService } from '../services/LongitudinalContextService';
import { PatientContext } from '../services/LongitudinalContextService';

interface UseLongitudinalContextReturn {
  patientContext: PatientContext | null;
  isLoading: boolean;
  error: string | null;
  loadPatientContext: (
    patientId: string,
    patientName: string,
    birthDate: string,
    motivoConsulta: string
  ) => Promise<void>;
  clearContext: () => void;
  getContextForPrompt: () => string;
  getContextForDisplay: () => string;
}

export function useLongitudinalContext(): UseLongitudinalContextReturn {
  const [patientContext, setPatientContext] = useState<PatientContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPatientContext = useCallback(async (
    patientId: string,
    patientName: string,
    birthDate: string,
    motivoConsulta: string
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const context = await LongitudinalContextService.getPatientContext(
        patientId,
        patientName,
        birthDate,
        motivoConsulta
      );
      setPatientContext(context);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error loading patient context';
      setError(message);
      console.error('Error loading longitudinal context:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearContext = useCallback(() => {
    setPatientContext(null);
    setError(null);
  }, []);

  const getContextForPrompt = useCallback(() => {
    if (!patientContext) return '';
    return LongitudinalContextService.buildSystemPromptContext(patientContext);
  }, [patientContext]);

  const getContextForDisplay = useCallback(() => {
    if (!patientContext) return '';
    return LongitudinalContextService.formatContextForDisplay(patientContext);
  }, [patientContext]);

  return {
    patientContext,
    isLoading,
    error,
    loadPatientContext,
    clearContext,
    getContextForPrompt,
    getContextForDisplay
  };
}
