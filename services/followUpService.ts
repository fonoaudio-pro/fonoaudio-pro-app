import { FollowUpHealth, FollowUpAlert, FollowUpType, FollowUpSeverity, FollowUpDecisionStatus, ClinicalSuggestionEvent } from '../types';
import { supabase as defaultSupabase } from '../utils/supabaseClient';

export class FollowUpService {
    private supabase: any = null;

    async _getSupabase() {
        if (!this.supabase) {
            this.supabase = defaultSupabase;
        }
        return this.supabase;
    }

    private _generateReasonHash(type: FollowUpType, identifier: string): string {
        // We use a stable identifier based on type and cause to ensure that
        // decisions (ignored, snoozed, resolved) can be applied to subsequent
        // occurrences of the same clinical issue.
        const base = `${type}|${identifier}`;
        // Simple hash-like string for the purpose of this implementation
        return btoa(base).replace(/=/g, '');
    }

    /**
     * Analyzes distribution logs and clinical sessions to generate actionable follow-up alerts.
     * Filters out alerts that have been ignored, snoozed, or resolved.
     */
    async getFollowUpHealth(patientId: string): Promise<FollowUpHealth> {
        const supabase = await this._getSupabase();
        const alerts: FollowUpAlert[] = [];
        let lastSuccessfulDelivery: string | undefined;

        // 1. Fetch logs and sessions in parallel
        let logs: any[] = [];
        let sessions: any[] = [];
        let decisions: any[] = [];

        try {
            const [logsRes, sessionsRes, decisionsRes] = await Promise.all([
                supabase
                    .from('distribution_logs')
                    .select('*')
                    .eq('patient_id', patientId)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('sessions')
                    .select('date, summary')
                    .eq('patient_id', patientId)
                    .order('date', { ascending: false })
                    .limit(5),
                supabase
                    .from('follow_up_decisions')
                    .select('reason_hash, status, snoozed_until, resolved_at')
                    .eq('patient_id', patientId)
            ]);

            if (!logsRes.error) logs = logsRes.data || [];
            if (!sessionsRes.error) sessions = sessionsRes.data || [];
            if (!decisionsRes.error) decisions = decisionsRes.data || [];
        } catch {
            // Tables may not exist yet - return empty health
            return { lastSuccessfulDelivery: undefined, alerts: [], clinicalSignals: [] };
        }

        // 2. Calculate last successful delivery
        const lastSentLog = logs.find(l => l.status === 'sent');
        if (lastSentLog) {
            lastSuccessfulDelivery = lastSentLog.created_at;
        }

        // 3. Detect REPEATED_FAILURE
        const failures: Record<string, { count: number; lastDate: string }> = {};
        logs.filter(l => l.status === 'failed').forEach(l => {
            const key = `${l.material_title}|${l.medium}`;
            if (!failures[key]) {
                failures[key] = { count: 0, lastDate: l.created_at };
            }
            failures[key].count++;
            if (new Date(l.created_at) > new Date(failures[key].lastDate)) {
                failures[key].lastDate = l.created_at;
            }
        });

        for (const [key, data] of Object.entries(failures)) {
            if (data.count >= 3) {
                const lastFailureDate = new Date(data.lastDate);
                const hoursSinceLastFailure = (new Date().getTime() - lastFailureDate.getTime()) / (1000 * 60 * 60);
                
                if (hoursSinceLastFailure > 6) {
                    const type = 'REPEATED_FAILURE' as FollowUpType;
                    const identifier = key.replace('|', ' vía ');
                    const reasonHash = this._generateReasonHash(type, identifier);

                    // Check if this specific alert is suppressed by a decision
                    const decision = decisions.find(d => d.reason_hash === reasonHash);
                    if (this._shouldShowAlert(decision, data.lastDate)) {
                        alerts.push({
                            type,
                            severity: 'high',
                            reason: `Múltiples fallos detectados en el envío de: ${identifier}`,
                            suggestedAction: 'Cambiar el medio de envío o verificar datos del contacto.',
                            reasonHash,
                            cooldownUntil: this._calculateCooldown(lastFailureDate),
                            detectedAt: data.lastDate
                        });
                    }
                }
            }
        }

        // 4. Detect CLINICAL_TREND and PROACTIVE_SUGGESTIONS
        const clinicalSignals = this._analyzeClinicalSignals(sessions, decisions);
        
        // Separate logistics from clinical signals
        const logisticsAlerts = alerts.filter(a => a.type !== 'CLINICAL_TREND' && a.type !== 'PROACTIVE_SUGGESTION');

        return {
            lastSuccessfulDelivery,
            alerts: logisticsAlerts.slice(0, 5),
            clinicalSignals: clinicalSignals.slice(0, 5)
        };
    }

