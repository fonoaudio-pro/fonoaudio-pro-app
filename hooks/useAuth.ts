import { useState, useEffect } from "react";
import { supabase } from "../utils/supabaseClient";
import { GoogleAuthService, UserProfile } from "../services/GoogleAuthService";

export interface AuthState {
  session: any;
  userProfile: UserProfile | null;
  dbProfile: { role: string; consultorio_ids: string[] } | null;
  isAuthLoading: boolean;
  isGoogleConnected: boolean;
  setSession: (s: any) => void;
  setUserProfile: (p: UserProfile | null) => void;
  setIsGoogleConnected: (v: boolean) => void;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [dbProfile, setDbProfile] = useState<{ role: string; consultorio_ids: string[] } | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchAvatar = async (profile: UserProfile, accessToken: string) => {
      if (profile.avatarUrl || !accessToken) return;
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.picture) {
            setUserProfile(prev => prev ? { ...prev, avatarUrl: data.picture } : prev);
          }
        }
      } catch {}
    };

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!mounted) return;
      setSession(currentSession);
      if (currentSession?.user) {
        const profile = GoogleAuthService.getUserProfile(currentSession);
        setUserProfile(profile);
        if (profile && !profile.avatarUrl && currentSession.provider_token) {
          fetchAvatar(profile, currentSession.provider_token);
        }

        // Restore Google connection from DB
        GoogleAuthService.getTokens(currentSession.user.id).then(tokens => {
          if (mounted && tokens) {
            setIsGoogleConnected(true);
            // If token is expired, try to refresh
            if (GoogleAuthService.isTokenExpired(tokens.expiresAt)) {
              GoogleAuthService.refreshAccessToken(tokens.refreshToken).then(refreshed => {
                if (refreshed) {
                  GoogleAuthService.saveTokens(currentSession.user.id, {
                    accessToken: refreshed.accessToken,
                    refreshToken: tokens.refreshToken,
                    expiresAt: refreshed.expiresAt,
                  });
                }
              });
            }
          }
        });

        supabase.from('profiles').select('role, consultorio_ids').eq('id', currentSession.user.id).single()
          .then(({ data }) => { if (mounted && data) setDbProfile(data); })
          .catch(() => {});
      }
    }).catch(() => {}).finally(() => {
      if (mounted) setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user) {
        const profile = GoogleAuthService.getUserProfile(newSession);
        setUserProfile(profile);
        if (event === 'SIGNED_IN' && newSession.provider_token) {
          GoogleAuthService.saveTokens(newSession.user.id, {
            accessToken: newSession.provider_token,
            refreshToken: newSession.provider_refresh_token || '',
            expiresAt: new Date(Date.now() + (newSession.expires_in || 3600) * 1000).toISOString(),
          }).then(() => setIsGoogleConnected(true)).catch(() => {});
          if (profile && !profile.avatarUrl) {
            fetchAvatar(profile, newSession.provider_token);
          }
          supabase.from('profiles').select('role, consultorio_ids').eq('id', newSession.user.id).single()
            .then(({ data }) => { if (mounted && data) setDbProfile(data); })
            .catch(() => {});
        }
      } else {
        setUserProfile(null);
        setDbProfile(null);
        setIsGoogleConnected(false);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    await GoogleAuthService.signOut();
    setSession(null);
    setUserProfile(null);
    setIsGoogleConnected(false);
  };

  return {
    session,
    userProfile,
    dbProfile,
    isAuthLoading,
    isGoogleConnected,
    setSession,
    setUserProfile,
    setIsGoogleConnected,
    signOut,
  };
}
