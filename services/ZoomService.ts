const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export interface ZoomMeeting {
  id: number;
  join_url: string;
  start_url: string;
  password: string | null;
}

export const ZoomService = {
  async getStatus(): Promise<{ configured: boolean; detail: string }> {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/zoom/status`);
      if (!resp.ok) return { configured: false, detail: 'Backend no disponible.' };
      return resp.json();
    } catch {
      return { configured: false, detail: 'Sin conexión con el backend.' };
    }
  },

  async createMeeting(opts: {
    topic: string;
    start_time?: string;
    duration?: number;
    agenda?: string;
  }): Promise<ZoomMeeting> {
    const resp = await fetch(`${BACKEND_URL}/api/zoom/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data.status === 'error') {
      throw new Error(data.message || `Error creando reunión Zoom (${resp.status})`);
    }
    return data as ZoomMeeting;
  },
};
