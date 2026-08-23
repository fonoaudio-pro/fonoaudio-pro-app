import { supabase } from "../utils/supabaseClient";
import { callBackend } from "../utils/apiClient";
import { Patient, Session, HomeGuide } from "../types";
import { MaterialAnalyticsService } from "./MaterialAnalyticsService";

export class SessionService {
    /**
     * Creates a new session for a patient.
     * Ensures the session is properly linked to the patient and has a valid structure.
     */
    static async createSession(patientId: string, sessionData: Partial<Session>): Promise<Session> {
        // 1. Fetch current patient to ensure existence
        const { data: patient, error: fetchError } = await supabase
            .from('patients')
            .select('id')
            .eq('id', patientId)
            .single();

        if (fetchError || !patient) {
            throw new Error(`Patient not found: ${patientId}`);
        }

        const newSession: Session = {
            id: crypto.randomUUID(),
            patientId: patientId,
            date: new Date().toISOString().split('T')[0],
            status: 'draft',
            objectives: '',
            observations: '',
            summary: '',
            planUpdates: '',
            associatedMaterialIds: [],
            nextAction: '',
            ...sessionData
        };

        // 2. Insert into the dedicated sessions table (Primary Source of Truth)
        const { data: { user } } = await supabase.auth.getUser();
        const { error: insertError } = await supabase
            .from('sessions')
            .insert({
                id: newSession.id,
                patient_id: newSession.patientId,
                date: newSession.date,
                summary: newSession.summary,
                observations: newSession.observations,
                next_action: newSession.nextAction,
                status: newSession.status,
                owner_id: user?.id || null,
            });

        if (insertError) {
            console.error('Error inserting session into sessions table:', insertError);
            throw insertError;
        }

        // 3. Also update the patient's history JSON for backward compatibility with some views
        const { data: pData } = await supabase
            .from('patients')
            .select('history')
            .eq('id', patientId)
            .single();

        const updatedHistory = [...(pData?.history || []), newSession];
        await supabase
            .from('patients')
            .update({ history: updatedHistory })
            .eq('id', patientId);

        return newSession;
    }

    /**
     * Retrieves a specific session for a patient.
     */
    static async getSession(patientId: string, sessionId: string): Promise<Session | null> {
        const { data: patient, error } = await supabase
            .from('patients')
            .select('history')
            .eq('id', patientId)
            .single();

        if (error || !patient) {
            return null;
        }

        return (patient.history || []).find(s => s.id === sessionId) || null;
    }

    /**
     * Lists all sessions for a given patient.
     */
    static async getPatientSessions(patientId: string): Promise<Session[]> {
        const { data: patient, error } = await supabase
            .from('patients')
            .select('history')
            .eq('id', patientId)
            .single();

        if (error || !patient) {
            return [];
        }

        return patient.history || [];
    }

    /**
     * Updates an existing session.
     * Ensures data integrity and maintains the link with the patient.
     */
    static async updateSession(patientId: string, sessionId: string, updates: Partial<Session>): Promise<void> {
        // 1. Fetch current patient
        const { data: patient, error: fetchError } = await supabase
            .from('patients')
            .select('id, history')
            .eq('id', patientId)
            .single();

        if (fetchError || !patient) {
            throw new Error(`Patient not found: ${patientId}`);
        }

        const history = patient.history || [];
        const sessionIndex = history.findIndex(s => s.id === sessionId);

        if (sessionIndex === -1) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        // 2. Apply updates and ensure patientId remains consistent
        const updatedSession = {
            ...history[sessionIndex],
            ...updates,
            patientId: patientId // Force consistency
        };

        const updatedHistory = [...history];
        updatedHistory[sessionIndex] = updatedSession;

        const { error: updateError } = await supabase
            .from('patients')
            .update({ history: updatedHistory })
            .eq('id', patientId);

        if (updateError) {
            console.error('Error updating session in Supabase:', updateError);
            throw updateError;
        }
    }

