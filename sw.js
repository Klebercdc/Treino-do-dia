const CACHE = 'kronia-diet-anamnese-force-20260523-v3';
const BUILD_VERSION = '20260523-diet-anamnese-force-v3';

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

const DIET_ANAMNESE_BOOTSTRAP = `
<script id="kronia-diet-anamnese-force-inline">
(function(){
  if(window.__kroniaDietAnamneseForceInline)return;
  window.__kroniaDietAnamneseForceInline=true;
  function hideBlockers(){['nutritionFlowScreen','dietChoiceScreen','dietEmergencyWizardScreen','customModal','bottomSheet','modalBackdrop','configSheet'].forEach(function(id){var el=document.getElementById(id);if(!el)return;el.classList.remove('show','active','open');el.style.pointerEvents='none';});}
  function toast(m){try{if(typeof showToast==='function')showToast(m,'info',2500)}catch(e){}}
  function modal(){
    hideBlockers();
    var old=document.getElementById('kroniaForcedDietAnamnese');if(old)old.remove();
    var s=document.createElement('div');s.id='kroniaForcedDietAnamnese';
    s.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.82);display:flex;align-items:flex-end;justify-content:center;font-family:inherit';
    s.innerHTML='<section style="width:100%;max-width:560px;max-height:92vh;overflow:auto;background:#020617;color:white;border:1px solid rgba(34,197,94,.35);border-radius:28px 28px 0 0;padding:22px;box-shadow:0 -20px 70px rgba(0,0,0,.55)"><button id="kdfaClose" style="float:right;background:rgba(255,255,255,.08);color:white;border:0;border-radius:50%;width:36px;height:36px;font-size:22px">×</button><p style="color:#22c55e;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;margin:0 0 8px">Anamnese nutricional</p><h2 style="margin:0 42px 10px 0;font-size:26px">Personalizar dieta com IA</h2><p style="color:#a1a1aa;font-size:14px;line-height:1.45">Preencha os dados essenciais para gerar uma dieta personalizada.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label>Objetivo<select id="kdfaGoal"><option value="hipertrofia">Hipertrofia</option><option value="emagrecimento">Emagrecimento</option><option value="manutencao">Manutenção</option></select></label><label>Sexo<select id="kdfaSexo"><option value="masculino">Masculino</option><option value="feminino">Feminino</option></select></label><label>Idade<input id="kdfaIdade" type="number" placeholder="30"></label><label>Peso kg<input id="kdfaPeso" type="number" placeholder="80"></label><label>Altura cm<input id="kdfaAltura" type="number" placeholder="175"></label><label>Refeições<select id="kdfaRefeicoes"><option>3</option><option selected>4</option><option>5</option><option>6</option></select></label></div><label style="display:block;margin-top:10px">Preferências<textarea id="kdfaPrefs" rows="2" placeholder="frango, ovos, arroz..."></textarea></label><label style="display:block;margin-top:10px">Restrições/patologias<textarea id="kdfaRest" rows="2" placeholder="diabetes, hipertensão, alergias..."></textarea></label><button id="kdfaSubmit" style="width:100%;margin-top:16px;background:#22c55e;color:#03130a;border:0;border-radius:16px;padding:16px;font-weight:900;font-size:16px">Gerar dieta personalizada</button><style>#kroniaForcedDietAnamnese label{display:block;font-size:13px;font-weight:800;color:#e5e7eb}#kroniaForcedDietAnamnese input,#kroniaForcedDietAnamnese select,#kroniaForcedDietAnamnese textarea{width:100%;box-sizing:border-box;margin-top:6px;background:#0f172a;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:13px;padding:12px}@media(max-width:430px){#kroniaForcedDietAnamnese section div{grid-template-columns:1fr!important}}</style></section>';
    document.body.appendChild(s);
    document.getElementById('kdfaClose').onclick=function(){s.remove()};
    document.getElementById('kdfaSubmit').onclick=function(){
      var p={objetivo:kdfaGoal.value,goal:kdfaGoal.value,sexo:kdfaSexo.value,idade:Number(kdfaIdade.value||0),peso:Number(kdfaPeso.value||0),altura:Number(kdfaAltura.value||0),refeicoesPorDia:Number(kdfaRefeicoes.value||4),nivelAtividade:'moderado',rotina:'moderado',preferencias:(kdfaPrefs.value||'').split(/[,;\\n]+/).filter(Boolean),restricoes:(kdfaRest.value||'').split(/[,;\\n]+/).filter(Boolean),patologias:(kdfaRest.value||'').split(/[,;\\n]+/).filter(Boolean),source:'forced_inline_anamnese',updatedAt:new Date().toISOString()};
      if(!p.idade||!p.peso||!p.altura){toast('Preencha idade, peso e altura.');return;}
      try{localStorage.setItem('kronia_diet_anamnese_profile',JSON.stringify(p));localStorage.setItem('kronia_nutrition_profile_v1',JSON.stringify(p));}catch(e){}
      s.remove();
      var names=['gerarDieta','generateAIDiet','generateDiet','createAIDiet','createDiet','startNutritionGeneration','startDietGeneration'];
      for(var i=0;i<names.length;i++){try{if(typeof window[names[i]]==='function'){window[names[i]]({profileData:p,profile:p,dietWizardPayload:p,source:'forced_inline_after_anamnese'});return;}}catch(e){}}
      try{if(typeof openDietDataScreen==='function')openDietDataScreen();}catch(e){}
    };
  }
  window.KroniaDiet=Object.assign({},window.KroniaDiet||{},{forceAnamnese:modal,generate:modal,ai:modal,regenerate:modal,createPlan:modal});
  ['startAIDiet','generateDietPlan','regenerateDiet','regenerateDietPlan','createDietPlan','createAnotherDiet'].forEach(function(n){window[n]=modal});
  document.addEventListener('click',function(e){
    var el=e.target&&e.target.closest&&e.target.closest('button,a,div,section');if(!el)return;
    var txt=(el.innerText||el.textContent||'').toLowerCase();
    if(txt.indexOf('regenerar plano')>-1||txt.indexOf('dieta com ia')>-1||txt.indexOf('gerar dieta')>-1){e.preventDefault();e.stopPropagation();modal();}
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
    const patched = html.includes('kronia-diet-anamnese-force-inline')
      ? html
      : html.replace('</body>', DIET_ANAMNESE_BOOTSTRAP + '\n</body>');
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
