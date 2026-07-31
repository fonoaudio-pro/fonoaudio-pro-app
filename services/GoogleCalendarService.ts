import { GoogleTokens } from './GoogleAuthService';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  link?: string;
  meetLink?: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
}

export interface SyncResult {
  events: CalendarEvent[];
  nextSyncToken?: string;
  isFullSync: boolean;
}

export const GoogleCalendarService = {
  async getSyncToken(userId: string): Promise<string | null> {
    try {
      const { data } = await (await import('../utils/supabaseClient')).supabase
        .from('google_auth')
        .select('sync_token')
        .eq('user_id', userId)
        .maybeSingle();
      return data?.sync_token || null;
    } catch {
      return null;
    }
  },

  async saveSyncToken(userId: string, token: string): Promise<void> {
    try {
      await (await import('../utils/supabaseClient')).supabase
        .from('google_auth')
        .update({ sync_token: token })
        .eq('user_id', userId);
    } catch (e) {
      console.warn('[GoogleCalendarService] Could not save sync token:', e);
    }
  },

  async syncEvents(userId: string, accessToken: string): Promise<SyncResult> {
    const syncToken = await this.getSyncToken(userId);
    
    if (syncToken) {
      try {
        return await this.performIncrementalSync(accessToken, syncToken);
      } catch (error: any) {
        if (error.message.includes('410') || error.message.includes('GONE')) {
          console.warn('Sync token expired (410 GONE). Performing full resync...');
          return await this.performFullSync(accessToken);
        }
        throw error;
      }
    }
    
    return await this.performFullSync(accessToken);
  },

  async performFullSync(accessToken: string): Promise<SyncResult> {
    let allEvents: CalendarEvent[] = [];
    let nextPageToken: string | undefined = undefined;
    let nextSyncToken: string | undefined = undefined;

    do {
      const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');
      if (nextPageToken) url.searchParams.set('pageToken', nextPageToken);
      
      // We typically want upcoming events for the dashboard, 
      // but for a full sync we might want a broader window or just the most recent
      const now = new Date().toISOString();
      url.searchParams.set('timeMin', now);

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Google Calendar API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      allEvents = allEvents.concat(data.items.map((item: any) => this.mapEvent(item)));
      
      nextPageToken = data.nextPageToken;
      nextSyncToken = data.nextSyncToken;
    } while (nextPageToken);

    return {
      events: allEvents,
      nextSyncToken,
      isFullSync: true
    };
  },

  async performIncrementalSync(accessToken: string, syncToken: string): Promise<SyncResult> {
    let allEvents: CalendarEvent[] = [];
    let nextPageToken: string | undefined = undefined;
    let nextSyncToken: string | undefined = syncToken;

    do {
      const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      url.searchParams.set('syncToken', syncToken);
      if (nextPageToken) url.searchParams.set('pageToken', nextPageToken);

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.status === 410) {
        throw new Error('410 GONE: Sync token expired');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Google Calendar API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      allEvents = allEvents.concat(data.items.map((item: any) => this.mapEvent(item)));
      
      nextPageToken = data.nextPageToken;
      if (data.nextSyncToken) {
        nextSyncToken = data.nextSyncToken;
      }
    } while (nextPageToken);

    return {
      events: allEvents,
      nextSyncToken,
      isFullSync: false
    };
  },

  async createEvent(accessToken: string, eventDetails: {
    summary: string;
    description?: string;
    start: string;
    end: string;
    colorId?: string;
  }): Promise<CalendarEvent> {
    const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    
    const body: any = {
      summary: eventDetails.summary,
      description: eventDetails.description,
      start: {
        dateTime: eventDetails.start,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: eventDetails.end,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    if (eventDetails.colorId) {
      body.colorId = eventDetails.colorId;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google Calendar API error creating event: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return this.mapEvent(data);
  },

  async createEventWithMeet(accessToken: string, eventDetails: {
    summary: string;
    description?: string;
    start: string;
    end: string;
    colorId?: string;
  }): Promise<CalendarEvent> {
    const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1';

    const body: any = {
      summary: eventDetails.summary,
      description: eventDetails.description,
      start: {
        dateTime: eventDetails.start,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: eventDetails.end,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    if (eventDetails.colorId) {
      body.colorId = eventDetails.colorId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google Calendar API error creating Meet event: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return this.mapEvent(data);
  },

  async addMeetToEvent(accessToken: string, eventId: string): Promise<string | null> {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?conferenceDataVersion=1`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conferenceData: {
          createRequest: {
            requestId: `meet-add-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google Calendar API error adding Meet: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.hangoutLink || data.conferenceData?.entryPoints?.[0]?.uri || null;
  },

  async updateEvent(accessToken: string, eventId: string, eventDetails: {
    summary?: string;
    description?: string;
    start: string;
    end: string;
    colorId?: string;
  }): Promise<void> {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;
    
    const body: any = {
      summary: eventDetails.summary,
      description: eventDetails.description,
      start: {
        dateTime: eventDetails.start,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: eventDetails.end,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    if (eventDetails.colorId) {
      body.colorId = eventDetails.colorId;
    }
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google Calendar API error updating event: ${errorData.error?.message || response.statusText}`);
    }
  },

  async deleteEvent(accessToken: string, eventId: string): Promise<void> {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      const errorData = await response.json();
      throw new Error(`Google Calendar API error deleting event: ${errorData.error?.message || response.statusText}`);
    }
  },

  mapEvent(item: any): CalendarEvent {
    return {
      id: item.id,
      summary: item.summary || 'Sin título',
      description: item.description,
      start: item.start.dateTime || item.start.date,
      end: item.end.dateTime || item.end.date,
      link: item.htmlLink,
      meetLink: item.hangoutLink || item.conferenceData?.entryPoints?.[0]?.uri || undefined,
      status: item.status || 'confirmed'
    };
  }
};
