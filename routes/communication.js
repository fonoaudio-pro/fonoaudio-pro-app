import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Supabase client for token access
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Get valid Google access token for a user
async function getGoogleAccessToken(userId) {
  const supabase = getSupabase();
  if (!supabase || !userId) return null;

  const { data } = await supabase
    .from('google_auth')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return null;

  // Check if token is expired
  if (data.expires_at && new Date(data.expires_at) > new Date()) {
    return data.access_token;
  }

  // Refresh token
  if (data.refresh_token) {
    try {
      const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: data.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (resp.ok) {
        const tokenData = await resp.json();
        const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

        // Save refreshed token
        await supabase
          .from('google_auth')
          .update({ access_token: tokenData.access_token, expires_at: expiresAt })
          .eq('user_id', userId);

        return tokenData.access_token;
      }
    } catch (e) {
      console.error('[Communication] Token refresh failed:', e.message);
    }
  }

  return null;
}

// Auto-correlate email to patient by sender email/name
async function correlatePatient(senderEmail, senderName) {
  const supabase = getSupabase();
  if (!supabase) return null;

  // Try exact email match
  if (senderEmail) {
    const { data } = await supabase
      .from('patients')
      .select('id, name, email, phone, diagnosis, age')
      .ilike('email', senderEmail)
      .limit(1)
      .maybeSingle();

    if (data) return { id: data.id, name: data.name, email: data.email, phone: data.phone, diagnosis: data.diagnosis, age: data.age, match_type: 'email' };
  }

  // Try name match
  if (senderName) {
    const firstName = senderName.split(' ')[0].toLowerCase();
    const { data } = await supabase
      .from('patients')
      .select('id, name, email, phone, diagnosis, age')
      .ilike('name', `%${firstName}%`)
      .limit(1)
      .maybeSingle();

    if (data) return { id: data.id, name: data.name, email: data.email, phone: data.phone, diagnosis: data.diagnosis, age: data.age, match_type: 'name' };
  }

  return null;
}

// ══════════════════════════════════════════════════════════════════
// GMAIL ENDPOINTS
// ══════════════════════════════════════════════════════════════════

