const CACHE = 'kronia-remove-profile-base-v3';
const BUILD_VERSION = 'remove-profile-base-v3';

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
  '/src/ui/diet/disable-legacy-diet.js?v=' + BUILD_VERSION,
  '/src/ui/diet/diet-wizard-standalone.js?v=' + BUILD_VERSION,
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

const LEGACY_PROFILE_BASE_KILLER = `
<style id="kronia-profile-base-killer-style">
  #dietDataScreen,
  #nutritionFlowScreen,
  .diet-profile-base-legacy,
  [data-legacy-diet-profile-base="1"] {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
</style>
<script id="kronia-profile-base-killer-script">
(function(){
  var KILL_IDS = ['dietDataScreen','nutritionFlowScreen'];
  function txt(el){ return String((el && el.textContent) || '').slice(0, 800); }
  function isBad(el){ return !!(el && /Perfil base|Dados base|25%/i.test(txt(el))); }
  function kill(el){
    if(!el) return;
    el.setAttribute('data-legacy-diet-profile-base','1');
    el.classList && el.classList.remove('show','active','open');
    el.style.setProperty('display','none','important');
    el.style.setProperty('visibility','hidden','important');
    el.style.setProperty('opacity','0','important');
    el.style.setProperty('pointer-events','none','important');
    el.setAttribute('aria-hidden','true');
  }
  function scan(){
    KILL_IDS.forEach(function(id){ var el=document.getElementById(id); if(el && isBad(el)) kill(el); });
    document.querySelectorAll('.screen,.modal,.sheet,[id*="diet"],[id*="Diet"],[class*="diet"],[class*="Diet"]').forEach(function(el){ if(isBad(el)) kill(el); });
  }
  window.__kroniaKillLegacyProfileBase = scan;
  document.addEventListener('DOMContentLoaded', scan, true);
  document.addEventListener('click', function(){ setTimeout(scan,0); setTimeout(scan,120); }, true);
  setInterval(scan, 250);
  scan();
})();
</script>`;

const DIET_SCRIPTS = LEGACY_PROFILE_BASE_KILLER + '\n' +
  '<script src="/src/ui/diet/disable-legacy-diet.js?v=' + BUILD_VERSION + '" data-kronia-disable-legacy-diet="1"></script>\n' +
  '<script src="/src/ui/diet/diet-entry-controller.js?v=' + BUILD_VERSION + '" data-kronia-diet-entry="1"></script>';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(STATIC.map(url => c.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

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
  return false;
}

async function injectDietController(response) {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;
    let html = await response.text();

    html = html.replace(/<script[^>]+src=["']\/src\/ui\/diet\/diet-entry-controller\.js[^>]*><\/script>/g, '');
    html = html.replace(/<script[^>]+src=["']\/src\/ui\/diet\/disable-legacy-diet\.js[^>]*><\/script>/g, '');
    html = html.replace(/<style[^>]+id=["']kronia-profile-base-killer-style["'][\s\S]*?<\/style>/g, '');
    html = html.replace(/<script[^>]+id=["']kronia-profile-base-killer-script["'][\s\S]*?<\/script>/g, '');

    if (html.includes('</head>')) {
      html = html.replace('</head>', LEGACY_PROFILE_BASE_KILLER + '\n</head>');
    } else {
      html = LEGACY_PROFILE_BASE_KILLER + html;
    }

    if (html.includes('</body>')) {
      html = html.replace('</body>', DIET_SCRIPTS + '\n</body>');
    } else {
      html += DIET_SCRIPTS;
    }

    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Kronia-Diet-Hotfix': BUILD_VERSION
      }
    });
  } catch (err) {
    return response;
  }
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (url.origin !== self.location.origin) return;
  if (shouldBypassCache(url)) return;

  if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(res => injectDietController(res))
        .catch(() => caches.match('/index.html').then(cached => {
          if (cached) return injectDietController(cached);
          return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }))
    );
    return;
  }

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
        return new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});
