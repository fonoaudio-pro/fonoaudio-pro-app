export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AlertCategory =
  | 'red_flag'        // Requiere acción inmediata
  | 'suggestion'      // Sugerencia proactiva
  | 'follow_up'       // Seguimiento logístico
  | 'clinical_trend'  // Tendencia clínica detectada
  | 'nba';            // Next Best Action del motor NBA

export type AlertSource =
  | 'clinical_intelligence'
  | 'follow_up_service'
  | 'nba_engine'
  | 'module_analysis'
  | 'assistant'
  | 'anamnesis'
  | 'evolution_entry';

export type AlertDisposition = 'pending' | 'applied' | 'snoozed' | 'ignored' | 'dismissed';

export interface ClinicalAlert {
  id: string;
  patientId?: string;
  patientName?: string;
  category: AlertCategory;
  severity: AlertSeverity;
  source: AlertSource;
  title: string;
  description: string;
  suggestedAction?: string;
  immediateAction?: string;
  evidence?: string;
  confidence?: number;
  disposition: AlertDisposition;
  createdAt: string;
  snoozedUntil?: string;
  metadata?: Record<string, any>;
}

export interface ClinicalAlertFilter {
  categories?: AlertCategory[];
  severities?: AlertSeverity[];
  sources?: AlertSource[];
  patientId?: string;
  disposition?: AlertDisposition;
}

export function matchesFilter(alert: ClinicalAlert, filter: ClinicalAlertFilter): boolean {
  if (filter.categories && !filter.categories.includes(alert.category)) return false;
  if (filter.severities && !filter.severities.includes(alert.severity)) return false;
  if (filter.sources && !filter.sources.includes(alert.source)) return false;
  if (filter.patientId && alert.patientId !== filter.patientId) return false;
  if (filter.disposition && alert.disposition !== filter.disposition) return false;
  return true;
}

export function severityWeight(s: AlertSeverity): number {
  switch (s) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
  }
}

export function sortAlertsByPriority(alerts: ClinicalAlert[]): ClinicalAlert[] {
  return [...alerts].sort((a, b) => {
    const sw = severityWeight(b.severity) - severityWeight(a.severity);
    if (sw !== 0) return sw;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export interface ClinicalAlertMetrics {
  totalCreated: number;
  totalDeduplicated: number;
  byDisposition: Record<AlertDisposition, number>;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  criticalVisible: number;
  criticalResolved: number;
  criticalResolutionRatio: number;
}