    /**
     * Completes a session and triggers downstream processes (like HomeGuide generation).
     * This follows the current clinical workflow.
     */
    static async completeSession(patientId: string, sessionId: string): Promise<void> {
        // 1. Update session status in both patients.history AND sessions table
        await this.updateSession(patientId, sessionId, { status: 'completed' });

        // Also update the sessions table so session data is queryable for analytics
        const { error: sessionsUpdateError } = await supabase
            .from('sessions')
            .update({ status: 'completed' })
            .eq('id', sessionId);

        if (sessionsUpdateError) {
            console.warn('Could not update sessions table status:', sessionsUpdateError.message);
        }
        
        // 2. Fetch the updated session to get details
        const session = await this.getSession(patientId, sessionId);
        if (!session) {
            throw new Error(`Session not found after completion: ${sessionId}`);
        }

        // 3. Extract and persist clinical facts to the clinical_facts table
        // This ensures analysis panels and red flags are updated
        try {
            const factsResponse = await callBackend('/api/process', {
                task: 'extract_clinical_facts',
                observations: session.observations,
                summary: session.summary,
                patientId: patientId
            });

            if (factsResponse.status === 'ok') {
                const facts = JSON.parse(factsResponse.response);
                if (Array.isArray(facts)) {
                    const factsToInsert = facts.map(f => ({
                        patient_id: patientId,
                        category: f.category || 'general',
                        fact: f.fact,
                        evidence: f.evidence,
                        confidence: f.confidence || 1.0
                    }));
                    await supabase.from('clinical_facts').insert(factsToInsert);
                }
            }
        } catch (err) {
            console.warn('Failed to extract clinical facts after session completion:', err);
        }

        // 3b. Sync session objectives/next-action into the patient's Treatment Plan
        try {
            const { data: tpPatient } = await supabase
                .from('patients')
                .select('treatmentPlan, name')
                .eq('id', patientId)
                .single();
            const existingPlan = (tpPatient?.treatmentPlan || {}) as any;
            const sessionDate = session.date || new Date().toISOString().split('T')[0];
            const objectivesLine = session.objectives?.trim()
                ? `• Objetivos trabajados (${sessionDate}): ${session.objectives.trim()}`
                : '';
            const nextLine = session.nextAction?.trim()
                ? `• Próximo paso (${sessionDate}): ${session.nextAction.trim()}`
                : '';
            const entry = [objectivesLine, nextLine].filter(Boolean).join('\n');
            if (entry) {
                const prevSummary = existingPlan.summary || '';
                const newSummary = prevSummary
                    ? `${prevSummary}\n\n══ SESIÓN ${sessionDate} ══\n${entry}`
                    : `══ SESIÓN ${sessionDate} ══\n${entry}`;
                const updatedPlan = {
                    ...existingPlan,
                    lastUpdate: new Date().toISOString(),
                    summary: newSummary,
                    history: [
                        ...(existingPlan.history || []),
                        { date: sessionDate, text: entry, action: 'session_sync' },
                    ],
                };
                await supabase
                    .from('patients')
                    .update({ treatmentPlan: updatedPlan })
                    .eq('id', patientId);
            }
        } catch (err) {
            console.warn('Failed to sync session into treatment plan:', err);
        }

        // 4. Fetch patient to get context for HomeGuide
        const { data: patient, error: fetchError } = await supabase
            .from('patients')
            .select('*')
            .eq('id', patientId)
            .single();

        if (fetchError || !patient) {
            throw new Error(`Failed to fetch patient context for HomeGuide: ${patientId}`);
        }

        // 5. Trigger HomeGuide draft generation via backend
        try {
            await callBackend('/api/guides/generate-home-guide-draft', {
                patientId: patient.id,
                patientName: patient.name,
                lastSessionSummary: session.summary,
                diagnosis: patient.diagnosis,
                age: patient.age
            });
        } catch (err) {
            console.warn('Failed to trigger HomeGuide generation after session completion:', err);
        }
    }

    static async generateHomeGuideDraft(patient: Patient): Promise<HomeGuide> {
        const res = await callBackend('/api/guides/generate-home-guide-draft', {
            patientId: patient.id,
            patientName: patient.name,
            diagnosis: patient.diagnosis,
            age: patient.age
        });
        if (res.status === 'ok') {
            return res.draft;
        }
        throw new Error(res.message || 'Failed to generate draft');
    }

    static async saveHomeGuide(patient: Patient, guide: HomeGuide): Promise<void> {
        const now = new Date().toISOString();
        
        // 1. Determine if we are creating a new version or a brand new guide
        let newVersion = 1;
        let newId = crypto.randomUUID();
        let shareToken = crypto.randomUUID();

        if (guide.id) {
            const { data: existing } = await supabase
                .from('home_guides')
                .select('version')
                .eq('id', guide.id)
                .single();
            
            if (existing) {
                newVersion = (existing.version || 1) + 1;
                newId = crypto.randomUUID(); // Always a new ID for a new version
                shareToken = crypto.randomUUID(); // New token for new version (revocability)
            }
        }

        const newGuide: HomeGuide = {
            ...guide,
            id: newId,
            version: newVersion,
            share_token: shareToken,
            updated_at: now
        };

        // 2. Insert the new version into home_guides
        const { error: guideError } = await supabase
            .from('home_guides')
            .insert(newGuide);

        if (guideError) {
            console.error('Error inserting new guide version:', guideError);
            throw guideError;
        }

        // 3. Update the patient's current homeGuide reference to the latest version
        const { error: patientError } = await supabase
            .from('patients')
            .update({ homeGuide: newGuide })
            .eq('id', patient.id);

        if (patientError) {
            console.error('Error updating patient current homeGuide reference:', patientError);
            throw patientError;
        }

        // 4. Audit: Record usage of materials in this new guide
        for (const materialId of newGuide.materialIds) {
            await MaterialAnalyticsService.recordEvent({
                material_id: materialId,
                event_type: 'used_in_guide',
                guide_id: newGuide.id,
                event_context: 'manual_add' // Or 'enrichment' if we can track it
            });
        }
    }

    static async getHomeGuideHistory(patientId: string): Promise<HomeGuide[]> {
        const { data, error } = await supabase
            .from('home_guides')
            .select('*')
            .eq('patientId', patientId)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Error fetching home guide history:', error);
            throw error;
        }

        return data || [];
    }

    static async updateHomeGuideStatus(guideId: string, status: 'draft' | 'final' | 'sent', deliveryMethod?: string): Promise<void> {
        const updates: any = { status };
        if (status === 'sent') {
            updates.sent_at = new Date().toISOString();
            updates.delivery_method = deliveryMethod;
        } else {
            updates.sent_at = null;
            updates.delivery_method = null;
        }
        updates.updated_at = new Date().toISOString();

        const { error } = await supabase
            .from('home_guides')
            .update(updates)
            .eq('id', guideId);

        if (error) {
            console.error('Error updating home guide status:', error);
            throw error;
        }
    }
}
