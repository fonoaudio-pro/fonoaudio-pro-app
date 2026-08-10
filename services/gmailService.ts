const API_BASE = '/api/communication';

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  labelIds: string[];
  isRead: boolean;
}

export interface GmailMessageDetail extends GmailMessage {
  to: string;
  body: string;
  bodyHtml: string;
}

export interface Thread {
  id: string;
  patient_id: string;
  channel: 'gmail' | 'telegram' | 'whatsapp';
  subject: string;
  last_message_at: string;
  unread_count: number;
  status: string;
  patients?: { id: string; name: string; email: string };
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject_template: string;
  body_template: string;
  variables: string[];
}

export const GmailService = {
  async listMessages(userId: string, query = 'in:inbox', pageToken?: string, maxResults = 20): Promise<{ messages: GmailMessage[]; nextPageToken: string | null; total: number }> {
    const params = new URLSearchParams({ userId, query, maxResults: maxResults.toString() });
    if (pageToken) params.set('pageToken', pageToken);

    try {
      const resp = await fetch(`${API_BASE}/gmail/messages?${params}`);
      if (!resp.ok) {
        return { messages: [], nextPageToken: null, total: 0 };
      }
      return resp.json();
    } catch {
      return { messages: [], nextPageToken: null, total: 0 };
    }
  },

  async getMessage(userId: string, messageId: string): Promise<{ message: GmailMessageDetail; patient: any }> {
    const resp = await fetch(`${API_BASE}/gmail/messages/${messageId}?userId=${userId}`);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || 'Error getting Gmail message');
    }
    return resp.json();
  },

  async sendMessage(userId: string, to: string, subject: string, body: string): Promise<{ messageId: string }> {
    const resp = await fetch(`${API_BASE}/gmail/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, to, subject, body }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || 'Error sending Gmail message');
    }
    return resp.json();
  },

  async markAsRead(userId: string, messageId: string): Promise<void> {
    const resp = await fetch(`${API_BASE}/gmail/messages/${messageId}/read`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!resp.ok) throw new Error('Error marking message as read');
  },

  async listThreads(channel?: string, patientId?: string): Promise<{ threads: Thread[]; total: number }> {
    const params = new URLSearchParams();
    if (channel) params.set('channel', channel);
    if (patientId) params.set('patient_id', patientId);

    const resp = await fetch(`${API_BASE}/threads?${params}`);
    if (!resp.ok) throw new Error('Error listing threads');
    return resp.json();
  },

  async listTemplates(): Promise<{ templates: EmailTemplate[] }> {
    const resp = await fetch(`${API_BASE}/templates`);
    if (!resp.ok) throw new Error('Error listing templates');
    return resp.json();
  },

  async createTemplate(template: Omit<EmailTemplate, 'id'>): Promise<{ id: string }> {
    const resp = await fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    });
    if (!resp.ok) throw new Error('Error creating template');
    return resp.json();
  },

  async deleteTemplate(id: string): Promise<void> {
    const resp = await fetch(`${API_BASE}/templates/${id}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error('Error deleting template');
  },

  async correlatePatient(email?: string, name?: string): Promise<{ patient: any } | null> {
    const resp = await fetch(`${API_BASE}/correlate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    if (!resp.ok) return null;
    return resp.json();
  },
};
