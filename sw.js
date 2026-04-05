const CACHE = 'kronia-v4-2026-04-04-1';
const STATIC = [
  '/',
  '/index.html',
  '/app.js?v=2026-04-04-1',
  '/auth.js?v=2026-04-04-1',
  '/styles.css?v=20260322d',
  '/Kronia.png',
  '/splash.png',
  '/manifest.json'
];

// Instala e cacheia os arquivos estáticos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// Remove caches antigos
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

// ══ Network-first para arquivos do app ══════════════
// Cache fallback apenas quando offline
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Deixa passar: supabase, google, cdn, APIs externas
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('openai.com') ||
    url.hostname.includes('anthropic.com')
  ) return;

  // Só intercepta requisições do mesmo origin
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request).then(res => {
      // Atualiza cache com versão nova
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => {
      // Offline: serve do cache
      return caches.match(e.request);
    })
  );
});
