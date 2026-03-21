const CACHE = 'titanpro-v5';
const STATIC = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
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

// Network-first para arquivos do app (sempre pega versão nova quando online)
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
