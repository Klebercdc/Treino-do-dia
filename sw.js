const CACHE = 'kronia-exercise-media-fix-20260503';
const BUILD_VERSION = '20260503-exercise-media-fix';

const STATIC_ASSET_RE = /\.(?:css|js|png|jpg|jpeg|webp|svg|ico|json|woff2?)$/i;
const STATIC_ALLOWLIST = [
  '/styles.css',
  '/app.js',
  '/auth.js',
  '/plans.js',
  '/icons.js',
  '/manifest.json',
  '/Kronia.png',
  '/splash.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC_ALLOWLIST.map(path => path + '?v=' + BUILD_VERSION)).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('push', event => {
  let data = { title: 'KRONIA', body: 'Você tem uma atualização.' };
  try { data = event.data ? event.data.json() : data; } catch (_) {}
  event.waitUntil(
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

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
      return undefined;
    })
  );
});

self.addEventListener('sync', event => {
  if (event.tag === 'kronia-workout-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
        list.forEach(client => client.postMessage({ type: 'KRONIA_SYNC_WORKOUT' }));
      })
    );
  }
});

function shouldBypass(requestUrl) {
  if (requestUrl.origin !== self.location.origin) return true;
  if (requestUrl.pathname === '/api/kronia/exercises/details') return true;
  if (requestUrl.pathname.startsWith('/api/')) return true;
  if (/supabase|googleapis|gstatic|jsdelivr|cdnjs|unpkg|openai|anthropic/i.test(requestUrl.hostname)) return true;
  return false;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && request.method === 'GET') {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone()).catch(() => undefined);
  }
  return response;
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (shouldBypass(url)) return;

  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/index.html')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (/\.(?:js|css)$/i.test(url.pathname) || url.pathname.startsWith('/src/ui/diet/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (STATIC_ASSET_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
  }
});
