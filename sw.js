const CACHE = 'kronia-login-direct-auth-fix-20260608';
const BUILD_VERSION = '20260608-login-direct-auth-fix-v2';

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
  '/src/ui/diet/kronia-diet-runtime.js',
  '/src/ui/diet/diet-entry-controller.js',
  '/src/ui/diet/diet-wizard-standalone.js',
  '/src/ui/diet/disable-legacy-diet.js',
  '/src/ui/labs/home-labs-cta-bridge.js'
];

const AUTH_LOGIN_HOTFIX = `

/* KRONIA AUTH HOTFIX — injected by sw.js 20260608 */
(function(){
  function forceLoginVisible(){
    var splash=document.getElementById('splashScreen');
    if(splash){
      splash.classList.remove('show','active','open');
      splash.style.setProperty('display','none','important');
      splash.style.setProperty('visibility','hidden','important');
      splash.style.setProperty('opacity','0','important');
      splash.setAttribute('aria-hidden','true');
    }
    var login=document.getElementById('loginScreen');
    if(login){
      login.classList.add('show','active','open');
      login.removeAttribute('aria-hidden');
      login.style.setProperty('display','flex','important');
      login.style.setProperty('visibility','visible','important');
      login.style.setProperty('opacity','1','important');
      login.style.setProperty('pointer-events','auto','important');
      login.style.setProperty('position','fixed','important');
      login.style.setProperty('inset','0','important');
      login.style.setProperty('z-index','2147483646','important');
      login.style.setProperty('transform','none','important');
    }
    var email=document.getElementById('emailLoginScreen');
    if(email){
      email.style.setProperty('z-index','2147483647','important');
      email.style.setProperty('pointer-events','auto','important');
    }
    var home=document.getElementById('homeScreen');
    if(home){
      home.classList.remove('show','active','open');
      home.setAttribute('aria-hidden','true');
    }
    var footer=document.querySelector('.footer-actions');
    if(footer) footer.style.setProperty('display','none','important');
    if(document.body) document.body.classList.add('overlay-open');
  }
  var originalShowLogin = typeof window.showLogin === 'function' ? window.showLogin : null;
  window.showLogin = function(){
    try{ if(originalShowLogin && originalShowLogin !== window.showLogin) originalShowLogin.apply(window, arguments); }catch(e){}
    forceLoginVisible();
    return true;
  };
  window.showLogin.__kroniaAuthHotfix = true;
  window.KroniaLoginFix = { forceVisible: forceLoginVisible, show: window.showLogin };

  var originalHandleAuthClick = typeof window.handleAuthClick === 'function' ? window.handleAuthClick : null;
  window.handleAuthClick = function(){
    try{
      if(window._sb && window._sb.auth && typeof window._sb.auth.getSession === 'function'){
        return window._sb.auth.getSession().then(function(res){
          var session = res && res.data && res.data.session;
          if(session && session.user && typeof window.toggleAuthMenu === 'function') return window.toggleAuthMenu();
          return window.showLogin();
        }).catch(function(){ return window.showLogin(); });
      }
    }catch(e){}
    if(originalHandleAuthClick){
      try{ return originalHandleAuthClick.apply(window, arguments); }catch(e){}
    }
    return window.showLogin();
  };
})();
`;

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

async function authNetworkFirstPatched(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    const source = response && response.ok ? await response.text() : '';
    const patched = source + AUTH_LOGIN_HOTFIX;
    const patchedResponse = new Response(patched, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Kronia-Hotfix': BUILD_VERSION
      }
    });
    const cache = await caches.open(CACHE);
    cache.put(request, patchedResponse.clone()).catch(() => undefined);
    return patchedResponse;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(AUTH_LOGIN_HOTFIX, { status: 200, headers: { 'Content-Type': 'application/javascript; charset=utf-8' } });
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

  if (url.pathname === '/auth.js') {
    event.respondWith(authNetworkFirstPatched(event.request));
    return;
  }

  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/index.html')) {
    event.respondWith(networkFirst(event.request));
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