// List Gmail messages
router.get('/gmail/messages', async (req, res) => {
  const { userId, query = 'in:inbox', pageToken, maxResults = 20 } = req.query;

  try {
    const accessToken = await getGoogleAccessToken(userId);
    if (!accessToken) {
      return res.status(401).json({ status: 'error', message: 'Google token not available. Connect Google in Settings.' });
    }

    // List message IDs
    const params = new URLSearchParams({
      q: query,
      maxResults: maxResults.toString(),
    });
    if (pageToken) params.set('pageToken', pageToken);

    const listResp = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?${params}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!listResp.ok) {
      const err = await listResp.json().catch(() => ({}));
      return res.status(listResp.status).json({ status: 'error', message: err.error?.message || 'Gmail API error' });
    }

    const listData = await listResp.json();
    const messages = listData.messages || [];

    // Fetch details for each message (batch)
    const detailed = await Promise.all(
      messages.slice(0, 20).map(async (msg) => {
        const detailResp = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!detailResp.ok) return null;
        const detail = await detailResp.json();
        const headers = (detail.payload?.headers || []);
        const getHeader = (name) => headers.find((h) => h.name === name)?.value || '';

        return {
          id: detail.id,
          threadId: detail.threadId,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          date: getHeader('Date'),
          snippet: detail.snippet || '',
          labelIds: detail.labelIds || [],
          isRead: !(detail.labelIds || []).includes('UNREAD'),
        };
      })
    );

    res.json({
      status: 'ok',
      messages: detailed.filter(Boolean),
      nextPageToken: listData.nextPageToken || null,
      total: listData.resultSizeEstimate || detailed.length,
    });
  } catch (error) {
    console.error('[Gmail List] Error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Get single Gmail message detail
router.get('/gmail/messages/:id', async (req, res) => {
  const { userId } = req.query;
  const { id } = req.params;

  try {
    const accessToken = await getGoogleAccessToken(userId);
    if (!accessToken) {
      return res.status(401).json({ status: 'error', message: 'Google token not available' });
    }

    const resp = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ status: 'error', message: err.error?.message || 'Gmail API error' });
    }

    const data = await resp.json();
    const headers = data.payload?.headers || [];
    const getHeader = (name) => headers.find((h) => h.name === name)?.value || '';

    // Extract body (prefer HTML, fallback to plain text)
    let body = '';
    let bodyHtml = '';
    function extractBody(part) {
      if (part.body?.data) {
        const decoded = Buffer.from(part.body.data, 'base64url').toString('utf-8');
        if (part.mimeType === 'text/html' && !bodyHtml) {
          bodyHtml = decoded;
        } else if (part.mimeType === 'text/plain' && !body) {
          body = decoded;
        }
        return;
      }
      if (part.parts) {
        for (const p of part.parts) {
          extractBody(p);
        }
      }
    }
    extractBody(data.payload);

    // Auto-correlate to patient
    const fromHeader = getHeader('From');
    const emailMatch = fromHeader.match(/<(.+?)>/);
    const senderEmail = emailMatch ? emailMatch[1] : fromHeader;
    const senderName = emailMatch ? fromHeader.replace(/<.*>/, '').trim() : fromHeader;

    const patient = await correlatePatient(senderEmail, senderName);

    res.json({
      status: 'ok',
      message: {
        id: data.id,
        threadId: data.threadId,
        subject: getHeader('Subject'),
        from: getHeader('From'),
        to: getHeader('To'),
        date: getHeader('Date'),
        body,
        bodyHtml,
        snippet: data.snippet || '',
        labelIds: data.labelIds || [],
        isRead: !(data.labelIds || []).includes('UNREAD'),
      },
      patient,
    });
  } catch (error) {
    console.error('[Gmail Detail] Error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Send Gmail message
router.post('/gmail/messages', async (req, res) => {
  const { userId, to, subject, body } = req.body;

  try {
    const accessToken = await getGoogleAccessToken(userId);
    if (!accessToken) {
      return res.status(401).json({ status: 'error', message: 'Google token not available' });
    }

    // Build RFC 2822 email
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n');

    const encodedEmail = Buffer.from(email).toString('base64url');

    const resp = await fetch(
      'https://www.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: encodedEmail }),
      }
    );

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ status: 'error', message: err.error?.message || 'Gmail send error' });
    }

    const data = await resp.json();

    // Auto-save to message_messages table
    const supabase = getSupabase();
    if (supabase) {
      const patient = await correlatePatient(to, null);
      let threadId = null;

      // Find or create thread
      if (patient) {
        const { data: existingThread } = await supabase
          .from('message_threads')
          .select('id')
          .eq('patient_id', patient.id)
          .eq('channel', 'gmail')
          .limit(1)
          .maybeSingle();

        if (existingThread) {
          threadId = existingThread.id;
          await supabase
            .from('message_threads')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', threadId);
        } else {
          const { data: newThread } = await supabase
            .from('message_threads')
            .insert({
              patient_id: patient.id,
              channel: 'gmail',
              subject,
            })
            .select('id')
            .single();
          threadId = newThread?.id;
        }
      }

      // Save message
      await supabase.from('message_messages').insert({
        thread_id: threadId,
        channel: 'gmail',
        direction: 'outbound',
        sender_name: 'Yo',
        sender_email: '',
        content: body,
        external_id: data.id,
      });
    }

    res.json({ status: 'ok', messageId: data.id });
  } catch (error) {
    console.error('[Gmail Send] Error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Mark Gmail message as read
router.put('/gmail/messages/:id/read', async (req, res) => {
  const { userId } = req.body;
  const { id } = req.params;

  try {
    const accessToken = await getGoogleAccessToken(userId);
    if (!accessToken) {
      return res.status(401).json({ status: 'error', message: 'Google token not available' });
    }

    const resp = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${id}/modify`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
      }
    );

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ status: 'error', message: err.error?.message });
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('[Gmail Read] Error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
router.get('/channels', (req, res) => {
  res.json({
    status: 'ok',
    channels: [
      { id: 'gmail', name: 'Gmail', active: true },
      { id: 'telegram', name: 'Telegram', active: !!process.env.TELEGRAM_BOT_TOKEN },
      { id: 'whatsapp', name: 'WhatsApp', active: false }
    ]
  });
});

// UNIFIED THREADS
// ══════════════════════════════════════════════════════════════════

// List unified threads
router.get('/threads', async (req, res) => {
  const { channel, patient_id, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(500).json({ status: 'error', message: 'Supabase not configured' });
    }

    let query = supabase
      .from('message_threads')
      .select('*, patients!inner(id, name, email)', { count: 'exact' })
      .order('last_message_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (channel) query = query.eq('channel', channel);
    if (patient_id) query = query.eq('patient_id', patient_id);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ status: 'ok', threads: data || [], total: count || 0 });
  } catch (error) {
    console.error('[Threads List] Error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ══════════════════════════════════════════════════════════════════

// List templates
router.get('/templates', async (req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) return res.json({ status: 'ok', templates: [] });

    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    res.json({ status: 'ok', templates: data || [] });
  } catch (error) {
    console.error('[Templates List] Error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Create template
router.post('/templates', async (req, res) => {
  const { name, category, subject_template, body_template, variables } = req.body;

  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ status: 'error', message: 'Supabase not configured' });

    const { data, error } = await supabase
      .from('email_templates')
      .insert({ name, category, subject_template, body_template, variables: variables || [] })
      .select('id')
      .single();

    if (error) throw error;
    res.json({ status: 'ok', id: data.id });
  } catch (error) {
    console.error('[Template Create] Error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Delete template
router.delete('/templates/:id', async (req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ status: 'error', message: 'Supabase not configured' });

    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('[Template Delete] Error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// PATIENT CORRELATION
// ══════════════════════════════════════════════════════════════════

router.post('/correlate', async (req, res) => {
  const { email, name } = req.body;

  try {
    const patient = await correlatePatient(email, name);
    if (patient) {
      res.json({ status: 'ok', patient });
    } else {
      res.json({ status: 'ok', patient: null, message: 'No matching patient found' });
    }
  } catch (error) {
    console.error('[Correlate] Error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

export default router;
