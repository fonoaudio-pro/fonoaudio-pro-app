import { supabase } from '../utils/supabaseClient';

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const TOKEN_BUFFER_MS = 5 * 60 * 1000;

export const GoogleAuthService = {
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/documents',
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.modify',
          ].join(' '),
        },
      },
    });
    if (error) throw error;
    return data;
  },

  async saveTokens(userId: string, tokens: GoogleTokens) {
    const { error } = await supabase
      .from('google_auth')
      .upsert({
        user_id: userId,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt,
      });
    if (error) throw error;
  },

  async getTokens(userId: string): Promise<GoogleTokens | null> {
    const { data, error } = await supabase
      .from('google_auth')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
    };
  },

  isTokenExpired(expiresAt: string): boolean {
    if (!expiresAt) return true;
    return Date.now() >= new Date(expiresAt).getTime() - TOKEN_BUFFER_MS;
  },

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: string } | null> {
    if (!refreshToken) return null;
    if (!BACKEND_URL) {
      console.warn('[GoogleAuthService] VITE_BACKEND_URL no configurado. No se pueden refrescar tokens de Google.');
      return null;
    }
    try {
      const response = await fetch(`${BACKEND_URL}/api/google/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) return null;
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        return { accessToken: data.access_token, expiresAt: data.expires_at };
      } catch { return null; }
    } catch {
      return null;
    }
  },

  async getValidTokens(userId: string): Promise<GoogleTokens | null> {
    const tokens = await this.getTokens(userId);
    if (!tokens) return null;
    if (!this.isTokenExpired(tokens.expiresAt)) return tokens;
    const refreshed = await this.refreshAccessToken(tokens.refreshToken);
    if (!refreshed) return null;
    const updatedTokens: GoogleTokens = {
      accessToken: refreshed.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: refreshed.expiresAt,
    };
    await this.saveTokens(userId, updatedTokens);
    return updatedTokens;
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async disconnectGoogle(userId: string): Promise<void> {
    const { error } = await supabase
      .from('google_auth')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
  },

  getUserProfile(session: any): UserProfile | null {
    if (!session?.user) return null;
    const user = session.user;
    const meta = user.user_metadata || {};
    const raw = (user as any).raw_user_meta_data || {};
    return {
      id: user.id,
      email: user.email || '',
      name: meta.full_name || meta.name || raw.full_name || raw.name || user.email?.split('@')[0] || 'Usuario',
      avatarUrl: meta.avatar_url || meta.picture || raw.avatar_url || raw.picture || '',
    };
  },
};