    /**
     * Analyzes session summaries to detect clinical trends and proactive suggestions.
     * Uses rule-based approach for auditability.
     * @param sessions Array of patient sessions
     * @param decisions Array of previous follow-up decisions
     */
    private _analyzeClinicalSignals(sessions: any[], decisions: any[]): FollowUpAlert[] {
        const clinicalAlerts: FollowUpAlert[] = [];
        if (sessions.length === 0) return clinicalAlerts;

        const recentSummaries = sessions.map(s => s.summary?.toLowerCase() || '');

        // --- Rule 1: Detect Trend in Phonetic Difficulties (CLINICAL_TREND) ---
        const phoneticKeywords = ['fonema', 'articulación', 'pronunciación', 'dislalia'];
        const phoneticMentions = recentSummaries.filter(summary => 
            phoneticKeywords.some(kw => summary.includes(kw))
        ).length;

        if (phoneticMentions >= 2) {
            const identifier = 'Tendencia en dificultades de articulación';
            const reasonHash = this._generateReasonHash('CLINICAL_TREND', identifier);
            const decision = decisions.find(d => d.reason_hash === reasonHash);
            
            if (this._shouldShowAlert(decision, sessions[0].date)) {
                clinicalAlerts.push({
                    type: 'CLINICAL_TREND',
                    severity: 'medium',
                    signal: 'Dificultad fonética persistente',
                    reason: 'Se han observado menciones a dificultades de articulación en las últimas sesiones.',
                    evidenceSummary: `Mencionado en ${phoneticMentions} de las últimas ${sessions.length} sesiones.`,
                    suggestedAction: 'Evaluar si es necesario ajustar el plan de tratamiento o reforzar materiales de fonética.',
                    reasonHash,
                    confidence: 0.8,
                    detectedAt: sessions[0].date,
                    cooldownUntil: this._calculateCooldown(new Date(sessions[0].date))
                });
            }
        }

        // --- Rule 2: Proactive Suggestion for Material Reinforcement (PROACTIVE_SUGGESTION) ---
        // If a session summary mentions "evolución positiva" or "buen progreso", suggest a harder material.
        const positiveProgressKeywords = ['buen progreso', 'evolución positiva', 'mejoría'];
        const hasPositiveProgress = recentSummaries.some(summary => 
            positiveProgressKeywords.some(kw => summary.includes(kw))
        );

        if (hasPositiveProgress) {
            const identifier = 'Progreso positivo detectado';
            const reasonHash = this._generateReasonHash('PROACTIVE_SUGGESTION', identifier);
            const decision = decisions.find(d => d.reason_hash === reasonHash);

            if (this._shouldShowAlert(decision, sessions[0].date)) {
                clinicalAlerts.push({
                    type: 'PROACTIVE_SUGGESTION',
                    severity: 'low',
                    signal: 'Oportunidad de escalada de dificultad',
                    reason: 'El paciente muestra progreso positivo en las últimas sesiones.',
                    evidenceSummary: 'Resúmenes de sesión indican mejoría en el desempeño.',
                    suggestedAction: 'Considerar la introducción de materiales con un nivel de dificultad ligeramente superior.',
                    reasonHash,
                    confidence: 0.7,
                    detectedAt: sessions[0].date,
                    cooldownUntil: this._calculateCooldown(new Date(sessions[0].date))
                });
            }
        }

        return clinicalAlerts;
    }

