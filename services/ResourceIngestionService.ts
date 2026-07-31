import { supabase } from "../utils/supabaseClient";
import { Material, ExternalResource } from "../types";

export class ResourceIngestionService {
    /**
     * Fetches candidate resources from external sources.
     * Currently uses a mock implementation.
     */
    static async fetchCandidates(): Promise<ExternalResource[]> {
        // Mocking an API call to an external source (e.g. a curated YouTube list or Drive folder)
        // In a real scenario, this would call a backend endpoint that scrapes or calls APIs.
        return [
            {
                id: `ext-${Date.now()}-1`,
                title: "Ejercicios de Articulación - Nivel Inicial",
                description: "Video con ejercicios de praxias linguales y labiales.",
                url: "https://youtube.com/example1",
                source: "YouTube Curated",
                category: "Video",
                tags: ["articulación", "praxias", "niños"],
                status: 'pending',
                created_at: new Date().toISOString()
            },
            {
                id: `ext-${Date.now()}-2`,
                title: "Guía de Deglución Segura",
                description: "Documento con recomendaciones para disfagia leve.",
                url: "https://drive.google.com/example2",
                source: "Google Drive",
                category: "PDF",
                tags: ["deglución", "disfagia", "adultos"],
                status: 'pending',
                created_at: new Date().toISOString()
            }
        ];
    }

    /**
     * Updates a pending candidate's metadata before approval.
     */
    static async updateCandidate(id: string, updates: Partial<ExternalResource>): Promise<void> {
        const { error } = await supabase
            .from('candidate_resources')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    }

    /**
     * Approves a resource: marks candidate as approved and promotes it to the materials library.
     */
    static async approveResource(candidate: ExternalResource): Promise<void> {
        // 1. Create the official Material from the candidate
        const newMaterial: Material = {
            id: crypto.randomUUID(),
            title: candidate.title,
            category: candidate.category,
            type: candidate.category.toLowerCase() === 'video' ? 'video' : 
                  candidate.category.toLowerCase() === 'pdf' ? 'pdf' : 'image',
            format: candidate.category,
            verified: true,
            clinical_area: candidate.tags[0], 
            tags: candidate.tags,
            url: candidate.url
        };

        // 2. Insert into materials table
        const { error: matError } = await supabase
            .from('materials')
            .insert([newMaterial]);

        if (matError) throw matError;

        // 3. Mark candidate as approved
        const { error: statusError } = await supabase
            .from('candidate_resources')
            .update({ status: 'approved' })
            .eq('id', candidate.id);

        if (statusError) throw statusError;
    }

    /**
     * Rejects a resource, removing it from the review queue.
     */
    static async rejectResource(id: string): Promise<void> {
        const { error } = await supabase
            .from('candidate_resources')
            .update({ status: 'rejected' })
            .eq('id', id);

        if (error) throw error;
    }

    /**
     * Retrieves all pending candidates for the review tray.
     */
    static async getPendingCandidates(): Promise<ExternalResource[]> {
        const { data, error } = await supabase
            .from('candidate_resources')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }
}
