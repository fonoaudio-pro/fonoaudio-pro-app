import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// List work journal events
router.get('/', async (req, res) => {
  const { days = '30', patient_id, event_type, page = '1', limit = '50' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(500).json({ status: 'error', message: 'Supabase not configured' });
    }

    // Query v_work_journal with filters
    let query = supabase
      .from('v_work_journal')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    // Filter by days
    if (days && days !== 'all') {
      const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', since);
    }

    // Filter by patient
    if (patient_id) {
      query = query.eq('patient_id', patient_id);
    }

    // Filter by event type
    if (event_type) {
      query = query.eq('event_type', event_type);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    // Get stats
    const stats = {
      total: count || 0,
      today: 0,
      thisWeek: 0,
      byType: {},
    };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    for (const event of data || []) {
      if (new Date(event.created_at) >= todayStart) {
        stats.today++;
      }
      if (new Date(event.created_at) >= weekStart) {
        stats.thisWeek++;
      }
      stats.byType[event.event_type] = (stats.byType[event.event_type] || 0) + 1;
    }

    res.json({ status: 'ok', events: data || [], stats, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('[WorkJournal] Error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Get summary stats
router.get('/stats', async (req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(500).json({ status: 'error', message: 'Supabase not configured' });
    }

    const { data, error } = await supabase
      .from('v_work_journal')
      .select('event_type, created_at');

    if (error) throw error;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const stats = {
      total: data?.length || 0,
      today: 0,
      thisWeek: 0,
      byType: {},
    };

    for (const event of data || []) {
      const ts = new Date(event.created_at);
      if (ts >= todayStart) stats.today++;
      if (ts >= weekStart) stats.thisWeek++;
      stats.byType[event.event_type] = (stats.byType[event.event_type] || 0) + 1;
    }

    res.json({ status: 'ok', stats });
  } catch (error) {
    console.error('[WorkJournal Stats] Error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

export default router;
