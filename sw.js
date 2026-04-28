const CACHE = 'kronia-v5-2026-04-28-diet-wizard-cache';
const BUILD_VERSION = '2026-04-28-diet-wizard-cache';

const STATIC = [
  '/',
  '/index.html',
  '/app.js?v=' + BUILD_VERSION,
  '/auth.js?v=' + BUILD_VERSION,
  '/styles.css?v=' + BUILD_VERSION,
  '/Kronia.png',
  '/splash.png',
  '/manifest.json',
  '/src/ui/diet/diet-entry-controller.js?v=' + BUILD_VERSION,
  '/src/ui/diet/diet-wizard-state.js?v=' + BUILD_VERSION,
  '/src/ui/diet/diet-step-body.js?v=' + BUILD_VERSION,
  '/src/ui/diet/diet-step-goal.js?v=' + BUILD_VERSION,
  '/src/ui/diet/diet-step-health.js?v=' + BUILD_VERSION,
  '/src/ui/diet/diet-step-food.js?v=' + BUILD_VERSION,
  '/src/ui/diet/diet-step-training.js?v=' + BUILD_VERSION,
  '/src/ui/diet/diet-step-metabolism.js?v=' + BUILD_VERSION,
  '/src/ui/diet/diet-summary.js?v=' + BUILD_VERSION,
  '/src/ui/diet/diet-wizard.js?v=' + BUILD_VERSION
];

// Instala e cacheia os arquivos estáticos sem travar a instalação se algum asset falhar.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(STATIC.map(url => c.add(url))))
      .then(() => self.skipWaiting())
  );
});

// Remove caches antigos e assume clientes abertos imediatamente.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ══ PWA PUSH NOTIFICATIONS ══════════════════════════
self.addEventListener('push', e => {
  let data = { title: 'KRONIA', body: 'Você tem uma atualização.' };
  try { data = e.data ? e.data.json() : data; } catch (err) {}
  e.waitUntil(
    self.registration.showNotification(data.title || 'KRONIA', {
      body: data.body || '',
      icon: '/Kronia.png',
      badge: '/Kronia.png',
      tag: data.tag || 'kronia-default',
      renotify: true,
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ══ BACKGROUND SYNC — workout cloud backup ══════════
self.addEventListener('sync', e => {
  if (e.tag === 'kronia-workout-sync') {
    e.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
        list.forEach(c => c.postMessage({ type: 'KRONIA_SYNC_WORKOUT' }));
      })
    );
  }
});

function shouldBypassCache(url) {
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('openai.com') ||
    url.hostname.includes('anthropic.com')
  ) return true;

  if (url.pathname.startsWith('/api/')) return true;

  // Dieta/wizard precisam sempre tentar rede primeiro para evitar JS antigo no iPhone/PWA.
  if (url.pathname.startsWith('/src/ui/diet/')) return false;

  return false;
}

// ══ Network-first para arquivos do app ══════════════
// Cache fallback apenas quando offline.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (url.origin !== self.location.origin) return;
  if (shouldBypassCache(url)) return;

  e.respondWith(
    fetch(e.request, { cache: 'no-store' }).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => {
      return caches.match(e.request).then(cached => {
        if (cached) return cached;

        if (e.request.mode === 'navigate') {
          return caches.match('/index.html').then(indexCached => {
            if (indexCached) return indexCached;
            return new Response('Offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
          });
        }

        return new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});