    /**
     * Records a clinical decision regarding a specific follow-up alert.
     * Also logs the action for auditing.
     */
    async recordDecision(patientId: string, decision: { 
        reasonHash: string, 
        status: FollowUpDecisionStatus, 
        snoozedUntil?: string, 
        resolvedAt?: string, 
        notes?: string,
        createdAt?: string 
    }): Promise<{ status: 'ok' } | { status: 'error', message: string }> {
        const supabase = await this._getSupabase();
        const now = new Date().toISOString();

        try {
            // 1. Upsert the decision
            const { error: decisionError } = await supabase
                .from('follow_up_decisions')
                .upsert({
                    patient_id: patientId,
                    reason_hash: decision.reasonHash,
                    status: decision.status,
                    snoozed_until: decision.snoozedUntil,
                    resolved_at: decision.status === 'resolved' ? (decision.resolvedAt || now) : null,
                    updated_at: now,
                    created_at: decision.createdAt || now,
                }, { onConflict: 'patient_id, reason_hash' });

            if (decisionError) throw decisionError;

            // 2. Log to audit trail
            const { error: auditError } = await supabase
                .from('follow_up_audit_log')
                .insert({
                    patient_id: patientId,
                    reason_hash: decision.reasonHash,
                    action: decision.status,
                    notes: decision.notes || '',
                    created_at: now
                });

            if (auditError) {
                console.warn('[FollowUpService] Decision recorded but audit log failed:', auditError);
            }

            return { status: 'ok' };
        } catch (error: any) {
            console.error('[FollowUpService] Error recording decision:', error);
            return { status: 'error', message: error.message };
        }
    }

    async logSuggestionEvent(event: ClinicalSuggestionEvent): Promise<{ status: 'ok' } | { status: 'error', message: string }> {
        const supabase = await this._getSupabase();
        try {
            const { error } = await supabase.from('clinical_suggestion_events').insert([event]);
            if (error) throw error;
            return { status: 'ok' };
        } catch (error: any) {
            console.error('[FollowUpService] Error logging suggestion event:', error);
            return { status: 'error', message: error.message };
        }
    }

    async getSuggestionMetrics() {
        const supabase = await this._getSupabase();
        try {
            const { data, error } = await supabase
                .from('clinical_suggestion_events')
                .select('*');

            if (error) throw error;
            if (!data) return { rules: [], severity: [], totals: {} };

            const rulesMap: Record<string, any> = {};
            const severityMap: Record<string, any> = {};
            const totals: Record<string, number> = { shown: 0, applied: 0, snoozed: 0, ignored: 0 };

            data.forEach(event => {
                // Totals
                if (totals[event.eventType as keyof typeof totals] !== undefined) {
                    totals[event.eventType as keyof typeof totals]++;
                }

                // Rules
                if (!rulesMap[event.reasonHash]) {
                    rulesMap[event.reasonHash] = {
                        type: event.suggestionType,
                        signal: event.signal,
                        shown: 0,
                        applied: 0,
                        snoozed: 0,
                        ignored: 0
                    };
                }
                rulesMap[event.reasonHash][event.eventType]++;

                // Severity
                if (!severityMap[event.severity]) {
                    severityMap[event.severity] = { shown: 0, applied: 0 };
                }
                severityMap[event.severity].shown++;
                if (event.eventType === 'applied') {
                    severityMap[event.severity].applied++;
                }
            });

            // Calculate CTRs
            const rules = Object.entries(rulesMap).map(([hash, data]: [string, any]) => ({
                hash,
                ...data,
                ctr: data.shown > 0 ? data.applied / data.shown : 0
            }));

            const severity = Object.entries(severityMap).map(([sev, data]: [string, any]) => ({
                severity: sev,
                ...data,
                acceptanceRate: data.shown > 0 ? data.applied / data.shown : 0
            }));

            return { rules, severity, totals };
        } catch (error: any) {
            console.error('[FollowUpService] Error fetching suggestion metrics:', error);
            throw error;
        }
    }

