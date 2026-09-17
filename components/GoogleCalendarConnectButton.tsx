import React, { useState, useEffect } from 'react';
import { Calendar, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { GoogleAuthService } from '../services/GoogleAuthService';
import { supabase } from '../utils/supabaseClient';
import { useToast } from '../context/ToastContext';

interface GoogleCalendarConnectButtonProps {
  onConnectionSuccess?: () => void;
}

export const GoogleCalendarConnectButton: React.FC<GoogleCalendarConnectButtonProps> = ({ onConnectionSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [statusDetail, setStatusDetail] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      // 1) Diagnóstico del backend (dice exactamente qué falta)
      try {
        const st = await GoogleAuthService.getConnectionStatus(session.user.id);
        if (st) {
          setStatusDetail(st.user.detail || st.envDetail);
          if (!st.user.connected || !st.user.hasRefreshToken || st.user.expired) {
            setNeedsReconnect(true);
            setIsConnected(false);
            return;
          }
          setIsConnected(true);
          setNeedsReconnect(false);
          return;
        }
      } catch { /* cae al chequeo local */ }
      // 2) Fallback local (sin backend)
      const tokens = await GoogleAuthService.getValidTokens(session.user.id);
      if (tokens) {
        setIsConnected(true);
        setNeedsReconnect(false);
      }
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      await GoogleAuthService.signInWithGoogle();
      // Los tokens se guardan en useAuth (SIGNED_IN) tras el redirect.
    } catch (error: any) {
      addToast(error.message || "Error al conectar con Google Calendar", "error");
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <button disabled className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-sm font-bold transition-all">
        <Loader2 size={16} className="animate-spin" /> Conectando...
      </button>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold border border-emerald-100" title={statusDetail}>
        <CheckCircle2 size={16} /> Conectado
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      title={statusDetail || 'Conectar cuenta de Google (Calendar + Gmail + Meet)'}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm border ${
        needsReconnect
          ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
      }`}
    >
      {needsReconnect ? <AlertCircle size={16} /> : <Calendar size={16} className="text-blue-600" />}
      {needsReconnect ? 'Reconectar Google' : 'Conectar Google Calendar'}
    </button>
  );
};
