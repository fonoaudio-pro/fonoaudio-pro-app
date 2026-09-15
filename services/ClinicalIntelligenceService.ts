import { SessionService } from './SessionService';
import { MaterialService } from './MaterialService';
import { Patient, ProactiveSuggestion, ClinicalTrend, RedFlag } from '../types';
import { supabase } from '../utils/supabaseClient';
import { SwallowingService } from '../src/modules/swallowing/service';

export class ClinicalIntelligenceService {
    private static swallowingService = new SwallowingService();

    /**
     * Generates proactive suggestions for a patient based on upcoming sessions.
     */
    static async getProactiveSuggestions(patientId: string, daysAhead: number = 0): Promise<ProactiveSuggestion[]> {
        const suggestions: ProactiveSuggestion[] = [];
        
        // 1. Get all sessions for this patient, ordered by date descending
        const { data: sessions } = await supabase
            .from('sessions')
            .select('*')
            .eq('patient_id', patientId)
            .order('date', { ascending: false });

        if (!sessions || sessions.length === 0) {
            return [];
        }

        // 2. Determine the target date range
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysAhead);
        const targetDateStr = targetDate.toISOString().split('T')[0];
        
        // We are looking for sessions on the target date
        const targetSessions = sessions.filter(s => s.date === targetDateStr);

        if (targetSessions.length === 0) {
            return [];
        }

        // 3. Analyze patterns from PREVIOUS sessions
        const recentSessions = sessions.slice(0, 3);

        // 4. For each target session, generate a suggestion
        for (const session of targetSessions) {
            // --- RULE 1: Next Action Follow-up ---
            const lastSession = sessions[0]; 
            if (lastSession && lastSession.id !== session.id && lastSession.nextAction) {
                suggestions.push({
                    id: `sug-action-${Date.now()}-${session.id}`,
                    patientId,
                    title: 'Seguir plan de acción',
                    reasoning: `En la última sesión (${lastSession.date}) se indicó: "${lastSession.nextAction}".`,
                    suggestedAction: `Continuar con el plan establecido en la sesión anterior.`,
                    priority: 'medium',
                    createdAt: new Date().toISOString()
                });
            }

            // --- RULE 2: Emerging Pattern (Keyword-based with Negation Detection) ---
            const patterns = [
                { keyword: 'dificultad', area: 'Habla', title: 'Reforzar articulación', reasoning: 'Se han observado dificultades recurrentes en la pronunciación.' },
                { keyword: 'deglución', area: 'Deglución', title: 'Protocolo de deglución', reasoning: 'Se detectaron patrones relacionados con la seguridad en la deglución.' },
                { keyword: 'vocabulario', area: 'Lenguaje', title: 'Ampliación léxica', reasoning: 'Se nota necesidad de trabajar la riqueza del vocabulario.' }
            ];

            let patternFound = false;
            for (const pattern of patterns) {
                // Check if any recent session contains the keyword WITHOUT negation
                const hasPattern = recentSessions.some(s => {
                    const text = ((s.observations || "") + " " + (s.summary || "")).toLowerCase();
                    if (!text.includes(pattern.keyword)) return false;
                    return !this.isNegated(text, pattern.keyword);
                });

                if (hasPattern) {
                    const trend: ClinicalTrend = {
                        id: `trend-${Date.now()}-${session.id}`,
                        patientId,
                        type: 'EMERGING_PATTERN',
                        area: pattern.area,
                        evidence: `Patrón detectado en sesiones recientes (${recentSessions[0].date})`,
                        confidence: 0.7,
                        detectedAt: new Date().toISOString()
                    };

                    const materials = await MaterialService.getAllMaterials();
                    const recommendedMaterial = materials.find(m => 
                        m.clinical_area.toLowerCase() === pattern.area.toLowerCase() || 
                        (m.tags && m.tags.some(t => t.toLowerCase() === pattern.area.toLowerCase()))
                    );

                    suggestions.push({
                        id: `sug-pattern-${Date.now()}-${session.id}`,
                        patientId,
                        trendId: trend.id,
                        title: pattern.title,
                        reasoning: pattern.reasoning,
                        suggestedAction: recommendedMaterial 
                            ? `Utilizar material recomendado: ${recommendedMaterial.title}`
                            : `Realizar actividades enfocadas en ${pattern.area}.`,
                        recommendedMaterialId: recommendedMaterial?.id,
                        priority: 'high',
                        createdAt: new Date().toISOString()
                    });
                    patternFound = true;
                    break; 
                }
            }

            // --- RULE 3: Generic Suggestion if nothing else matches ---
            if (suggestions.length === 0 && !patternFound) {
                suggestions.push({
                    id: `sug-gen-${Date.now()}-${session.id}`,
                    patientId,
                    title: 'Sesión de seguimiento',
                    reasoning: 'Continuación del proceso terapéutico habitual.',
                    suggestedAction: 'Revisar objetivos establecidos en el plan de tratamiento.',
                    priority: 'low',
                    createdAt: new Date().toISOString()
                });
            }
        }

        return suggestions;
    }

    /**
     * Detects if a keyword is preceded by a negation phrase within a short context window.
     */
    private static isNegated(text: string, keyword: string): boolean {
        const index = text.indexOf(keyword);
        if (index === -1) return false;

        const negationIndicators = [
            'no presenta',
            'sin dificultad',
            'niega',
            'sin signos de',
            'no se observa',
            'sin evidencia de',
            'sin problemas de'
        ];

        // Look at the 30 characters before the keyword
        const contextWindow = text.substring(Math.max(0, index - 30), index);
        return negationIndicators.some(indicator => contextWindow.includes(indicator));
    }

    /**
     * Gets all active red flags from all patients (for Dashboard).
     */
    static async getDashboardRedFlags(): Promise<RedFlag[]> {
        const { data: patients } = await supabase.from('patients').select('id, name');
        if (!patients) return [];

        const allRedFlags: RedFlag[] = [];

        for (const patient of patients) {
            // 1. Standard Red Flags (from sessions)
            const { data: patientData } = await supabase
                .from('patients')
                .select('history')
                .eq('id', patient.id)
                .single();

            if (patientData?.history) {
                for (const session of patientData.history) {
                    if (session.observations) {
                        if (Array.isArray(session.observations)) {
                            for (const obs of session.observations) {
                                if (obs.type === 'RED_FLAG') {
                                    allRedFlags.push({
                                        ...obs,
                                        patientId: patient.id
                                    } as RedFlag);
                                }
                            }
                        }
                    }
                }
            }

            // 2. Swallowing Red Flags
            const { data: facts } = await supabase
                .from('clinical_facts')
                .select('*')
                .eq('patient_id', patient.id)
                .eq('category', 'swallowing');

            if (facts) {
                const analysis = await this.swallowingService.analyze(facts);
                if (analysis && analysis.redFlags && Array.isArray(analysis.redFlags)) {
                    analysis.redFlags.forEach(rf => {
                        allRedFlags.push({
                            ...rf,
                            patientId: patient.id
                        });
                    });
                }
            }
        }
        return allRedFlags;
    }

    /**
     * Gets all suggestions for today's sessions across all patients (for Dashboard).
     */
    static async getDashboardSuggestions(): Promise<ProactiveSuggestion[]> {
        const { data: patients } = await supabase.from('patients').select('id');
        if (!patients) return [];

        const allSuggestions: ProactiveSuggestion[] = [];
        await Promise.all(patients.map(async (p) => {
            const suggestions = await this.getProactiveSuggestions(p.id, 0);
            allSuggestions.push(...suggestions);
        }));

        return allSuggestions;
    }
}

export default ClinicalIntelligenceService;

