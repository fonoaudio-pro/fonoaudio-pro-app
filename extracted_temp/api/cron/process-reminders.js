import { createClient } from '@supabase/supabase-js';
import distributionService from '../../services/distributionService.js';

// Vercel Cron Job: Process pending reminders every 5 minutes
export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await distributionService.processPendingReminders();
    res.json({ status: 'ok', processed: result.processed || 0 });
  } catch (e) {
    // Silently skip if reminders table doesn't exist
    res.json({ status: 'ok', processed: 0, note: 'Skipped: ' + e.message });
  }
}
