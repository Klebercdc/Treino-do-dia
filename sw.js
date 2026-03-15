const CACHE = 'titanpro-v2';
const STATIC = [
  '/',
  '/index.html',
  '/titanpro.png',
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

// Cache-first para estáticos, network-first para API/Supabase
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

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Cacheia só respostas válidas do mesmo origin
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
