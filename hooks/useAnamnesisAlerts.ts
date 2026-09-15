import { useCallback } from 'react';
import { AdaptiveAnamnesisResponse } from '../types/clinical_history';
import { AnamnesisAlertService } from '../services/AnamnesisAlertService';
import { useClinicalAlerts } from '../context/ClinicalAlertBus';

export function useAnamnesisAlerts() {
  const { addAlert } = useClinicalAlerts();

  const processAnamnesisAlerts = useCallback(async (
    response: AdaptiveAnamnesisResponse,
    patientName: string
  ) => {
    try {
      const input = {
        patientId: response.patientId,
        patientName,
        answers: response.answers,
        affectedAreas: response.affectedAreas,
        ageGroup: response.metadata.ageGroup,
        motivoConsulta: response.metadata.motivoConsulta,
      };

      const generatedAlerts = AnamnesisAlertService.generateAlerts(input);

      for (const alert of generatedAlerts) {
        addAlert({
          patientId: alert.patientId,
          patientName: alert.patientName,
          category: alert.category,
          severity: alert.severity,
          source: alert.source,
          title: alert.title,
          description: alert.description,
          suggestedAction: alert.suggestedAction,
          immediateAction: alert.immediateAction,
          evidence: alert.evidence,
          confidence: alert.confidence,
          metadata: alert.metadata,
        });
      }

      if (generatedAlerts.length > 0) {
        console.log(`[useAnamnesisAlerts] ${generatedAlerts.length} alertas generadas para ${patientName}`);
      }
    } catch (err) {
      console.error('[useAnamnesisAlerts] Error procesando alertas:', err);
    }
  }, [addAlert]);

  return { processAnamnesisAlerts };
}
