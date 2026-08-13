import { supabase } from "../utils/supabaseClient";
import { HomeGuide } from "../types";
import { generateMessage, DeliveryMethod } from "../utils/messageTemplates";

const WEBHOOK_URL = import.meta.env.VITE_DISPATCH_WEBHOOK_URL;

export class GuideService {
    /**
     * Dispatches a guide using the specified method.
     * Currently prepares the ground for n8n/webhook integration.
     */
    static async dispatch(guide: HomeGuide, method: DeliveryMethod, patientName: string): Promise<void> {
        // 1. Update status in Supabase
        await this.updateStatus(guide.id, method);

        // 2. Prepare payload for webhook
        const payload = {
            guideId: guide.id,
            version: guide.version,
            patientName: patientName,
            guideTitle: guide.title,
            method: method,
            shareLink: `${window.location.origin}/share/guide/${guide.share_token}`,
            timestamp: new Date().toISOString()
        };

        // 3. Attempt to call webhook if configured
        if (WEBHOOK_URL) {
            try {
                await fetch(WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                console.log('Webhook dispatched successfully');
            } catch (err) {
                console.error('Failed to dispatch webhook:', err);
                // We don't throw here to keep the flow functional even if webhook fails
            }
        } else {
            console.log('Webhook URL not configured. Skipping automated dispatch.', payload);
        }
    }

    private static async updateStatus(guideId: string, method: DeliveryMethod): Promise<void> {
        const status: 'draft' | 'final' | 'sent' = method === 'whatsapp' || method === 'email' ? 'sent' : 'final';
        
        const updates: any = { 
            status, 
            updated_at: new Date().toISOString() 
        };

        if (status === 'sent') {
            updates.sent_at = new Date().toISOString();
            updates.delivery_method = method;
        }

        const { error } = await supabase
            .from('home_guides')
            .update(updates)
            .eq('id', guideId);

        if (error) throw error;
    }

    /**
     * Generates the public share link for a guide.
     */
    static getShareLink(token: string): string {
        return `${window.location.origin}/share/guide/${token}`;
    }
}
