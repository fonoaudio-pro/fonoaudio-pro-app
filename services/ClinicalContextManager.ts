import { ClinicalContext, ClinicalTask, ConversationMessage, FollowUpHealth, FollowUpType, FollowUpSeverity } from "../types";
import followUpService from './followUpService';
import { supabase } from '../utils/supabaseClient';

type Listener = (context: ClinicalContext) => void;

class ClinicalContextManager {
    private context: ClinicalContext = {
        activePatientId: null,
        activeSessionId: null,
        activeGuideId: null,
        currentView: 'dashboard',
        recentMaterials: [],
        currentTask: 'idle',
        conversationHistory: [],
    };
    private listeners: Set<Listener> = new Set();

    private notify(): void {
        const snapshot = this.getSnapshot();
        this.listeners.forEach(listener => listener(snapshot));
    }

    public getSnapshot(): ClinicalContext {
        return { ...this.context };
    }

    public subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        listener({ ...this.context });
        return () => this.listeners.delete(listener);
    }

    public updateContext(updates: Partial<ClinicalContext>): void {
        this.context = { ...this.context, ...updates };
        this.notify();
    }

    public async setPatient(patientId: string | null, sessionId: string | null = null): Promise<void> {
        this.context.activePatientId = patientId;
        this.context.activeSessionId = sessionId;
        this.context.activePatientSummary = null;
        this.context.activeSessionSummary = null;
        this.context.followUpHealth = undefined;
        if (!patientId) {
            this.context.activeGuideId = null;
        }
        this.notify();

        if (patientId) {
            try {
                const health = await followUpService.getFollowUpHealth(patientId);
                this.setFollowUpHealth(health);
                if (health.clinicalSignals) {
                    this.context.proactiveClinicalSuggestions = health.clinicalSignals;
                }
                // Check for missing data alerts
                await this.checkMissingDataAlerts(patientId, health);
            } catch (error) {
                console.error('[ClinicalContextManager] Error fetching follow-up health:', error);
            }
        }
    }

    /** Check for missing required clinical data fields and generate follow-up alerts */
    private async checkMissingDataAlerts(patientId: string, health: FollowUpHealth): Promise<void> {
        try {
            const { data: crData } = await supabase
                .from('clinical_records')
                .select('chief_complaint, primary_diagnosis_name, affected_areas, personal_history, family_history, medical_history, developmental_history')
                .eq('patient_id', patientId)
                .maybeSingle();

            if (!crData) return;

            const missing: string[] = [];

            // Check required fields
            if (!crData.chief_complaint || crData.chief_complaint.trim() === '') {
                missing.push('Motivo de consulta (chief_complaint)');
            }
            if (!crData.primary_diagnosis_name || crData.primary_diagnosis_name.trim() === '') {
                missing.push('Diagnóstico principal');
            }
            if (!crData.affected_areas || !Array.isArray(crData.affected_areas) || crData.affected_areas.filter((a: any) => a && a.affected).length === 0) {
                missing.push('Áreas afectadas');
            }
            if (!crData.personal_history || Object.keys(crData.personal_history).length === 0) {
                missing.push('Historia personal');
            }
            if (!crData.family_history || Object.keys(crData.family_history).length === 0) {
                missing.push('Historia familiar');
            }
            if (!crData.medical_history || Object.keys(crData.medical_history).length === 0) {
                missing.push('Historia médica');
            }
            if (!crData.developmental_history || Object.keys(crData.developmental_history).length === 0) {
                missing.push('Historia del desarrollo');
            }

            // Add alerts if there are missing required fields
            if (missing.length > 0) {
                for (const field of missing) {
                    const identifier = `dato_faltante_${field.replace(/ /g, '_')}`;
                    const reasonHash = this._generateReasonHash('FOLLOW_UP_NEEDED', identifier);

                    // Check if there's already an alert for this
                    const existingAlert = health.alerts?.find((a: any) => a.reason === `Falta de dato: ${field}`);
                    if (existingAlert) continue; // Already has alert

                    // Add the alert to health
                    health.alerts = health.alerts || [];
                    // Avoid duplicates
                    const alreadyExists = health.alerts.some((a: any) => a.reason === `Falta de dato: ${field}`);
                    if (!alreadyExists) {
                        health.alerts.push({
                            type: 'FOLLOW_UP_NEEDED' as FollowUpType,
                            severity: 'medium' as FollowUpSeverity,
                            reason: `Falta de dato clínico requerido: ${field}`,
                            suggestedAction: 'Completar el campo antes de aprobar la historia clínica',
                            reasonHash,
                            detectedAt: new Date().toISOString(),
                        });
                    }
                }
                // Notify listeners about the update
                this.notify();
            }
        } catch (e) {
            console.error('[ClinicalContextManager] Error checking missing data:', e);
        }
    }

    private _generateReasonHash(type: FollowUpType, identifier: string): string {
        const base = `${type}|${identifier}`;
        return btoa(base).replace(/=/g, '');
    }

    public setPatientSummary(summary: ClinicalContext['activePatientSummary']): void {
        this.context.activePatientSummary = summary;
        this.notify();
    }

    public setSessionSummary(summary: ClinicalContext['activeSessionSummary']): void {
        this.context.activeSessionSummary = summary;
        this.notify();
    }

    public setFollowUpHealth(health: FollowUpHealth): void {
        this.context.followUpHealth = health;
        this.notify();
    }

    public setGuide(guideId: string | null): void {
        this.context.activeGuideId = guideId;
        this.notify();
    }

    public setView(view: string): void {
        this.context.currentView = view;
        this.notify();
    }

    public setTask(task: ClinicalTask): void {
        this.context.currentTask = task;
        this.notify();
    }

    public addRecentMaterial(materialId: string): void {
        const newMaterials = [materialId, ...this.context.recentMaterials.filter(id => id !== materialId)].slice(0, 5);
        this.context.recentMaterials = newMaterials;
        this.notify();
    }

    public addMessage(message: ConversationMessage): void {
        const newHistory = [...this.context.conversationHistory, message];
        if (newHistory.length > 10) {
            newHistory.shift();
        }
        this.context = { ...this.context, conversationHistory: newHistory };
        this.notify();
    }

    public getHistory(): ConversationMessage[] {
        return [...this.context.conversationHistory];
    }

    public getClinicalContextPacket(): string {
        const {
            activePatientSummary,
            activeSessionSummary,
            currentTask,
            recentMaterials,
            activeGuideId,
            followUpHealth,
            proactiveClinicalSuggestions
        } = this.context;

        let packet = `[CONTEXTO CLÍNICO ACTUAL]\n`;
        if (activePatientSummary) {
            packet += `- Paciente: ${activePatientSummary.name} (${activePatientSummary.age} años)\n`;
            packet += `- Diagnóstico: ${activePatientSummary.diagnosis}\n`;
            if (activePatientSummary.primaryDiagnosis) {
                packet += `- Diagnóstico Clínico: ${activePatientSummary.primaryDiagnosis}\n`;
            }
            if (activePatientSummary.chiefComplaint) {
                packet += `- Motivo de Consulta: ${activePatientSummary.chiefComplaint}\n`;
            }
            if (activePatientSummary.affectedAreas && activePatientSummary.affectedAreas.length > 0) {
                packet += `- Áreas Afectadas: ${activePatientSummary.affectedAreas.join(', ')}\n`;
            }
            if (activePatientSummary.alerts && activePatientSummary.alerts.length > 0) {
                packet += `- Alertas: ${activePatientSummary.alerts.join(', ')}\n`;
            }
            if (activePatientSummary.interests && activePatientSummary.interests.length > 0) {
                packet += `- Intereses: ${activePatientSummary.interests.join(', ')}\n`;
            }
        }
        if (activeSessionSummary) {
            packet += `- Última Sesión: ${activeSessionSummary.date}, Resumen: ${activeSessionSummary.summary}\n`;
        }
        packet += `- Tarea Actual: ${currentTask}\n`;
        if (activeGuideId) {
            packet += `- Guía Activa ID: ${activeGuideId}\n`;
        }
        if (recentMaterials.length > 0) {
            packet += `- Materiales Recientes: ${recentMaterials.join(', ')}\n`;
        }
        if (followUpHealth && followUpHealth.alerts && followUpHealth.alerts.length > 0) {
            packet += `\n[ALERTAS DE SEGUIMIENTO]\n`;
            followUpHealth.alerts.forEach(alert => {
                packet += `- ${alert.type} (${alert.severity}): ${alert.reason}. Acción sugerida: ${alert.suggestedAction}\n`;
            });
        }
        if (proactiveClinicalSuggestions && proactiveClinicalSuggestions.length > 0) {
            packet += `\n[SUGERENCIAS CLÍNICAS PROACTIVAS]\n`;
            proactiveClinicalSuggestions.forEach(suggestion => {
                packet += `- ${suggestion.signal} (${suggestion.severity}): ${suggestion.reason}. Acción sugerida: ${suggestion.suggestedAction}\n`;
            });
        }
        return packet;
    }

    public reset(): void {
        this.context = {
            activePatientId: null,
            activeSessionId: null,
            activeGuideId: null,
            currentView: 'dashboard',
            recentMaterials: [],
            currentTask: 'idle',
            conversationHistory: [],
            proactiveClinicalSuggestions: [],
        };
        this.notify();
    }
}

export const clinicalContextManager = new ClinicalContextManager();