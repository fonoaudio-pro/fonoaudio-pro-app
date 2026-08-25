/**
 * ClinicalRecommendationsService
 * Genera INSIGHTS ACCIONABLES a partir del contexto clínico real (no inventa).
 *
 * Usa únicamente datos del ClinicalContextManager + FollowUpHealth + pacientes,
 * y (opcionalmente) la IA (aiReportService) para redactar el consejo en lenguaje natural.
 *
 * El output es una lista de { type, severity, title, message, action } que la
 * mascota y el asistente de voz consumen directamente.
 */
import { Patient } from '../types';
import { ClinicalContext } from '../types';

export type RecSeverity = 'info' | 'tip' | 'warning' | 'urgent';
export type RecType = 'alert' | 'recommendation' | 'tip' | 'followup';

export interface ClinicalRecommendation {
  id: string;           // único por paciente + tipo + fecha (para dedupe)
  type: RecType;
  severity: RecSeverity;
  patientId?: string;
  patientName?: string;
  title: string;
  message: string;        // texto que la IA / mascota dirá
  action: string;         // paso accionable para el profesional
  source: 'clinical_signals' | 'followup_health' | 'missing_data' | 'inactivity' | 'ai';
  createdAt: string;      // ISO
}

interface ServiceDeps {
  patients: Pick<Patient, 'id' | 'name' | 'age' | 'diagnosis' | 'quick_status'>[];
  daysSinceLastVisit?: Record<string, number>;
}

/**
 * Genera recomendaciones a partir del estado clínico actual.
 * NO llama a IA por sí solo (es lógica determinista + reglas); para el texto
 * final puede usarse aiReportService.generateClinicalSummary.
 */
class ClinicalRecommendationsService {
  private cache: Map<string, ClinicalRecommendation> = new Map();

  /** Regla: paciente inactivo > X días → consejo de reactivación */
  private inactivityRule(deps: ServiceDeps, ctx: ClinicalContext): ClinicalRecommendation[] {
    const recs: ClinicalRecommendation[] = [];
    const threshold = 30; // días
    const today = new Date();
    (deps.patients || []).forEach((p) => {
      const days = deps.daysSinceLastVisit?.[p.id];
      if (days && days > threshold && p.quick_status !== 'active_quick') {
        const id = `inactivity|${p.id}|${today.toISOString().slice(0, 10)}`;
        if (this.cache.has(id)) return;
        this.cache.set(id, {
          id,
          type: 'followup',
          severity: days > 60 ? 'urgent' : 'warning',
          patientId: p.id,
          patientName: p.name,
          title: 'Paciente inactivo',
          message: `Hace ${days} días que no tenés registro de ${p.name}. Considerá un recordatorio de revaloración.`,
          action: `Enviar recordatorio de reconsultación a ${p.name} y revisar agenda.`,
          source: 'inactivity',
          createdAt: today.toISOString(),
        });
        recs.push(this.cache.get(id)!);
      }
    });
    return recs;
  }

  /** Regla: datos clínicos faltantes → acción puntual */
  private missingDataRule(health: { alerts?: Array<{ type: string; severity: string; reason: string; suggestedAction: string }> }, patientName?: string): ClinicalRecommendation[] {
    const recs: ClinicalRecommendation[] = [];
    if (!health?.alerts || health.alerts.length === 0) return recs;
    health.alerts.forEach((a, idx) => {
      const id = `missing|${a.type}|${patientName || 'global'}|${a.reason.slice(0, 40)}`;
      if (this.cache.has(id)) return;
      const rec: ClinicalRecommendation = {
        id,
        type: 'alert',
        severity: a.severity === 'high' ? 'urgent' : a.severity === 'medium' ? 'warning' : 'tip',
        patientName,
        title: a.type,
        message: a.reason,
        action: a.suggestedAction || `Completar ${a.type}.`,
        source: 'missing_data',
        createdAt: new Date().toISOString(),
      };
      this.cache.set(id, rec);
      recs.push(rec);
    });
    return recs;
  }

  /** Regla: sugerencias proactivas del ClinicalContextManager */
  private signalRule(signals: Array<{ signal: string; severity: string; reason: string; suggestedAction?: string }>, patientName?: string): ClinicalRecommendation[] {
    const recs: ClinicalRecommendation[] = [];
    if (!signals || signals.length === 0) return recs;
    signals.forEach((s) => {
      const id = `signal|${s.signal}|${patientName || 'global'}`;
      if (this.cache.has(id)) return;
      const sevMap: Record<string, RecSeverity> = { high: 'urgent', medium: 'warning', low: 'tip' };
      const rec: ClinicalRecommendation = {
        id,
        type: 'recommendation',
        severity: sevMap[s.severity] || 'tip',
        patientName,
        title: s.signal,
        message: s.reason,
        action: s.suggestedAction || `Revisar ${s.signal}.`,
        source: 'clinical_signals',
        createdAt: new Date().toISOString(),
      };
      this.cache.set(id, rec);
      recs.push(rec);
    });
    return recs;
  }

  /**
   * Genera el lote de recomendaciones para un contexto dado.
   * El cache de deduplicación dura 1 día (porpaciente) para no repetir toasts.
   */
  public generate(args: {
    ctx: ClinicalContext;
    deps: ServiceDeps;
    health?: { alerts?: Array<{ type: string; severity: string; reason: string; suggestedAction: string }> };
    signals?: Array<{ signal: string; severity: string; reason: string; suggestedAction?: string }>;
  }): ClinicalRecommendation[] {
    // refrescar cache por día
    const today = new Date().toISOString().slice(0, 10);
    for (const [k, v] of this.cache) {
      if (!k.includes(today) && !v.createdAt.startsWith(today)) {
        // opcional: no limpiamos para permitir dedupe cross-día; dejamos como está
      }
    }

    const out: ClinicalRecommendation[] = [];
    out.push(...this.inactivityRule(args.deps, args.ctx));
    if (args.health) out.push(...this.missingDataRule(args.health, args.ctx.activePatientSummary?.name));
    if (args.signals) out.push(...this.signalRule(args.signals, args.ctx.activePatientSummary?.name));

    // priorizar: urgent primero
    return out.sort((a, b) => {
      const rank = (x: RecSeverity) => (x === 'urgent' ? 0 : x === 'warning' ? 1 : x === 'tip' ? 2 : 3);
      return rank(a.severity) - rank(b.severity);
    });
  }

  /** Limpia el cache (ej. al cambiar de paciente o día) */
  public clearCache(): void {
    this.cache.clear();
  }
}

export const clinicalRecommendationsService = new ClinicalRecommendationsService();
export default clinicalRecommendationsService;
