import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Distribution Service
 * Handles external distribution of materials and guides to caregivers/families.
 */
class DistributionService {
    constructor() {
        this.supabase = null;
    }

    async _getSupabase() {
        if (!this.supabase) {
            const url = process.env.VITE_SUPABASE_URL;
            const key = process.env.VITE_SUPABASE_ANON_KEY;

            if (!url || !key) {
                throw new Error('Supabase credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are not configured in environment variables.');
            }

            this.supabase = createClient(url, key);
        }
        return this.supabase;
    }

    /**
     * Sends clinical material/guides to a caregiver via WhatsApp or Email.
     * @param {Object} params
     * @param {string} params.patientName
     * @param {string} params.materialTitle
     * @param {string} [params.materialUrl]
     * @param {string} params.recipientContact
     * @param {string} params.medium - 'whatsapp' or 'email'
     * @param {string} [params.message]
     * @param {string} [params.subject] - Only for email
     * @param {string} [params.sessionId] - The ID of the session that triggered this distribution
     * @returns {Promise<Object>}
     */
    async sendMaterialToCaregiver({ patientName, materialTitle, materialUrl, recipientContact, medium, message, subject, sessionId }) {
        try {
            // 0. Validations
            if (!materialTitle || materialTitle.trim() === '') {
                throw new Error('materialTitle is required.');
            }

            if (!['whatsapp', 'email'].includes(medium)) {
                throw new Error("medium must be either 'whatsapp' or 'email'.");
            }

            if (medium === 'email') {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(recipientContact)) {
                    throw new Error('Invalid email format for recipientContact.');
                }
            } else if (medium === 'whatsapp') {
                // Basic phone number validation: allow '+' and 7-15 digits
                const phoneRegex = /^\+?[1-9]\d{6,14}$/;
                if (!phoneRegex.test(recipientContact.replace(/[\s()-]/g, ''))) {
                    throw new Error('Invalid phone number format for recipientContact.');
                }
            }

            const supabase = await this._getSupabase();

            // 1. Find the patient by name (case-insensitive)
            const { data: patients, error: pError } = await supabase
                .from('patients')
                .select('*')
                .ilike('name', patientName)
                .limit(1);

            if (pError || !patients || patients.length === 0) {
                throw new Error(`Patient "${patientName}" not found.`);
            }

            const patient = patients[0];
            const distributionId = uuidv4();
            const timestamp = new Date().toISOString();

            // 2. Log the action in the patient's history
            const historyEntry = {
                date: timestamp,
                type: 'external_distribution',
                summary: `Material "${materialTitle}" enviado a cuidador vía ${medium}.`,
                observations: `Destinatario: ${recipientContact}. Mensaje: ${message || 'Sin mensaje adicional.'}`
            };

            const updatedHistory = [...(patient.history || []), historyEntry];

            const { error: updateError } = await supabase
                .from('patients')
                .update({ history: updatedHistory })
                .eq('id', patient.id);

            if (updateError) {
                throw new Error(`Failed to update patient history: ${updateError.message}`);
            }

            // 3. Create initial log in distribution_logs (status: queued)
            const { error: logError } = await supabase
                .from('distribution_logs')
                .insert({
                    distribution_id: distributionId,
                    patient_id: patient.id,
                    session_id: sessionId, // Persist the session ID for traceability
                    status: 'queued',
                    medium: medium,
                    recipient_contact: recipientContact,
                    material_title: materialTitle,
                    material_url: materialUrl
                });

            if (logError) {
                console.error('[DistributionService] Failed to create distribution log:', logError);
            }

            // 4. Trigger n8n webhook
            const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
            if (n8nWebhookUrl) {
                // Use global fetch (Node.js 18+)
                fetch(n8nWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'send_material_to_caregiver',
                        data: {
                            distributionId,
                            patientId: patient.id,
                            sessionId, // Include sessionId in the webhook payload
                            patientName: patient.name,
                            materialTitle,
                            materialUrl,
                            recipientContact,
                            medium,
                            message,
                            subject,
                            timestamp
                        }
                    })
                }).catch(err => console.error('[DistributionService] n8n webhook error:', err));
            } else {
                console.warn('[DistributionService] N8N_WEBHOOK_URL not configured. Skipping webhook.');
            }

            return { status: 'ok', patientId: patient.id, distributionId };

        } catch (error) {
            console.error('[DistributionService] Error:', error);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Gets the distribution history for a specific patient.
     * @param {string} patientId
     * @returns {Promise<Array>}
     */
    async getPatientDistributionHistory(patientId) {
        try {
            const supabase = await this._getSupabase();
            const { data, error } = await supabase
                .from('distribution_logs')
                .select('*')
                .eq('patient_id', patientId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[DistributionService] Error fetching history:', error);
            throw error;
        }
    }

    /**
     * Retries a failed distribution.
     * @param {string} distributionId - The ID of the failed distribution log.
     * @returns {Promise<Object>}
     */
    async retryDistribution(distributionId) {
        try {
            const supabase = await this._getSupabase();
            
            const { data: log, error: logError } = await supabase
                .from('distribution_logs')
                .select('*')
                .eq('distribution_id', distributionId)
                .single();

            if (logError || !log) {
                throw new Error('Original distribution log not found.');
            }

            const { data: patient, error: pError } = await supabase
                .from('patients')
                .select('name')
                .eq('id', log.patient_id)
                .single();

            if (pError || !patient) {
                throw new Error('Patient not found for retry.');
            }

            const result = await this.sendMaterialToCaregiver({
                patientName: patient.name,
                materialTitle: log.material_title,
                materialUrl: log.material_url,
                recipientContact: log.recipient_contact,
                medium: log.medium,
                message: log.error_message 
            });

            return result;
        } catch (error) {
            console.error('[DistributionService] Error retrying distribution:', error);
            throw error;
        }
    }

    /**
     * Resends the last material sent to the patient.
     * @param {string} patientId
     * @returns {Promise<Object>}
     */
    async resendLastMaterial(patientId) {
        try {
            const supabase = await this._getSupabase();
            
            const { data: lastLog, error: logError } = await supabase
                .from('distribution_logs')
                .select('*')
                .eq('patient_id', patientId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (logError || !lastLog) {
                throw new Error('No previous distribution found for this patient.');
            }

            const { data: patient, error: pError } = await supabase
                .from('patients')
                .select('name')
                .eq('id', patientId)
                .single();

            if (pError || !patient) {
                throw new Error('Patient not found.');
            }

            const result = await this.sendMaterialToCaregiver({
                patientName: patient.name,
                materialTitle: lastLog.material_title,
                materialUrl: lastLog.material_url,
                recipientContact: lastLog.recipient_contact,
                medium: lastLog.medium,
                message: 'Reenvío de material solicitado.'
            });

            return result;
        } catch (error) {
            console.error('[DistributionService] Error resending last material:', error);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Processes all pending reminders that are due.
     * @returns {Promise<Object>} Summary of processed reminders.
     */
    async processPendingReminders() {
        try {
            const supabase = await this._getSupabase();
            const now = new Date().toISOString();

            const { data: pendingReminders, error: fetchError } = await supabase
                .from('reminders')
                .select('*')
                .eq('status', 'pending')
                .lte('scheduled_at', now);

            if (fetchError) throw fetchError;
            if (!pendingReminders || pendingReminders.length === 0) {
                return { status: 'ok', processed: 0 };
            }

            let successCount = 0;
            let failureCount = 0;

            for (const reminder of pendingReminders) {
                try {
                    // 1. Get patient details
                    const { data: patient, error: pError } = await supabase
                        .from('patients')
                        .select('name')
                        .eq('id', reminder.patient_id)
                        .single();

                    if (pError || !patient) {
                        throw new Error(`Patient ${reminder.patient_id} not found.`);
                    }

                    // 2. Attempt to send the material
                    const result = await this.sendMaterialToCaregiver({
                        patientName: patient.name,
                        materialTitle: reminder.material_title,
                        recipientContact: reminder.recipient_contact,
                        medium: reminder.medium,
                        message: 'Recordatorio de material clínico pendiente.'
                    });

                    if (result.status === 'ok') {
                        // 3. Mark as sent
                        await supabase
                            .from('reminders')
                            .update({ status: 'sent', updated_at: new Date().toISOString() })
                            .eq('id', reminder.id);
                        successCount++;
                    } else {
                        throw new Error(result.message);
                    }
                } catch (err) {
                    console.error(`[DistributionService] Failed to process reminder ${reminder.id}:`, err);
                    // 4. Mark as failed
                    await supabase
                        .from('reminders')
                        .update({ status: 'failed', updated_at: new Date().toISOString() })
                        .eq('id', reminder.id);
                    failureCount++;
                }
            }

            return { status: 'ok', processed: pendingReminders.length, success: successCount, failure: failureCount };
        } catch (error) {
            console.error('[DistributionService] Error processing reminders:', error);
            return { status: 'error', message: error.message };
        }
    }
}

export default new DistributionService();
