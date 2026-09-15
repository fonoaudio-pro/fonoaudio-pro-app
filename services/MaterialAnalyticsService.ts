import { supabase } from "../utils/supabaseClient";
import { MaterialAnalyticsEvent } from "../types";

export class MaterialAnalyticsService {
    /**
     * Records a material-related event for auditing and metrics.
     */
    static async recordEvent(event: Omit<MaterialAnalyticsEvent, 'id' | 'timestamp'>): Promise<void> {
        const { error } = await supabase
            .from('material_analytics')
            .insert([{
                ...event,
                timestamp: new Date().toISOString()
            }]);

        if (error) {
            console.error("Error recording analytics event:", error);
            // We don't throw to avoid breaking the main user flow if analytics fails
        }
    }
}
