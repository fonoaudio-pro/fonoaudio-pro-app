import { SessionLogEntry, ResponseSource } from '../types/notebooklm';

const LOG_KEY = 'fonoaudio_session_log';
const MAX_ENTRIES = 100;

export class SessionLogService {
  static log(entry: Omit<SessionLogEntry, 'id' | 'timestamp'>): SessionLogEntry {
    const fullEntry: SessionLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    };

    try {
      const existing = this.getAll();
      const updated = [fullEntry, ...existing].slice(0, MAX_ENTRIES);
      localStorage.setItem(LOG_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('[SessionLog] Error saving:', e);
    }

    console.log('[SessionLog]', {
      patient: fullEntry.patientName,
      sources: fullEntry.sources.map(s => s.label),
      confidence: fullEntry.confidence,
    });

    return fullEntry;
  }

  static getAll(): SessionLogEntry[] {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static getForPatient(patientId: string): SessionLogEntry[] {
    return this.getAll().filter(e => e.patientId === patientId);
  }

  static getRecentCount(minutes: number = 30): number {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.getAll().filter(e => new Date(e.timestamp).getTime() > cutoff).length;
  }

  static clear(): void {
    localStorage.removeItem(LOG_KEY);
  }
}

export function detectSources(params: {
  hasPatientContext: boolean;
  hasNotebookLM: boolean;
  hasAlerts: boolean;
  hasEvolution: boolean;
  queryMentionsPatient: boolean;
}): ResponseSource[] {
  const sources: ResponseSource[] = [];

  if (params.hasPatientContext && params.queryMentionsPatient) {
    sources.push({
      layer: 'patient_context',
      label: 'Contexto del Paciente',
      detail: 'Datos longitudinales del paciente seleccionado',
    });
  }

  if (params.hasNotebookLM) {
    sources.push({
      layer: 'notebook_lm',
      label: 'Base Científica',
      detail: 'Guías de práctica clínica y evidencia científica',
    });
  }

  if (params.hasAlerts) {
    sources.push({
      layer: 'clinical_alert',
      label: 'Alerta Clínica',
      detail: 'Alertas activas del ClinicalAlertBus',
    });
  }

  if (params.hasEvolution) {
    sources.push({
      layer: 'evolution',
      label: 'Evolución',
      detail: 'Registros de evolución clínica',
    });
  }

  if (sources.length === 0) {
    sources.push({
      layer: 'general',
      label: 'Conocimiento General',
      detail: 'Respuesta basada en conocimiento general del asistente',
    });
  }

  return sources;
}