    private _shouldShowAlert(decision: any, eventTimestamp: string): boolean {
        if (!decision) return true;

        if (decision.status === 'ignored') return false;
        
        if (decision.status === 'snoozed' && decision.snoozed_until) {
            return new Date() > new Date(decision.snoozed_until);
        }

        if (decision.status === 'resolved') {
            // If the event happened AFTER the resolution, it's a new occurrence.
            if (decision.resolved_at && new Date(eventTimestamp) > new Date(decision.resolved_at)) {
                return true;
            }
            return false;
        }

        return true;
    }

    private _calculateCooldown(lastEventDate: Date): string | undefined {
        const cooldown = new Date(lastEventDate.getTime() + (24 * 60 * 60 * 1000));
        return cooldown.toISOString();
    }

    /**
     * Detects patients whose clinical record (ficha) is missing required fields.
     * Returns a worklist entry per patient with one FOLLOW_UP_NEEDED alert per missing field,
     * so the "Seguimiento" section surfaces incomplete fichas like a real secretary would.
     */
    async getPatientsWithMissingData(): Promise<{ patientId: string; patientName: string; alerts: FollowUpAlert[] }[]> {
        const supabase = await this._getSupabase();

        // 1. Fetch all patients (id + name)
        const { data: patients, error: patErr } = await supabase
            .from('patients')
            .select('id, name');
        if (patErr) throw patErr;
        if (!patients || patients.length === 0) return [];

        const patientNameById: Record<string, string> = {};
        patients.forEach((p: any) => { patientNameById[p.id] = p.name; });

        // 2. Fetch all clinical_records in one shot (efficient bulk query)
        const { data: records, error: recErr } = await supabase
            .from('clinical_records')
            .select('patient_id, chief_complaint, primary_diagnosis_name, affected_areas, personal_history, family_history, medical_history, developmental_history');
        if (recErr) throw recErr;

        const recordByPatient: Record<string, any> = {};
        (records || []).forEach((r: any) => { recordByPatient[r.patient_id] = r; });

        const results: { patientId: string; patientName: string; alerts: FollowUpAlert[] }[] = [];

        for (const p of patients) {
            const cr = recordByPatient[p.id];
            const missing: string[] = [];

            if (!cr) {
                // No ficha at all — highest priority gap
                missing.push('Ficha clínica sin crear');
            } else {
                if (!cr.chief_complaint || String(cr.chief_complaint).trim() === '') {
                    missing.push('Motivo de consulta (chief_complaint)');
                }
                if (!cr.primary_diagnosis_name || String(cr.primary_diagnosis_name).trim() === '') {
                    missing.push('Diagnóstico principal');
                }
                if (!cr.affected_areas || !Array.isArray(cr.affected_areas) || cr.affected_areas.filter((a: any) => a && a.affected).length === 0) {
                    missing.push('Áreas afectadas');
                }
                if (!cr.personal_history || Object.keys(cr.personal_history).length === 0) {
                    missing.push('Historia personal');
                }
                if (!cr.family_history || Object.keys(cr.family_history).length === 0) {
                    missing.push('Historia familiar');
                }
                if (!cr.medical_history || Object.keys(cr.medical_history).length === 0) {
                    missing.push('Historia médica');
                }
                if (!cr.developmental_history || Object.keys(cr.developmental_history).length === 0) {
                    missing.push('Historia del desarrollo');
                }
            }

            if (missing.length > 0) {
                const alerts: FollowUpAlert[] = missing.map((field) => {
                    const identifier = `dato_faltante_${field.replace(/ /g, '_')}`;
                    return {
                        type: 'FOLLOW_UP_NEEDED' as FollowUpType,
                        severity: 'medium' as FollowUpSeverity,
                        reason: `Ficha incompleta — falta: ${field}`,
                        suggestedAction: 'Completar el campo en la Ficha Clínica antes de aprobar la historia.',
                        reasonHash: this._generateReasonHash('FOLLOW_UP_NEEDED', identifier),
                        detectedAt: new Date().toISOString(),
                    };
                });
                results.push({ patientId: p.id, patientName: p.name, alerts });
            }
        }

        return results;
    }
}

export default new FollowUpService();

