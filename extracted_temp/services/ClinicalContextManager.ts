import { ClinicalContext, ClinicalTask, ConversationMessage, FollowUpHealth } from "../types";
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
            } catch (error) {
                console.error('[ClinicalContextManager] Error fetching follow-up health:', error);
            }

            // Fetch clinical record for enriched context
            try {
                const { data: crData } = await supabase
                    .from('clinical_records')
                    .select('chief_complaint, primary_diagnosis_name, affected_areas')
                    .eq('patient_id', patientId)
                    .maybeSingle();

                if (crData) {
                    const affected = crData.affected_areas?.filter((a: any) => a.affected).map((a: any) => a.name) || [];
                    this.context.activePatientSummary = {
                        ...this.context.activePatientSummary,
                        chiefComplaint: crData.chief_complaint || undefined,
                        affectedAreas: affected.length > 0 ? affected : undefined,
                        primaryDiagnosis: crData.primary_diagnosis_name || undefined,
                    } as any;
                    this.notify();
                }
            } catch {
                // clinical_records table may not exist yet
            }
        }
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
        this.context.conversationHistory.push(message);
        if (this.context.conversationHistory.length > 10) {
            this.context.conversationHistory.shift();
        }
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
            if (activePatientSummary.alerts.length > 0) {
                packet += `- Alertas: ${activePatientSummary.alerts.join(', ')}\n`;
            }
            if (activePatientSummary.interests.length > 0) {
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

        if (followUpHealth && followUpHealth.alerts.length > 0) {
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
            proactiveClinicalSuggestions: []
        };
        this.notify();
    }
}

export const clinicalContextManager = new ClinicalContextManager();
