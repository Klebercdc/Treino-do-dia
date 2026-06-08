/* ═══════════════════════════════════════════════════
   SUPABASE AUTH — Google OAuth
═══════════════════════════════════════════════════ */
const KRONIA_FALLBACK_SUPABASE_URL = 'https://twxoddzogbmaysebhour.supabase.co';
const KRONIA_FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3eG9kZHpvZ2JtYXlzZWJob3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTk4MzgsImV4cCI6MjA4OTA3NTgzOH0.8xXiTS863_rtKOE3g2wDn7PdQVKCFj2hxhtnya3Wa5E';

function resolveSupabaseClientConfig() {
  const runtime = (typeof window !== 'undefined' && window.__KRONIA_ENV__ && typeof window.__KRONIA_ENV__ === 'object')
    ? window.__KRONIA_ENV__
    : {};

  const fromWindowUrl = typeof window !== 'undefined' ? String(window.KRONIA_SUPABASE_URL || '').trim() : '';
  const fromWindowKey = typeof window !== 'undefined' ? String(window.KRONIA_SUPABASE_ANON_KEY || '').trim() : '';

  const fromRuntimeUrl = String(runtime.SUPABASE_URL || runtime.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const fromRuntimeKey = String(runtime.SUPABASE_ANON_KEY || runtime.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

  const fromStorageUrl = typeof localStorage !== 'undefined' ? String(localStorage.getItem('kronia_supabase_url') || '').trim() : '';
  const fromStorageKey = typeof localStorage !== 'undefined' ? String(localStorage.getItem('kronia_supabase_anon_key') || '').trim() : '';

  const url = fromWindowUrl || fromRuntimeUrl || fromStorageUrl || KRONIA_FALLBACK_SUPABASE_URL;
  const anonKey = fromWindowKey || fromRuntimeKey || fromStorageKey || KRONIA_FALLBACK_SUPABASE_ANON_KEY;

  if ((!fromWindowUrl && !fromRuntimeUrl && !fromStorageUrl) || (!fromWindowKey && !fromRuntimeKey && !fromStorageKey)) {
    console.warn('[auth] Supabase config não injetada por ambiente. Usando fallback legado; configure KRONIA_SUPABASE_URL/KRONIA_SUPABASE_ANON_KEY.');
  }

  return { url, anonKey };
}

const _sbConfig = resolveSupabaseClientConfig();
const _sb = supabase.createClient(_sbConfig.url, _sbConfig.anonKey);
if (typeof window !== 'undefined') {
  window._sb = _sb;
}

// ══════════════════════════════════════════════════════
// TOKEN DE AUTENTICAÇÃO — enviado em todas as chamadas à API
// ══════════════════════════════════════════════════════
async function getAuthHeaders(opts = {}) {
  const { data: { session } } = await _sb.auth.getSession();
  const token = session?.access_token;
  const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  const headers = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  return headers;
}

/**
 * Wrapper de fetch com tratamento automático de falha de token (401).
 * Em caso de 401: força refresh da sessão e tenta uma vez mais.
 * Se ainda 401 após retry (sessão expirada), faz logout e exibe aviso.
 */
async function apiFetch(url, opts = {}) {
  // iOS Safari PWA fix — sempre converte para URL absoluta para evitar
  // "The string did not match the expected pattern" em PWAs.
  if (typeof url === 'string') {
    const fallbackBase = 'https://kronia.app.br';
    const normalizeRelativePath = function(raw) {
      const value = String(raw || '').trim() || '/';
      return value.startsWith('/') ? value : ('/' + value);
    };
    try {
      const resolved = new URL(url, window.location.href);
      const isHttp = /^https?:$/i.test(String(resolved.protocol || ''));
      const hasHost = Boolean(String(resolved.host || '').trim());
      if (!isHttp || !hasHost) {
        url = fallbackBase + normalizeRelativePath(url);
      } else {
        url = resolved.toString();
      }
    } catch {
      const currentOrigin = (window.location && /^https?:$/i.test(String(window.location.protocol || '')) && window.location.host)
        ? (window.location.protocol + '//' + window.location.host)
        : fallbackBase;
      url = currentOrigin + normalizeRelativePath(url);
    }
  }
  const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  const receivedHeaders = new Headers(opts.headers || {});
  const authHeaders = await getAuthHeaders(opts);
  const mergedHeaders = new Headers(receivedHeaders);
  Object.entries(authHeaders).forEach(([key, value]) => {
    mergedHeaders.set(key, value);
  });
  if (isFormData) {
    mergedHeaders.delete('Content-Type');
  }
  opts.headers = mergedHeaders;
  let resp = await fetch(url, opts);

  if (resp.status === 401) {
    // Força refresh e tenta novamente
    try {
      const { data } = await _sb.auth.refreshSession();
      if (data?.session?.access_token) {
        const retryHeaders = new Headers(opts.headers || {});
        retryHeaders.set('Authorization', 'Bearer ' + data.session.access_token);
        if (isFormData) {
          retryHeaders.delete('Content-Type');
        } else {
          retryHeaders.set('Content-Type', 'application/json');
        }
        opts.headers = retryHeaders;
        resp = await fetch(url, opts);
      }
    } catch {}

    // Se ainda 401, sessão inválida — logout automático
    if (resp.status === 401) {
      await _sb.auth.signOut();
      _appUnlocked = false;
      showLogin();
      if (typeof showToast === 'function') {
        showToast('Sessão expirada. Faça login novamente.', 'error', 4000);
      }
      throw new Error('Sessão expirada. Faça login novamente.');
    }
  }

  return resp;
}

// ══════════════════════════════════════════════════════
// SINCRONIZAÇÃO COM SUPABASE (backup em nuvem)
// ══════════════════════════════════════════════════════
const _dbSync = {
  // Combina config local + nuvem preservando campos já preenchidos
  mergeConfig(localCfg, cloudCfg) {
    const local = (localCfg && typeof localCfg === 'object') ? localCfg : {};
    const cloud = (cloudCfg && typeof cloudCfg === 'object') ? cloudCfg : {};
    const merged = Object.assign({}, cloud, local);

    // Se campo local estiver vazio e nuvem tiver valor, prefere nuvem
    Object.keys(cloud).forEach((k) => {
      const vLocal = merged[k];
      const vCloud = cloud[k];
      const localVazio = vLocal === '' || vLocal === null || typeof vLocal === 'undefined';
      if (localVazio && vCloud !== null && typeof vCloud !== 'undefined' && vCloud !== '') {
        merged[k] = vCloud;
      }
    });

    return merged;
  },

  // Envia histórico de treinos para o banco em background
  async pushHistory() {
    try {
      const { data: { session } } = await _sb.auth.getSession();
      if (!session?.user) return;
      const userId = session.user.id;
      const hist = safeJSON(STORAGE.historyKey, []);
      if (!hist.length) return;
      // Upsert: envia cada sessão nova (usa id como chave única)
      const rows = hist.map(s => ({
        id: s.id,
        user_id: userId,
        session_data: s,
        trained_at: s.createdAt || new Date().toISOString(),
        synced_at: new Date().toISOString()
      }));
      await _sb.from('workout_history').upsert(rows, { onConflict: 'id' });
    } catch (e) { /* sync é silencioso — não interrompe o usuário */ }
  },

  // Envia perfil/config do usuário para o banco em background
  async pushConfig() {
    try {
      const { data: { session } } = await _sb.auth.getSession();
      if (!session?.user) return;
      const userId = session.user.id;
      const config = safeJSON('kronia_config', {});
      await _sb.from('profiles').upsert({
        id: userId,
        config: config,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch (e) { /* silencioso */ }
  },

  // Ao fazer login: puxa dados do banco e mescla com localStorage
  async pullAll(userId) {
    try {
      // Puxa histórico
      const { data: histRows } = await _sb
        .from('workout_history')
        .select('session_data, trained_at')
        .eq('user_id', userId)
        .order('trained_at', { ascending: false })
        .limit(STORAGE.maxHistory);

      if (histRows && histRows.length > 0) {
        const localHist = safeJSON(STORAGE.historyKey, []);
        const localIds = new Set(localHist.map(s => s.id));
        const novas = histRows
          .map(r => r.session_data)
          .filter(s => s && !localIds.has(s.id));
        if (novas.length > 0) {
          const merged = [...localHist, ...novas]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, STORAGE.maxHistory);
          localStorage.setItem(STORAGE.historyKey, JSON.stringify(merged));
        }
      }

      // Puxa config/perfil
      const { data: profile } = await _sb
        .from('profiles')
        .select('config,is_admin')
        .eq('id', userId)
        .single();

      const localCfg = safeJSON('kronia_config', {});
      const cloudCfg = (profile && profile.config && typeof profile.config === 'object')
        ? profile.config
        : {};


      if (profile && typeof profile.is_admin === 'boolean') {
        window.KroniaAccessProfile = window.KroniaAccessProfile || {};
        window.KroniaAccessProfile.isAdmin = !!profile.is_admin;
        window.KroniaAccessProfile.canBypassQuota = !!profile.is_admin;
        window.KroniaAccessProfile.canSeeAdminUI = !!profile.is_admin;
        trackAdminHydrationDebug('profile_loaded_from_supabase', { profileIsAdmin: !!profile.is_admin });
        refreshIntelligenceAdminAccessSafe();
        if (window.KroniaAccessScope && typeof window.KroniaAccessScope.buildUserCapabilities === 'function') {
          window.currentUserCapabilities = window.KroniaAccessScope.buildUserCapabilities(window.KroniaAccessProfile);
          window.KroniaAccessScope.setupAdminDebug && window.KroniaAccessScope.setupAdminDebug();
          trackAdminHydrationDebug('access_capabilities_hydrated');
        }
      }

            const mergedCfg = this.mergeConfig(localCfg, cloudCfg);
      localStorage.setItem('kronia_config', JSON.stringify(mergedCfg));

      // Se nuvem estiver desatualizada/vazia, reenvia o merge para persistir
      if (Object.keys(mergedCfg).length > Object.keys(cloudCfg).length) {
        await _sb.from('profiles').upsert({
          id: userId,
          config: mergedCfg,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      }
    } catch (e) { /* silencioso */ }
  }
};

let _authMenuOpen = false;
let _appUnlocked = false;
const KRONIA_DEFAULT_WEB_REDIRECT = window.location.origin + window.location.pathname;
const KRONIA_DEFAULT_MOBILE_REDIRECT = 'kronia://login-callback';

function isKroniaDeepLink(url) {
  return typeof url === 'string' && /^[a-z][a-z0-9+.-]*:\/\//i.test(url) && !/^https?:\/\//i.test(url);
}

function resolveOAuthRedirectUrl() {
  const configured = (window.KRONIA_OAUTH_REDIRECT_TO || localStorage.getItem('kronia_oauth_redirect_to') || '').trim();
  if (configured) return configured;
  const runningInMobileContainer = !!(
    window.Capacitor ||
    window.cordova ||
    window.ReactNativeWebView ||
    window.KRONIA_MOBILE_OAUTH
  );
  if (runningInMobileContainer) return KRONIA_DEFAULT_MOBILE_REDIRECT;
  return KRONIA_DEFAULT_WEB_REDIRECT;
}

function resolveOAuthOptions() {
  const redirectTo = resolveOAuthRedirectUrl();
  const isDeepLink = isKroniaDeepLink(redirectTo);
  return {
    redirectTo,
    skipBrowserRedirect: isDeepLink
  };
}

function refreshIntelligenceAdminAccessSafe() {
  try { window.KroniaIntelligenceAdmin?.refreshAccess?.(); } catch (_) {}
  trackAdminHydrationDebug('refresh_access_called');
}


function trackAdminHydrationDebug(stage, extra) {
  try {
    var profile = window.KroniaAccessProfile || {};
    if (!profile.isAdmin) return;
    var payload = Object.assign({
      stage: stage,
      isAdmin: !!profile.isAdmin,
      canSeeAdminUI: !!profile.canSeeAdminUI,
      canBypassQuota: !!profile.canBypassQuota,
      timestamp: new Date().toISOString(),
    }, extra || {});
    window.KroniaIntelligence?.setAdminAuditTrace?.({ adminHydration: payload });
    window.KroniaIntelligence?.track?.({
      module: 'auth',
      action: 'admin_hydration_debug',
      status: 'success',
      source: 'auth',
      metadata: payload,
    });
  } catch (_err) {
    return;
  }
}

function hideSplash() {
  const el = document.getElementById('splashScreen');
  if (!el || el.style.display === 'none') return;
  el.style.animation = 'splashAutoHide 0.4s ease forwards';
  setTimeout(() => { el.style.display = 'none'; }, 400);
}

function showApp() {
  if (_appUnlocked) return;
  _appUnlocked = true;
  hideSplash();
  const login = document.getElementById('loginScreen');
  if (login) login.style.display = 'none';
  const emailLogin = document.getElementById('emailLoginScreen');
  if (emailLogin) emailLogin.classList.remove('show');
  // Dispara fluxo de primeira vez após telas fecharem
  setTimeout(checkFirstTimeFlow, 350);
}

async function bootstrapAuthenticatedSession(session) {
  try {
    try {
      window.KroniaIntelligence?.init?.({ source: 'auth_bootstrap', appVersion: 'web' });
      window.KroniaIntelligence?.identifyUser?.({ userId: session.user.id, sessionId: session.access_token ? String(session.access_token).slice(0, 16) : undefined });
      window.KroniaIntelligence?.setContext?.({ route: 'inicio', currentJourney: 'authenticated_session' });
      window.KroniaIntelligence?.track?.({ module: 'auth', action: 'loginSuccess', status: 'success', correlationId: 'login_' + Date.now(), source: 'auth_state_change' });
    } catch (_) {}
    if (window.KroniaAccessScope && typeof window.KroniaAccessScope.hydrateAccessContext === 'function') {
      await window.KroniaAccessScope.hydrateAccessContext(session);
      trackAdminHydrationDebug('hydrate_access_context_completed', { source: 'on_auth_state_change' });
    }
    window.KroniaIntelligenceAdmin?.refreshAccess?.();
    await _dbSync.pullAll(session.user.id);
    if (typeof fetchUserPlan === 'function') {
      try { await fetchUserPlan(); } catch (_) {}
    }
  } catch (_) {}
  if (typeof window.KroniaDashboard !== 'undefined') {
    window.KroniaDashboard.render(session.user.id);
  }
  refreshIntelligenceAdminAccessSafe();
}

function handleBusinessRoute(route) {
  if (route === 'krona-setup') {
    if (typeof openKronaSetup === 'function') openKronaSetup();
    return;
  }

  if (route === 'onboarding') {
    const ob = document.getElementById('onboarding');
    if (ob) {
      ob.classList.add('show');
      document.body.classList.add('overlay-open');
      const f = document.querySelector('.footer-actions');
      if (f) f.style.display = 'none';
      if (typeof ffObGoTo === 'function') ffObGoTo(0);
    }
    return;
  }

  if (route === 'plans') {
    if (typeof openPlanModal === 'function') openPlanModal();
    return;
  }

  if (typeof navTo === 'function') navTo('inicio');
  if (typeof openHome === 'function') openHome();
}

function checkFirstTimeFlow() {
  const appLayer = window.KroniaApplication && window.KroniaApplication.application;
  if (!appLayer) {
    handleBusinessRoute(!localStorage.getItem('kronia_profile_setup_done') ? 'krona-setup' : (!localStorage.getItem('kronia_onboarded') ? 'onboarding' : 'inicio'));
    return;
  }

  if (typeof appLayer.resolveInitialRoute !== 'function') {
    handleBusinessRoute(!localStorage.getItem('kronia_profile_setup_done') ? 'krona-setup' : (!localStorage.getItem('kronia_onboarded') ? 'onboarding' : 'inicio'));
    return;
  }

  const routeResolution = appLayer.resolveInitialRoute({
    isAuthenticated: true,
    profileSetupDone: !!localStorage.getItem('kronia_profile_setup_done'),
    onboardingDone: !!localStorage.getItem('kronia_onboarded'),
    hasPlan: !!localStorage.getItem('kronia_plan'),
    planActive: true,
    planExpired: false,
    blocked: false,
  });
  try {
    window.KroniaIntelligence?.track?.({
      module: 'auth',
      action: 'resolveInitialRoute',
      status: 'success',
      source: 'auth_check_first_time_flow',
      route: routeResolution && routeResolution.nextAction ? routeResolution.nextAction.route : 'inicio'
    });
  } catch (_) {}

  handleBusinessRoute(routeResolution && routeResolution.nextAction ? routeResolution.nextAction.route : 'inicio');
}

function showLogin() {
  hideSplash();
  const login = document.getElementById('loginScreen');
  if (login) login.style.display = 'flex';
  // Esconde a home para não ficar visível atrás
  const home = document.getElementById('homeScreen');
  if (home) home.classList.remove('show');
}

function updateAuthUI(user) {
  const btn    = document.getElementById('authBtn');
  const label  = document.getElementById('authLabel');
  const avatar = document.getElementById('userAvatar');
  if (!btn) return;
  if (user) {
    const pic = user.user_metadata?.avatar_url || '';
    label.textContent = user.user_metadata?.name?.split(' ')[0] || 'Conta';
    if (pic) { avatar.src = pic; avatar.style.display = 'block'; }
    btn.style.borderColor = 'var(--accent)';
    const menuAvatar = document.getElementById('authMenuAvatar');
    if (menuAvatar && pic) menuAvatar.src = pic;
    const menuName = document.getElementById('authMenuName');
    if (menuName) menuName.textContent = user.user_metadata?.full_name || user.email;
    const menuEmail = document.getElementById('authMenuEmail');
    if (menuEmail) menuEmail.textContent = user.email;
  } else {
    label.textContent = 'Entrar';
    avatar.style.display = 'none';
    btn.style.borderColor = '';
    closeAuthMenu();
  }
}

function handleAuthClick() {
  _sb.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) toggleAuthMenu();
    else showLogin();
  });
}

function handleAvatarUpload(event) {
  if (event && event.target) event.target.value = '';
  if (typeof showToast === 'function') showToast('Perfil usa monograma. Upload desativado.', 'info', 2200);
}

function applyAvatarPhoto(dataUrl) {
  const perfilEl = document.getElementById('perfilAvatar');
  const homeEl = document.getElementById('homeCardAvatar');
  if (perfilEl) perfilEl.style.backgroundImage = '';
  if (homeEl) homeEl.style.backgroundImage = '';
}

let _loginIsRegister = false;

function showEmailLogin(isRegister) {
  _loginIsRegister = !!isRegister;
  const screen = document.getElementById('emailLoginScreen');
  screen.classList.add('show');
  const bodyTitle = document.getElementById('emailLoginBodyTitle');
  if (bodyTitle) bodyTitle.textContent = isRegister ? 'Criar conta' : 'Entrar na conta';
  document.getElementById('btnEmail').textContent = isRegister ? 'Criar conta' : 'Entrar';
  document.getElementById('loginToggleLabel').textContent = isRegister ? 'Já tenho conta' : 'Criar conta';
  const headerTitle = document.getElementById('emailLoginHeaderTitle');
  if (headerTitle) headerTitle.textContent = isRegister ? 'Criar conta' : 'Login';
  document.getElementById('loginPassword').placeholder = isRegister ? 'Criar senha (mín. 6 caracteres)' : 'Senha (mínimo 6 caracteres)';
  document.getElementById('loginPassword').autocomplete = isRegister ? 'new-password' : 'current-password';
  document.getElementById('loginError').textContent = '';
  document.getElementById('forgotPassLink').style.display = isRegister ? 'none' : 'block';
}

function showEmailLoginRegister() {
  showEmailLogin(true);
}

function hideEmailLogin() {
  document.getElementById('emailLoginScreen').classList.remove('show');
}

function toggleLoginMode() {
  showEmailLogin(!_loginIsRegister);
}

async function authForgotPassword() {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) { document.getElementById('loginError').textContent = 'Digite seu e-mail primeiro.'; return; }
  const { error } = await _sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
  if (error) { document.getElementById('loginError').textContent = error.message; }
  else { document.getElementById('loginError').style.color = '#22c55e'; document.getElementById('loginError').textContent = 'E-mail de recuperação enviado!'; }
}

async function authSignInEmail() {
  const loginStart = Date.now();
  const correlationId = 'login_' + loginStart;
  try { window.KroniaIntelligence?.track?.({ module: 'auth', action: 'login', status: 'start', correlationId, source: 'auth_email' }); } catch (_) {}
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';

  if (!email || !password) { errEl.textContent = 'Preencha e-mail e senha.'; return; }
  if (password.length < 6) { errEl.textContent = 'Senha deve ter pelo menos 6 caracteres.'; return; }

  const btn = document.getElementById('btnEmail');
  btn.textContent = '...'; btn.disabled = true;

  try {
    let result;
    if (_loginIsRegister) {
      result = await _sb.auth.signUp({ email, password });
      if (result.error) throw result.error;
      if (!result.data.session) {
        result = await _sb.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
      }
    } else {
      result = await _sb.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
    }
  } catch (e) {
    try { window.KroniaIntelligence?.track?.({ module: 'auth', action: 'login', status: 'error', correlationId, durationMs: Date.now() - loginStart, severity: 'medium', source: 'auth_email', metadata: { reason: e?.message || 'unknown' } }); } catch (_) {}
    errEl.style.color = '#f87171';
    errEl.textContent = e.message === 'Invalid login credentials'
      ? 'E-mail ou senha incorretos.'
      : e.message;
  } finally {
    btn.textContent = _loginIsRegister ? 'Criar conta' : 'Entrar';
    btn.disabled = false;
  }
}

async function authSignInGoogle() {
  const btn = document.getElementById('btnGoogle');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; }
  try {
    const oauthOptions = resolveOAuthOptions();
    const { data, error } = await _sb.auth.signInWithOAuth({
      provider: 'google',
      options: oauthOptions
    });

    if (!error && oauthOptions.skipBrowserRedirect && data?.url) {
      window.location.href = data.url;
      return;
    }

    if (error) {
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
      const errEl = document.getElementById('loginError');
      if (errEl) { errEl.style.color = '#f87171'; errEl.textContent = error.message; }
      else alert('Erro Google: ' + error.message);
    }
    // Se OK, Supabase redireciona — não precisa fazer nada
  } catch(e) {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    alert('Erro ao conectar com Google: ' + e.message);
  }
}

function toggleAuthMenu() {
  const menu = document.getElementById('authMenu');
  if (!menu) return;
  _authMenuOpen = !_authMenuOpen;
  menu.style.display = _authMenuOpen ? 'block' : 'none';
}

function closeAuthMenu() {
  _authMenuOpen = false;
  const menu = document.getElementById('authMenu');
  if (menu) menu.style.display = 'none';
}

async function authSignOut() {
  await _sb.auth.signOut();
  closeAuthMenu();
  _appUnlocked = false;
  // Esconde home e mostra login
  const home = document.getElementById('homeScreen');
  if (home) home.classList.remove('show');
  showLogin();
  showToast('Saiu da conta.', 'success', 3000);
}

document.addEventListener('click', function(e) {
  if (_authMenuOpen && !e.target.closest('#authMenu') && !e.target.closest('#authBtn')) {
    closeAuthMenu();
  }
});

// Splash: imagem estática tela cheia

// Ouvir mudanças de sessão
_sb.auth.onAuthStateChange((_event, session) => {
  updateAuthUI(session?.user || null);
  if (session?.user) {
    const firstLoad = !_appUnlocked;
    showApp();
    if (firstLoad) { navTo('inicio'); openHome(); }
    refreshIntelligenceAdminAccessSafe();
    bootstrapAuthenticatedSession(session);
  } else if (_appUnlocked) {
    _appUnlocked = false;
    refreshIntelligenceAdminAccessSafe();
    showLogin();
  }
});

// Checar sessão ao carregar — após splash (mín 2.5s)
Promise.all([
  _sb.auth.getSession(),
  new Promise(r => setTimeout(r, 4000))
]).then(async ([{ data: { session } }]) => {
  updateAuthUI(session?.user || null);
  if (session?.user) {
    const firstLoad = !_appUnlocked;
    showApp();
    if (firstLoad) { navTo('inicio'); openHome(); }
    bootstrapAuthenticatedSession(session);
  } else {
    refreshIntelligenceAdminAccessSafe();
    showLogin();
  }
}).catch(() => {
  refreshIntelligenceAdminAccessSafe();
  showLogin();
});

window.KroniaAuth = window.KroniaAuth || {};
window.KroniaAuth.setOAuthRedirectTo = function setOAuthRedirectTo(url) {
  if (typeof url !== 'string' || !url.trim()) return;
  localStorage.setItem('kronia_oauth_redirect_to', url.trim());
};
window.KroniaAuth.getOAuthRedirectTo = function getOAuthRedirectTo() {
  return resolveOAuthRedirectUrl() || KRONIA_DEFAULT_MOBILE_REDIRECT;
};
