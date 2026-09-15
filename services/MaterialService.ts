import { supabase } from "../utils/supabaseClient";
import { Material, MaterialAnalyticsEvent } from "../types";
import { MaterialAnalyticsService } from "./MaterialAnalyticsService";

export class MaterialService {
    /**
     * Archives a material (soft delete) to preserve historical links in guides.
     */
    static async archiveMaterial(id: string): Promise<void> {
        const { error } = await supabase
            .from('materials')
            .update({ status: 'archived' })
            .eq('id', id);

        if (error) throw error;

        await MaterialAnalyticsService.recordEvent({
            material_id: id,
            event_type: 'material_archived',
            event_context: 'archive'
        });
    }

    /**
     * Merges a secondary material into a primary one.
     * Unifies tags and archives the secondary material.
     */
    static async mergeMaterials(primaryId: string, secondaryId: string): Promise<void> {
        // 1. Fetch both materials to get current tags
        const { data: materials, error: fetchError } = await supabase
            .from('materials')
            .select('id, tags')
            .in('id', [primaryId, secondaryId]);

        if (fetchError || !materials || materials.length < 2) {
            throw new Error("No se pudieron encontrar los materiales para la fusión.");
        }

        const primary = materials.find(m => m.id === primaryId);
        const secondary = materials.find(m => m.id === secondaryId);

        if (!primary || !secondary) {
            throw new Error("Uno de los materiales no existe.");
        }

        // 2. Unify tags using a Set to avoid duplicates
        const combinedTags = Array.from(new Set([...(primary.tags || []), ...(secondary.tags || [])]));

        // 3. Update primary material with combined tags
        const { error: updateError } = await supabase
            .from('materials')
            .update({ tags: combinedTags })
            .eq('id', primaryId);

        if (updateError) throw updateError;

        // 4. Archive the secondary material
        await this.archiveMaterial(secondaryId);

        // Record the merge event for the primary material (optional, but good for tracking)
        await MaterialAnalyticsService.recordEvent({
            material_id: primaryId,
            event_type: 'used_in_guide', // Or a new event type if we wanted more granularity
            event_context: 'merge'
        });
    }

    /**
     * Updates quality-related metadata and records the reviewer/timestamp.
     */
    static async updateQualityStatus(
        id: string,
        updates: Partial<Omit<Material, 'id' | 'title' | 'clinical_area' | 'resource_type' | 'media_type' | 'url' | 'approved_at' | 'approved_by'>>,
        approvedBy: string
    ): Promise<void> {
        const updatesWithMetadata = {
            ...updates,
            approved_at: new Date().toISOString(),
            approved_by: approvedBy,
        };

        const { error } = await supabase
            .from('materials')
            .update(updatesWithMetadata)
            .eq('id', id);

        if (error) throw error;
    }

    /**
     * Performs a full update of a material.
     */
    static async updateMaterial(id: string, updates: Partial<Material>): Promise<void> {
        const { error } = await supabase
            .from('materials')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    }

    /**
     * Updates tags for normalization purposes.
     */
    static async normalizeTags(id: string, newTags: string[]): Promise<void> {
        const { error } = await supabase
            .from('materials')
            .update({ tags: newTags })
            .eq('id', id);

        if (error) throw error;
    }

    /**
     * Retrieves all materials by their current status.
     */
    static async getMaterialsByStatus(status: Material['status']): Promise<Material[]> {
        const { data, error } = await supabase
            .from('materials')
            .select('*')
            .eq('status', status);

        if (error) throw error;
        return data || [];
    }

    /**
     * Identifies potential duplicates by checking for matching URLs.
     */
    static async findDuplicateUrls(): Promise<{ primaryId: string, secondaryId: string, url: string }[]> {
        const { data, error } = await supabase
            .from('materials')
            .select('id, url')
            .not('url', 'is', null);

        if (error) throw error;
        if (!data) return [];

        const urlMap = new Map<string, string[]>();
        const duplicates: { primaryId: string, secondaryId: string, url: string }[] = [];

        data.forEach(m => {
            if (m.url) {
                const existing = urlMap.get(m.url);
                if (existing) {
                    // Match found: existing[0] is the primary, current m.id is the secondary
                    duplicates.push({
                        primaryId: existing[0],
                        secondaryId: m.id,
                        url: m.url
                    });
                    existing.push(m.id);
                } else {
                    urlMap.set(m.url, [m.id]);
                }
            }
        });

        return duplicates;
    }

    /**
     * Retrieves all materials.
     */
    static async getAllMaterials(): Promise<Material[]> {
        const { data, error } = await supabase
            .from('materials')
            .select('*')
            .order('title', { ascending: true });

        if (error) throw error;
        return data || [];
    }
}
