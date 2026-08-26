// FonoAudio-Pro — Hook para registrar el service worker y obtener la push subscription.
// NOTA: NO contiene branding "FonoAudio-Pro" en las notificaciones entregadas al paciente.
import { useEffect, useState } from 'react';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export function usePushSubscription() {
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('Push no soportado en este navegador');
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      setError('VAPID_PUBLIC_KEY no configurada');
      return;
    }
    // Registrar el service worker
    navigator.serviceWorker.register('/sw.js')
      .then(async (reg) => {
        const sub = await reg.pushManager.subscribe({
          userVisibleProperty: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        // Persistir suscripción (backend guarda en Supabase push_subscriptions)
        const r = await fetch('/api/notifications/save-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub),
        });
        const data = await r.json().catch(() => ({}));
        if (data?.status === 'ok' || r.ok) setSubscribed(true);
        else setError(data?.message || 'Error guardando subscripción');
      })
      .catch((e) => setError(e?.message || String(e)));
  }, []);

  return { subscribed, error };
}

// Helper: VAPID base64 -> Uint8Array (formato exigido por PushManager)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}
