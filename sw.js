const CACHE = 'kronia-diet-wizard-v3-20260523-v4';
const BUILD_VERSION = '20260523-diet-wizard-v3-v4';

const STATIC_ASSET_RE = /\.(?:css|js|png|jpg|jpeg|webp|svg|ico|json|woff2?)$/i;
const STATIC_ALLOWLIST = [
  '/styles.css',
  '/app.js',
  '/auth.js',
  '/plans.js',
  '/icons.js',
  '/manifest.json',
  '/Kronia.png',
  '/splash.png',
  '/transforms_patch.js',
  '/src/ui/diet/diet-entry-controller.js',
  '/src/ui/diet/diet-wizard-standalone.js',
  '/src/ui/diet/disable-legacy-diet.js',
  '/src/ui/labs/home-labs-cta-bridge.js'
];

const DIET_WIZARD_V3_BOOTSTRAP = `
<script id="kronia-diet-wizard-v3-bootstrap">
(function(){
  if(window.__kroniaDietWizardV3Bootstrap)return;
  window.__kroniaDietWizardV3Bootstrap=true;
  var VERSION='20260523-wizard-v3-v4';
  function load(src,id){return new Promise(function(resolve){var old=document.getElementById(id);if(old)old.remove();var s=document.createElement('script');s.id=id;s.src=src+'?v='+VERSION+'&t='+Date.now();s.async=false;s.onload=function(){resolve(true)};s.onerror=function(){resolve(false)};document.head.appendChild(s);});}
  function hideBlockers(){['kroniaForcedDietAnamnese','nutritionFlowScreen','dietChoiceScreen','dietEmergencyWizardScreen','customModal','bottomSheet','modalBackdrop','configSheet'].forEach(function(id){var el=document.getElementById(id);if(!el)return; if(id==='kroniaForcedDietAnamnese'){el.remove();return;} el.classList.remove('show','active','open');el.style.pointerEvents='none';});}
  async function openWizard(context){
    hideBlockers();
    try{if(typeof navTo==='function')navTo('dieta')}catch(e){}
    await load('/src/ui/diet/diet-wizard-standalone.js','kronia-diet-wizard-v3-force');
    var fn=(typeof window.openDietProfileWizard==='function'&&!window.openDietProfileWizard.__kroniaDietEntryWrapper)?window.openDietProfileWizard:null;
    if(!fn&&typeof window.openDietWizardStandalone==='function')fn=window.openDietWizardStandalone;
    if(!fn){try{showToast&&showToast('Não carregou a anamnese V3. Atualize o app.','error',4000)}catch(e){} return false;}
    return fn(Object.assign({source:'sw_diet_wizard_v3_bootstrap',forceAnamnese:true},context||{}));
  }
  function wrapper(context){return openWizard(context||{});} 
  window.KroniaDiet=Object.assign({},window.KroniaDiet||{},{forceAnamnese:wrapper,generate:wrapper,ai:wrapper,regenerate:wrapper,createPlan:wrapper});
  ['startAIDiet','generateDietPlan','regenerateDiet','regenerateDietPlan','createDietPlan','createAnotherDiet'].forEach(function(n){window[n]=wrapper});
  document.addEventListener('click',function(e){
    var el=e.target&&e.target.closest&&e.target.closest('button,a,div,section');if(!el)return;
    var txt=(el.innerText||el.textContent||'').toLowerCase();
    if(txt.indexOf('regenerar plano')>-1||txt.indexOf('dieta com ia')>-1||txt.indexOf('gerar dieta')>-1||txt.indexOf('criar dieta')>-1){e.preventDefault();e.stopPropagation();wrapper({source:'text_click_wizard_v3'});}
  },true);
})();
</script>`;

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

async function htmlWithDietBootstrap(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    const html = await response.text();
    const cleaned = html.replace(/<script id="kronia-diet-anamnese-force-inline">[\s\S]*?<\/script>/g, '');
    const patched = cleaned.includes('kronia-diet-wizard-v3-bootstrap')
      ? cleaned
      : cleaned.replace('</body>', DIET_WIZARD_V3_BOOTSTRAP + '\n</body>');
    return new Response(patched, { status: response.status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch (_) {
    return networkFirst(request);
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
    event.respondWith(htmlWithDietBootstrap(event.request));
    return;
  }

  if (/\.(?:js|css)$/i.test(url.pathname) || url.pathname.startsWith('/src/ui/diet/') || url.pathname.startsWith('/src/ui/labs/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (STATIC_ASSET_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
  }
});
