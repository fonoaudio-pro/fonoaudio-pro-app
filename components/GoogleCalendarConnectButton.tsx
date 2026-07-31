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
  const { addToast } = useToast();

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const tokens = await GoogleAuthService.getValidTokens(session.user.id);
      if (tokens) {
        setIsConnected(true);
      }
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      await GoogleAuthService.signInWithGoogle();
      // Note: The actual token saving happens after the redirect callback
      // which we will handle in the main App component.
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
      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold border border-emerald-100">
        <CheckCircle2 size={16} /> Conectado
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
    >
      <Calendar size={16} className="text-blue-600" />
      Conectar Google Calendar
    </button>
  );
};
