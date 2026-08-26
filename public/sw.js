/* FonoAudio-Pro — Service Worker (push web para la mascota secretario clínico)
   NOTA: NO contiene branding FonoAudio-Pro en notificaciones entregadas a pacientes.
   Push entregado al profesional (fonoaudiólogo), identidad neutra.
*/
const CACHE = 'fonoaudio-pro-cache-v1';

self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => self.clients.claim());

// Recibir push del worker cron (check-reminders) y mostrar notificación
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { /* ignore */ }
  const title = data.title || '🔔 Recordatorio clínico';
  const options = {
    body: data.body || 'Tenés un recordatorio pendiente.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || 'clinical-reminder',
    data: {
      url: data.url || '/',
      appointmentId: data.appointmentId,
      type: data.type || 'reminder',
    },
    requireInteraction: data.requireInteraction || false,
    actions: [
      { action: 'open', title: 'Abrir agenda' },
    ],
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Click en la notificación → abrir la app en la pestaña/página indicada
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = e.notification.data?.url || '/';
  e.waitUntil(
    self.clients.openWindow(target)
  );
});
